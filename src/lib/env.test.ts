/**
 * env.ts 단위 테스트 — 공개 환경변수 읽기 · 빠졌을 때 분명한 오류.
 *
 * 하는 일: 빠진 변수 이름이 오류에 전부 나오고 값은 나오지 않는지 본다.
 *
 * 근거: WU-03 7번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 공개 환경변수 시험 (WU-03)
 */
import { describe, expect, it } from 'vitest';
import { EnvError, parsePublicEnv } from './env';

describe('env: 공개 환경변수', () => {
  it('N-1 값이 모두 있으면 읽는다(앞뒤 공백 제거), 목 모드는 1일 때만', () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: ' https://x.example.test ', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k', NEXT_PUBLIC_USE_MOCK: '1' })).toEqual({
      supabaseUrl: 'https://x.example.test',
      supabaseAnonKey: 'k',
      useMock: true,
    });
    expect(parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k', NEXT_PUBLIC_USE_MOCK: '0' }).useMock).toBe(false);
    expect(parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' }).useMock).toBe(false);
  });

  it('N-2 빠지면 빠진 이름을 전부 적은 EnvError', () => {
    let error: unknown;
    try {
      parsePublicEnv({});
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EnvError);
    expect((error as EnvError).missing).toEqual(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    expect((error as EnvError).message).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('N-3 공백만 있는 값도 빠진 것으로 본다', () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: '   ' })).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
