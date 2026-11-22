-- 시연 데이터 초기화: pf_reset_and_seed — 본인 데이터만 지우고 시드를 다시 넣는다 (D-10, docs/03-data-model.md 4 · 7절)
--
-- 하는 일
-- 1. security definer + set search_path = public, 첫 줄 pf_require_user()로 주인(uid)을 확인한다(P-04).
-- 2. 입력 모양을 검사한다: items는 배열(필수), purchases · sales · events는 배열(없으면 빈 배열). 어긋나면 PF_VALIDATION.
-- 3. 본인 데이터만 지운다 — 이력 → 판매 · 구매 → 품목 순, 모든 쿼리에 user_id = uid. (llm_usage는 건드리지 않는다: 호출 상한을 초기화로 되돌리지 못하게)
-- 4. 품목을 넣고 초기 재고는 '재고조정' 이력으로 함께 넣는다(재고 = 이력의 합). 이어서 구매 · 판매를 넣는다(source = 'seed').
--    구매 · 판매의 시드 상태는 재고에 영향이 없는 것만 허용한다(입고완료 · 출고완료 등은 events가 재고 함수로 만든다).
-- 5. events를 재고 함수(pf_receive_purchase · pf_ship_sale …)로 차례대로 실행한다 — 시드 이력도 실제 기능과 같은 규칙을 지난다.
--    재고 함수가 아직 stub(PF_NOT_IMPLEMENTED)인 동안은 events가 비어 있는 시드만 성공한다(WU-21 · 23 뒤 전부 동작).
--    한 줄이라도 실패하면 함수 전체가 롤백되어 기존 데이터가 그대로 남는다.
-- 6. 넣은 건수 {items, purchases, sales, logs}를 돌려준다. logs는 초기화 뒤 이 사용자의 stock_logs 전체 행 수(초기 재고 + events가 만든 것).
--
-- "기록은 지우지 않는다"(01 6절)의 유일한 예외가 이 함수다. stock_logs는 사용자에게 DELETE 권한이 없지만
-- security definer 함수 안에서는 지울 수 있다. 시연 · 테스트 초기화만을 위한 것이고, 지우는 범위는 본인 데이터뿐이다.
--
-- 근거: docs/03-data-model.md 4 · 7절, docs/work-units/WU-00-skeleton.md WU-08 4번, D-10, P-04
-- 구역: eple (시드 데이터 · 정답표는 sorek-charlie)
--
-- 이력
-- 2026-11-23  eple  처음 작성 — pf_reset_and_seed (WU-08)

-- 본인 데이터를 지우고 시드를 넣는다. 실패: PF_UNAUTHENTICATED · PF_VALIDATION(입력 모양 · 값 오류) · PF_NOT_IMPLEMENTED(events가 stub 함수를 부를 때)
create or replace function public.pf_reset_and_seed(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid          uuid := public.pf_require_user();
  v_item       jsonb;
  v_row        jsonb;
  v_event      jsonb;
  v_id         uuid;
  v_qty        integer;
  n_items      integer := 0;
  n_purchases  integer := 0;
  n_sales      integer := 0;
  n_logs       integer;
begin
  -- 2. 입력 모양 검사
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'PF_VALIDATION' using detail = '{"field":"data","reason":"bad_format"}';
  end if;
  if jsonb_typeof(p_data -> 'items') is distinct from 'array' then
    raise exception 'PF_VALIDATION' using detail = '{"field":"items","reason":"bad_format"}';
  end if;
  if jsonb_typeof(coalesce(p_data -> 'purchases', '[]'::jsonb)) <> 'array' then
    raise exception 'PF_VALIDATION' using detail = '{"field":"purchases","reason":"bad_format"}';
  end if;
  if jsonb_typeof(coalesce(p_data -> 'sales', '[]'::jsonb)) <> 'array' then
    raise exception 'PF_VALIDATION' using detail = '{"field":"sales","reason":"bad_format"}';
  end if;
  if jsonb_typeof(coalesce(p_data -> 'events', '[]'::jsonb)) <> 'array' then
    raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"bad_format"}';
  end if;

  begin
    -- 3. 본인 데이터만 지운다(이력 → 판매 · 구매 → 품목). 모든 쿼리에 user_id = uid
    delete from stock_logs where user_id = uid;
    delete from sales      where user_id = uid;
    delete from purchases  where user_id = uid;
    delete from items      where user_id = uid;

    -- 4a. 품목 + 초기 재고(재고조정 이력)
    for v_item in select * from jsonb_array_elements(p_data -> 'items') loop
      if jsonb_typeof(v_item) <> 'object' then
        raise exception 'PF_VALIDATION' using detail = '{"field":"items","reason":"bad_format"}';
      end if;
      v_qty := coalesce((v_item ->> 'initial_qty')::integer, 0);
      if v_qty < 0 then
        raise exception 'PF_VALIDATION' using detail = '{"field":"initial_qty","reason":"out_of_range"}';
      end if;
      insert into items (user_id, sku_id, item_name, source_url, unit_cost, sale_price, stock_qty, safety_stock)
      values (
        uid,
        v_item ->> 'sku_id',
        v_item ->> 'item_name',
        nullif(btrim(v_item ->> 'source_url'), ''),
        (v_item ->> 'unit_cost')::integer,
        (v_item ->> 'sale_price')::integer,
        v_qty,
        coalesce((v_item ->> 'safety_stock')::integer, 0)
      );
      if v_qty > 0 then
        insert into stock_logs (user_id, sku_id, change_qty, reason, ref_type, ref_id)
        values (uid, v_item ->> 'sku_id', v_qty, '재고조정', 'seed', 'SEED');
      end if;
      n_items := n_items + 1;
    end loop;

    -- 4b. 구매 — 재고에 영향이 없는 상태만(입고완료 · 입고취소는 events가 만든다)
    for v_row in select * from jsonb_array_elements(coalesce(p_data -> 'purchases', '[]'::jsonb)) loop
      if jsonb_typeof(v_row) <> 'object'
         or coalesce(v_row ->> 'status', '발주완료') not in ('발주완료', '이동·통관중', '품절', '취소') then
        raise exception 'PF_VALIDATION' using detail = '{"field":"purchases","reason":"not_allowed_value"}';
      end if;
      insert into purchases (user_id, purchase_id, sku_id, supplier, order_qty, purchase_cost, status, invoice_no, source)
      values (
        uid,
        v_row ->> 'purchase_id',
        v_row ->> 'sku_id',
        v_row ->> 'supplier',
        (v_row ->> 'order_qty')::integer,
        (v_row ->> 'purchase_cost')::integer,
        coalesce(v_row ->> 'status', '발주완료'),
        nullif(btrim(v_row ->> 'invoice_no'), ''),
        'seed'
      );
      n_purchases := n_purchases + 1;
    end loop;

    -- 4c. 판매 — 재고에 영향이 없는 상태만(출고완료 · 출고취소는 events가 만든다)
    for v_row in select * from jsonb_array_elements(coalesce(p_data -> 'sales', '[]'::jsonb)) loop
      if jsonb_typeof(v_row) <> 'object'
         or coalesce(v_row ->> 'fulfillment_status', '주문접수') not in ('주문접수', '출고대기', '주문취소') then
        raise exception 'PF_VALIDATION' using detail = '{"field":"sales","reason":"not_allowed_value"}';
      end if;
      insert into sales (user_id, sale_id, sku_id, channel, sold_qty, sale_amount, fulfillment_status, invoice_no, source)
      values (
        uid,
        v_row ->> 'sale_id',
        v_row ->> 'sku_id',
        v_row ->> 'channel',
        (v_row ->> 'sold_qty')::integer,
        (v_row ->> 'sale_amount')::integer,
        coalesce(v_row ->> 'fulfillment_status', '주문접수'),
        nullif(btrim(v_row ->> 'invoice_no'), ''),
        'seed'
      );
      n_sales := n_sales + 1;
    end loop;

    -- 5. events를 재고 함수로 차례대로 실행(stub이면 PF_NOT_IMPLEMENTED가 그대로 올라와 전체가 롤백된다)
    for v_event in select * from jsonb_array_elements(coalesce(p_data -> 'events', '[]'::jsonb)) loop
      if jsonb_typeof(v_event) <> 'object' then
        raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"bad_format"}';
      end if;
      case v_event ->> 'op'
        when 'receive' then
          select id into v_id from purchases where user_id = uid and purchase_id = v_event ->> 'purchase_id';
          if v_id is null then
            raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"bad_format"}';
          end if;
          perform public.pf_receive_purchase(v_id, (v_event ->> 'received_qty')::integer);
        when 'cancel_receipt' then
          select id into v_id from purchases where user_id = uid and purchase_id = v_event ->> 'purchase_id';
          if v_id is null then
            raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"bad_format"}';
          end if;
          perform public.pf_cancel_receipt(v_id);
        when 'purchase_status' then
          select id into v_id from purchases where user_id = uid and purchase_id = v_event ->> 'purchase_id';
          if v_id is null then
            raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"bad_format"}';
          end if;
          perform public.pf_set_purchase_status(v_id, v_event ->> 'to');
        when 'ship' then
          select id into v_id from sales where user_id = uid and sale_id = v_event ->> 'sale_id';
          if v_id is null then
            raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"bad_format"}';
          end if;
          perform public.pf_ship_sale(v_id);
        when 'cancel_shipment' then
          select id into v_id from sales where user_id = uid and sale_id = v_event ->> 'sale_id';
          if v_id is null then
            raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"bad_format"}';
          end if;
          perform public.pf_cancel_shipment(v_id);
        when 'sale_status' then
          select id into v_id from sales where user_id = uid and sale_id = v_event ->> 'sale_id';
          if v_id is null then
            raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"bad_format"}';
          end if;
          perform public.pf_set_sale_status(v_id, v_event ->> 'to');
        else
          raise exception 'PF_VALIDATION' using detail = '{"field":"events","reason":"not_allowed_value"}';
      end case;
    end loop;
  exception
    -- 값이 표의 CHECK · 형식 · 외래키 · 중복에 어긋나면 DB 오류 대신 PF_VALIDATION으로 바꾼다(PF_… 오류는 그대로 지나간다)
    when check_violation or not_null_violation or foreign_key_violation or unique_violation
         or invalid_text_representation or numeric_value_out_of_range then
      raise exception 'PF_VALIDATION' using detail = '{"field":"data","reason":"bad_format"}';
  end;

  select count(*) into n_logs from stock_logs where user_id = uid;
  return jsonb_build_object('items', n_items, 'purchases', n_purchases, 'sales', n_sales, 'logs', n_logs);
end;
$$;

comment on function public.pf_reset_and_seed(jsonb) is
  '시연 데이터 초기화: 본인 데이터만 지우고 시드를 다시 넣는다(재고 = 이력의 합). events는 재고 함수로 실행. "기록은 지우지 않는다"의 유일한 예외 (WU-08)';

-- authenticated만 부를 수 있다(anon · public 제외). 새 함수의 기본 권한과 같지만 명시해 둔다.
revoke execute on function public.pf_reset_and_seed(jsonb) from public, anon;
grant execute on function public.pf_reset_and_seed(jsonb) to authenticated;
