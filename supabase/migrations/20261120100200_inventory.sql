-- 주인: sorek-charlie. 11/23부터 수정은 적용 전이면 이 파일, 적용 뒤에는 새 마이그레이션(P-06).
-- 재고 함수 자리: 생성 · 입고 · 출고 · 취소 · 전이 판정 (D-10, docs/03-data-model.md 3 · 4절)
--
-- 하는 일
-- 1. 함수 이름 · 인자 · 반환형만 정해 둔다. 본문은 PF_NOT_IMPLEMENTED (API는 501로 보인다).
-- 2. 인자 이름(p_…)은 src/lib/inventory.ts의 rpc 호출과 같아야 한다 — 바꾸려면 eple에게 요청(06 1절).
-- 3. 구현할 때 지킬 것: security definer + set search_path = public, 첫 줄 pf_require_user(),
--    모든 쿼리에 user_id = uid, 재고 · 이력은 한 트랜잭션, 남의 id는 PF_NOT_FOUND(P-07),
--    오류는 raise exception '<코드>' using detail = '<json>' (03 4절 '함수 안 순서').
--
-- 근거: docs/03-data-model.md 4절 · WU-02(자리) · WU-21 · WU-23(구현)
-- 구역: sorek-charlie (docs/06-work-plan.md 1절)
--
-- 이력
-- 2026-11-20  eple  자리 생성 (WU-02) — 구현은 sorek-charlie WU-21 · WU-23

-- 품목 등록 (재고 0). 실패: PF_VALIDATION · PF_DUPLICATE_SKU
create or replace function public.pf_create_item(p_sku_id text, p_item_name text, p_unit_cost integer, p_sale_price integer, p_safety_stock integer, p_source_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_create_item(text, text, integer, integer, integer, text) is '품목 등록 (재고 0) — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 구매를 발주완료로 만든다. purchase_id(P-…)를 매긴다. 실패: PF_NOT_FOUND(품목) · PF_DUPLICATE_INVOICE
create or replace function public.pf_create_purchase(p_sku_id text, p_supplier text, p_order_qty integer, p_purchase_cost integer, p_invoice_no text default null, p_source text default 'form')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_create_purchase(text, text, integer, integer, text, text) is '구매 생성 (발주완료) — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 재고 영향 없는 구매 전이 (이동·통관중 · 품절 · 취소). 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION
create or replace function public.pf_set_purchase_status(p_id uuid, p_to_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_set_purchase_status(uuid, text) is '구매 상태 변경 (재고 영향 없음) — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 입고완료: 재고 +received_qty, 이력 구매입고. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_VALIDATION
create or replace function public.pf_receive_purchase(p_id uuid, p_received_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_receive_purchase(uuid, integer) is '입고 확정 — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 입고취소: 재고 −received_qty, 이력 입고취소. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_INSUFFICIENT_STOCK
create or replace function public.pf_cancel_receipt(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_cancel_receipt(uuid) is '입고 취소 — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 판매를 주문접수로 만든다. sale_id(S-…)를 매긴다. 실패: PF_NOT_FOUND(품목) · PF_DUPLICATE_INVOICE
create or replace function public.pf_create_sale(p_sku_id text, p_channel text, p_sold_qty integer, p_sale_amount integer, p_invoice_no text default null, p_source text default 'form')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_create_sale(text, text, integer, integer, text, text) is '판매 생성 (주문접수) — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 재고 영향 없는 판매 전이 (출고대기 · 주문취소). 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION
create or replace function public.pf_set_sale_status(p_id uuid, p_to_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_set_sale_status(uuid, text) is '판매 상태 변경 (재고 영향 없음) — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 출고완료: 재고 −sold_qty, 이력 실판매출고. 주문접수에서 부르면 출고대기를 거쳐 한 번에. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_INSUFFICIENT_STOCK(detail 남은 수량)
create or replace function public.pf_ship_sale(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_ship_sale(uuid) is '출고 — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 출고취소: 재고 +sold_qty, 이력 출고취소. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION
create or replace function public.pf_cancel_shipment(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pf_require_user();
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_cancel_shipment(uuid) is '출고 취소 — 자리(PF_NOT_IMPLEMENTED), 구현 sorek-charlie';

-- 구매 상태 전이가 허용되는지 판정한다(전이표는 이곳 한곳에만 — 03 3절). 내부용, 사용자 EXECUTE 없음.
create or replace function public.pf_purchase_transition_ok(p_from text, p_to text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_purchase_transition_ok(text, text) is '구매 전이 판정 (03 3절) — 자리, 구현 sorek-charlie. 내부용';

-- 판매 상태 전이가 허용되는지 판정한다(전이표는 이곳 한곳에만 — 03 3절). 내부용, 사용자 EXECUTE 없음.
create or replace function public.pf_sale_transition_ok(p_from text, p_to text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  raise exception 'PF_NOT_IMPLEMENTED';
end;
$$;
comment on function public.pf_sale_transition_ok(text, text) is '판매 전이 판정 (03 3절) — 자리, 구현 sorek-charlie. 내부용';
