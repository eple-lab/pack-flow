-- 권한: RLS 켜기 · 읽기 정책 · 컬럼 단위 수정 권한 · anon 회수 · 함수 EXECUTE 정리 (P-03 · P-04, docs/03-data-model.md 5절)
--
-- 하는 일
-- 1. 모든 테이블에 RLS를 켠다. 정책이 없는 테이블(llm_usage)은 아무도 직접 읽지 못한다 — 의도한 동작.
-- 2. Supabase 기본값이 anon · authenticated에 준 테이블 권한을 모두 회수하고 필요한 것만 다시 준다.
--    authenticated: 4테이블 SELECT(자기 행만), items는 마스터 5개 컬럼만 UPDATE. INSERT · DELETE 없음.
--    재고(stock_qty) · 이력(stock_logs) · 거래는 security definer 재고 함수로만 바뀐다(D-10).
-- 3. 함수 EXECUTE: PUBLIC · anon에서 회수, 업무 함수만 authenticated에 준다. 내부용 함수는 주지 않는다.
-- 4. 앞으로 만드는 테이블 · 함수에도 anon 권한이 자동으로 붙지 않게 기본 권한을 바꾼다.
--    새 테이블은 이 파일처럼 권한을 직접 적어야 보인다(실수로 열리는 것보다 안 보이는 쪽이 안전).
--
-- 근거: docs/03-data-model.md 5절 · docs/05-security.md 3절 · P-03 · P-04 · WU-02
-- 구역: eple (docs/06-work-plan.md 1절)
--
-- 이력
-- 2026-11-20  eple  처음 작성 — RLS · 정책 · 컬럼 권한 · 함수 권한 (WU-02)

-- ── 1. RLS 켜기 ────────────────────────────────────────────────────────

alter table public.items      enable row level security;
alter table public.purchases  enable row level security;
alter table public.sales      enable row level security;
alter table public.stock_logs enable row level security;
alter table public.llm_usage  enable row level security;

-- ── 2. 테이블 권한: 모두 회수한 뒤 필요한 것만 ─────────────────────────

revoke all on table public.items, public.purchases, public.sales, public.stock_logs, public.llm_usage
  from public, anon, authenticated;

grant select on table public.items, public.purchases, public.sales, public.stock_logs to authenticated;

-- 품목 마스터 5개 컬럼만 고칠 수 있다. sku_id · stock_qty · user_id는 못 바꾼다 (D-22, T-AUTH-5)
grant update (item_name, source_url, unit_cost, sale_price, safety_stock) on table public.items to authenticated;

-- 정책: 자기 행만. (select auth.uid())로 감싸면 행마다가 아니라 쿼리마다 한 번만 계산된다.
create policy items_select_own on public.items
  for select to authenticated using (user_id = (select auth.uid()));
create policy items_update_own on public.items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy purchases_select_own on public.purchases
  for select to authenticated using (user_id = (select auth.uid()));

create policy sales_select_own on public.sales
  for select to authenticated using (user_id = (select auth.uid()));

-- stock_logs: 읽기만. UPDATE · DELETE 정책과 권한이 없다 — 기록은 지우지 않는다 (T-AUTH-6)
create policy stock_logs_select_own on public.stock_logs
  for select to authenticated using (user_id = (select auth.uid()));

-- llm_usage: 정책 없음 — pf_llm_take()만 쓴다

-- ── 3. 함수 EXECUTE ─────────────────────────────────────────────────────

revoke execute on all functions in schema public from public, anon, authenticated;

-- 업무 함수 (재고 · 일괄 · LLM 상한). 함수 안에서 pf_require_user()로 다시 확인한다 (P-04)
grant execute on function
  public.pf_create_item(text, text, integer, integer, integer, text),
  public.pf_create_purchase(text, text, integer, integer, text, text),
  public.pf_set_purchase_status(uuid, text),
  public.pf_receive_purchase(uuid, integer),
  public.pf_cancel_receipt(uuid),
  public.pf_create_sale(text, text, integer, integer, text, text),
  public.pf_set_sale_status(uuid, text),
  public.pf_ship_sale(uuid),
  public.pf_cancel_shipment(uuid),
  public.pf_bulk_apply(jsonb),
  public.pf_llm_take(integer, integer)
to authenticated;

-- 내부용(pf_require_user, pf_*_transition_ok, pf_touch_updated_at)은 주지 않는다.
-- security definer 함수 안에서는 함수 주인(postgres) 권한으로 불리므로 문제없다.

-- ── 4. 앞으로 만드는 객체의 기본 권한 ──────────────────────────────────
-- Supabase는 public 스키마의 새 테이블 · 함수에 anon · authenticated 권한을 자동으로 준다.
-- 마이그레이션은 postgres 역할로 돌므로 그 역할의 기본값을 바꾼다.

alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
-- 새 함수는 authenticated에만 자동으로 열린다(재고 함수를 새 마이그레이션으로 고칠 때 권한을 다시 적지 않아도 되게).
-- 내부용 함수를 새로 만들면 그 파일에서 revoke execute … from authenticated를 직접 적는다.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
-- PUBLIC의 함수 EXECUTE는 Postgres 전체 기본값이라 스키마 단위로는 지워지지 않는다(시험 D-03에서 발견).
-- 스키마를 빼고 전역으로 회수해야 anon이 PUBLIC을 통해 새 함수를 부르지 못한다.
alter default privileges for role postgres revoke execute on functions from public;
