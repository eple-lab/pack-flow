/**
 * npm install · npm ci 때 git 훅 폴더를 .githooks로 켠다 (package.json "prepare").
 *
 * 하는 일
 * 1. git 저장소 안이면 `git config core.hooksPath .githooks`를 실행한다.
 * 2. git이 없거나 저장소 밖(배포 서버의 압축본 등)이면 알리고 넘어간다 — 설치를 실패시키지 않는다.
 *
 * 근거: docs/05-security.md 2.2 '자동 설치' · D-20 ④ · WU-01
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  처음 작성 — 훅 자동 설치, 윈도우 · 맥 · 리눅스 공통으로 node 스크립트 (WU-01)
 */
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  console.log('[hooks] core.hooksPath = .githooks (비밀값 검사 훅이 켜졌습니다)');
} catch {
  console.log('[hooks] git 저장소가 아니라 훅 설치를 건너뜁니다');
}
