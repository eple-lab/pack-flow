# WU-11 대시보드

- 담당: jkspawn / 검증: skygaul / Step 1 / Wave 1 · 11/23(월)
- 브랜치: `feat/WU-11-dashboard`
- 의존: WU-04(목 응답, 이미 main), WU-41(실제 API — 오후에 붙는다)

## 왜 (근거)

계획서 3절 Step 1 "대시보드에는 KPI 카드, 파이프라인 단계별 건수, 품목별 재고 표" + 완료 판정 1번 "품절 임박 카드 표시". 차트는 MVP 이후(표로).

## 읽을 파일

- [04 API 계약](../04-api-contract.md) 3.5절 `Dashboard` 타입
- `src/types/erp.ts`, `src/lib/api-client.ts`, `src/lib/mock/dashboard.ts`
- `src/components/layout/`(자리만 확인), `src/components/common/`(쓸 조각), `src/components/agent/open.ts`(함수 이름만) — 모두 eple 소유, 읽기만
- 계획서 5절 '화면 구성' 대시보드 항목

## 만들 · 고칠 파일 (내 구역만)

- `src/app/(app)/page.tsx`
- `src/components/dashboard/KpiCards.tsx`, `Pipeline.tsx`, `StockTable.tsx`, `AlertCards.tsx`, `RecentChanges.tsx`
- 목 값 보강이 필요하면 eple에게 요청(`src/lib/mock/`은 eple 소유)
- 옆에 `*.test.tsx`(선택)

## 하지 말 것

- 대시보드 숫자를 화면에서 다시 계산하지 않는다. **API가 준 값만 표시**한다(DB 값과 일치해야 하는 테스트 T-S1-3)
- 에이전트 패널을 직접 만들지 않는다. 버튼은 `openAgentPanel(...)`만 부른다(skygaul 구역)
- 차트 라이브러리 추가 금지(MVP 이후)

## 고치는 방법

1. `NEXT_PUBLIC_USE_MOCK=1`로 시작해 목 데이터로 화면을 끝까지 만든다
2. 상단 KPI 4개: 전체 품목 수 · 재고 합계(`item_count` · `stock_total`), 안전재고 미만(`below_safety`, 0보다 크면 경고 배지), 오늘 입고 · 출고(`today_in` · `today_out`)
3. 품절 임박 카드(`alerts`): 품목마다 "품목명 — 재고 4 / 안전재고 5" + 버튼 **[발주서 초안 보기]** → `openAgentPanel({ mode: 'draft-po', sku_ids: [sku_id] })`. 카드 묶음 위에 **[AI 에이전트에게 맡기기]** → `openAgentPanel({ mode: 'draft-po' })`
4. 파이프라인 가로 스텝: 구매 `발주완료 · 이동·통관중 · 입고완료`, 판매 `출고대기 · 출고완료` 건수. 클릭하면 `/trades?status=...`로 이동
5. 품목별 재고 표: 품목코드 · 이름 · 재고 · 안전재고 · 상태(미만이면 빨간 배지). 행 클릭 → `/history?sku_id=...`
6. 최근 변경 5건(`recent_changes`): 시각 · 품목 · `+8`/`−6` · 사유
7. 데이터 로딩 · 오류 상태: 오류면 `error.message`를 그대로 보여 준다
8. WU-41이 병합되면 `NEXT_PUBLIC_USE_MOCK=0`으로 실제 값 확인
9. `data-testid` (E2E가 이 이름을 쓴다 — 바꾸면 sorek-charlie에게 알린다)

| 요소 | testid |
|---|---|
| KPI 카드 | `kpi-item-count`, `kpi-stock-total`, `kpi-below-safety`, `kpi-today-in`, `kpi-today-out` |
| 품절 임박 카드 | `alert-card-<sku_id>` (예 `alert-card-PRD-001`), 버튼 `btn-draft-po-<sku_id>` |
| 맡기기 버튼 | `btn-agent-all` |
| 파이프라인 칸 | `pipe-purchase-<상태>`, `pipe-sale-<상태>` (상태는 한글 그대로) |
| 재고 표 행 | `stock-row-<sku_id>`, 재고 칸 `stock-qty-<sku_id>` |

## 입력 · 오류 처리 ([04](../04-api-contract.md) 4절)

- 숫자 · 날짜는 `src/lib/format.ts`로 표시(천 단위 쉼표, `+8` · `−6`, 한국 시간). 비어 있는 값은 `—`, 품절 임박이 없으면 `EmptyState` ([04](../04-api-contract.md) 4.5 · 4.6)
- 로딩 · 오류는 공통 `Loading` · `ErrorBanner`. 연결 실패 · 시간 초과면 배너의 [다시 시도]

## 다 됐다의 기준

> 11/26 eple 사후 확인: 개발 종료 뒤 소스 · 시험 · 기록으로 확인한 칸만 체크

- [x] lint · typecheck · test:unit 통과 — (11/26 eple 사후 확인: 11/26 `npm run lint` · `typecheck` · `test:unit` 직접 재실행 — 오류 0, unit 49파일 869개 통과)
- [x] 목 데이터: PRD-003(재고 3 / 안전 4)이 품절 임박 카드와 빨간 배지로 보임 — (11/26 eple 사후 확인: src/components/dashboard/dashboard.test.tsx C-04 · C-09 (11/26 재실행 통과))
- [x] 실제 API(dev, 본인 테스트 계정, `demo` 시드): 화면 숫자 = `GET /api/dashboard` 응답 숫자 — (11/26 eple 사후 확인: T-S1-3a(회귀 11/25 10:56 통과, 대시보드 값 = DB 직접 조회) · review-skygaul.md Step 1(demo 배포 화면 118 → 112 · 입고 뒤 120이 순서표와 일치) · review-eple.md Step 1)
- [x] [발주서 초안 보기]가 `openAgentPanel`을 부름 (패널이 아직 비어 있어도 됨) — (11/26 eple 사후 확인: dashboard.test.tsx C-07 · C-08(openAgentPanel 호출) · review-eple.md Step 5(demo 배포에서 노트북 거치대 초안 → [확인]))
- [x] 위 testid 전부 있음 — (11/26 eple 사후 확인: dashboard.test.tsx C-14 · 11/26 소스 grep으로 WU 표의 testid 10종이 src/components/dashboard에 모두 있음)
- [x] 금액 · 수량이 쉼표로, 시각이 한국 시간으로 보임 — (11/26 eple 사후 확인: dashboard.test.tsx C-03(12,345) · C-12(한국 시간 · 부호) 11/26 재실행 통과. 이 화면에는 금액 표시가 없다)

## 테스트 방법

- 자동: E2E는 sorek-charlie가 `tests/e2e/step1.spec.ts`에서 위 testid로 쓴다. 본인은 `npm run test:unit`
- 직접: dev에서 본인 계정으로 `demo` 시드 → 입출고 화면에서 S-201 출고 → 대시보드로 돌아와 PRD-001 재고 4 · 품절 임박 카드 · 오늘 출고 +1 확인

## 실제 동작 확인 항목 (리뷰어 skygaul)

- [x] 브랜치를 받아 `npm run dev` → 위 '직접' 순서대로 확인
- [x] 화면 폭을 휴대폰 크기로 줄여도 표가 깨지지 않음(가로 스크롤 허용)

## 결과 (담당자가 채움)

- 한 것:
- KPI 카드 4개(testid 5개): 전체 품목 수 · 재고 합계 · 안전재고 미만(0보다 크면 경고 배지) · 오늘 입고 · 출고
- 품절 임박 카드 "품목명 — 재고 N / 안전재고 M" + [발주서 초안 보기] → `openAgentPanel({ mode: 'draft-po', sku_ids: [sku_id] })`, 묶음 위 [AI 에이전트에게 맡기기] → `openAgentPanel({ mode: 'draft-po' })`
- 파이프라인 가로 스텝(구매 발주완료 · 이동·통관중 · 입고완료 / 판매 출고대기 · 출고완료) → `/trades?status=<상태>`
- 품목별 재고 표(미만이면 빨간 배지, 가로 스크롤) → 행 클릭 `/history?sku_id=<품목코드>`
- 최근 변경 5건: 한국 시각 · 품목 · `+8`/`−6` · 사유
- 로딩(`Loading`) · 오류(`ErrorBanner`, 연결 실패 · 시간 초과면 [다시 시도]) · 빈 상태(`EmptyState`)
- 숫자 · 미만 여부는 API 값 그대로 표시, 화면에서 다시 계산하지 않음(T-S1-3)
- WU 목록 밖 새 파일 3개 — 모두 내 구역(`src/components/dashboard/`):
  - `DashboardView.tsx`: `page.tsx`가 metadata를 내보내는 서버 컴포넌트라 불러오기 · 상태를 클라이언트 컴포넌트로 나눔
  - `dashboard.module.css`: CSS 모듈 + 토큰 규칙(D-31)
  - `dashboard.test.tsx`: 렌더 시험 C-01~C-14
- AI 사례 기록 `docs/records/ai-cases-jkspawn.md` 사례 1 (C-22, lint 오류 → 수정 → 재확인)

- 직접 확인한 것:
- [x] npm run lint / typecheck / test:unit 통과 (unit 19파일 456개)
- [x] 다 됐다의 기준
  - [x] lint · typecheck · test:unit 통과
  - [x] 목 데이터: PRD-003(재고 3 / 안전 4)이 품절 임박 카드와 빨간 배지로 보임
  - [x] 실제 API(dev, 본인 테스트 계정, `demo` 시드): 화면 숫자 = `GET /api/dashboard` 응답 숫자 — **WU-41 병합 뒤 확인** — (11/26 eple 사후 확인: T-S1-3a(회귀 11/25 10:56 통과, 대시보드 값 = DB 직접 조회) · review-skygaul.md Step 1(demo 배포 화면 118 → 112 · 입고 뒤 120이 순서표와 일치) · review-eple.md Step 1)
  - [x] [발주서 초안 보기]가 `openAgentPanel`을 부름 (패널 자리 "발주서 초안 — 준비 중"이 열림)
  - [x] WU 문서의 testid 전부 있음
  - [x] 수량이 쉼표로, 시각이 한국 시간으로 보임
- [x] 실제 동작 확인: `NEXT_PUBLIC_USE_MOCK=1`로 `npm run dev`, 로그인 뒤 `/`에서 확인 (아래 C-15~C-21)

| ID | 조건 · 행동 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| C-01 | 목 KPI 렌더 | 3 · 53 · 1(경고 배지) · 0 · 0 | 같음 | 통과 |
| C-02 | 안전재고 미만 0 (실패해야 함) | 경고 배지 없음 | 없음 | 통과 |
| C-03 | 재고 합계 12345 · 품목 1200 | `12,345` · `1,200`, 다시 계산 안 함 | 같음 | 통과 |
| C-04 | 목 alerts 렌더 | `alert-card-PRD-003` "노트북 거치대 — 재고 3 / 안전재고 4", 두 버튼 | 같음 | 통과 |
| C-05 | 재고 충분한 PRD-001 · 002 (실패해야 함) | 카드 없음 | 없음 | 통과 |
| C-06 | alerts 빈 배열 | `EmptyState` "품절 임박 품목이 없어요" | 같음 | 통과 |
| C-07 | `openDraftPo('PRD-003')` | `{ mode: 'draft-po', sku_ids: ['PRD-003'] }` | 같음 | 통과 |
| C-08 | `openDraftPo()` | `{ mode: 'draft-po' }` | 같음 | 통과 |
| C-09 | 재고 표 렌더 | PRD-003 빨간 배지, PRD-001 배지 없음, `stock-qty` 값 그대로 | 같음 | 통과 |
| C-10 | 재고 100 · 안전 1인데 `below_safety: true` | API 값을 따라 배지 보임 | 같음 | 통과 |
| C-11 | 파이프라인 렌더 | 5칸 testid · 건수 그대로 · `/trades?status=` 링크 | 같음 | 통과 |
| C-12 | 최근 변경 −6 · +8 | 순서 그대로, U+2212 부호, `14:05:09`(KST), 품목명 | 같음 | 통과 |
| C-13 | 최근 변경 빈 배열 | `EmptyState` | 같음 | 통과 |
| C-14 | 전체 묶음 렌더 | WU 표의 testid 전부 | 같음 | 통과 |
| C-15 | 브라우저 `/` (목) | KPI 3 · 53 · 1 · 0 · 0 | 같음 | 통과 |
| C-16 | 브라우저 `/` (목) | PRD-003 카드 · 빨간 배지, PRD-001 · 002 "정상" | 같음 | 통과 |
| C-17 | [발주서 초안 보기] 클릭 | 에이전트 패널 열림 | 열림 | 통과 |
| C-18 | 파이프라인 "이동·통관중" 클릭 | `/trades?status=이동·통관중` | 같음 | 통과 |
| C-19 | 재고 표 PRD-003 행 클릭 | `/history?sku_id=PRD-003` | 같음 | 통과 |
| C-20 | 화면 폭 375px | 페이지는 375 그대로, 표만 가로 스크롤 | 페이지 375, 표 480 → 310 상자 안 스크롤 | 통과 |
| C-21 | 최근 변경 표시 | `11/23 10:00` · `+3` | 같음 | 통과 |
| C-22 | `npm run lint` | 오류 0 | 처음엔 `react-hooks/set-state-in-effect` 1건 → 응답 콜백에서만 setState하도록 고침 | 통과(수정 후) |

- 확인 못 한 것:
- 실제 API 비교(`NEXT_PUBLIC_USE_MOCK=0`, `demo` 시드, S-201 출고 뒤 PRD-001 재고 4 · 품절 임박 카드 · 오늘 출고 +1) — WU-41 병합 뒤 확인하고 이 PR에 덧붙일 예정
- E2E(`tests/e2e/step1.spec.ts`)는 sorek-charlie 몫이라 돌리지 않음

- AI가 틀린 것과 고친 과정:
- lint react-hooks/set-state-in-effect 오류 → 응답 콜백에서만 setState하도록 수정 → lint 통과

- PR:#4
