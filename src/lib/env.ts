/**
 * 화면에서도 읽어도 되는(공개) 환경변수를 한곳에서 읽는다.
 *
 * 하는 일
 * 1. NEXT_PUBLIC_* 값만 다룬다. 브라우저 번들에 실려도 되는 값뿐이다(권한은 RLS가 막는다).
 * 2. 값이 빠지면 어느 변수인지 밝힌 오류를 던진다. 처음 부를 때 한 번 검사하고 결과를 쓴다.
 * 3. 서버 전용 값(GEMINI_API_KEY 등)은 여기에 없다 — `src/lib/env-server.ts`(import 'server-only')에 있어
 *    화면 코드가 가져오면 빌드가 실패한다.
 * 4. Next가 NEXT_PUBLIC_*을 번들에 넣으려면 `process.env.NEXT_PUBLIC_X`를 글자 그대로 써야 한다.
 *    (process.env[name] 같은 동적 접근은 브라우저에서 비어 있다.)
 *
 * 근거: docs/05-security.md 2절, docs/04-api-contract.md 5절, WU-03 7번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 공개 환경변수 읽기 (WU-03)
 */

/** 공개 환경변수 묶음. */
export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** NEXT_PUBLIC_USE_MOCK=1이면 api-client가 목 응답을 돌려준다 */
  useMock: boolean;
};

/** 빠진 환경변수 이름을 담은 오류. 값은 담지 않는다. */
export class EnvError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`환경변수가 비어 있어요: ${missing.join(', ')} (.env.example을 보고 .env.local을 채우세요)`);
    this.name = 'EnvError';
    this.missing = missing;
  }
}

/**
 * 주어진 원본에서 공개 환경변수를 읽고 검사한다(순수 함수 — 테스트용).
 * @throws EnvError 필수 값이 비었을 때(빠진 이름 전부)
 */
export function parsePublicEnv(source: {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_USE_MOCK?: string;
}): PublicEnv {
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const missing: string[] = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!key) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length > 0 || !url || !key) throw new EnvError(missing);
  return { supabaseUrl: url, supabaseAnonKey: key, useMock: source.NEXT_PUBLIC_USE_MOCK?.trim() === '1' };
}

let cached: PublicEnv | undefined;

/**
 * 공개 환경변수를 돌려준다. 처음 부를 때 검사하고, 빠졌으면 EnvError.
 * 부작용 없음(읽기만).
 * @throws EnvError
 */
export function getPublicEnv(): PublicEnv {
  cached ??= parsePublicEnv({
    // 글자 그대로 써야 Next가 번들에 값을 넣는다(위 4번)
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK,
  });
  return cached;
}

/**
 * 목 모드인가(NEXT_PUBLIC_USE_MOCK=1). Supabase 값이 없어도 물을 수 있다(화면 개발용).
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK?.trim() === '1';
}
