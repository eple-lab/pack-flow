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

- [ ] sorek-charlie의 `tests/db/bulk.test.ts` 통과(T-S3-5 DB 쪽, T-S4-4), 실패 행이 있어도 성공 행은 남고 T-INV-1 0행
- [ ] 미리보기는 DB를 바꾸지 않음(호출 전후 건수 같음)
- [ ] 501행 · 100KB 초과 → 400
- [ ] 배포 URL에서 Step 3 · 5 시연 가능 상태
- [ ] 중간 점검 기록 완료

## 결과

- 한 것 / 직접 확인한 것 / 확인 못 한 것 / PR:
