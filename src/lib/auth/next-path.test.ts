/**
 * next-path.ts 단위 테스트 — 로그인 뒤 이동 경로의 열린 리다이렉트 방지.
 *
 * 하는 일: 허용(같은 사이트 경로) · 거부(외부 · 프로토콜 상대 · 스크립트) 기대를 표로 먼저 적고 비교한다.
 *
 * 근거: WU-03 5번 (R 기준)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — next 검사 시험 (WU-03)
 */
import { describe, expect, it } from 'vitest';
import { loginUrlFor, safeNextPath } from './next-path';

describe('R: safeNextPath', () => {
  it.each([
    ['/trades', '/trades'],
    ['/items?sku=PRD-001', '/items?sku=PRD-001'],
    ['/history#top', '/history#top'],
    ['/a/b/c', '/a/b/c'],
    ['/%2F/evil.example', '/%2F/evil.example'], // 이 사이트 안의 경로(인코딩된 슬래시)
  ])('R-1 허용 %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ['//evil.example'],
    ['//evil.example/trades'],
    ['https://evil.example'],
    ['http://evil.example/x'],
    ['javascript:alert(1)'],
    ['JaVaScRiPt:alert(1)'],
    ['data:text/html,x'],
    ['/\\evil.example'],
    ['/\\/evil.example'],
    ['\\\\evil.example'],
    ['/\t/evil.example'],
    ['/\n/evil.example'],
    ['/ok\\..\\evil'],
    ['trades'],
    ['evil.example'],
    [' /trades'],
    [''],
  ])('R-2 거부 → "/" : %j', (input) => {
    expect(safeNextPath(input)).toBe('/');
  });

  it('R-3 없음 · null · 배열 · 너무 긴 값', () => {
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(['/trades', '/other'])).toBe('/trades');
    expect(safeNextPath(['//evil.example'])).toBe('/');
    expect(safeNextPath(`/${'a'.repeat(600)}`)).toBe('/');
  });

  it('R-4 /login 자신으로 돌아가지 않는다(반복 방지)', () => {
    expect(safeNextPath('/login')).toBe('/');
    expect(safeNextPath('/login?next=/x')).toBe('/');
    expect(safeNextPath('/login/x')).toBe('/');
    expect(safeNextPath('/loginx')).toBe('/loginx');
  });
});

describe('R: loginUrlFor', () => {
  it('R-5 지금 경로를 next로 붙인다(인코딩)', () => {
    expect(loginUrlFor('/trades', '?tab=sales')).toBe('/login?next=%2Ftrades%3Ftab%3Dsales');
    expect(loginUrlFor('/items')).toBe('/login?next=%2Fitems');
  });
  it('R-6 홈이면 next를 붙이지 않는다', () => {
    expect(loginUrlFor('/')).toBe('/login');
  });
  it('R-7 위험한 경로는 next 없이 /login', () => {
    expect(loginUrlFor('//evil.example')).toBe('/login');
  });
});
