# 라이선스 정리

> 작성일: 2026-11-24 · `package-lock.json`의 각 패키지 `license` 칸과 설치된 `node_modules`의 `package.json`을 직접 읽어 정리했다. **법률 자문이 아니다.** 공개 배포나 상업적 이용 전에는 각 원문을 다시 확인한다.
> 다시 세는 법: lock 파일의 `packages`를 돌며 `license` · `dev` · `optional` 칸을 모은다(11/24 eple 세션 스크립트, 결과만 이 문서에 둔다).

## 1. 이 저장소 자체

- 팀원이 직접 작성한 코드와 문서: **Copyright © 2026 PackFlow 팀. All rights reserved.** — 열람 · 참고는 환영, 복제 · 수정 · 배포 · 다른 곳에 사용하려면 먼저 문의. 전문은 루트 [LICENSE](../LICENSE), [README 저작권과 이용 범위](../README.md#저작권과-이용-범위)
- 저장소에는 **다른 사람의 코드가 들어 있지 않다.** 라이브러리는 `package.json` · `package-lock.json`에 이름 · 버전만 있고, 실제 파일은 설치할 때(`npm ci`) 각자 받는다.
- 시드 데이터(품목 · 거래처 · 금액 · 시연 계정)는 시연용 **가상 데이터**다.
- 웹 글꼴 · 이미지 · 아이콘 파일을 저장소에 넣지 않았다(시스템 글꼴, CSS만 사용).

### "All rights reserved"와 충돌하는가

**지금은 충돌하지 않는다.** 근거:

1. 앱이 실행 중에 쓰는 패키지에 GPL · AGPL은 **없다**(아래 2절).
2. LGPL(`sharp`의 libvips 바이너리)은 Next.js가 이미지 최적화용으로 **선택 설치**하는 부품이다. 우리는 고치지도, 저장소에 넣지도 않는다. LGPL 의무(교체 가능하게 · 고지)는 그 라이브러리를 **배포할 때** 생기고, Render 서버에서 실행하는 것은 우리 쪽 배포가 아니다.
3. GitHub 이용약관상 공개 저장소는 GitHub 안에서 보기 · 포크가 허용되지만, 그것으로 사용 권리가 생기지는 않는다.

## 2. npm 패키지

### 직접 쓰는 패키지 (`package.json`)

| 패키지 | 버전 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| next | 16.4.6 | MIT | 앱 |
| react · react-dom | 19.3.0 | MIT | 앱 |
| @supabase/supabase-js | 2.119.2 | MIT | 앱(DB · 인증 클라이언트) |
| @supabase/ssr | 0.12.7 | MIT | 앱(쿠키 세션) |
| zod | 4.6.7 | MIT | 앱(입력 검사) |
| server-only | 0.0.1 | MIT | 앱(서버 전용 표시) |
| @playwright/test | 1.65.1 | Apache-2.0 | 시험(E2E) |
| typescript | 5.9.3 | Apache-2.0 | 개발 |
| vitest | 5.1.1 | MIT | 시험(단위 · DB) |
| eslint · eslint-config-next | 9.39.5 · 16.4.6 | MIT | 개발 |
| @types/node · @types/react · @types/react-dom | 24 · 19 · 19 | MIT | 개발 |

### 전체 의존 패키지 (`package-lock.json` 기준, 운영체제별 선택 설치 포함)

| 구분 | 라이선스 | 개수 | 이 프로젝트에 주는 영향 |
|---|---|---|---|
| 앱(69개) | MIT | 31 | 없음. 배포할 때 고지문을 함께 둔다 |
| | Apache-2.0 | 19 | 없음. 배포할 때 고지문 · NOTICE를 함께 둔다 |
| | LGPL-3.0-or-later (단독 10 · 혼합 4) | 14 | `@img/sharp-libvips-*` · `@img/sharp-*`(이미지 처리 libvips) — 위 1절 근거 2 |
| | ISC (picocolors, semver) | 2 | 없음 |
| | CC-BY-4.0 (caniuse-lite) | 1 | 브라우저 지원 **데이터**. 출처 표시 조건 — 우리는 재배포하지 않음 |
| | BSD-3-Clause (source-map-js) · 0BSD (tslib) | 2 | 없음 |
| 개발 · 시험(400개) | MIT 342 · Apache-2.0 19 · ISC 14 · BSD 8 · BlueOak-1.0.0 2 · Python-2.0 1 · CC0-1.0 1 | 387 | 없음 |
| | MPL-2.0 (axe-core, lightningcss와 플랫폼별 바이너리) | 13 | 그 **파일을 고쳐서 배포할 때만** 고친 파일을 공개. 가져다 쓰기만 하면 영향 없음. 개발 도구라 앱과 함께 배포되지도 않음 |
| | GPL · AGPL | 0 | — |

- 숫자는 lock 파일에 적힌 항목 수다. 운영체제별 선택 설치 패키지(예: 리눅스용 바이너리)는 이 PC에 설치되지 않았어도 센다.
- 패키지를 바꾸면(`package.json` 변경 — eple 구역) 이 표를 다시 센다.

## 3. 외부 서비스 · 모델

| 이름 | 쓰는 곳 | 따르는 것 | 메모 |
|---|---|---|---|
| Supabase (Postgres · Auth) | DB · 로그인 (dev · demo 프로젝트) | Supabase 이용 약관 · 무료 플랜 제한 | 1주일 미사용 시 일시정지(계획서 9절) |
| Render | 배포 (`pack-flow` · `pack-flow-demo`) | Render 이용 약관 · 무료 플랜 | 접속이 없으면 잠듦 |
| Google Gemini API (`gemini-3.5-flash-lite`) | 배포 · 발표의 AI 초안 · 챗봇, 일부 개발(D-06) | Gemini API 이용 약관 · 무료 티어 | 무료 티어는 입력이 서비스 개선에 쓰일 수 있어 **가상 데이터만** 넣는다 — `docs/records/ai-limits.md` 3절(WU-35) |
| Ollama + 로컬 모델 (`qwen3.5:0.8b` 등) | 개발 중 각자 PC | Ollama(MIT) · **모델별 라이선스** | 모델 라이선스 원문은 아직 확인하지 않음 — 저장소에 모델 파일을 넣지 않으므로 배포 영향은 없음 |

## 4. 확인하지 못한 것

- 패키지 `license` 칸이 실제 LICENSE 파일 내용과 같은지(칸만 읽었다)
- Ollama 로컬 모델 각각의 라이선스 원문
- 각 서비스 약관의 최신 내용(링크로 원문 확인 필요)

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-11-24 | 처음 작성 — 이 저장소 고지(PackFlow 팀), npm 패키지 집계, 외부 서비스 · 모델 (WU-44) |
