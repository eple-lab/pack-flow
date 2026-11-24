/**
 * 회귀 실행기 · 측정 스크립트의 공통 도우미 — 환경변수 읽기, 테스트 계정 로그인(쿠키 세션), 시드 초기화.
 *
 * 하는 일
 * 1. .env.local을 한 번 읽는다(Node 24 process.loadEnvFile). 값은 어디에도 출력하지 않는다.
 * 2. loginWithCookies: 테스트 계정으로 로그인하고, 서버가 읽는 쿠키 세션(@supabase/ssr 형식)을 Cookie 헤더로 돌려준다.
 *    → 배포 · 로컬 서버의 GET /api/*에 사용자 JWT 세션을 그대로 싣는다. 서비스 키는 쓰지 않는다(D-20).
 * 3. resetSeed: pf_reset_and_seed를 사용자 JWT로 부른다(본인 데이터만). tests/db/helpers.ts의 resetAndSeed와 같은 DB 함수다.
 *    그 파일은 '@/' 별칭을 써서 node가 직접 못 읽으므로, 같은 동작을 여기서 별칭 없이 한다.
 * 4. 이 파일은 node로 직접 돌아가는 스크립트용이라 순수 함수가 아니다(시험은 report.ts 쪽에 있다).
 *
 * 근거: docs/work-units/WU-45-regression-runner.md · tests/db/helpers.ts · docs/05-security.md
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 환경 읽기 · 쿠키 로그인 · 시드 초기화 (WU-45)
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/** 저장소 루트(이 파일은 scripts/regression/ 에 있다). */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** 시드 이름(src/types/erp.ts의 SEED_DATASETS와 같다). */
export type SeedName = 'demo' | 'small' | 'large';

/** .env.local을 읽는다. 없으면 아무것도 하지 않는다. 이미 있는 환경변수는 덮어쓰지 않는다. */
export function loadLocalEnv(): void {
  const file = `${REPO_ROOT}.env.local`;
  if (!existsSync(file)) return;
  try {
    process.loadEnvFile(file);
  } catch {
    // 형식이 깨졌으면 무시한다. 빠진 값은 requireEnv가 이름으로 알려 준다.
  }
}

/** 이름 목록의 환경변수가 모두 있어야 한다. 없으면 빠진 이름만 적은 Error(값은 없음). */
export function requireEnv(names: string[]): void {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`환경변수가 비어 있습니다: ${missing.join(', ')}. .env.local을 채우세요(.env.example 참고).`);
  }
}

/** 결과 파일에서 가려야 할 실제 값들(테스트 계정 · 공개 키). redact()의 secrets 인자로 넘긴다. */
export function secretValues(): string[] {
  const names = [
    'TEST_USER_A_EMAIL',
    'TEST_USER_A_PASSWORD',
    'TEST_USER_B_EMAIL',
    'TEST_USER_B_PASSWORD',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];
  return names.map((name) => process.env[name]?.trim() ?? '').filter((v) => v.length >= 4);
}

/** 대상 서버 주소. E2E_BASE_URL이 비면 로컬 개발 서버. 끝의 / 는 뗀다. */
export function baseUrl(): string {
  return (process.env.E2E_BASE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
}

/** 로그인한 클라이언트와 요청에 실을 Cookie 헤더 값. */
export type CookieSession = { client: SupabaseClient; cookieHeader: () => string };

/**
 * 테스트 계정 A로 로그인한다. 세션 쿠키는 @supabase/ssr이 쓰는 형식(이름 · 값 조각 나눔 포함)을 그대로 쓴다.
 * 던지는 오류: Error — 환경변수 빠짐(이름만), 로그인 실패(계정 표시만, 이메일 · 비밀번호 없음).
 */
export async function loginWithCookies(which: 'A' | 'B' = 'A'): Promise<CookieSession> {
  loadLocalEnv();
  const emailName = `TEST_USER_${which}_EMAIL`;
  const passwordName = `TEST_USER_${which}_PASSWORD`;
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', emailName, passwordName]);

  const jar = new Map<string, string>();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          // 값이 비었거나 만료로 지우라는 쿠키는 항아리에서 뺀다
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env[emailName]!.trim(),
    password: process.env[passwordName]!,
  });
  if (error || !data.session) throw new Error(`테스트 계정 ${which} 로그인 실패`);

  // 서버는 Cookie 헤더를 decodeURIComponent로 읽으므로 값을 인코딩해서 싣는다.
  const cookieHeader = (): string => [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
  return { client, cookieHeader };
}

/** 시드를 읽어 초기화한다(본인 데이터만). 돌려주는 건수는 DB 함수가 센 값. */
export async function resetSeed(
  client: SupabaseClient,
  name: SeedName,
): Promise<{ items: number; purchases: number; sales: number; logs: number }> {
  const data = JSON.parse(readFileSync(`${REPO_ROOT}src/lib/seed/${name}.json`, 'utf8')) as Record<string, unknown>;
  const { data: result, error } = await client.rpc('pf_reset_and_seed', { p_data: data });
  if (error) throw new Error(`시드 초기화 실패 (${name}): ${error.code ?? '오류'}`);
  return result as { items: number; purchases: number; sales: number; logs: number };
}
