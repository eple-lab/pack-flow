/**
 * Next.js 설정.
 *
 * 하는 일
 * 1. create-next-app 16 기본값의 cacheComponents · partialPrefetching을 끈다.
 *    로그인 쿠키를 읽는 화면이 대부분이라 요청마다 그리는 기본 방식이 단순하고,
 *    팀원 에이전트가 익숙한 패턴과 같다(골격 결정, WU-01).
 *
 * 근거: WU-01
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  처음 작성 — 캐시 컴포넌트 끔 (WU-01)
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
