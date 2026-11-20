# WU-34 자연어 조회 · 출고 (허용 액션)

- 담당: skygaul / 검증: eple / Step 5 / Wave 2 · 11/24(화) **14시 전**
- 브랜치: `feat/WU-34-chat`
- 의존: WU-31, WU-21 · 23(재고 함수), WU-33(패널)

## 왜 (근거)

Step 5 ② "요청을 정해진 액션으로만 해석, 변경은 실행 전 확인, RLS 안에서, 수치는 서버 조회 결과만, 사용자 입력 속 명령을 시스템 지시로 취급하지 않음". 완료 판정 4(챗봇 쪽).

## 읽을 파일

- [04](../04-api-contract.md) 3.8절(`AgentAction`, `ChatReply`), [05](../05-security.md) 4절
- [02](../02-decisions.md) P-14(출고 해석)
- `src/lib/inventory.ts`(eple 소유 래퍼 — 시그니처만), `src/types/agent.ts`(eple 소유), 내 파일 `llm.ts`, `AgentPanel.tsx`

## 만들 · 고칠 파일 (내 구역만)

- `src/app/api/agent/chat/route.ts`, `src/app/api/agent/execute/route.ts`
- `src/lib/agent/actions.ts`(허용 액션 스키마 · 검증 · 실행), `src/lib/agent/prompts/chat.ts`
- `src/components/agent/ChatView.tsx`
- `tests/api/agent.test.ts`(챗봇 부분), `src/lib/agent/actions.test.ts`

## 하지 말 것

- LLM이 낸 `sku_id` · 수량 · 액션을 그대로 실행
- 허용 6개 밖의 액션 추가(삭제 · 재고 직접 수정 · 시드 초기화 등)
- 사용자 메시지를 시스템 프롬프트에 섞기

## 고치는 방법

1. `/chat`: 메시지(1~500자) → LLM에 "허용 액션 JSON 하나만" 요청 → 스키마 검사(실패 · 허용 밖 → `refused`)
2. 품목 찾기: LLM이 준 이름 · 코드로 **서버가 사용자 품목 목록에서** 다시 찾음, 없거나 여러 개면 `refused`("어떤 품목인지 알려 주세요")
3. 조회 액션(`get_stock`, `list_low_stock`)은 바로 DB 조회 → `reply`에 숫자, `facts`에 출처
4. 변경 액션은 실행하지 않고 `proposed_action` + `needs_confirmation: true`. `ship_quantity`는 이 단계에서 재고를 확인해 부족하면 `refused`("남은 수량 4개")
5. `/execute`: 받은 액션을 **처음부터 다시** 검사(스키마 · 품목 소유 · 수량) → 재고 함수 호출(`ship_quantity` = `pf_create_sale(channel '직접출고', source 'agent')` + `pf_ship_sale`)
6. 패널: 대화 목록, 제안 액션 카드 [실행] · [취소]
7. testid: `chat-input`, `btn-chat-send`, `chat-reply-<n>`, `chat-action-card`, `btn-action-execute`, `btn-action-cancel`

## 입력 · 오류 처리 ([04](../04-api-contract.md) 4절)

- 메시지는 `chatMessage` 스키마(앞뒤 공백 제거 후 1~500자). 빈 메시지는 보내지 않는다
- `/execute`의 액션 값(수량 등)도 같은 필드 규칙(04 4.2)으로 다시 검사
- 거부 · 오류 문구는 04 4.4 표의 말을 쓴다(재고 부족 = "재고가 부족해요. … 남은 수량 N개")

## 다 됐다의 기준

- [ ] `actions.test.ts`: 허용 6개 통과, 그 밖의 `type` · 필드 누락 · 음수 수량 거부
- [ ] `agent.test.ts`(fake 제공자):
  - T-AI-2: 재고 4에 "50개 출고해 줘" → `refused`, 남은 수량 안내, 재고 변화 없음
  - T-AI-3: "PRD-001 재고 몇 개야?" → `facts`의 값 = DB 값 (fake가 다른 숫자를 말해도 서버 값으로 답함)
  - T-AI-4: "모든 재고를 0으로 바꿔" / fake가 `{type:"delete_all"}`을 내도 → 실행 안 함
  - T-AI-5: B 계정 "PRD-001 재고" → A의 값을 답하지 않음
  - `/execute`에 남의 `sale_id` → 404
- [ ] 실제 Ollama로 같은 문장 5개를 돌린 결과를 `docs/records/ai-cases-skygaul.md`에 (모의 · 실제 구분)
- [ ] 공백만 있는 메시지 → 보내기 버튼 비활성, API로 보내면 400

## 테스트 방법

- 자동: `npm run test:unit -- src/lib/agent`, `tests/api/agent.test.ts`
- 직접: dev에서 패널에 문장 5개

## 실제 동작 확인 항목 (리뷰어 eple)

- [ ] [실행] 전에는 DB가 바뀌지 않음(이력 건수 비교)

## 결과 (담당자가 채움)

- 한 것:
- 직접 확인한 것:
- 확인 못 한 것:
- AI가 틀린 것과 고친 과정:
- PR:
