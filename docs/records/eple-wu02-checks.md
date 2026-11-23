# WU-02 확인 기록 — 스키마 · 권한 · 함수 자리

작성일: 2026-11-22 · 작성: eple · 근거: [WU-00](../work-units/WU-00-skeleton.md) WU-02, [03](../03-data-model.md) 2 · 4 · 5절, [05](../05-security.md) 3절, D-34

## 1. 로컬 시험 (PGlite — Postgres 17을 Node에서 띄움, Supabase `auth` 스키마 · 역할 흉내)

- 방법: 저장소 밖 시험 폴더에서 마이그레이션 5개를 순서대로 적용한 뒤 역할(`anon` · `authenticated`)과 `auth.uid()`를 바꿔 가며 시험. 기대 결과를 스크립트에 먼저 적음
- 결과: **46건 통과 / 0건 실패** (결함 1건을 고친 뒤)

| 묶음 | ID | 내용 | 판정 |
|---|---|---|---|
| 권한 | T-AUTH-4 | B로 `items` 조회 → B의 행만 | 통과 |
| | T-AUTH-5 | `stock_qty` UPDATE → 권한 오류 (대조: `item_name` UPDATE는 자기 행만 성공, 남의 행 0행) | 통과 |
| | T-AUTH-6 | `stock_logs` DELETE · UPDATE → 권한 오류 | 통과 |
| | P-03~08 | `user_id` 바꾸기 · 직접 INSERT · anon 조회 · `llm_usage` 조회 → 모두 권한 오류 | 통과 |
| 함수 | F-01~06 | 재고 · 일괄 함수 stub → `PF_NOT_IMPLEMENTED`, uid 없음 → `PF_UNAUTHENTICATED`, anon · 내부용 함수 → 권한 오류 | 통과 |
| LLM 상한 | L-01~06 | 사용자 2 · 전체 3 상한에서 3번째 → 사용자 초과, 전체 4번째 → 전체 초과, 음수 상한 → `PF_VALIDATION` | 통과 |
| 제약 | K-01~18 | 수량 0 · 100001 거부, 100000 통과, 금액 상한, 공백 거래처 · 빈 송장 `''` 거부, null 송장 중복 허용, 같은 사용자 송장 중복 거부 · 다른 사용자 허용, 남의 품목 참조 외래키 거부, 소문자 품목코드 · 101자 이름 거부, 입고 수량 > 주문 수량 거부, 이력 0 거부, 없는 상태값 거부, 재고 음수 거부 | 통과 |
| 기본 권한 | D-01~04 | 마이그레이션 뒤 새로 만든 테이블은 anon · authenticated 모두 못 봄, 새 함수는 authenticated만 호출 | 통과(수정 후) |
| 트리거 | U-01 | UPDATE 뒤 `updated_at` 갱신 | 통과 |
| 계정 스크립트 | S-01~07 | dev 주소만 허용, demo · 가짜 호스트 · http · 빈 값 · 형식 오류 거부 (`scripts/create-test-users.test.ts`) | 통과 |

## 2. 찾아 고친 결함

| # | 문제 | 원인 | 고친 것 | 다시 확인 |
|---|---|---|---|---|
| D-1 | 마이그레이션 뒤 새로 만든 함수를 anon이 부를 수 있음 (D-03 실패) | Postgres의 함수 PUBLIC EXECUTE 기본값은 스키마 단위 `alter default privileges`로 지워지지 않는다 | `_rls.sql`에 스키마 없이 전역으로 `revoke execute on functions from public` | D-03 권한 오류, D-04는 그대로 통과 |

## 3. 실제 dev 프로젝트 시험 (2026-11-23, 마이그레이션 6개 적용 뒤)

- 적용: `npx supabase@3.2.0 db push --remote` — dry-run으로 목록 확인 → eple 승인 → 6개 적용. 연결 대상이 `.env.local`의 dev ref · 주소와 같은지 값을 출력하지 않고 비교
- 방법: 실제 REST(`supabase-js`, publishable 키 + 테스트 계정 A · B 로그인). 출력의 메일 · 키 모양은 가려서 확인

| ID | 내용 | 실제 | 판정 |
|---|---|---|---|
| R-0 | A로 `pf_reset_and_seed`(품목 1개) | 성공 | 통과 |
| T-AUTH-4 | B로 `items` 조회 | A 행 0개, 모두 B | 통과 |
| T-AUTH-5 | `stock_qty` UPDATE | 42501 권한 오류 | 통과 |
| P-01 | 대조: `item_name` UPDATE | 1행 성공 | 통과 |
| T-AUTH-6 | `stock_logs` DELETE | 42501 권한 오류 | 통과 |
| F-01 | 재고 함수 stub 호출 | `PF_NOT_IMPLEMENTED` | 통과 |
| P-07 · F-03 | anon으로 조회 · 재고 함수 | 42501 권한 오류 | 통과 |
| P-08 | `llm_usage` 직접 조회 | 42501 권한 오류 | 통과 |
| DB-1 | `npm run test:db` (샘플 + helpers, 계정 A · B) | 2파일 13건 통과 | 통과 |
| UI-1 | 로컬 `npm run dev` → 테스트 계정 로그인 → "준비 중" 화면 (eple 확인) | 확인 | 통과 |

- D-35(Data API '새 테이블 자동 공개' 끄기)에서도 기존 권한 설계대로 동작함을 확인했다.

## 4. 아직 (eple과 함께)

- 실제 Supabase dev · demo에 적용, 두 프로젝트 비교(`db diff`), 실제 REST로 T-AUTH-4~6 다시 확인
- demo 주소로 계정 스크립트 실행 시 거부 확인, 테스트 계정 8개 · 시연 계정 A · B 생성
- PGlite는 Supabase의 실제 기본 권한 · `auth` 스키마와 다를 수 있다 — 실제 적용 뒤 결과를 이 문서에 더한다
