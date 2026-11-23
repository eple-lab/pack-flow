# WU-06 확인 기록 — Render 배포

작성일: 2026-11-23 · 작성: eple · 근거: [WU-00](../work-units/WU-00-skeleton.md) WU-06, D-05 · D-20 · D-27 · D-34

기대 결과를 먼저 적고 시험한다(D-34). 키 · 주소 · 프로젝트 ref는 적지 않는다.

## 1. 로컬 시험 (11/23 — `render.yaml`과 같은 빌드 · 시작 명령, `.env.local`의 dev 값)

| ID | 기대 | 실제 | 판정 |
|---|---|---|---|
| C-01 | `npm run build` 성공 | 성공, 화면 · API 경로 모두 빌드 | 통과 |
| C-02 | `PORT=3100 npm start` → `/api/health` 200 `{status:"ok", db:"ok"}` | 200 `{"data":{"status":"ok","db":"ok","llm":"gemini"}}` | 통과 |
| C-03 | 비로그인 `/items` → `/login`으로 보냄(실패해야 정상) | 307 → `/login?next=%2Fitems` | 통과 |
| C-04 | `render.yaml`에 비밀값 · 이메일 · 경로 없음, 서비스 키 칸 없음 | `check-secrets.sh --staged` 통과, 패턴 검사 결과 없음 | 통과 |

- `next start`는 `PORT` 환경변수와 0.0.0.0을 기본으로 쓴다(Next 16 CLI 문서) → Render 포트 설정 불필요
- `NODE_ENV`를 넣지 않는다: production이면 `npm ci`가 devDependencies(typescript)를 빼서 빌드 실패

## 2. Render 배포 (채울 것)

| ID | 기대 | 실제 | 판정 |
|---|---|---|---|
| C-05 | Render 빌드 로그에 Node 24 · 빌드 성공 | | |
| C-06 | 배포 URL `/api/health` → 200 `ok/ok` | | |
| C-07 | 배포 URL 비로그인 `/items` → `/login` | | |
| C-08 | 배포 URL에서 시연 계정 A 로그인 → 빈 대시보드 | | |
| C-09 | 틀린 비밀번호 로그인 → 오류 문구, 대시보드로 가지 않음(실패해야 정상) | | |
| C-10 | Render 환경변수 목록에 서비스 키 없음 | | |
