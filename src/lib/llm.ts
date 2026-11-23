/**
 * LLM 호출 래퍼 — 제공자(gemini · ollama · fake)를 설정값으로 바꿔 부르는 한 곳.
 *
 * 하는 일
 * 1. `generate()` 하나로 어느 제공자든 같은 모양(`{ text, provider, latencyMs }`)을 돌려준다(D-06).
 *    제공자는 환경변수 LLM_PROVIDER, 모델은 LLM_MODEL. fake는 테스트가 응답을 끼워 넣는다.
 * 2. 호출 전에 사용자 JWT 클라이언트로 `pf_llm_take(상한)`을 부른다. 넘으면 PF_QUOTA_EXCEEDED(P-09).
 *    설정 누락은 상한을 쓰기 전에 걸러서, 잘못된 설정이 하루 호출 수를 깎지 않게 한다.
 * 3. 20초 안에 응답이 없거나 네트워크 · HTTP 오류 · 빈 응답이면 PF_LLM_UNAVAILABLE(P-08, 04 4.6).
 *    원문 오류 · 응답 본문은 밖으로 내보내지 않고, 로그에는 제공자 · 이유 · 상태 · 길이 · 지연만 남긴다.
 * 4. 키는 gemini 요청 헤더에만 싣는다(주소 · 로그에 없다). 프롬프트 전문은 로그에 남기지 않는다.
 *
 * 서버에서만 쓴다(`import 'server-only'`). 호출하는 쪽이 LLM 실패를 200 + llm_error로 바꾸는 것(WU-33)은 여기 일이 아니다.
 *
 * 근거: docs/04-api-contract.md 3.8 · 4.6, docs/02-decisions.md D-06 · P-08 · P-09, docs/05-security.md 2 · 4절, WU-31
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple     자리 생성 (WU-04) — 구현은 skygaul WU-31
 * 2026-11-23  skygaul  처음 구현 — 제공자 3종 · 시간 초과 · 호출 상한 · 안전한 로그 (WU-31)
 */
import 'server-only';
import { PfError, fromSupabaseError } from '@/lib/api/errors';
import { EnvError } from '@/lib/env';
import { getServerEnv, type LlmProviderSetting, type ServerEnv } from '@/lib/env-server';
import { log } from '@/lib/log';
import { createServerSupabase } from '@/lib/supabase/server';
import type { ServerErrorCode } from '@/types/erp';

/** LLM 응답을 기다리는 최대 시간(밀리초). 04 4.6: 서버 쪽 20초. */
export const LLM_TIMEOUT_MS = 20_000;

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** LLM에 보낼 요청. 프롬프트 전문은 로그에 남기지 않는다(길이만). */
export type LlmRequest = {
  /** 시스템 지시문 (src/lib/agent/prompts/) */
  system: string;
  /** 사용자 입력 또는 코드가 만든 사실표 */
  user: string;
  /** 구조화 응답(JSON)을 요구할 때의 힌트. 검증은 부르는 쪽 스키마가 한다 */
  json?: boolean;
  /** 응답 길이 상한(토큰). 비우면 제공자 기본값 */
  maxTokens?: number;
};

/** LLM 응답. */
export type LlmResponse = {
  text: string;
  provider: LlmProviderSetting;
  /** 호출 지연(밀리초) — 로그용 */
  latencyMs: number;
};

/** 시험에서 끼워 넣을 수 있는 바깥 의존. 비우면 실제 값을 쓴다. */
export type LlmDeps = {
  env: ServerEnv;
  /** 호출 전 상한 확인. 넘으면 PfError(PF_QUOTA_EXCEEDED) */
  takeQuota: (limits: { user: number; global: number }) => Promise<void>;
  fetch: typeof fetch;
  timeoutMs: number;
  now: () => number;
};

/** fake 제공자가 응답을 만드는 함수. 시험이 `setFakeLlmResponder`로 끼워 넣는다. */
export type FakeLlmResponder = (request: LlmRequest) => string | Promise<string>;

let fakeResponder: FakeLlmResponder | null = null;

/**
 * fake 제공자의 응답 함수를 정한다(시험용). null이면 기본 응답(`{}` 또는 `(fake)`)으로 돌아간다.
 * 부작용: 모듈 전역 상태를 바꾼다 — 시험마다 `beforeEach`에서 null로 되돌릴 것.
 */
export function setFakeLlmResponder(responder: FakeLlmResponder | null): void {
  fakeResponder = responder;
}

/** 실패 이유. 로그에만 쓰고 응답에는 싣지 않는다. */
type FailureReason = 'timeout' | 'http_status' | 'bad_body' | 'empty' | 'exception';

class LlmFailure extends Error {
  readonly reason: FailureReason;
  readonly status: number | null;

  constructor(reason: FailureReason, status: number | null = null) {
    super(reason); // 원문 메시지는 담지 않는다
    this.name = 'LlmFailure';
    this.reason = reason;
    this.status = status;
  }
}

/** PF_LLM_UNAVAILABLE 오류를 만든다(문구는 04 4.4가 정한다). */
function unavailable(): PfError {
  return new PfError('PF_LLM_UNAVAILABLE');
}

/** 기본 상한 확인: 사용자 JWT 클라이언트로 `pf_llm_take`를 부른다. DB 오류 코드는 그대로 PfError로 옮긴다. */
async function takeQuotaFromDb(limits: { user: number; global: number }): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('pf_llm_take', {
    p_user_limit: limits.user,
    p_global_limit: limits.global,
  });
  if (error) {
    const { body } = fromSupabaseError(error);
    throw new PfError(body.error.code as ServerErrorCode, body.error.detail ?? null);
  }
}

/** 설정을 읽는다. 환경변수가 틀리면 로그(변수 이름만)를 남기고 PF_LLM_UNAVAILABLE로 바꾼다. */
function resolveDeps(overrides: Partial<LlmDeps>): LlmDeps {
  let env = overrides.env;
  if (env === undefined) {
    try {
      env = getServerEnv();
    } catch (error) {
      log.error('llm.config', {
        code: 'PF_LLM_UNAVAILABLE',
        reason: 'env_invalid',
        missing: error instanceof EnvError ? error.missing : [],
      });
      throw unavailable();
    }
  }
  return {
    env,
    takeQuota: overrides.takeQuota ?? takeQuotaFromDb,
    fetch: overrides.fetch ?? fetch,
    timeoutMs: overrides.timeoutMs ?? LLM_TIMEOUT_MS,
    now: overrides.now ?? Date.now,
  };
}

/** `run`이 시간 안에 끝나지 않으면 요청을 취소(abort)하고 timeout 실패를 던진다. */
async function runWithTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LlmFailure('timeout'));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 응답을 JSON으로 읽는다. 상태가 2xx가 아니거나 JSON이 아니면 실패(본문은 읽어도 밖에 안 낸다). */
async function readJsonBody(response: Response): Promise<unknown> {
  if (!response.ok) throw new LlmFailure('http_status', response.status);
  try {
    return await response.json();
  } catch {
    throw new LlmFailure('bad_body');
  }
}

/** Ollama `/api/chat`: `message.content`가 답이다. */
async function callOllama(request: LlmRequest, env: ServerEnv, fetchFn: typeof fetch, signal: AbortSignal): Promise<string> {
  const response = await fetchFn(`${env.ollamaBaseUrl.replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.llmModel,
      stream: false,
      // 생각(thinking) 모델이 max 토큰을 생각에 다 써서 content가 빈 채 끝나는 것을 막는다.
      // 실제 qwen3.5:0.8b로 확인: 기본값은 200토큰이 모두 thinking(content 빈 글자), think=false는 35토큰에 JSON 답
      think: false,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      ...(request.json ? { format: 'json' } : {}),
      ...(request.maxTokens !== undefined ? { options: { num_predict: request.maxTokens } } : {}),
    }),
    signal,
  });
  const data = await readJsonBody(response);
  const message = isRecord(data) ? data.message : undefined;
  return isRecord(message) && typeof message.content === 'string' ? message.content : '';
}

/** Gemini `generateContent`: 첫 후보의 글자 조각을 이어 붙인다. 키는 헤더로만 보낸다. */
async function callGemini(request: LlmRequest, env: ServerEnv, fetchFn: typeof fetch, signal: AbortSignal): Promise<string> {
  const generationConfig = {
    ...(request.json ? { responseMimeType: 'application/json' } : {}),
    ...(request.maxTokens !== undefined ? { maxOutputTokens: request.maxTokens } : {}),
  };
  const response = await fetchFn(`${GEMINI_BASE_URL}/${encodeURIComponent(env.llmModel)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.geminiApiKey ?? '' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts: [{ text: request.user }] }],
      generationConfig,
    }),
    signal,
  });
  const data = await readJsonBody(response);
  const candidates = isRecord(data) && Array.isArray(data.candidates) ? data.candidates : [];
  const content = isRecord(candidates[0]) ? candidates[0].content : undefined;
  const parts = isRecord(content) && Array.isArray(content.parts) ? content.parts : [];
  return parts
    .map((part) => (isRecord(part) && part.thought !== true && typeof part.text === 'string' ? part.text : ''))
    .join('');
}

/** fake: 시험이 끼워 넣은 함수의 답. 없으면 기본 응답. */
async function callFake(request: LlmRequest): Promise<string> {
  if (fakeResponder) return fakeResponder(request);
  return request.json ? '{}' : '(fake)';
}

/**
 * LLM에 한 번 묻는다.
 *
 * 순서: 설정 확인 → 상한 확인(`pf_llm_take`, 호출 수 +1) → 제공자 호출(20초 제한) → 빈 응답 검사.
 * 상한을 쓴 뒤 호출이 실패해도 호출 수는 돌려주지 않는다(시도도 한도에 센다).
 *
 * @param request system · user 글자와 선택 힌트(json · maxTokens)
 * @param overrides 시험용으로 설정 · fetch · 상한 함수 · 시간 제한을 바꿔 끼운다
 * @returns 답 글자와 제공자 · 지연. json=true여도 JSON 검증은 부르는 쪽 몫이다
 * @throws PfError PF_QUOTA_EXCEEDED(상한) · PF_UNAUTHENTICATED(로그인 안 됨) · PF_LLM_UNAVAILABLE(설정 · 시간 초과 · 오류 · 빈 응답)
 */
export async function generate(request: LlmRequest, overrides: Partial<LlmDeps> = {}): Promise<LlmResponse> {
  const deps = resolveDeps(overrides);
  const { env } = deps;
  const provider = env.llmProvider;
  const promptLen = request.system.length + request.user.length;

  // 설정이 틀리면 상한을 쓰기 전에 멈춘다
  const missing =
    provider !== 'fake' && env.llmModel === ''
      ? 'LLM_MODEL'
      : provider === 'gemini' && !env.geminiApiKey
        ? 'GEMINI_API_KEY'
        : null;
  if (missing !== null) {
    log.error('llm.config', { code: 'PF_LLM_UNAVAILABLE', provider, reason: 'config_missing', missing: [missing] });
    throw unavailable();
  }

  await deps.takeQuota({ user: env.llmLimitUser, global: env.llmLimitGlobal });

  const startedAt = deps.now();
  try {
    const text = await runWithTimeout(deps.timeoutMs, (signal) => {
      if (provider === 'ollama') return callOllama(request, env, deps.fetch, signal);
      if (provider === 'gemini') return callGemini(request, env, deps.fetch, signal);
      return callFake(request);
    });
    if (text.trim() === '') throw new LlmFailure('empty');
    const latencyMs = deps.now() - startedAt;
    log.info('llm.ok', { provider, ms: latencyMs, promptLen, textLen: text.length });
    return { text, provider, latencyMs };
  } catch (error) {
    const failure = error instanceof LlmFailure ? error : new LlmFailure('exception');
    log.warn('llm.failed', {
      code: 'PF_LLM_UNAVAILABLE',
      provider,
      reason: failure.reason,
      status: failure.status,
      ms: deps.now() - startedAt,
      promptLen,
    });
    throw unavailable();
  }
}
