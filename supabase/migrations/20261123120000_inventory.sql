-- WU-21 재고 함수: 등록 · 입고 · 출고
-- 사용자별 거래와 재고 원장을 같은 트랜잭션에서 처리한다.
-- 근거: docs/03-data-model.md 3·4·6절 · WU-21
-- 구역: sorek-charlie
-- 이력
-- 2026-11-23  sorek-charlie  처음 작성 — 적용된 골격의 재고 RPC 교체 (WU-21)

-- 구매 전이 판정. 오류와 부작용 없음.
create or replace function public.pf_purchase_transition_ok(p_from text, p_to text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  return coalesce(case p_from
    when '발주완료' then p_to in ('이동·통관중', '입고완료', '품절', '취소')
    when '이동·통관중' then p_to in ('입고완료', '취소')
    when '입고완료' then p_to = '입고취소'
    else false
  end, false);
end;
$$;

-- 판매 전이 판정. 오류와 부작용 없음.
create or replace function public.pf_sale_transition_ok(p_from text, p_to text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  return coalesce(case p_from
    when '주문접수' then p_to in ('출고대기', '주문취소')
    when '출고대기' then p_to in ('출고완료', '주문취소')
    when '출고완료' then p_to = '출고취소'
    else false
  end, false);
end;
$$;

-- 품목을 재고 0으로 등록한다. 실패: PF_VALIDATION · PF_DUPLICATE_SKU.
create or replace function public.pf_create_item(p_sku_id text, p_item_name text, p_unit_cost integer, p_sale_price integer, p_safety_stock integer, p_source_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  item public.items%rowtype;
begin
  uid := public.pf_require_user();
  p_sku_id := nullif(regexp_replace(p_sku_id, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  p_item_name := nullif(regexp_replace(p_item_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  p_source_url := nullif(regexp_replace(p_source_url, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  if p_sku_id is null then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sku_id', 'reason', 'required')::text;
  end if;
  if p_sku_id !~ '^[A-Z0-9][A-Z0-9-]{2,19}$' then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sku_id', 'reason', 'bad_format')::text;
  end if;
  if p_item_name is null then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'item_name', 'reason', 'required')::text;
  end if;
  if char_length(p_item_name) > 100 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'item_name', 'reason', 'too_long', 'max', 100)::text;
  end if;
  if p_unit_cost is null or p_unit_cost not between 0 and 1000000000 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'unit_cost', 'reason',
      case when p_unit_cost is null then 'required' else 'out_of_range' end, 'min', 0, 'max', 1000000000)::text;
  end if;
  if p_sale_price is null or p_sale_price not between 0 and 1000000000 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sale_price', 'reason',
      case when p_sale_price is null then 'required' else 'out_of_range' end, 'min', 0, 'max', 1000000000)::text;
  end if;
  if p_safety_stock is null or p_safety_stock not between 0 and 100000 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'safety_stock', 'reason',
      case when p_safety_stock is null then 'required' else 'out_of_range' end, 'min', 0, 'max', 100000)::text;
  end if;
  if char_length(p_source_url) > 500 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'source_url', 'reason', 'too_long', 'max', 500)::text;
  end if;

  insert into public.items (user_id, sku_id, item_name, unit_cost, sale_price, safety_stock, source_url)
    values (uid, p_sku_id, p_item_name, p_unit_cost, p_sale_price, p_safety_stock, p_source_url)
    on conflict (user_id, sku_id) do nothing returning * into item;
  if not found then
    raise exception 'PF_DUPLICATE_SKU' using detail = json_build_object('sku_id', p_sku_id)::text;
  end if;
  return to_jsonb(item) - 'user_id';
end;
$$;

-- 구매 번호를 발급하고 발주를 등록한다. 실패: PF_VALIDATION · PF_NOT_FOUND · PF_DUPLICATE_INVOICE.
create or replace function public.pf_create_purchase(p_sku_id text, p_supplier text, p_order_qty integer, p_purchase_cost integer, p_invoice_no text default null, p_source text default 'form')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  next_number integer;
  trade public.purchases%rowtype;
begin
  uid := public.pf_require_user();
  p_sku_id := nullif(regexp_replace(p_sku_id, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  p_supplier := nullif(regexp_replace(p_supplier, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  p_invoice_no := nullif(regexp_replace(p_invoice_no, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  p_source := nullif(regexp_replace(p_source, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  if p_sku_id is null then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sku_id', 'reason', 'required')::text;
  end if;
  if p_sku_id !~ '^[A-Z0-9][A-Z0-9-]{2,19}$' then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sku_id', 'reason', 'bad_format')::text;
  end if;
  if p_supplier is null then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'supplier', 'reason', 'required')::text;
  end if;
  if char_length(p_supplier) > 50 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'supplier', 'reason', 'too_long', 'max', 50)::text;
  end if;
  if p_order_qty is null or p_order_qty not between 1 and 100000 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'order_qty', 'reason',
      case when p_order_qty is null then 'required' else 'out_of_range' end, 'min', 1, 'max', 100000)::text;
  end if;
  if p_purchase_cost is null or p_purchase_cost not between 0 and 1000000000 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'purchase_cost', 'reason',
      case when p_purchase_cost is null then 'required' else 'out_of_range' end, 'min', 0, 'max', 1000000000)::text;
  end if;
  if char_length(p_invoice_no) > 50 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'invoice_no', 'reason', 'too_long', 'max', 50)::text;
  end if;
  if p_invoice_no !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'invoice_no', 'reason', 'bad_format')::text;
  end if;
  if p_source is null then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'source', 'reason', 'required')::text;
  end if;
  if p_source not in ('form', 'bulk', 'agent', 'seed') then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'source', 'reason', 'not_allowed_value')::text;
  end if;

  -- 같은 사용자의 거래 번호 발급을 직렬화한다.
  perform pg_advisory_xact_lock(hashtext('pf_create_purchase'), hashtext(uid::text));
  perform 1 from public.items where user_id = uid and sku_id = p_sku_id for key share;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  select coalesce(max(substring(purchase_id from 3)::integer), 0) + 1 into next_number
    from public.purchases where user_id = uid;
  insert into public.purchases (user_id, purchase_id, sku_id, supplier, order_qty, purchase_cost, invoice_no, source)
    values (uid, 'P-' || next_number, p_sku_id, p_supplier, p_order_qty, p_purchase_cost, p_invoice_no, p_source)
    on conflict (user_id, invoice_no) where invoice_no is not null do nothing returning * into trade;
  if not found then
    raise exception 'PF_DUPLICATE_INVOICE' using detail = json_build_object('invoice_no', p_invoice_no)::text;
  end if;
  return to_jsonb(trade) - 'user_id';
end;
$$;

-- 입고를 확정하고 재고와 원장을 갱신한다. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_VALIDATION.
create or replace function public.pf_receive_purchase(p_id uuid, p_received_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  trade public.purchases%rowtype;
  new_stock integer;
begin
  uid := public.pf_require_user();
  select * into trade from public.purchases where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  if not public.pf_purchase_transition_ok(trade.status, '입고완료') then
    raise exception 'PF_INVALID_TRANSITION' using detail = json_build_object(
      'from', trade.status, 'to', '입고완료', 'allowed', (
        select coalesce(json_agg(candidate order by position), '[]'::json)
        from unnest(array['발주완료', '이동·통관중', '입고완료', '입고취소', '품절', '취소']) with ordinality as states(candidate, position)
        where public.pf_purchase_transition_ok(trade.status, candidate)
      ))::text;
  end if;
  if p_received_qty is null or p_received_qty not between 1 and trade.order_qty then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'received_qty', 'reason',
      case when p_received_qty is null then 'required' else 'out_of_range' end, 'min', 1, 'max', trade.order_qty)::text;
  end if;

  update public.items set stock_qty = stock_qty + p_received_qty
    where user_id = uid and sku_id = trade.sku_id returning stock_qty into new_stock;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  insert into public.stock_logs (user_id, sku_id, change_qty, reason, ref_type, ref_id)
    values (uid, trade.sku_id, p_received_qty, '구매입고', 'purchase', trade.purchase_id);
  update public.purchases set status = '입고완료', received_qty = p_received_qty, received_at = now()
    where id = p_id and user_id = uid returning * into trade;
  return jsonb_build_object('purchase', to_jsonb(trade) - 'user_id', 'stock_qty', new_stock);
end;
$$;

-- 판매 번호를 발급하고 주문을 등록한다. 실패: PF_VALIDATION · PF_NOT_FOUND · PF_DUPLICATE_INVOICE.
create or replace function public.pf_create_sale(p_sku_id text, p_channel text, p_sold_qty integer, p_sale_amount integer, p_invoice_no text default null, p_source text default 'form')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  next_number integer;
  trade public.sales%rowtype;
begin
  uid := public.pf_require_user();
  p_sku_id := nullif(regexp_replace(p_sku_id, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  p_channel := nullif(regexp_replace(p_channel, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  p_invoice_no := nullif(regexp_replace(p_invoice_no, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  p_source := nullif(regexp_replace(p_source, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  if p_sku_id is null then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sku_id', 'reason', 'required')::text;
  end if;
  if p_sku_id !~ '^[A-Z0-9][A-Z0-9-]{2,19}$' then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sku_id', 'reason', 'bad_format')::text;
  end if;
  if p_channel is null then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'channel', 'reason', 'required')::text;
  end if;
  if char_length(p_channel) > 30 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'channel', 'reason', 'too_long', 'max', 30)::text;
  end if;
  if p_sold_qty is null or p_sold_qty not between 1 and 100000 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sold_qty', 'reason',
      case when p_sold_qty is null then 'required' else 'out_of_range' end, 'min', 1, 'max', 100000)::text;
  end if;
  if p_sale_amount is null or p_sale_amount not between 0 and 1000000000 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'sale_amount', 'reason',
      case when p_sale_amount is null then 'required' else 'out_of_range' end, 'min', 0, 'max', 1000000000)::text;
  end if;
  if char_length(p_invoice_no) > 50 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'invoice_no', 'reason', 'too_long', 'max', 50)::text;
  end if;
  if p_invoice_no !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'invoice_no', 'reason', 'bad_format')::text;
  end if;
  if p_source is null then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'source', 'reason', 'required')::text;
  end if;
  if p_source not in ('form', 'bulk', 'agent', 'seed') then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'source', 'reason', 'not_allowed_value')::text;
  end if;

  -- 같은 사용자의 거래 번호 발급을 직렬화한다.
  perform pg_advisory_xact_lock(hashtext('pf_create_sale'), hashtext(uid::text));
  perform 1 from public.items where user_id = uid and sku_id = p_sku_id for key share;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  select coalesce(max(substring(sale_id from 3)::integer), 0) + 1 into next_number
    from public.sales where user_id = uid;
  insert into public.sales (user_id, sale_id, sku_id, channel, sold_qty, sale_amount, invoice_no, source)
    values (uid, 'S-' || next_number, p_sku_id, p_channel, p_sold_qty, p_sale_amount, p_invoice_no, p_source)
    on conflict (user_id, invoice_no) where invoice_no is not null do nothing returning * into trade;
  if not found then
    raise exception 'PF_DUPLICATE_INVOICE' using detail = json_build_object('invoice_no', p_invoice_no)::text;
  end if;
  return to_jsonb(trade) - 'user_id';
end;
$$;

-- 재고 변경 없이 판매 상태를 바꾼다. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION.
create or replace function public.pf_set_sale_status(p_id uuid, p_to_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  trade public.sales%rowtype;
begin
  uid := public.pf_require_user();
  select * into trade from public.sales where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  p_to_status := nullif(regexp_replace(p_to_status, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  if p_to_status is null or p_to_status not in ('출고대기', '주문취소') or not public.pf_sale_transition_ok(trade.fulfillment_status, p_to_status) then
    raise exception 'PF_INVALID_TRANSITION' using detail = json_build_object(
      'from', trade.fulfillment_status, 'to', p_to_status, 'allowed', (
        select coalesce(json_agg(candidate order by position), '[]'::json)
        from unnest(array['주문접수', '출고대기', '출고완료', '출고취소', '주문취소']) with ordinality as states(candidate, position)
        where public.pf_sale_transition_ok(trade.fulfillment_status, candidate)
      ))::text;
  end if;
  update public.sales set fulfillment_status = p_to_status
    where id = p_id and user_id = uid returning * into trade;
  return to_jsonb(trade) - 'user_id';
end;
$$;

-- 출고를 확정하고 재고와 원장을 갱신한다. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_INSUFFICIENT_STOCK.
create or replace function public.pf_ship_sale(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  trade public.sales%rowtype;
  current_stock integer;
  from_status text;
begin
  uid := public.pf_require_user();
  select * into trade from public.sales where id = p_id and user_id = uid for update;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  from_status := trade.fulfillment_status;
  -- 주문접수의 중간 단계는 출고 트랜잭션 안에서 전이만 확인한다.
  if from_status = '주문접수' and public.pf_sale_transition_ok(from_status, '출고대기') then
    from_status := '출고대기';
  end if;
  if not public.pf_sale_transition_ok(from_status, '출고완료') then
    raise exception 'PF_INVALID_TRANSITION' using detail = json_build_object(
      'from', from_status, 'to', '출고완료', 'allowed', (
        select coalesce(json_agg(candidate order by position), '[]'::json)
        from unnest(array['주문접수', '출고대기', '출고완료', '출고취소', '주문취소']) with ordinality as states(candidate, position)
        where public.pf_sale_transition_ok(from_status, candidate)
      ))::text;
  end if;

  select stock_qty into current_stock from public.items
    where user_id = uid and sku_id = trade.sku_id for update;
  if not found then
    raise exception 'PF_NOT_FOUND';
  end if;
  if current_stock < trade.sold_qty then
    raise exception 'PF_INSUFFICIENT_STOCK' using detail = json_build_object(
      'sku_id', trade.sku_id, 'stock_qty', current_stock, 'requested', trade.sold_qty)::text;
  end if;
  update public.items set stock_qty = stock_qty - trade.sold_qty
    where user_id = uid and sku_id = trade.sku_id returning stock_qty into current_stock;
  insert into public.stock_logs (user_id, sku_id, change_qty, reason, ref_type, ref_id)
    values (uid, trade.sku_id, -trade.sold_qty, '실판매출고', 'sale', trade.sale_id);
  update public.sales set fulfillment_status = '출고완료', shipped_at = now()
    where id = p_id and user_id = uid returning * into trade;
  return jsonb_build_object('sale', to_jsonb(trade) - 'user_id', 'stock_qty', current_stock);
end;
$$;

comment on function public.pf_purchase_transition_ok(text, text) is '구매 전이 판정. 오류와 부작용 없음.';
comment on function public.pf_sale_transition_ok(text, text) is '판매 전이 판정. 오류와 부작용 없음.';
comment on function public.pf_create_item(text, text, integer, integer, integer, text) is '품목을 재고 0으로 등록한다. 실패: PF_VALIDATION · PF_DUPLICATE_SKU.';
comment on function public.pf_create_purchase(text, text, integer, integer, text, text) is '구매 번호를 발급하고 발주를 등록한다. 실패: PF_VALIDATION · PF_NOT_FOUND · PF_DUPLICATE_INVOICE.';
comment on function public.pf_receive_purchase(uuid, integer) is '입고를 확정하고 재고와 원장을 갱신한다. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_VALIDATION.';
comment on function public.pf_create_sale(text, text, integer, integer, text, text) is '판매 번호를 발급하고 주문을 등록한다. 실패: PF_VALIDATION · PF_NOT_FOUND · PF_DUPLICATE_INVOICE.';
comment on function public.pf_set_sale_status(uuid, text) is '재고 변경 없이 판매 상태를 바꾼다. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION.';
comment on function public.pf_ship_sale(uuid) is '출고를 확정하고 재고와 원장을 갱신한다. 실패: PF_NOT_FOUND · PF_INVALID_TRANSITION · PF_INSUFFICIENT_STOCK.';
