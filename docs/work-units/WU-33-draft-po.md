# WU-33 발주서 초안 API · 에이전트 패널

- 담당: skygaul / 검증: eple / Step 5 / Wave 2 · 11/24(화) **14시 전**
- 브랜치: `feat/WU-33-draft-po`
- 의존: WU-31, WU-32, WU-21(`pf_create_purchase`), WU-11(대시보드 버튼이 `openAgentPanel` 호출)

## 왜 (근거)

완료 판정 5 "발주서 초안에서 [확인] → `Purchases`에 '발주완료' 1건 / [취소] → 변화 없음", 대표 시나리오의 마지막 장면. P-08 LLM 실패 시 계산 표만.

## 읽을 파일

- [04](../04-api-contract.md) 1 · 2 · 3.8절
- `src/lib/api/handler.ts`(라우트 공통 — 사용법만), `src/lib/inventory.ts`(`createPurchase` 시그니처만)
- 내 파일: `src/lib/llm.ts`, `src/lib/agent/reorder.ts`, `src/lib/agent/prompts/draft-po.ts`, `src/components/agent/*`

## 만들 · 고칠 파일 (내 구역만)

- `src/app/api/agent/draft-po/route.ts`, `src/app/api/agent/draft-po/confirm/route.ts`
- `src/lib/agent/draft-po.ts`(조회 → 계산 → LLM → `PoDraft`)
- `src/components/agent/AgentPanel.tsx`, `DraftPoView.tsx` (패널 여는 입구 `open.ts`와 `<AgentSlot />`은 eple 소유 — 읽기만. 공통 조각은 `src/components/common/` 가져다 씀)
- `tests/api/agent.test.ts`(초안 부분)

## 하지 말 것

- `/draft-po`에서 DB에 쓰기 (쓰기는 `/confirm`에서만)
- `/confirm`에서 화면이 보낸 값을 그대로 믿기 — 품목이 본인 것인지, 수량 > 0인지, 금액 ≥ 0인지 다시 검사하고 `pf_create_purchase`가 한 번 더 검사
- LLM 실패 시 미리 써 둔 문안을 AI 결과처럼 보여 주기 (P-08)

## 고치는 방법

1. `/draft-po`: 사용자 JWT로 품목 · 7일 이력 · 진행 중 구매 조회 → `reorder` → 후보 없으면 "지금 발주할 품목이 없어요" → 있으면 LLM 문안 요청 → `PoDraft`
2. LLM 오류 · 상한 초과 → `message: null`, `llm_error` 채워 **200으로** 반환(계산 표는 보여 줌). 패널에 "AI 문안을 만들지 못했어요(사유). 아래 계산 결과로 직접 발주할 수 있어요"
3. 패널: 표(품목 · 재고 · 안전재고 · 추천 수량 · 단가 · 거래처 · 근거) — 수량 · 거래처 수정 가능, 문안 영역, [발주 등록(확인)] · [취소], '발주서 발송(시연용)' 표시는 실제 발송이 아님을 명시
4. [확인] → `/confirm` → `source: "agent"`로 줄마다 `pf_create_purchase` → 결과 "P-105 발주완료 1건" → 대시보드 새로고침
5. testid: `agent-panel`, `draft-row-<sku_id>`, `draft-qty-<sku_id>`, `draft-message`, `draft-llm-error`, `btn-draft-confirm`, `btn-draft-cancel`

## 다 됐다의 기준

- [ ] T-AI-1: `demo` 시드 PRD-003 → 초안 → [확인] → `purchases`에 `발주완료` 1건 / [취소] → 건수 변화 없음
- [ ] 초안 표의 재고 · 안전재고 · 단가 = DB 값, 추천 수량 = `reorder` 결과 (T-AI-3 초안 쪽)
- [ ] T-AI-6(초안 쪽): `LLM_PROVIDER`를 잘못된 주소로 → 표는 보이고 문안 없음 · 오류 표시, 입출고 화면은 정상
- [ ] B 계정으로 A의 sku로 `/confirm` → 404, 변화 없음

## 테스트 방법

- 자동: `npm run test:unit`, `tests/api/agent.test.ts`(fake 제공자)
- 직접: dev에서 대시보드 → [발주서 초안 보기] → 수정 → 확인

## 실제 동작 확인 항목 (리뷰어 eple)

- [ ] 문안 속 숫자가 표와 다르면? → 표 기준으로 저장되는지(저장은 표 값만 쓴다)

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- AI가 틀린 것과 고친 과정:
- PR:
