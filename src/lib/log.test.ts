/**
 * log.ts 단위 테스트 — 이메일 · 키 모양 값이 로그 문자열에 남지 않는지.
 *
 * 하는 일: 기대(가려짐 · 남아야 하는 값)를 먼저 적고 formatLog 출력 문자열에서 찾는다.
 *
 * 근거: WU-03 7번 · AGENTS.md 3절
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 로그 가림 처리 시험 (WU-03)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatLog, log, redactString } from './log';

// 테스트용 가짜 값: 실제 키가 아니라 모양만 같다
// (검사 스크립트가 모양을 키로 오인하지 않게 조각을 나눠 이어 붙인다)
const FAKE_JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJyb2xlIjoidGVzdCJ9', 'c2lnbmF0dXJl'].join('.');
const FAKE_GEMINI = 'AIza' + 'a'.repeat(35);
const FAKE_SB = 'sb_secret_' + 'x'.repeat(24);
const FAKE_GH = 'ghp_' + 'z'.repeat(30);
const FAKE_SK = 'sk-' + 'q'.repeat(30);

describe('L: log 가림 처리', () => {
  afterEach(() => vi.restoreAllMocks());

  it('L-1 값 안의 이메일은 로그 문자열에 남지 않는다', () => {
    const line = formatLog('error', 'login.fail', { cause: 'user a-a@packflow.test not found' });
    expect(line).not.toContain('a-a@packflow.test');
    expect(line).toContain('[email]');
  });

  it('L-2 키 모양 값(JWT · Gemini · Supabase · GitHub · sk-)은 키 이름이 평범해도 남지 않는다', () => {
    const line = formatLog('warn', 'x', {
      a: FAKE_JWT,
      b: FAKE_GEMINI,
      c: FAKE_SB,
      d: FAKE_GH,
      e: FAKE_SK,
      f: `Authorization failed for Bearer ${'t'.repeat(30)}`,
    });
    for (const secret of [FAKE_JWT, FAKE_GEMINI, FAKE_SB, FAKE_GH, FAKE_SK, 't'.repeat(30), 'eyJhbGciOiJIUzI1NiJ9']) {
      expect(line).not.toContain(secret);
    }
  });

  it('L-3 민감한 키 이름(password · token · email · prompt …)은 값 대신 길이만 남는다', () => {
    const line = formatLog('info', 'llm.call', {
      password: 'hunter2-hunter2',
      api_key: 'abc',
      token: 'tok',
      email: 'someone@packflow.test',
      prompt: '재고 5개인 박스를 알려줘 아주 긴 프롬프트 전문',
      ['GEMINI_' + 'API_KEY']: 'k',
      authorization: 'Bearer abc',
    });
    for (const leaked of ['hunter2', 'someone', '프롬프트', '박스', 'Bearer abc']) expect(line).not.toContain(leaked);
    expect(line).toContain('"prompt":"[redacted len=');
    expect(line).toContain('"password":"[redacted len=15]"');
  });

  it('L-4 코드 · 숫자 · 지연은 그대로 남는다', () => {
    const parsed = JSON.parse(formatLog('info', 'api.done', { code: 'PF_NOT_FOUND', status: 404, ms: 12, promptLen: 83, ok: false }));
    expect(parsed).toMatchObject({ level: 'info', event: 'api.done', code: 'PF_NOT_FOUND', status: 404, ms: 12, promptLen: 83, ok: false });
  });

  it('L-4b 키가 민감해 보여도 길이 · 건수 숫자는 남고, 같은 키의 숫자 비밀번호는 가려진다', () => {
    const parsed = JSON.parse(formatLog('info', 'x', { promptLen: 83, tokenCount: 5, password: 123456 }));
    expect(parsed).toMatchObject({ promptLen: 83, tokenCount: 5, password: '[redacted]' });
  });

  it('L-5 중첩 객체 · 배열 안의 비밀도 가린다', () => {
    const line = formatLog('error', 'x', { req: { headers: { cookie: 'sb=1' }, user: { email: 'q@packflow.test' } }, list: ['a@packflow.test'] });
    expect(line).not.toContain('sb=1');
    expect(line).not.toContain('q@packflow.test');
    expect(line).not.toContain('a@packflow.test');
  });

  it('L-6 Error 객체는 이름과 가린 메시지만(스택 없음)', () => {
    const line = formatLog('error', 'x', { cause: new Error('fail for z@packflow.test') });
    expect(line).not.toContain('z@packflow.test');
    expect(line).not.toContain(' at ');
    expect(line).toContain('"name":"Error"');
  });

  it('L-7 200자를 넘는 문자열은 잘린다', () => {
    const out = redactString('가'.repeat(500));
    expect(out.length).toBeLessThanOrEqual(201);
    expect(out.endsWith('…')).toBe(true);
  });

  it('L-8 log.error는 console.error로 한 줄(JSON)을 쓴다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    log.error('api.internal', { cause: 'boom for a@packflow.test', ms: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(() => JSON.parse(line)).not.toThrow();
    expect(line).not.toContain('a@packflow.test');
  });

  it('L-9 info는 console.log, warn은 console.warn', () => {
    const l = vi.spyOn(console, 'log').mockImplementation(() => {});
    const w = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log.info('a');
    log.warn('b');
    expect(l).toHaveBeenCalledTimes(1);
    expect(w).toHaveBeenCalledTimes(1);
  });

  it('L-10 fields를 안 줘도 동작한다', () => {
    expect(JSON.parse(formatLog('info', 'ping'))).toEqual({ level: 'info', event: 'ping' });
  });
});
