-- WU-23 재고 함수: 구매 상태 변경 · 입고 취소 · 출고 취소
-- 거래와 품목을 잠근 뒤 재고와 반대 원장 기록을 같은 트랜잭션에서 갱신한다.
-- 근거: docs/03-data-model.md 3·4·6절, WU-23
-- 구역: sorek-charlie
-- 이력
-- 2026-11-23  sorek-charlie  처음 작성 (WU-23)

-- 재고에 영향이 없는 구매 상태만 변경한다.
create or replace function public.pf_set_purchase_status(p_id uuid, p_to_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  trade public.purchases%rowtype;
begin
  uid := public.pf_require_user();
  select * into trade from public.purchases where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;

  if p_to_status is null or p_to_status not in ('이동·통관중', '품절', '취소')
    or not public.pf_purchase_transition_ok(trade.status, p_to_status) then
    raise exception 'PF_INVALID_TRANSITION' using detail = json_build_object(
      'from', trade.status, 'to', p_to_status, 'allowed', (
        select coalesce(json_agg(candidate order by position), '[]'::json)
        from unnest(array['이동·통관중', '품절', '취소']) with ordinality as states(candidate, position)
        where public.pf_purchase_transition_ok(trade.status, candidate)
      ))::text;
  end if;

  update public.purchases set status = p_to_status
    where id = p_id and user_id = uid returning * into trade;
  return to_jsonb(trade) - 'user_id';
end;
$$;

-- 실제 입고 수량을 되돌리고 원래 입고 기록을 보존한다.
create or replace function public.pf_cancel_receipt(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  trade public.purchases%rowtype;
  current_stock integer;
begin
  uid := public.pf_require_user();
  select * into trade from public.purchases where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;

  if not public.pf_purchase_transition_ok(trade.status, '입고취소') then
    raise exception 'PF_INVALID_TRANSITION' using detail = json_build_object(
      'from', trade.status, 'to', '입고취소', 'allowed', (
        select coalesce(json_agg(candidate order by position), '[]'::json)
        from unnest(array['이동·통관중', '입고완료', '입고취소', '품절', '취소']) with ordinality as states(candidate, position)
        where public.pf_purchase_transition_ok(trade.status, candidate)
      ))::text;
  end if;

  select stock_qty into current_stock from public.items
    where user_id = uid and sku_id = trade.sku_id for update;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  if current_stock < trade.received_qty then
    raise exception 'PF_INSUFFICIENT_STOCK' using detail = json_build_object(
      'sku_id', trade.sku_id, 'stock_qty', current_stock, 'requested', trade.received_qty)::text;
  end if;

  update public.items set stock_qty = stock_qty - trade.received_qty
    where user_id = uid and sku_id = trade.sku_id returning stock_qty into current_stock;
  insert into public.stock_logs (user_id, sku_id, change_qty, reason, ref_type, ref_id)
    values (uid, trade.sku_id, -trade.received_qty, '입고취소', 'purchase', trade.purchase_id);
  update public.purchases set status = '입고취소'
    where id = p_id and user_id = uid returning * into trade;
  return jsonb_build_object('purchase', to_jsonb(trade) - 'user_id', 'stock_qty', current_stock);
end;
$$;

-- 출고 수량을 복원하고 원래 출고 기록을 보존한다.
create or replace function public.pf_cancel_shipment(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  trade public.sales%rowtype;
  current_stock integer;
begin
  uid := public.pf_require_user();
  select * into trade from public.sales where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;

  if not public.pf_sale_transition_ok(trade.fulfillment_status, '출고취소') then
    raise exception 'PF_INVALID_TRANSITION' using detail = json_build_object(
      'from', trade.fulfillment_status, 'to', '출고취소', 'allowed', (
        select coalesce(json_agg(candidate order by position), '[]'::json)
        from unnest(array['출고대기', '출고완료', '출고취소', '주문취소']) with ordinality as states(candidate, position)
        where public.pf_sale_transition_ok(trade.fulfillment_status, candidate)
      ))::text;
  end if;

  update public.items set stock_qty = stock_qty + trade.sold_qty
    where user_id = uid and sku_id = trade.sku_id returning stock_qty into current_stock;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  insert into public.stock_logs (user_id, sku_id, change_qty, reason, ref_type, ref_id)
    values (uid, trade.sku_id, trade.sold_qty, '출고취소', 'sale', trade.sale_id);
  update public.sales set fulfillment_status = '출고취소'
    where id = p_id and user_id = uid returning * into trade;
  return jsonb_build_object('sale', to_jsonb(trade) - 'user_id', 'stock_qty', current_stock);
end;
$$;

comment on function public.pf_set_purchase_status(uuid, text) is '구매 상태 변경. 재고 영향 없음.';
comment on function public.pf_cancel_receipt(uuid) is '입고 취소. 재고 차감과 반대 이력 기록.';
comment on function public.pf_cancel_shipment(uuid) is '출고 취소. 재고 복원과 반대 이력 기록.';
