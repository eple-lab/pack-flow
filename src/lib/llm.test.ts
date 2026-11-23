/**
 * llm.ts 단위 테스트 — 제공자 3개(fake · ollama · gemini), 시간 초과, 호출 상한, 로그.
 *
 * 하는 일
 * 1. 기대 결과(돌려주는 값 · 던지는 오류 코드 · 부르는 주소와 본문)를 먼저 적고 비교한다(D-34).
 * 2. 실제 LLM · DB는 부르지 않는다. fetch · 상한 함수 · 설정은 인자로 끼워 넣는다.
 * 3. 일부러 실패해야 하는 경우(시간 초과 · HTTP 오류 · 빈 응답 · 상한 초과 · 설정 누락)를 넣는다.
 * 4. 프롬프트 전문 · 키가 로그에 남지 않는지 확인한다(WU-31 하지 말 것).
 *
 * 근거: docs/work-units/WU-31-llm.md · docs/04-api-contract.md 2 · 4.6 · docs/02-decisions.md P-08 · P-09 · T-AI-6 · T-AI-7
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — fake · ollama · gemini · 시간 초과 · 상한 · 로그 시험 (WU-31)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PfError } from '@/lib/api/errors';
import type { ServerEnv } from '@/lib/env-server';
import { generate, setFakeLlmResponder, type LlmDeps, type LlmRequest } from './llm';

// llm.ts가 가져오는 server-only · Supabase 서버 클라이언트는 일반 Node에서 못 읽으므로 비워 둔다
vi.mock('server-only', () => ({}));
const createServerSupabase = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: () => createServerSupabase() }));

const REQUEST: LlmRequest = { system: '시스템 지시', user: '사용자 질문' };

function env(over: Partial<ServerEnv> = {}): ServerEnv {
  return {
    llmProvider: 'fake',
    llmModel: 'test-model',
    ollamaBaseUrl: 'http://ollama.test:11434',
    geminiApiKey: null,
    llmLimitUser: 30,
    llmLimitGlobal: 300,
    ...over,
  };
}

/** 상한 함수 자리: 아무 일도 안 한다. */
const noQuota = () => Promise.resolve();

/** fetch 가짜: 마지막 호출의 주소 · 요청을 기록한다. */
function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const record = { url: String(url), init: init ?? {} };
    calls.push(record);
    return respond(record.url, record.init);
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** generate가 던진 PfError의 코드와 detail. 안 던지면 null. */
async function failureOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PfError) return { code: error.code, detail: error.detail };
    throw error;
  }
  return null;
}

function deps(over: Partial<LlmDeps> = {}): Partial<LlmDeps> {
  return { env: env(), takeQuota: noQuota, ...over };
}

beforeEach(() => {
  setFakeLlmResponder(null);
  createServerSupabase.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('L: fake 제공자 · 시간 초과 · 상한', () => {
  it('L-1 fake가 정한 응답을 돌려주고, 상한 함수를 설정 숫자(30 · 300)로 한 번 부른다', async () => {
    setFakeLlmResponder(() => '{"ok":true}');
    const takeQuota = vi.fn(noQuota);
    const result = await generate({ ...REQUEST, json: true }, deps({ takeQuota }));
    expect(result.text).toBe('{"ok":true}');
    expect(result.provider).toBe('fake');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(takeQuota).toHaveBeenCalledTimes(1);
    expect(takeQuota).toHaveBeenCalledWith({ user: 30, global: 300 });
  });

  it('L-2 fake가 요청 내용을 받아 입력에 따라 다른 응답을 낸다', async () => {
    setFakeLlmResponder((request) => (request.user.includes('PRD-001') ? '재고 4개' : '모르겠어요'));
    const a = await generate({ system: 's', user: 'PRD-001 재고 몇 개야?' }, deps());
    const b = await generate({ system: 's', user: '날씨 어때?' }, deps());
    expect([a.text, b.text]).toEqual(['재고 4개', '모르겠어요']);
  });

  it('L-3 T-AI-6 응답이 시간 안에 안 오면 PF_LLM_UNAVAILABLE (서버는 안 죽는다)', async () => {
    setFakeLlmResponder(() => new Promise<string>(() => {}));
    const started = Date.now();
    const failure = await failureOf(generate(REQUEST, deps({ timeoutMs: 30 })));
    expect(failure).toEqual({ code: 'PF_LLM_UNAVAILABLE', detail: null });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('L-4 T-AI-7 상한 1이면 첫 호출은 되고 두 번째는 PF_QUOTA_EXCEEDED, 두 번째는 LLM을 부르지 않는다', async () => {
    const responder = vi.fn(() => '응답');
    setFakeLlmResponder(responder);
    let used = 0;
    const takeQuota: LlmDeps['takeQuota'] = async (limits) => {
      if (used >= limits.user) throw new PfError('PF_QUOTA_EXCEEDED', { scope: 'user' });
      used += 1;
    };
    const options = deps({ env: env({ llmLimitUser: 1 }), takeQuota });

    expect((await generate(REQUEST, options)).text).toBe('응답');
    const second = await failureOf(generate(REQUEST, options));
    expect(second).toEqual({ code: 'PF_QUOTA_EXCEEDED', detail: { scope: 'user' } });
    expect(responder).toHaveBeenCalledTimes(1);
  });

  it('L-5 빈 응답(공백뿐)이면 PF_LLM_UNAVAILABLE', async () => {
    setFakeLlmResponder(() => '   \n ');
    expect(await failureOf(generate(REQUEST, deps()))).toEqual({ code: 'PF_LLM_UNAVAILABLE', detail: null });
  });

  it('L-6 제공자 쪽에서 오류를 던져도 PF_LLM_UNAVAILABLE로 바뀐다(원문 오류는 밖으로 안 나간다)', async () => {
    setFakeLlmResponder(() => {
      throw new Error('내부 사정 원문');
    });
    const failure = await failureOf(generate(REQUEST, deps()));
    expect(failure).toEqual({ code: 'PF_LLM_UNAVAILABLE', detail: null });
  });
});

describe('O: ollama 제공자', () => {
  const ollamaEnv = () => env({ llmProvider: 'ollama', llmModel: 'qwen-test' });

  it('O-1 /api/chat에 모델 · system · user · stream=false로 부르고 message.content를 돌려준다', async () => {
    const { fetch, calls } = fakeFetch(() => json({ message: { role: 'assistant', content: '안녕하세요' } }));
    const result = await generate(REQUEST, deps({ env: ollamaEnv(), fetch }));
    expect(result).toMatchObject({ text: '안녕하세요', provider: 'ollama' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://ollama.test:11434/api/chat');
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.model).toBe('qwen-test');
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual([
      { role: 'system', content: '시스템 지시' },
      { role: 'user', content: '사용자 질문' },
    ]);
    expect(body.format).toBeUndefined();
    // 생각(thinking) 모델은 기본값이면 토큰을 생각에 다 써서 content가 빈다 — 실제 qwen3.5로 확인(WU-31)
    expect(body.think).toBe(false);
  });

  it('O-2 json=true면 format=json, maxTokens는 num_predict로 넘긴다', async () => {
    const { fetch, calls } = fakeFetch(() => json({ message: { content: '{}' } }));
    await generate({ ...REQUEST, json: true, maxTokens: 256 }, deps({ env: ollamaEnv(), fetch }));
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.format).toBe('json');
    expect(body.options.num_predict).toBe(256);
  });

  it('O-3 HTTP 500 · 연결 실패 · JSON이 아닌 응답은 모두 PF_LLM_UNAVAILABLE', async () => {
    const http500 = fakeFetch(() => json({ error: 'boom' }, 500));
    const refused = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    const notJson = fakeFetch(() => new Response('<html>', { status: 200 }));
    for (const { fetch } of [http500, refused, notJson]) {
      expect(await failureOf(generate(REQUEST, deps({ env: ollamaEnv(), fetch })))).toEqual({
        code: 'PF_LLM_UNAVAILABLE',
        detail: null,
      });
    }
  });

  it('O-4 시간 초과 때 진행 중인 요청을 취소(abort)한다', async () => {
    let signal: AbortSignal | undefined;
    const { fetch } = fakeFetch((_url, init) => {
      signal = init.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const failure = await failureOf(generate(REQUEST, deps({ env: ollamaEnv(), fetch, timeoutMs: 30 })));
    expect(failure?.code).toBe('PF_LLM_UNAVAILABLE');
    expect(signal?.aborted).toBe(true);
  });

  it('O-5 content가 비었거나 없으면 PF_LLM_UNAVAILABLE', async () => {
    for (const body of [{ message: { content: '' } }, { message: {} }, {}]) {
      const { fetch } = fakeFetch(() => json(body));
      expect((await failureOf(generate(REQUEST, deps({ env: ollamaEnv(), fetch }))))?.code).toBe('PF_LLM_UNAVAILABLE');
    }
  });
});

describe('G: gemini 제공자', () => {
  const geminiEnv = () => env({ llmProvider: 'gemini', llmModel: 'gemini-test', geminiApiKey: 'test-key-abc' });

  it('G-1 모델 주소로 부르고, 키는 헤더에만 싣는다(주소에 없다), parts의 글자를 이어 돌려준다', async () => {
    const { fetch, calls } = fakeFetch(() =>
      json({ candidates: [{ content: { parts: [{ text: '발주' }, { text: '서 문안' }] } }] }),
    );
    const result = await generate(REQUEST, deps({ env: geminiEnv(), fetch }));
    expect(result).toMatchObject({ text: '발주서 문안', provider: 'gemini' });
    const call = calls[0];
    expect(call?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(call?.url).not.toContain('test-key-abc');
    expect((call?.init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key-abc');
    const body = JSON.parse(String(call?.init.body));
    expect(body.systemInstruction.parts[0].text).toBe('시스템 지시');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: '사용자 질문' }] }]);
    expect(body.generationConfig.responseMimeType).toBeUndefined();
  });

  it('G-2 json=true면 responseMimeType=application/json, maxTokens는 maxOutputTokens', async () => {
    const { fetch, calls } = fakeFetch(() => json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }));
    await generate({ ...REQUEST, json: true, maxTokens: 300 }, deps({ env: geminiEnv(), fetch }));
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.generationConfig).toEqual({ responseMimeType: 'application/json', maxOutputTokens: 300 });
  });

  it('G-3 400 · 403 · 429 · 503 응답, 후보 없음(차단), 글자 없음은 모두 PF_LLM_UNAVAILABLE', async () => {
    const bad = [
      fakeFetch(() => json({ error: { message: 'bad key' } }, 400)),
      fakeFetch(() => json({}, 403)),
      fakeFetch(() => json({}, 429)),
      fakeFetch(() => json({}, 503)),
      fakeFetch(() => json({ candidates: [] })),
      fakeFetch(() => json({ candidates: [{ content: { parts: [{ text: '' }] } }] })),
    ];
    for (const { fetch } of bad) {
      expect((await failureOf(generate(REQUEST, deps({ env: geminiEnv(), fetch }))))?.code).toBe('PF_LLM_UNAVAILABLE');
    }
  });
});

describe('C: 설정 누락 · 상한 함수 연결 · 로그', () => {
  it('C-1 모델 이름이 비어 있으면 LLM도 상한도 부르지 않고 PF_LLM_UNAVAILABLE', async () => {
    const { fetch } = fakeFetch(() => json({ message: { content: 'x' } }));
    const takeQuota = vi.fn(noQuota);
    const failure = await failureOf(
      generate(REQUEST, deps({ env: env({ llmProvider: 'ollama', llmModel: '' }), fetch, takeQuota })),
    );
    expect(failure?.code).toBe('PF_LLM_UNAVAILABLE');
    expect(fetch).not.toHaveBeenCalled();
    expect(takeQuota).not.toHaveBeenCalled();
  });

  it('C-2 기본 상한 함수는 사용자 JWT 클라이언트로 pf_llm_take(30, 300)을 부른다', async () => {
    const rpc = vi.fn(async () => ({ data: 1, error: null }));
    createServerSupabase.mockResolvedValue({ rpc });
    setFakeLlmResponder(() => '응답');
    const result = await generate(REQUEST, { env: env() });
    expect(result.text).toBe('응답');
    expect(rpc).toHaveBeenCalledWith('pf_llm_take', { p_user_limit: 30, p_global_limit: 300 });
  });

  it('C-3 DB가 PF_QUOTA_EXCEEDED(scope)를 주면 그대로 던지고 LLM은 부르지 않는다', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'PF_QUOTA_EXCEEDED', details: '{"scope":"global"}' },
    }));
    createServerSupabase.mockResolvedValue({ rpc });
    const responder = vi.fn(() => '응답');
    setFakeLlmResponder(responder);
    const failure = await failureOf(generate(REQUEST, { env: env() }));
    expect(failure).toEqual({ code: 'PF_QUOTA_EXCEEDED', detail: { scope: 'global' } });
    expect(responder).not.toHaveBeenCalled();
  });

  it('C-4 로그인 안 된 요청(PF_UNAUTHENTICATED)은 그 코드 그대로 던진다', async () => {
    createServerSupabase.mockResolvedValue({
      rpc: async () => ({ data: null, error: { message: 'PF_UNAUTHENTICATED', details: null } }),
    });
    expect((await failureOf(generate(REQUEST, { env: env() })))?.code).toBe('PF_UNAUTHENTICATED');
  });

  it('C-5 실패 로그에 프롬프트 전문 · 키 · 원문 오류가 남지 않고, 제공자 · 이유 · 길이는 남는다', async () => {
    const lines: string[] = [];
    for (const method of ['log', 'warn', 'error'] as const) {
      vi.spyOn(console, method).mockImplementation((line) => void lines.push(String(line)));
    }
    const { fetch } = fakeFetch(() => json({ error: { message: 'the key test-key-abc is invalid' } }, 403));
    await failureOf(
      generate(
        { system: '비밀 시스템 문장 ZZZ-SYSTEM', user: '비밀 질문 문장 ZZZ-USER' },
        deps({ env: env({ llmProvider: 'gemini', llmModel: 'gemini-test', geminiApiKey: 'test-key-abc' }), fetch }),
      ),
    );
    const logged = lines.join('\n');
    expect(logged).not.toContain('ZZZ-SYSTEM');
    expect(logged).not.toContain('ZZZ-USER');
    expect(logged).not.toContain('test-key-abc');
    expect(logged).toContain('PF_LLM_UNAVAILABLE');
    expect(logged).toContain('gemini');
    expect(logged).toMatch(/"status":403/);
    expect(logged).toMatch(/"promptLen":\d+/);
  });
});
