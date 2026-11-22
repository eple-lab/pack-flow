/**
 * create-test-users의 dev 프로젝트 확인 단위 테스트 — demo에 잘못 실행하지 않는지(D-20 ③).
 *
 * 근거: docs/05-security.md 2.1 ③ · WU-02
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  처음 작성 — 주소 확인 사례 7개 (WU-02)
 */
import { describe, expect, it } from 'vitest';
import { assertDevProject } from './create-test-users';

const DEV = 'devref123';

describe('assertDevProject', () => {
  it('S-01 dev 주소면 그대로 돌려준다', () => {
    expect(assertDevProject(`https://${DEV}.supabase.co`, DEV)).toBe(`https://${DEV}.supabase.co`);
  });
  it('S-02 다른 프로젝트(demo) 주소면 거부', () => {
    expect(() => assertDevProject('https://demoref456.supabase.co', DEV)).toThrow(/dev 프로젝트가 아닙니다/);
  });
  it('S-03 dev ref를 앞에 붙인 가짜 호스트면 거부', () => {
    expect(() => assertDevProject(`https://${DEV}.supabase.co.example.org`, DEV)).toThrow(/dev 프로젝트가 아닙니다/);
  });
  it('S-04 http(암호화 없음)면 거부', () => {
    expect(() => assertDevProject(`http://${DEV}.supabase.co`, DEV)).toThrow(/dev 프로젝트가 아닙니다/);
  });
  it('S-05 주소가 비면 거부', () => {
    expect(() => assertDevProject(undefined, DEV)).toThrow(/URL이 비어/);
  });
  it('S-06 dev ref가 비면 거부', () => {
    expect(() => assertDevProject(`https://${DEV}.supabase.co`, '')).toThrow(/REF가 비어/);
  });
  it('S-07 주소 형식이 아니면 거부', () => {
    expect(() => assertDevProject('not a url', DEV)).toThrow(/형식/);
  });
});
