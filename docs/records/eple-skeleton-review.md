# 골격 2~6단계 검토 기록 (관리 세션)

작성일: 2026-11-23 · 작성: eple · 방식: 단계마다 Sonnet 하위 세션이 작성(단순 작업은 Haiku 에이전트에 다 됐다의 기준과 함께 위임) → 관리 세션(Opus)이 기준 명령 재실행 · 핵심 파일 읽기 · 비밀값 검사 후 커밋. 근거: D-34


## 2단계 (타입 · 검증 · 유틸) — 커밋함
- 직접 다시 돌림: test:unit 7파일 265건, typecheck, lint, 비밀값 검사 통과
- 대조: errors.ts 문구 14개가 04 4.4와 글자 그대로 같음, HTTP 매핑 04 2절과 같음
- 확인: env를 env.ts(공통) · env-server.ts(server-only)로 나눔 → 합리적. AGENTS.md 3절 · 2절 경로 목록에 env-server.ts를 내가 추가
- Haiku 사용 0건(Sonnet 판단: 파일 간 규칙 연결이 많음). → 3단계부터 반복 작업(라우트 stub, 목 데이터, 자리 컴포넌트)은 Haiku에 맡기라고 지시

## 3단계 (인증 · proxy · API 공통 · inventory) — 커밋함
- 직접 다시 돌림: test:unit 12파일 343건, typecheck, lint, 비밀값 검사 통과
- 읽어 본 것: proxy.ts(getClaims로 세션 확인, 화면만 /login 리다이렉트, API는 handler가 401), handler 흐름(CSRF → 로그인 → JSON → 스키마 → 실행 → 오류 변환), /api/me
- Haiku 2건: 지시문에 읽을 파일 · 만들 파일 · 하지 말 것 · 다 됐다의 기준(vitest · eslint · tsc 명령)이 모두 있었고, Sonnet이 결과를 전체 테스트 재실행 + 전문 읽기로 확인 → 적절
- 메모(판단 필요 없음): CSRF가 x-forwarded-host 쉼표 목록을 모두 자기 호스트로 인정. 브라우저는 교차 사이트에서 이 헤더와 X-PF를 함께 보낼 수 없어 CSRF 위험은 낮음. Render 배포 후 실제 헤더 모양만 확인
- inventory 래퍼에 pf_reset_and_seed가 미리 있음(SQL은 6단계) — 테스트에서 '아직 SQL 없음' 목록으로 따로 관리, 6단계에서 목록을 비우라고 지시

## 4단계 (API stub · 목 · api-client) — 커밋함
- 직접 다시 돌림: test:unit 15파일 371건, typecheck, lint, 비밀값 검사 통과
- 읽어 본 것: /api/health(키 · 주소 응답에 없음, 3초 시간 초과, 응답은 04 공통 {data} 봉투), api-client(15초, X-PF는 GET 외, server-only 섞이지 않음)
- Haiku 3건 병렬: 지시문 기준 충족, Sonnet이 grep · typecheck · 자체 테스트로 확인. Haiku의 tsc 오류 보고 1건은 Sonnet 쪽 오타였고 Sonnet이 고침 → 적절
- 남길 메모: 목 mockPoDraft의 '여유 7' 근거 값이 skygaul reorder 규칙(WU-32)과 맞는지 미확인 → WU-32 때 skygaul이 목 값 보강 요청하면 됨

## 5단계 (앱 뼈대 · 공통 조각) — 커밋함
- 직접 다시 돌림: test:unit 17파일 420건, typecheck, lint, 비밀값 검사 통과. alert/confirm/prompt 호출 없음(테스트의 XSS 문자열만)
- 읽어 본 것: (app)/layout.tsx(서버에서 getClaims, 없으면 /login), 임시 확인 페이지는 지워짐
- Haiku 3건 병렬: 지시문에 props · testid 명세와 기준 포함 → 적절. Sonnet이 Haiku 결과를 전문 읽기로 검토해 SubmitButton의 처리 안 된 Promise 거부 버그를 찾아 고침 → 검토가 제대로 작동함(AI 사례 후보)

## 6단계 (테스트 기반 · 시드 함수) — 커밋함
- 직접 다시 돌림: Sonnet의 PGlite 시험 56건(저장소 밖 스크립트)을 내가 다시 실행해 56/0 확인, test:unit 18파일 442건, typecheck, lint, 비밀값 검사 통과
- 읽어 본 것: pf_reset_and_seed의 삭제 4줄이 모두 user_id = uid, llm_usage는 초기화하지 않음(상한 우회 방지), EXECUTE는 authenticated만
- Haiku 1건: 지시문 적절. Haiku가 불변식 검사에 '입고완료 구매에 입고취소 기록이 있으면 위반'을 더함 — 03 6절 T-INV-3 뜻과 맞아 받아들임
- 운영 메모: Sonnet이 Haiku를 백그라운드로 띄운 채 턴을 끝내 한 번 멈춤 → 내가 '끝까지 마치고 보고' 메시지로 재개시킴

## Sonnet → Haiku 지시 기록 요약

| 단계 | Haiku 건수 | 지시문에 다 됐다의 기준 | Sonnet이 고쳐 준 것 |
|---|---|---|---|
| 2 | 0 | — | — (직접 작성) |
| 3 | 2 | 있음 | 없음 |
| 4 | 3 (병렬) | 있음 | Sonnet 쪽 오타 1 |
| 5 | 3 (병렬) | 있음 | SubmitButton 처리 안 된 Promise 거부 |
| 6 | 1 | 있음 | e2e 도우미 낡은 주석 1줄 |
