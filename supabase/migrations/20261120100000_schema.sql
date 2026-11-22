-- PackFlow 스키마: 4테이블 + llm_usage, 제약 · 복합 외래키 · 인덱스 (D-02, docs/03-data-model.md 2절)
--
-- 하는 일
-- 1. items · purchases · sales · stock_logs · llm_usage를 만든다. 모든 행은 user_id로 주인을 가진다.
-- 2. 입력 범위는 docs/04-api-contract.md 4.2와 같은 CHECK로 DB에서도 막는다(D-24).
--    수량 1~100,000 · 금액 0~1,000,000,000 · 글자 수 상한 · 텍스트는 빈 문자열 금지(선택 칸은 null).
-- 3. 거래 · 이력의 품목 참조는 (user_id, sku_id) 복합 외래키 — 남의 품목을 참조할 수 없다(P-05).
-- 4. 송장번호는 사용자 안에서 구매끼리 · 판매끼리 유일, null끼리는 중복이 아니다(P-16, 부분 유일 인덱스).
-- 5. 재고(stock_qty)와 이력(stock_logs)은 재고 함수만 바꾼다(D-10). 권한은 rls 마이그레이션에서 막는다.
--
-- 근거: docs/03-data-model.md 2절 · docs/04-api-contract.md 4.2 · WU-02
-- 구역: eple (docs/06-work-plan.md 1절)
--
-- 이력
-- 2026-11-20  eple  처음 작성 — 4테이블 + llm_usage, CHECK · 복합 외래키 · 인덱스 (WU-02)

-- ── 공통: updated_at 자동 갱신 ──────────────────────────────────────────

-- 행이 바뀔 때 updated_at을 지금 시각으로 바꾼다(트리거 전용, 사용자가 부르지 않음).
create or replace function public.pf_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
comment on function public.pf_touch_updated_at() is '트리거 전용: updated_at 갱신';

-- ── items: 상품 · 재고 마스터 ──────────────────────────────────────────

create table public.items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 영문 대문자 · 숫자 · 하이픈 3~20자, 영문 또는 숫자로 시작 (04 4.2)
  sku_id        text not null check (sku_id ~ '^[A-Z0-9][A-Z0-9-]{2,19}$'),
  item_name     text not null check (length(btrim(item_name)) > 0 and char_length(item_name) <= 100),
  -- 구매처 메모. 화면에서 링크로 열지 않는다(05 5절)
  source_url    text check (source_url is null or (length(btrim(source_url)) > 0 and char_length(source_url) <= 500)),
  unit_cost     integer not null check (unit_cost between 0 and 1000000000),
  sale_price    integer not null check (sale_price between 0 and 1000000000),
  -- 재고는 이력의 합. 함수만 바꾼다(D-10). 상한은 두지 않는다(입고가 쌓이면 10만을 넘을 수 있다)
  stock_qty     integer not null default 0 check (stock_qty >= 0),
  safety_stock  integer not null default 0 check (safety_stock between 0 and 100000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, sku_id)
);
comment on table public.items is '상품 · 재고 마스터. stock_qty는 재고 함수만 바꾼다 (D-10)';

create trigger items_touch before update on public.items
  for each row execute function public.pf_touch_updated_at();

-- ── purchases: 구매 · 입고 ────────────────────────────────────────────

create table public.purchases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 사람이 읽는 번호 P-101. 재고 함수가 매긴다
  purchase_id    text not null check (purchase_id ~ '^P-[0-9]{1,9}$'),
  sku_id         text not null,
  supplier       text not null check (length(btrim(supplier)) > 0 and char_length(supplier) <= 50),
  order_qty      integer not null check (order_qty between 1 and 100000),
  received_qty   integer check (received_qty is null or (received_qty > 0 and received_qty <= order_qty)),
  purchase_cost  integer not null check (purchase_cost between 0 and 1000000000),
  status         text not null default '발주완료'
                 check (status in ('발주완료', '이동·통관중', '입고완료', '입고취소', '품절', '취소')),
  invoice_no     text check (invoice_no is null or invoice_no ~ '^[A-Za-z0-9_-]{1,50}$'),
  source         text not null default 'form' check (source in ('form', 'bulk', 'agent', 'seed')),
  received_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, purchase_id),
  foreign key (user_id, sku_id) references public.items (user_id, sku_id)
);
comment on table public.purchases is '구매 · 입고. 상태 전이는 재고 함수가 판정 (03 3절)';

-- null끼리는 겹치지 않는다 — 빈 송장끼리 중복이 아니다 (P-16, D-24)
create unique index purchases_invoice_uniq on public.purchases (user_id, invoice_no) where invoice_no is not null;
create index purchases_user_created_idx on public.purchases (user_id, created_at desc);

create trigger purchases_touch before update on public.purchases
  for each row execute function public.pf_touch_updated_at();

-- ── sales: 판매 · 출고 ────────────────────────────────────────────────

create table public.sales (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 사람이 읽는 번호 S-201. 재고 함수가 매긴다
  sale_id             text not null check (sale_id ~ '^S-[0-9]{1,9}$'),
  sku_id              text not null,
  -- 판매처. 챗봇 직접 출고는 '직접출고' (P-14)
  channel             text not null check (length(btrim(channel)) > 0 and char_length(channel) <= 30),
  sold_qty            integer not null check (sold_qty between 1 and 100000),
  sale_amount         integer not null check (sale_amount between 0 and 1000000000),
  fulfillment_status  text not null default '주문접수'
                      check (fulfillment_status in ('주문접수', '출고대기', '출고완료', '출고취소', '주문취소')),
  invoice_no          text check (invoice_no is null or invoice_no ~ '^[A-Za-z0-9_-]{1,50}$'),
  source              text not null default 'form' check (source in ('form', 'bulk', 'agent', 'seed')),
  shipped_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, sale_id),
  foreign key (user_id, sku_id) references public.items (user_id, sku_id)
);
comment on table public.sales is '판매 · 출고. 상태 전이는 재고 함수가 판정 (03 3절)';

create unique index sales_invoice_uniq on public.sales (user_id, invoice_no) where invoice_no is not null;
create index sales_user_created_idx on public.sales (user_id, created_at desc);

create trigger sales_touch before update on public.sales
  for each row execute function public.pf_touch_updated_at();

-- ── stock_logs: 재고 원장 (추가만) ────────────────────────────────────

create table public.stock_logs (
  log_id      bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sku_id      text not null,
  -- 입고 +, 출고 −. 0은 기록하지 않는다
  change_qty  integer not null check (change_qty <> 0),
  reason      text not null check (reason in ('구매입고', '실판매출고', '입고취소', '출고취소', '재고조정')),
  ref_type    text not null check (ref_type in ('purchase', 'sale', 'seed')),
  -- P-101 · S-201 같은 사람이 읽는 번호. 시드 초기 재고는 시드 함수가 정한 값
  ref_id      text not null check (length(btrim(ref_id)) > 0 and char_length(ref_id) <= 50),
  created_at  timestamptz not null default now(),
  foreign key (user_id, sku_id) references public.items (user_id, sku_id)
);
comment on table public.stock_logs is '재고 원장. 추가만 한다 — 취소는 반대 기록 (01 6절). 재고 = 이력의 합';

-- 품목별 이력 + 페이지네이션 (03 2절)
create index stock_logs_item_idx on public.stock_logs (user_id, sku_id, created_at desc, log_id desc);
-- 전체 이력 · 대시보드 최근 변동
create index stock_logs_user_idx on public.stock_logs (user_id, created_at desc, log_id desc);

-- ── llm_usage: LLM 호출 수 (P-09) ─────────────────────────────────────

create table public.llm_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  -- 한국 시간 기준 날짜 (pf_llm_take가 정한다)
  day      date not null,
  count    integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
comment on table public.llm_usage is 'LLM 호출 수. pf_llm_take()만 증가시킨다 (P-09)';
create index llm_usage_day_idx on public.llm_usage (day);
