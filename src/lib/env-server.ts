/**
 * 서버 전용 환경변수 — 화면 코드가 가져오면 빌드가 실패한다.
 *
 * 하는 일
 * 1. 첫 줄의 `import 'server-only'`가 핵심이다. 'use client' 컴포넌트(또는 그것이 가져오는 파일)가 이 파일을
 *    가져오면 `next build`가 막힌다 — 키가 브라우저 번들로 새는 것을 빌드 단계에서 막는 장치.
 * 2. LLM 설정(제공자 · 모델 · 주소 · 키 · 호출 상한)을 읽고 검사한다. 키는 값을 돌려주되 로그 · 오류에 싣지 않는다.
 * 3. gemini 제공자일 때만 GEMINI_API_KEY가 필수다. ollama · fake는 키 없이 돈다(개발 · 테스트).
 * 4. 서비스 키(SUPABASE_SERVICE_ROLE_KEY)는 읽지 않는다 — `src/`에 서비스 키 코드를 두지 않는다(AGENTS.md 3절 3번).
 *
 * 근거: docs/05-security.md 2절 · D-06 · D-20 · P-09, WU-03 7번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 서버 전용 환경변수(server-only) (WU-03)
 */
import 'server-only';
import { EnvError } from '@/lib/env';

/** LLM 제공자(D-06): 개발 ollama, 배포 gemini, 테스트 fake. */
export const LLM_PROVIDERS = ['gemini', 'ollama', 'fake'] as const;
export type LlmProviderSetting = (typeof LLM_PROVIDERS)[number];

/** 서버 전용 설정 묶음. */
export type ServerEnv = {
  llmProvider: LlmProviderSetting;
  llmModel: string;
  ollamaBaseUrl: string;
  /** gemini일 때만 있다. 로그 · 응답에 싣지 않는다 */
  geminiApiKey: string | null;
  /** 사용자당 하루 호출 상한 (P-09 기본 30) */
  llmLimitUser: number;
  /** 앱 전체 하루 호출 상한 (P-09 기본 300) */
  llmLimitGlobal: number;
};

function readLimit(raw: string | undefined, fallback: number, name: string, errors: string[]): number {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) {
    errors.push(`${name}(1 이상의 정수)`);
    return fallback;
  }
  return n;
}

/**
 * 주어진 원본에서 서버 전용 설정을 읽고 검사한다(순수 함수 — 테스트용).
 * @throws EnvError 빠졌거나 형식이 틀린 변수 이름 전부(값은 담지 않는다)
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const errors: string[] = [];

  const rawProvider = source.LLM_PROVIDER?.trim() || 'ollama';
  let provider: LlmProviderSetting = 'ollama';
  if ((LLM_PROVIDERS as readonly string[]).includes(rawProvider)) {
    provider = rawProvider as LlmProviderSetting;
  } else {
    errors.push('LLM_PROVIDER(gemini | ollama | fake)');
  }

  const geminiApiKey = source.GEMINI_API_KEY?.trim() || null;
  if (provider === 'gemini' && !geminiApiKey) errors.push('GEMINI_API_KEY');

  const llmLimitUser = readLimit(source.LLM_LIMIT_USER, 30, 'LLM_LIMIT_USER', errors);
  const llmLimitGlobal = readLimit(source.LLM_LIMIT_GLOBAL, 300, 'LLM_LIMIT_GLOBAL', errors);

  if (errors.length > 0) throw new EnvError(errors);

  return {
    llmProvider: provider,
    llmModel: source.LLM_MODEL?.trim() ?? '',
    ollamaBaseUrl: source.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434',
    geminiApiKey,
    llmLimitUser,
    llmLimitGlobal,
  };
}

let cached: ServerEnv | undefined;

/**
 * 서버 전용 설정을 돌려준다. 처음 부를 때 검사한다.
 * @throws EnvError
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
