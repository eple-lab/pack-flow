-- 핵심 함수: 로그인 확인 pf_require_user, LLM 호출 상한 pf_llm_take (P-04 · P-09)
--
-- 하는 일
-- 1. pf_require_user(): 요청한 사용자의 uid를 돌려준다. 로그인하지 않았으면 PF_UNAUTHENTICATED.
--    모든 재고 함수의 첫 줄에서 부른다(P-04). 사용자에게 직접 EXECUTE를 주지 않는다(rls 마이그레이션).
-- 2. pf_llm_take(user_limit, global_limit): 오늘(한국 시간) 호출 수를 1 올린다.
--    넘으면 올리지 않고 PF_QUOTA_EXCEEDED, detail {"scope":"user"|"global"} (04 2절).
--
-- 근거: docs/03-data-model.md 4절 · docs/04-api-contract.md 2절 · P-04 · P-09 · WU-02
-- 구역: eple (docs/06-work-plan.md 1절)
--
-- 이력
-- 2026-11-20  eple  처음 작성 — pf_require_user, pf_llm_take (WU-02)

-- 로그인한 사용자의 uid를 돌려준다. 없으면 PF_UNAUTHENTICATED.
create or replace function public.pf_require_user()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'PF_UNAUTHENTICATED';
  end if;
  return uid;
end;
$$;
comment on function public.pf_require_user() is '로그인 확인: auth.uid() 없으면 PF_UNAUTHENTICATED (P-04, 내부용)';

-- 오늘 LLM 호출 수를 1 올린다. 사용자 상한 · 전체 상한을 넘으면 PF_QUOTA_EXCEEDED.
-- 같은 날의 호출을 줄 세워(advisory lock) 동시에 들어와도 전체 상한을 넘지 않게 한다.
create or replace function public.pf_llm_take(p_user_limit integer, p_global_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := public.pf_require_user();
  today      date := (now() at time zone 'Asia/Seoul')::date;
  mine       integer;
  everyone   integer;
begin
  if p_user_limit is null or p_user_limit < 0 or p_global_limit is null or p_global_limit < 0 then
    raise exception 'PF_VALIDATION' using detail = '{"field":"limit","reason":"out_of_range"}';
  end if;

  -- 같은 날짜의 호출을 한 줄로 세운다 (트랜잭션이 끝나면 풀린다)
  perform pg_advisory_xact_lock(hashtext('pf_llm_take'), (today - date '2000-01-01'));

  select coalesce(sum(count), 0) into everyone from public.llm_usage where day = today;
  select coalesce(max(count), 0) into mine from public.llm_usage where day = today and user_id = uid;

  if mine >= p_user_limit then
    raise exception 'PF_QUOTA_EXCEEDED' using detail = '{"scope":"user"}';
  end if;
  if everyone >= p_global_limit then
    raise exception 'PF_QUOTA_EXCEEDED' using detail = '{"scope":"global"}';
  end if;

  insert into public.llm_usage (user_id, day, count) values (uid, today, 1)
  on conflict (user_id, day) do update set count = public.llm_usage.count + 1
  returning count into mine;

  return mine;
end;
$$;
comment on function public.pf_llm_take(integer, integer) is
  'LLM 호출 수 +1 (한국 시간 하루). 넘으면 PF_QUOTA_EXCEEDED detail scope (P-09). 반환: 오늘 내 호출 수';
