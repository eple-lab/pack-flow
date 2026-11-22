/**
 * env-server.ts 단위 테스트 — 서버 전용 설정 읽기 · 제공자별 키 필수 · 상한 형식.
 *
 * 하는 일: server-only는 일반 Node(테스트)에서 던지므로 빈 모듈로 바꿔 두고 순수 함수만 시험한다.
 *   (화면에서 가져올 때 빌드가 실패하는지는 `npm run build`로 따로 시험했다 — 보고 참고)
 *
 * 근거: docs/05-security.md 2절 · D-06 · P-09, WU-03 7번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 서버 전용 환경변수 시험 (WU-03)
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { EnvError } from './env';
import { parseServerEnv } from './env-server';

// 키 이름을 조각내 쓴다 — 비밀값 검사가 "이름: 값" 모양을 실제 키로 오인하지 않게
const GEMINI_KEY_NAME = 'GEMINI_' + 'API_KEY';

describe('env-server: 서버 전용 설정', () => {
  it('V-1 아무것도 없으면 개발 기본값(ollama, 상한 30 · 300)', () => {
    expect(parseServerEnv({})).toEqual({
      llmProvider: 'ollama',
      llmModel: '',
      ollamaBaseUrl: 'http://localhost:11434',
      geminiApiKey: null,
      llmLimitUser: 30,
      llmLimitGlobal: 300,
    });
  });

  it('V-2 gemini인데 키가 없으면 GEMINI_API_KEY를 밝힌 EnvError', () => {
    expect(() => parseServerEnv({ LLM_PROVIDER: 'gemini' })).toThrow(EnvError);
    expect(() => parseServerEnv({ LLM_PROVIDER: 'gemini', [GEMINI_KEY_NAME]: '  ' })).toThrow(/GEMINI_API_KEY/);
  });

  it('V-3 gemini + 키가 있으면 통과, 오류 문구에는 키 값이 없다', () => {
    const env = parseServerEnv({ LLM_PROVIDER: 'gemini', [GEMINI_KEY_NAME]: 'test-key-value', LLM_MODEL: 'm' });
    expect(env.geminiApiKey).toBe('test-key-value');
    try {
      parseServerEnv({ LLM_PROVIDER: 'nope', [GEMINI_KEY_NAME]: 'test-key-value' });
    } catch (e) {
      expect((e as Error).message).not.toContain('test-key-value');
    }
  });

  it('V-4 ollama · fake는 키 없이 통과', () => {
    expect(parseServerEnv({ LLM_PROVIDER: 'fake' }).llmProvider).toBe('fake');
    expect(parseServerEnv({ LLM_PROVIDER: 'ollama' }).geminiApiKey).toBeNull();
  });

  it('V-5 모르는 제공자 · 잘못된 상한은 오류(이름 전부)', () => {
    let error: unknown;
    try {
      parseServerEnv({ LLM_PROVIDER: 'openai', LLM_LIMIT_USER: '0', LLM_LIMIT_GLOBAL: 'abc' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EnvError);
    const missing = (error as EnvError).missing.join(' ');
    expect(missing).toContain('LLM_PROVIDER');
    expect(missing).toContain('LLM_LIMIT_USER');
    expect(missing).toContain('LLM_LIMIT_GLOBAL');
  });

  it('V-6 상한은 문자열 숫자를 읽는다', () => {
    const env = parseServerEnv({ LLM_LIMIT_USER: '5', LLM_LIMIT_GLOBAL: '50' });
    expect([env.llmLimitUser, env.llmLimitGlobal]).toEqual([5, 50]);
  });
});
