-- 일괄 등록 반영 함수 본문: pf_bulk_apply (P-15, WU-43)
--
-- 하는 일
-- 1. 20261120100300_bulk.sql의 자리(PF_NOT_IMPLEMENTED)를 실제 본문으로 바꾼다.
--    시그니처 · 반환형은 자리와 같다(pf_bulk_apply(jsonb) returns jsonb) — create or replace가 같은 함수를 덮어쓰므로
--    새 오버로드가 생기지 않고, 20261120100400_rls.sql의 권한(PUBLIC 회수 · authenticated만 실행)이 그대로 유지된다.
-- 2. 행마다 서브트랜잭션(begin … exception when others)으로 재고 함수만 부른다(원칙 1 — 여기서 재고를 직접 바꾸지 않는다):
--      입고 행: pf_create_purchase(source 'bulk', 금액 = 품목 unit_cost × 수량) → pf_receive_purchase(받은 수량 = 수량)
--      출고 행: pf_create_sale(channel = 거래처, source 'bulk', 금액 = 품목 sale_price × 수량) → pf_ship_sale
--    한 행에서 실패하면 그 행의 변경(구매 · 판매 생성 포함)은 서브트랜잭션이 되돌리고, 사유만 모은 뒤 다음 행으로 간다.
-- 3. 반환: { applied: 반영한 행 수, skipped: [{ line, code, message }] }. code는 재고 함수가 던진 PF_ 코드,
--    목록에 없는 오류는 PF_INTERNAL이다. message는 04 4.4 문구(원문 DB 오류 · 테이블 이름은 싣지 않는다).
-- 4. 행 수 500 초과 · 배열이 아닌 입력 → PF_VALIDATION(전체 거절). 로그인 확인은 pf_require_user().
-- 5. 비고(memo)는 구매 · 판매 표에 칸이 없어 저장하지 않는다(재고 함수 시그니처에 없음).
--
-- 근거: docs/03-data-model.md 4절 · docs/04-api-contract.md 3.6 · 4.4 · docs/05-security.md 5절 · WU-43
-- 구역: eple (docs/06-work-plan.md 1절)
--
-- 이력
-- 2026-11-23  eple  처음 작성 — pf_bulk_apply 실제 본문 (WU-43)

-- 일괄 등록 행들을 반영한다. 행: {line, kind('입고'|'출고'), sku_id, qty, partner, invoice_no, memo}.
-- 실패: PF_UNAUTHENTICATED · PF_VALIDATION(행 수 · 형식). 행 단위 실패는 반환값의 skipped에 들어간다.
create or replace function public.pf_bulk_apply(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  r jsonb;
  idx integer := 0;
  row_line integer;
  applied_count integer := 0;
  skipped jsonb := '[]'::jsonb;
  err_code text;
  row_kind text;
  row_qty integer;
  unit_money bigint;
  amount bigint;
  made jsonb;
begin
  uid := public.pf_require_user();
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'rows', 'reason', 'required')::text;
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'PF_VALIDATION' using detail = json_build_object('field', 'rows', 'reason', 'too_long', 'max', 500)::text;
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    idx := idx + 1;
    row_line := case when jsonb_typeof(r) = 'object' and (r->>'line') ~ '^[0-9]{1,9}$' then (r->>'line')::integer else idx end;
    begin
      if jsonb_typeof(r) <> 'object' then
        raise exception 'PF_VALIDATION';
      end if;
      row_kind := r->>'kind';
      if row_kind is null or row_kind not in ('입고', '출고') then
        raise exception 'PF_VALIDATION';
      end if;
      if jsonb_typeof(r->'qty') is distinct from 'number' or (r->>'qty') !~ '^[0-9]{1,6}$' then
        raise exception 'PF_VALIDATION';
      end if;
      row_qty := (r->>'qty')::integer;
      if jsonb_typeof(r->'sku_id') is distinct from 'string' or jsonb_typeof(r->'partner') is distinct from 'string' then
        raise exception 'PF_VALIDATION';
      end if;
      if r->'invoice_no' is not null and jsonb_typeof(r->'invoice_no') not in ('string', 'null') then
        raise exception 'PF_VALIDATION';
      end if;

      -- 금액은 품목 단가 × 수량(계산은 코드, 원칙 4). 없는 품목 · 남의 품목은 PF_NOT_FOUND(P-07).
      select case when row_kind = '입고' then unit_cost else sale_price end::bigint into unit_money
        from public.items where user_id = uid and sku_id = btrim(r->>'sku_id');
      if not found then
        raise exception 'PF_NOT_FOUND';
      end if;
      amount := unit_money * row_qty;
      if amount > 1000000000 then
        raise exception 'PF_VALIDATION';
      end if;

      if row_kind = '입고' then
        made := public.pf_create_purchase(r->>'sku_id', r->>'partner', row_qty, amount::integer, r->>'invoice_no', 'bulk');
        perform public.pf_receive_purchase((made->>'id')::uuid, row_qty);
      else
        made := public.pf_create_sale(r->>'sku_id', r->>'partner', row_qty, amount::integer, r->>'invoice_no', 'bulk');
        perform public.pf_ship_sale((made->>'id')::uuid);
      end if;
      applied_count := applied_count + 1;
    exception when others then
      -- 이 행의 변경은 되돌려졌다. 알려진 PF_ 코드만 그대로 싣고, 나머지(원문 DB 오류)는 PF_INTERNAL로 가린다.
      err_code := case
        when SQLERRM in ('PF_VALIDATION', 'PF_NOT_FOUND', 'PF_DUPLICATE_INVOICE', 'PF_INSUFFICIENT_STOCK', 'PF_INVALID_TRANSITION')
          then SQLERRM
        else 'PF_INTERNAL'
      end;
      skipped := skipped || jsonb_build_array(jsonb_build_object(
        'line', row_line,
        'code', err_code,
        'message', case err_code
          when 'PF_VALIDATION' then '입력값을 확인해 주세요'
          when 'PF_NOT_FOUND' then '찾을 수 없어요. 목록을 새로고침해 주세요'
          when 'PF_DUPLICATE_INVOICE' then '이미 등록된 송장번호예요'
          when 'PF_INSUFFICIENT_STOCK' then '재고가 부족해요'
          when 'PF_INVALID_TRANSITION' then '지금 상태에서는 바꿀 수 없어요'
          else '잠시 문제가 생겼어요. 다시 시도해 주세요'
        end));
    end;
  end loop;

  return jsonb_build_object('applied', applied_count, 'skipped', skipped);
end;
$$;
comment on function public.pf_bulk_apply(jsonb) is '일괄 등록 반영 (P-15) — 행마다 서브트랜잭션으로 재고 함수 호출, 반환 {applied, skipped[]} (WU-43)';
