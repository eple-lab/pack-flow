# WU-43 일괄 반영 함수 · 일괄 등록 · 시드 API, 중간 점검

- 담당: eple / 검증: sorek-charlie / Step 3 · 4 / Wave 2 · 11/24(화) **오전**
- 브랜치: `feat/WU-43-bulk-seed-api`
- 의존: WU-21(재고 함수), WU-22(시드 데이터), WU-13의 `parse.ts`(미리보기에서 사용). **오전에 `pf_bulk_apply`부터** — jkspawn WU-13 · sorek-charlie `bulk.test.ts`가 기다린다

## 왜 (근거)

[04](../04-api-contract.md) 3.6 · 3.7. 공통 진행표 3일차 "중간 점검, 범위 조정 기록".

## 읽을 파일

- [04](../04-api-contract.md) 3.6 · 3.7, [05](../05-security.md) 5절(행 · 크기 상한)
- `src/lib/bulk/parse.ts`(jkspawn, 시그니처만), `src/lib/seed/index.ts`(sorek-charlie)

## 만들 · 고칠 파일 (내 구역만)

- `supabase/migrations/<ts>_bulk.sql`(`pf_bulk_apply` 구현)
- `src/app/api/bulk/preview/route.ts`, `src/app/api/bulk/commit/route.ts`, `src/app/api/seed/route.ts`
- 계획서 2절 변경 이력(중간 점검 줄)

## 고치는 방법

0. `pf_bulk_apply(rows jsonb)` — 행마다 `begin … exception when others` 서브트랜잭션으로 재고 함수를 부른다(규칙은 재고 함수가 판정, 이 함수는 묶기만):
   - `입고` 행: `pf_create_purchase(source 'bulk')` → `pf_receive_purchase(received = qty)` (P-15)
   - `출고` 행: `pf_create_sale(channel = 거래처, source 'bulk')` → `pf_ship_sale`
   - 실패 행은 `{line, code, message}`로 모으고 다음 행 진행, 반환 `{applied, skipped[]}`
   - `security definer` + `pf_require_user()`, 행 수 500 상한
1. `/bulk/preview`: 크기 상한 → `parse` → 품목코드 존재 · 이미 등록된 송장 · 출고 수량 대 현재 재고를 조회해 행별 `valid` · `errors` (저장 없음)
2. `/bulk/commit`: 행 스키마 검사 → `pf_bulk_apply` → `{applied, skipped}`
3. `/seed`: `dataset` 이름 → JSON → `pf_reset_and_seed`(본인만)
4. 중간 점검(11/24 오후): 완료 · 미완료 · 막힌 점 · 범위 조정을 계획서 2절에, demo DB에 최신 마이그레이션 적용 후 배포

## 다 됐다의 기준

- [x] sorek-charlie의 `tests/db/bulk.test.ts` 통과(T-S3-5 DB 쪽, T-S4-4), 실패 행이 있어도 성공 행은 남고 T-INV-1 0행
- [x] 미리보기는 DB를 바꾸지 않음(호출 전후 건수 같음)
- [x] 501행 · 100KB 초과 → 400
- [ ] 배포 URL에서 Step 3 · 5 시연 가능 상태
- [ ] 중간 점검 기록 완료

## 테스트 방법

- 자동(DB): `npm run test:db -- tests/db/bulk.test.ts tests/api/bulk.test.ts` — T-S3-5(실패 행이 있어도 성공 행은 남고 T-INV-1 0행) · T-S4-4(재시도 중복) · 미리보기 전후 건수 · 501행 거부. dev에 `20261124090000_bulk_apply.sql`이 적용돼 있어야 한다. `tests/api/bulk.test.ts`는 PR #46에 있다
- 자동(단위): `npm run test:unit -- src/app/api/bulk src/app/api/seed` — bulk 라우트 C-71~C-82(100KB · 501행 · X-PF · 미로그인, preview가 쓰기 · rpc를 부르지 않음), seed 라우트 C-60~C-65. bulk 단위 시험은 PR #46에 있다
- 직접: 일괄 등록 탭(WU-13 화면)에서 붙여넣기 → 미리보기 → 반영 후 대시보드 재고 확인. `src/lib/bulk/parse.ts`(WU-13)가 채워지기 전에는 `/api/bulk/preview`가 501(11/23 작성 당시 — 11/24 #57 · #46 병합 뒤 동작, demo에서 미리보기 확인)
- 준비: `.env.local`의 dev 프로젝트와 본인 테스트 계정(값은 적지 않는다)

## 결과

(작성: eple 세션의 Claude, 2026-11-23. 두 PR로 나눔 — `/api/seed` 먼저(배포 E2E가 기다림, eple 결정), bulk 나중)

- 한 것:
  - (1/2) `POST /api/seed`: 시드 로더 → `pf_reset_and_seed`(본인 데이터만), 시드 오류는 400 `field: dataset`(경로 미노출). 단위 C-60~C-65, T-AUTH-7을 라우트로
  - (2/2) `20261124090000_bulk_apply.sql` `pf_bulk_apply`(stub과 시그니처 같음, 행마다 서브트랜잭션으로 재고 함수만 호출, 실패 행 `{line, code, message}`, 500행 상한, 알려진 코드 외 `PF_INTERNAL`), `/api/bulk/preview`(조회만) · `/commit`, 단위 C-71~C-82 · `tests/api/bulk.test.ts`. 구현은 하위 에이전트(Sonnet), SQL은 관리 세션이 직접 검토
  - small · large 로더 등록과 demo 8품목 시험 갱신은 sorek-charlie가 #40에서 함께 처리(eple 리뷰)
- 직접 확인한 것: bulk 마이그레이션 dev 적용(eple 승인, dry-run으로 1개만 확인, dev 9개 · stub 아님 · authenticated만 실행 · 오버로드 없음). test:db 16파일 76건 통과(WU-23의 `bulk` · `cancel` · `transition` 시험 함께 — T-S3-5: 10행 중 3행 실패 → 재고 17, T-S4-4 재시도 중복). 미리보기 전후 건수 같음, 501행 · 100KB → 400(단위 · DB). unit 702개(하위 에이전트), lint · typecheck 통과
- 확인 못 한 것: 배포 URL에서 Step 3 · 5 시연 — `src/lib/bulk/parse.ts`(WU-13)가 아직 자리라 `/api/bulk/preview`는 501, demo DB에 WU-23 · WU-43 마이그레이션 미적용(#46 병합 뒤 적용 예정). 중간 점검 기록은 11/24 오후
- AI가 틀린 것과 고친 과정: (1) `/api/seed` 단위 시험에 가짜 클라이언트 대신 도우미 반환 객체를 넘겨 5건 모두 500 → 로그(`getClaims` 없음)로 원인 찾아 시험만 고침 (2) bulk 단위 시험 데이터의 마지막 칸이 비어 열 수 오류 4건 → 시험 데이터 고침. [ai-cases-eple](../records/ai-cases-eple.md) 사례 2
- PR: #41(병합) · #43(SeedError 실패 시험 복원, 병합) · #46(bulk, 리뷰 중)
