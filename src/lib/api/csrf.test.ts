/**
 * csrf.ts 단위 테스트 — 변경 요청은 X-PF: 1 + 같은 사이트 Origin이 있어야 통과하는지.
 *
 * 하는 일: 기대 결과(통과 true · 막음 false)를 먼저 적고 checkCsrf 반환값과 비교한다.
 *
 * 근거: docs/04-api-contract.md 1절 · P-18, WU-03 4번 · AGENTS.md 3절
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — CSRF 검사 시험 (WU-03)
 */
import { describe, expect, it } from 'vitest';
import { checkCsrf } from './csrf';

const APP_URL = 'https://app.packflow.test/api/items';
const APP_ORIGIN = 'https://app.packflow.test';
const EVIL_ORIGIN = 'https://evil.packflow.test';

// 요청 한 개를 만든다. headers는 필요한 것만 준다.
function req(method: string, headers: Record<string, string> = {}, url = APP_URL): Request {
  return new Request(url, { method, headers });
}

describe('C: CSRF 검사 (checkCsrf)', () => {
  it('C-1 GET · HEAD · OPTIONS는 헤더 없이도 통과한다', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(checkCsrf(req(method)), method).toBe(true);
    }
  });

  it('C-2 POST에 X-PF 헤더가 없으면 Origin이 맞아도 막는다', () => {
    expect(checkCsrf(req('POST', { origin: APP_ORIGIN }))).toBe(false);
  });

  it('C-3 POST에 X-PF가 "1"이 아니면(0 · true · 빈 값) 막는다', () => {
    for (const value of ['0', 'true', '']) {
      expect(checkCsrf(req('POST', { 'x-pf': value, origin: APP_ORIGIN })), `x-pf="${value}"`).toBe(false);
    }
  });

  it('C-4 X-PF:1이 있어도 Origin이 다른 사이트면 막는다', () => {
    expect(checkCsrf(req('POST', { 'x-pf': '1', origin: EVIL_ORIGIN }))).toBe(false);
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('C-5 %s에 X-PF:1 + 같은 호스트 Origin이면 통과한다', (method) => {
    expect(checkCsrf(req(method, { 'x-pf': '1', origin: APP_ORIGIN }))).toBe(true);
  });

  it('C-6 X-PF:1이 있어도 Origin 헤더가 없으면 막는다', () => {
    expect(checkCsrf(req('POST', { 'x-pf': '1' }))).toBe(false);
  });

  it('C-7 Origin이 깨진 값("not a url", "null")이면 막는다', () => {
    for (const origin of ['not a url', 'null']) {
      expect(checkCsrf(req('POST', { 'x-pf': '1', origin })), `origin="${origin}"`).toBe(false);
    }
  });

  it('C-8 x-forwarded-host가 있으면 내부 주소 대신 그 호스트와 비교한다', () => {
    const internal = 'http://localhost:10000/api/items';
    const headers = { 'x-pf': '1', 'x-forwarded-host': 'app.packflow.test' };
    expect(checkCsrf(req('POST', { ...headers, origin: APP_ORIGIN }, internal))).toBe(true);
    expect(checkCsrf(req('POST', { ...headers, origin: EVIL_ORIGIN }, internal))).toBe(false);
  });

  it('C-9 호스트 이름이 비슷하지만 다른 Origin(접미사 · 접두사 조작)은 막는다', () => {
    for (const origin of ['https://app.packflow.test.evil.test', 'https://evilapp.packflow.test']) {
      expect(checkCsrf(req('POST', { 'x-pf': '1', origin })), `origin="${origin}"`).toBe(false);
    }
  });

  it('C-10 메서드가 소문자(post)여도 변경 요청으로 보고 X-PF가 없으면 막는다', () => {
    // Request 생성자가 post를 POST로 바꾸는지와 무관하게 결과가 같아야 한다
    expect(checkCsrf(req('post', { origin: APP_ORIGIN }))).toBe(false);
  });
});
