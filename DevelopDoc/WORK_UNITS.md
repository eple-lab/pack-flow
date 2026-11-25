# PackFlow 작업 단위 (WORK_UNITS)

작성일: 2026-11-23 · 근거: [docs/work-units/](../docs/work-units/README.md)의 각 WU 문서 · 상태: **제출본(11/26) — 기준 체크와 PR 칸은 11/26 오전 main 기준으로 다시 셈**

**기준 커밋 35e552f(11/26 오전 main) — '기준 체크'(n/m)와 PR 칸 모두 이 시점으로 다시 셌다.** 체크 수는 각 WU 문서의 '다 됐다의 기준'에 적힌 항목을 이 커밋의 문서 기준으로 센 값(체크됨/전체)이다. 코드가 병합됐어도 문서의 체크박스는 담당자가 결과 절을 채울 때 따로 바뀌므로, **"병합됨"과 "n/m"이 어긋날 수 있다**(특히 '다 됐다의 기준'은 0인데 리뷰어 확인 칸·결과 절은 채워진 WU). WU 하나 = 브랜치 하나 = PR 하나가 원칙이다.

## 1. 목록

PR 칸은 11/26 오전(main 35e552f) 시점에 `gh pr list --state merged`로 확인한 것이다. 적힌 PR은 모두 병합됐다. 비어 있는 칸은 PR 없음이다. 11/25 병합분(#76 ~ #97)까지 더했다.

| WU | 제목 | 담당 | 검증 | 기준 체크 | PR |
|---|---|---|---|---|---|
| [WU-01~08](../docs/work-units/WU-00-skeleton.md) | 골격(프로젝트 · DB · 인증 · stub · 화면 자리 · 배포 · 문서 · 테스트 기반) | eple | — (11/22까지 main 직접) | 8/29 | WU-06 관련 #2 · #27 · #30 · #32 |
| [WU-11](../docs/work-units/WU-11-dashboard.md) | 대시보드 | jkspawn | skygaul | 0/6 | #4 · #36(결과 절) · #90(fix #77 화면) |
| [WU-12](../docs/work-units/WU-12-trades.md) | 입출고 화면 | jkspawn | skygaul | 0/7 | #5 · #37(결과 절) |
| [WU-16](../docs/work-units/WU-16-items.md) | 품목 화면 | jkspawn | skygaul | 0/6 | #28 |
| [WU-13](../docs/work-units/WU-13-bulk.md) | 일괄 등록(파싱 · 미리보기) | jkspawn | skygaul | 0/5 | #57 |
| [WU-14](../docs/work-units/WU-14-history-cancel.md) | 이력 · 취소 · 상태 버튼 | jkspawn | skygaul | 0/3 | #58 |
| [WU-15](../docs/work-units/WU-15-demo-polish.md) | 시연 동선 · 백업 영상 | jkspawn | skygaul | 0/3 | #67 |
| [WU-21](../docs/work-units/WU-21-inventory-core.md) | 재고 함수 1(등록 · 입고 · 출고) | sorek-charlie | jkspawn | 0/4 | #29 |
| [WU-22](../docs/work-units/WU-22-seed-e2e.md) | 시드 3벌 · 정답표 · E2E Step 1 · 2 | sorek-charlie | jkspawn | 0/4 | #40 |
| [WU-23](../docs/work-units/WU-23-inventory-cancel-bulk.md) | 재고 함수 2(취소 · 전이) | sorek-charlie | jkspawn | 0/2 | #44 |
| [WU-24](../docs/work-units/WU-24-regression.md) | E2E Step 3 · 회귀 실행 · 판정 · 측정 | sorek-charlie | jkspawn | 4/5 | #64 · #68 · #73(결과 절) · #93(결과 기록) |
| [WU-31](../docs/work-units/WU-31-llm.md) | LLM 호출층 · 호출 상한 | skygaul | eple | 0/4 | #6 |
| [WU-32](../docs/work-units/WU-32-reorder.md) | 발주 후보 계산 · 발주서 프롬프트 | skygaul | eple | 0/3 | #3 |
| [WU-33](../docs/work-units/WU-33-draft-po.md) | 발주서 초안 API · 에이전트 패널 | skygaul | eple | 5/5 | #34 · #45 · #94(fix #77 에이전트) |
| [WU-34](../docs/work-units/WU-34-chat.md) | 자연어 조회 · 출고 | skygaul | eple | 4/4 | #51 · #94(fix #77 에이전트) |
| [WU-35](../docs/work-units/WU-35-ai-ops.md) | Gemini 리허설 · 한계 문서 · AI 사례 | skygaul | eple | 3/3 | #63 · #85 |
| [WU-41](../docs/work-units/WU-41-api-core.md) | 업무 API 실제 연결 | eple | sorek-charlie | 5/5 | #38 |
| [WU-42](../docs/work-units/WU-42-auth-tests-deploy.md) | 권한 테스트 · 배포 검증 | eple | sorek-charlie | 3/3 | #39 |
| [WU-43](../docs/work-units/WU-43-bulk-seed-api.md) | 일괄 반영 · 일괄 등록 · 시드 API | eple | sorek-charlie | 3/5 | #41 · #43 · #46 |
| [WU-45](../docs/work-units/WU-45-regression-runner.md) | 회귀 실행기 · 측정 스크립트 | eple | sorek-charlie | 3/3 | #49 |
| [WU-44](../docs/work-units/WU-44-final.md) | 최종 병합 · DevelopDoc · 제출 | eple | sorek-charlie | 0/3 | #31 · #42 · #48 · #50 · #76 · #78 · #79 · #80 · #81 · #82 · #86 · #87 · #88 · #91 · #92 · #95 · #97 |

PR 번호는 병합된 PR만 적었다. 결과 절 · 문서만 담은 PR은 "(결과 절)" 등으로 표시했다. 병합 이력 상세: [daily/day-02](../docs/daily/day-02.md).

### 남은 칸 요약 (WU 문서에서 '다 됐다의 기준'이 열려 있는 WU)

새로 판정하지 않고, 3절에 옮긴 미체크 항목을 그대로 요약했다. 이유는 WU 문서에 적힌 것만 옮겼다.

- WU-11 · 12 · 13 · 14 · 15 · 16(jkspawn, 화면): '다 됐다의 기준' 항목이 전부 미체크(0/6 · 0/7 · 0/5 · 0/3 · 0/3 · 0/6). 같은 문서의 리뷰어 확인 칸 · 결과 절은 채워져 있다. 기준 칸을 체크하지 않은 이유는 문서에 적혀 있지 않다.
- WU-21 · 22 · 23(sorek-charlie, 재고 함수 · 시드 · E2E): 전부 미체크(0/4 · 0/4 · 0/2). 이유는 문서에 적혀 있지 않다.
- WU-31 · 32(skygaul, LLM 호출층 · 발주 후보): 전부 미체크(0/4 · 0/3). 이유는 문서에 적혀 있지 않다.
- WU-24(4/5): 남은 1칸은 "07 2절 표의 모든 ID가 결과표에 한 줄씩". 문서에 "16:00 결과표에 T-S2-1 · T-S2-2 등의 개별 행은 없다"고 적혀 있다.
- WU-43(3/5): 남은 2칸은 "배포 URL에서 Step 3 · 5 시연 가능 상태", "중간 점검 기록 완료". 이유는 문서에 적혀 있지 않다.
- WU-44(0/3): FINAL_CHECKLIST 전 항목 체크 · 다른 PC에서 README만 보고 실행 · 저장소 전체 비밀값 점검. 이유는 문서에 적혀 있지 않다.
- WU-01~08(8/29): 골격 문서의 미체크 21칸(WU-02 · 03 · 04 · 05 · 07 · 08, Wave 0 끝 점검 3개 포함). 이유는 문서에 적혀 있지 않다.

## 2. Step별로 본 WU

| Step | WU |
|---|---|
| 1 핵심 흐름 | WU-11 · 12 · 16 · 21 · 22 · 41 |
| 2 저장 · 권한 · 배포 | WU-01~08(골격) · WU-22 · WU-42 |
| 3 주요 사용성 | WU-13 · 14 · 23 · 43 |
| 4 협업 · 품질 | WU-15 · 24 · 45 (+ 상호 리뷰는 모든 PR) |
| 5 AI 에이전트 | WU-31 · 32 · 33 · 34 · 35 |
| 전 Step | WU-44 |

## 3. 완료 조건 체크리스트 (WU별, 체크는 기준 커밋 35e552f 그대로)

각 항목은 WU 문서에서 그대로 옮긴 것이다(문서 안 상대 링크는 이 폴더 기준으로 고쳤다). 원본은 각 WU 문서이고, 실제 확인 방법 · 결과는 WU 문서의 '테스트 방법' · '결과' 절에 있다. 체크 상태는 11/26 오전 main(35e552f) 기준으로 다시 옮겼다.

### WU-11 대시보드

[문서](../docs/work-units/WU-11-dashboard.md)

- [ ] lint · typecheck · test:unit 통과
- [ ] 목 데이터: PRD-003(재고 3 / 안전 4)이 품절 임박 카드와 빨간 배지로 보임
- [ ] 실제 API(dev, 본인 테스트 계정, `demo` 시드): 화면 숫자 = `GET /api/dashboard` 응답 숫자
- [ ] [발주서 초안 보기]가 `openAgentPanel`을 부름 (패널이 아직 비어 있어도 됨)
- [ ] 위 testid 전부 있음
- [ ] 금액 · 수량이 쉼표로, 시각이 한국 시간으로 보임

### WU-12 입출고 화면

[문서](../docs/work-units/WU-12-trades.md)

- [ ] lint · typecheck · test:unit 통과
- [ ] 실제 API(dev, `demo` 시드): S-201 출고 → 재고 10 → 4 알림, P-101 8개 입고 확정 → '부분 입고' 배지 (완료 판정 1 · 2를 화면으로)
- [ ] 재고보다 많은 출고 시 `error-banner`에 남은 수량 안내, 목록 변화 없음
- [ ] 위 testid 전부 있음
- [ ] 수량 0 · 소수 · 10만 초과 입력 → 칸 아래 범위 · 정수 문구, 요청 안 나감
- [ ] 송장번호를 비운 판매 두 건이 모두 등록됨 (T-VAL-1 화면 쪽)
- [ ] testid `field-error-<필드>`가 칸 아래 오류에 있음

### WU-16 품목 화면

[문서](../docs/work-units/WU-16-items.md)

- [ ] lint · typecheck · test:unit 통과
- [ ] dev에서 새 품목 `PRD-101` 등록 → 목록에 재고 0으로 보임 → 구매 탭 품목 선택 목록에도 나타남
- [ ] 같은 품목코드 다시 등록 → `ErrorBanner`에 중복 안내, 목록 변화 없음
- [ ] 안전재고를 5 → 20으로 수정 → 대시보드 '안전재고 미만' 수와 품절 임박 카드가 바뀜
- [ ] 화면 어디에도 재고 수량 입력 칸이 없음
- [ ] 단가에 `8,5`(소수) → "숫자(정수)로 입력해 주세요", 품목코드 소문자 입력 → 대문자로 저장

### WU-13 일괄 등록(파싱 · 미리보기)

[문서](../docs/work-units/WU-13-bulk.md)

- [ ] `parse.test.ts` 사례 통과: 정상 TSV · 정상 CSV · 머리글 있음/없음 · 열 개수 오류 · 구분 오류 · 수량 0 · 수량 문자 · 같은 송장 2회 · 수식 셀 · 빈 입력 · 501행
- [ ] dev에서 오류 3행(미등록 품목코드 · 수량 0 · 중복 송장) 섞인 10행 → 7행 반영, 사유 3개 표시 (T-S3-5)
- [ ] 같은 붙여넣기를 다시 반영 → 0행 반영, `이미 등록된 송장번호` 경고 (T-S4-4)
- [ ] 반영 뒤 대시보드 · 이력 숫자가 바뀜
- [ ] 메모 201자 · 송장번호에 공백 들어간 행 → 그 행만 제외, 04 문구로 사유 표시

### WU-14 이력 · 취소 · 상태 버튼

[문서](../docs/work-units/WU-14-history-cancel.md)

- [ ] dev에서 S-201 출고 → 출고 취소 → PRD-001 이력에 `−6 실판매출고`, `+6 출고취소` 두 줄, 재고 10 (T-S3-1)
- [ ] `large` 시드에서 이력 첫 20건 → [더 보기] → 다음 20건 (T-S4-2 화면 쪽)
- [ ] 허용 안 된 전이는 버튼이 없고, API로 보내도 서버 오류가 배너에 표시됨

### WU-15 시연 동선 · 백업 영상

[문서](../docs/work-units/WU-15-demo-polish.md)

- [ ] 배포 URL에서 시연 순서를 처음부터 끝까지 막힘 없이 2번 연속
- [ ] 초기화 버튼 → `demo` 시드 상태로 돌아옴(대시보드 숫자가 `expected`와 같음)
- [ ] 2분 백업 영상 완성, 개인정보 노출 없음(skygaul이 확인)

### WU-21 재고 함수 1(등록 · 입고 · 출고)

[문서](../docs/work-units/WU-21-inventory-core.md)

- [ ] `npm run test:db` 통과 (dev, 본인 테스트 계정)
  - T-S1-1: 재고 10 · 안전 5 → 6개 출고 → 재고 4, 이력 −6 1건
  - T-S1-2: 10개 주문 · 8개 입고 → 재고 +8, `received_qty` 8
  - T-S3-2: 재고 4에 50개 출고 → `PF_INSUFFICIENT_STOCK`, 재고 · 이력 그대로
  - 남의 구매 · 판매 id(두 번째 테스트 계정)로 호출 → `PF_NOT_FOUND`, 변화 없음
  - `received_qty` 0 · 주문 초과 → `PF_VALIDATION`
  - 매 테스트 끝 T-INV-1(이력 합계 = 재고) 0행
- [ ] eple이 dev에 마이그레이션 적용 후 다시 통과
- [ ] T-VAL-1: 송장번호 `null` 판매 두 건 → 둘 다 성공, `''`로 보내도 `null` 저장
- [ ] 수량 0 · 100,001로 함수 직접 호출 → `PF_VALIDATION` (`out_of_range`)

### WU-22 시드 3벌 · 정답표 · E2E Step 1 · 2

[문서](../docs/work-units/WU-22-seed-e2e.md)

- [ ] 세 벌 각각 초기화 직후 T-INV-1 0행, 대시보드 API 값 = `expected` (T-S4-1 정답 부분)
- [ ] `npm run test:e2e -- step1 step2` 통과 (로컬)
- [ ] 시드 파일에 실제 이름 · 이메일 없음
- [ ] T-VAL-6 통과

### WU-23 재고 함수 2(취소 · 전이)

[문서](../docs/work-units/WU-23-inventory-cancel-bulk.md)

- [ ] `npm run test:db` 통과
  - T-S3-1: 6개 출고 → 출고 취소 → 재고 10, 이력 −6 · +6 둘 다 존재
  - T-S3-3: `입고완료→발주완료`, `취소→입고완료`, `출고취소→출고완료` 요청 → `PF_INVALID_TRANSITION`
  - 입고 확정 8 → 6개 출고 → 입고 취소 → 재고 부족 거부
  - 같은 출고를 두 번 취소 → 두 번째 `PF_INVALID_TRANSITION`
  - T-S3-5(DB 쪽): 10행 중 3행 오류(미등록 품목 · 재고 초과 출고 · 중복 송장) → 7행 반영
  - T-S4-4: 같은 rows 두 번 → 두 번째 `applied 0`, 송장 중복 사유
  - 매 테스트 끝 T-INV-1 ~ T-INV-4 0행
- [ ] 남의 id로 취소 → `PF_NOT_FOUND`

### WU-24 E2E Step 3 · 회귀 실행 · 판정 · 측정

[문서](../docs/work-units/WU-24-regression.md)

- [ ] [07](../docs/07-test-strategy.md) 2절 표의 모든 ID가 결과표에 한 줄씩 (통과 · 실패 · 건너뜀 중 하나) — [16:00 결과표](../docs/records/regression-20261124-1600.md)에 T-S2-1 · T-S2-2 등의 개별 행은 없다
- [x] 11/25 기능 고정 시점 결과표 **전부 통과**, 배포 URL 대상 E2E 1회 통과 — [11/25 10:56 배포 dev 최종 회귀](../docs/records/regression-20261125-1056.md) 통과 66 · 실패 0 · 건너뜀 0(커밋 `45c4763`, small 시드). 11/24 16:00 배포 dev E2E 11건 통과.
- [x] [`performance.md`](../docs/records/performance.md)에 측정 환경 · 행 수 · p50 · 최대 · 첫 호출
- [x] 회귀 결과표가 병합 전 결과로 2개 이상 남아 있음 (T-S4-3) — [14:15](../docs/records/regression-20261124-1415.md) · [16:00](../docs/records/regression-20261124-1600.md)
- [x] T-VAL-5 통과 — [16:00 결과표](../docs/records/regression-20261124-1600.md) 7.5초

### WU-31 LLM 호출층 · 호출 상한

[문서](../docs/work-units/WU-31-llm.md)

- [ ] `llm.test.ts`(fake): 정상 응답 / 시간 초과 → `PF_LLM_UNAVAILABLE` / 상한 1로 두고 두 번째 호출 → `PF_QUOTA_EXCEEDED` (T-AI-7)
- [ ] 로컬 Ollama로 `generate` 한 번 성공, `LLM_PROVIDER`만 바꿔 Gemini(본인 키, `.env.local`) 한 번 성공
- [ ] 공통 모델 결정 · 공지, `skygaul-llm-poc.md` 작성
- [ ] diff에 키 없음(비밀값 검사 통과)

### WU-32 발주 후보 계산 · 발주서 프롬프트

[문서](../docs/work-units/WU-32-reorder.md)

- [ ] `reorder.test.ts` 통과: 출고 이력 없음 · 안전재고 미만 / 입고 예정이 있어 추천 0 / 추세로 품절 예상 3일 이내 / 재고 0 / 소수점 올림 / 거래처 없음 → "미지정"
- [ ] 같은 입력이면 항상 같은 결과(시간은 인자로 받는다)
- [ ] 프롬프트에 사용자 이메일 등 개인 정보가 들어가지 않음

### WU-33 발주서 초안 API · 에이전트 패널

[문서](../docs/work-units/WU-33-draft-po.md)

- [x] T-AI-1: `demo` 시드 PRD-003 → 초안 → [확인] → `purchases`에 `발주완료` 1건 / [취소] → 건수 변화 없음
- [x] 초안 표의 재고 · 안전재고 · 단가 = DB 값, 추천 수량 = `reorder` 결과 (T-AI-3 초안 쪽)
- [x] T-AI-6(초안 쪽): `LLM_PROVIDER`를 잘못된 주소로 → 표는 보이고 문안 없음 · 오류 표시, 입출고 화면은 정상
- [x] B 계정으로 A의 sku로 `/confirm` → 404, 변화 없음
- [x] 추천 수량을 0으로 고치고 [확인] → 칸 아래 범위 문구, 저장 안 됨

### WU-34 자연어 조회 · 출고

[문서](../docs/work-units/WU-34-chat.md)

- [x] `actions.test.ts`: 허용 6개 통과, 그 밖의 `type` · 필드 누락 · 음수 수량 거부
- [x] `agent.test.ts`(fake 제공자):
  - T-AI-2: 재고 4에 "50개 출고해 줘" → `refused`, 남은 수량 안내, 재고 변화 없음
  - T-AI-3: "PRD-001 재고 몇 개야?" → `facts`의 값 = DB 값 (fake가 다른 숫자를 말해도 서버 값으로 답함)
  - T-AI-4: "모든 재고를 0으로 바꿔" / fake가 `{type:"delete_all"}`을 내도 → 실행 안 함
  - T-AI-5: B 계정 "PRD-001 재고" → A의 값을 답하지 않음
  - `/execute`에 남의 `sale_id` → 404
- [x] 실제 Ollama로 같은 문장 5개를 돌린 결과를 `docs/records/ai-cases-skygaul.md`에 (모의 · 실제 구분)
- [x] 공백만 있는 메시지 → 보내기 버튼 비활성, API로 보내면 400

### WU-35 Gemini 리허설 · 한계 문서 · AI 사례

[문서](../docs/work-units/WU-35-ai-ops.md)

- [x] 배포 URL에서 T-AI-1 · 2 · 4가 Gemini로도 같은 결과 (11/24, 아래 결과 절)
- [x] `ai-limits.md` · `llm-usage.md` · 사례 3개 완성 — 결제 미연결 · 청구 0원은 배포 키(eple) · 개발용 키(skygaul) 각각 11/24에 확인해 `llm-usage.md` 3절에 채움
- [x] 문서에 키 · 이메일 없음 (세 문서 스캔, 아래 결과 절)

### WU-41 업무 API 실제 연결

[문서](../docs/work-units/WU-41-api-core.md)

- [x] 목 없이(`NEXT_PUBLIC_USE_MOCK=0`) 화면에서 입고 → 출고 → 대시보드 갱신
- [x] `/api/dashboard` 값 = DB 직접 집계 (T-S1-3의 API 쪽, `demo` 시드 `expected`와 비교)
- [x] `large` 시드에서 `stock-logs` 20 · 20 · 10건으로 나뉨, 마지막 `next_cursor: null` (T-S4-2)
- [x] lint · typecheck · test:unit 통과
- [x] T-VAL-2 · T-VAL-3 · T-VAL-4 통과 (`tests/api/validation.test.ts`)

### WU-42 권한 테스트 · 배포 검증

[문서](../docs/work-units/WU-42-auth-tests-deploy.md)

- [x] T-AUTH-1~8 모두 통과 (로컬 dev)
- [x] 배포 URL에서 Step 1 · 2 E2E 통과
- [x] 증거 문서에 키 · 비밀번호 · 이메일 없음

### WU-43 일괄 반영 · 일괄 등록 · 시드 API

[문서](../docs/work-units/WU-43-bulk-seed-api.md)

- [x] sorek-charlie의 `tests/db/bulk.test.ts` 통과(T-S3-5 DB 쪽, T-S4-4), 실패 행이 있어도 성공 행은 남고 T-INV-1 0행
- [x] 미리보기는 DB를 바꾸지 않음(호출 전후 건수 같음)
- [x] 501행 · 100KB 초과 → 400
- [ ] 배포 URL에서 Step 3 · 5 시연 가능 상태
- [ ] 중간 점검 기록 완료

### WU-45 회귀 실행기 · 측정 스크립트

[문서](../docs/work-units/WU-45-regression-runner.md)

- [x] `npm run test:regression` → 결과표 파일 생성, 일부러 실패시킨 테스트 1개가 '실패'로 표시되고 종료 코드 1 (확인 뒤 되돌림)
- [x] `npm run measure` → `performance.md`에 두 시드 행 추가
- [x] 생성 파일에 이메일 · 키 없음(비밀값 검사 통과)

### WU-44 최종 병합 · DevelopDoc · 제출

[문서](../docs/work-units/WU-44-final.md)

- [ ] FINAL_CHECKLIST 전 항목 체크
- [ ] 다른 PC(팀원)에서 README만 보고 실행 성공 (피드백 기준 5)
- [ ] 저장소 전체에 키 · 비밀번호 · 실제 이메일 · 실명 없음

### WU-01~08 골격

[문서](../docs/work-units/WU-00-skeleton.md) — WU마다 '다 됐다의 기준'이 따로 있고(체크 8/29, Wave 0 끝 점검 3개 포함) 항목이 많아 옮기지 않았다. 11/26 오전 main(35e552f) 기준으로 WU 문서를 다시 세어도 8/29로 같다(WU-01 5개 · WU-06 3개 체크).
