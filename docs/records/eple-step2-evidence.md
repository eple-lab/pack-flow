# Step 2 권한 거부 증거 — RLS 정책 요약 · T-AUTH 결과

작성일: 2026-11-23 · 작성: eple · 근거: 완료 판정 6("B가 A의 품목 ID로 API를 직접 호출 → 거부"), [05 보안](../05-security.md) 3절, [WU-42](../work-units/WU-42-auth-tests.md), 마이그레이션 `20261120100400_rls.sql` · `20261123120000_inventory.sql`

**키 · 비밀번호 · 이메일 · 프로젝트 ref는 이 문서에 적지 않는다.** 계정은 'A' · 'B'로만 쓴다.

## 1. 권한은 어디서 막나 (겹마다)

| 겹 | 규칙 | 근거 파일 |
|---|---|---|
| proxy | 화면 경로 미로그인 → `/login`. 판정은 낙관적 확인일 뿐이고 진짜 권한은 아래 겹이 정한다 | `src/proxy.ts` |
| API 라우트 | 변경 요청은 `X-PF` · Origin 확인(403 `PF_CSRF`) → 로그인 확인(401) → 스키마 strict 검사. `user_id`는 요청에서 받지 않는다 | `src/lib/api/handler.ts`, `src/lib/validation/` |
| DB 함수 | `security definer`, 첫 줄 `pf_require_user()`, 모든 select · update · insert에 `user_id = uid` → 남의 id는 `PF_NOT_FOUND` | `20261123120000_inventory.sql` |
| DB 테이블 | RLS `user_id = auth.uid()`, 쓰기 권한 최소 | `20261120100400_rls.sql` |

## 2. RLS 정책 요약 (원문: `20261120100400_rls.sql`)

| 테이블 | RLS | authenticated 권한 | 정책 |
|---|---|---|---|
| `items` | 켬 | SELECT, UPDATE(`item_name` · `source_url` · `unit_cost` · `sale_price` · `safety_stock` 다섯 칸만) | `items_select_own` · `items_update_own`: `user_id = (select auth.uid())`, update는 `with check`도 같은 조건 |
| `purchases` | 켬 | SELECT | `purchases_select_own` |
| `sales` | 켬 | SELECT | `sales_select_own` |
| `stock_logs` | 켬 | SELECT | `stock_logs_select_own` — UPDATE · DELETE 정책과 권한 없음(기록은 지우지 않는다) |
| `llm_usage` | 켬 | 없음 | 정책 없음 — `pf_llm_take()`만 쓴다 |

- anon · PUBLIC의 테이블 권한은 모두 회수했다. INSERT · DELETE는 누구에게도 없다. 등록 · 재고 변경은 재고 함수(`pf_*`)로만 한다(D-10)
- 함수 EXECUTE: 업무 함수만 authenticated에, 내부용(`pf_require_user` · `pf_*_transition_ok` · `pf_touch_updated_at`)은 주지 않는다
- 함수 권한 실측(11/23, dev · demo 같음): 업무 함수 6개 anon=false · authenticated=true, `pf_purchase_transition_ok` · `pf_sale_transition_ok` anon=false · authenticated=false

## 3. T-AUTH 결과 (로컬 → dev DB, 테스트 계정 A · B, 2026-11-23)

실행: `npm run test:db -- tests/api/auth.test.ts tests/api/rls.test.ts` → **2파일 10개 통과**. 시험은 A · B 둘 다 demo 시드로 시작하고 끝낸다. 서비스 키는 쓰지 않는다.

| ID | 조건 · 행동 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| T-AUTH-1 | 로그인 없이 `GET /api/items` | 401 `PF_UNAUTHENTICATED` | 같음 | 통과 |
| T-AUTH-2 | B로 로그인, A의 구매 `id`로 `POST /api/purchases/{id}/receive` | 404 `PF_NOT_FOUND`, A의 재고 · 이력 건수 · 구매 상태 그대로 | 같음 | 통과 |
| T-AUTH-3 | B로 로그인, A의 판매 `id`로 `ship` | 404, A 그대로 | 같음 | 통과 |
| T-AUTH-2b | B가 `PATCH /api/items/PRD-001`(A에게도 같은 품목코드 있음) · B의 `GET /api/purchases` | B 행만 바뀌고 A 그대로, B 목록에 A의 구매 없음 | 같음 | 통과 |
| T-AUTH-4 | B의 JWT로 Supabase REST에 직접 `items` · `purchases` · `sales` · `stock_logs` 전체 select | 모든 행이 B 것, A의 행 id 없음 | 같음 | 통과 |
| T-AUTH-5 | B가 REST로 자기 품목 `stock_qty = 999` update, `user_id`를 A로 바꾸는 update | 권한 오류, 재고 그대로 | 같음 | 통과 |
| T-AUTH-6 | B가 REST로 네 테이블 delete | 권한 오류 또는 0행, 건수 그대로 | 같음 | 통과 |
| T-AUTH-6b | B가 REST로 `items`에 직접 insert | 권한 오류, 건수 그대로 | 같음 | 통과 |
| T-AUTH-7 | B가 시드 초기화 | B 데이터만 바뀌고 A 그대로 | DB 함수 `pf_reset_and_seed`를 B로 불러 같음 | 통과(DB 쪽만) |
| T-AUTH-8 | `X-PF` 헤더 없이 `POST /api/sales` | 403 `PF_CSRF`, 판매 건수 그대로 | 같음 | 통과 |

함께 확인된 것(WU-21 시험, 11/23 dev): T-INV-1 "다른 계정의 구매 · 판매는 `PF_NOT_FOUND`, 재고 · 이력 변화 없음"(DB 함수를 B로 직접 호출) 통과.

## 4. 확인하지 못한 것

- **T-AUTH-7의 API 쪽:** `POST /api/seed`가 WU-43 전까지 stub(501)이다. 라우트가 생기면 같은 시험을 라우트로 바꿔 다시 돌린다
- **배포 URL에서의 확인:** 위 결과는 로컬 → dev DB다. 배포 URL(Render `pack-flow`)의 Step 1 · 2 E2E는 WU-41(#38) 병합 · 재배포 뒤 sorek-charlie가 실행한다(WU-42 고치는 방법 3)
- 화면에서 B로 로그인해 A의 데이터가 안 보이는지는 sorek-charlie가 PR #38 서버에서 Chrome으로 확인했다고 보고했다(11/23 18시 무렵, 팀 채널). 이 문서 작성자가 직접 본 것은 아니다
