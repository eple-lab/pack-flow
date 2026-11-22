-- 일괄 등록 반영 함수 자리: pf_bulk_apply (P-15, docs/03-data-model.md 4절)
--
-- 하는 일
-- 1. 자리만 둔다. 본문은 PF_NOT_IMPLEMENTED (WU-43에서 구현).
-- 2. 구현할 때: 행마다 서브트랜잭션(begin … exception)으로 재고 함수를 부른다 — 유효한 행만 반영,
--    실패 행은 사유를 모아 돌려준다. 입고 행 = 구매 생성 + 바로 입고완료, 출고 행 = 판매 생성 + 바로 출고완료(P-15).
--
-- 근거: docs/03-data-model.md 4절 · docs/04-api-contract.md 3.6 · WU-02(자리) · WU-43(구현)
-- 구역: eple (docs/06-work-plan.md 1절)
--
-- 이력
-- 2026-11-20  eple  처음 작성 — 자리 (WU-02)

-- 일괄 등록 행들을 반영한다. 반환: {applied, skipped: [{line, code, detail}]}
create or replace function public.pf_bulk_apply(p_rows jsonb)
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
comment on function public.pf_bulk_apply(jsonb) is '일괄 등록 반영 (P-15) — 자리(PF_NOT_IMPLEMENTED), 구현 eple WU-43';
