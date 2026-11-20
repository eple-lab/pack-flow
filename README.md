# PackFlow (팩플로우)

소규모 판매자(구매대행 · 부업 포함)가 엑셀과 메모로 따로 관리하던 **구매 → 입고 → 재고 → 출고** 흐름을 한 화면에서 다루고, **거래가 일어나면 재고가 저절로 맞는** 미니 ERP입니다. 품절이 가까운 품목은 AI 에이전트가 발주서 초안을 만들고, 사람이 확인한 뒤에만 저장합니다.

바이브 코딩 해커톤(2026-11-19 ~ 11-26) 팀 프로젝트입니다. 모든 거래처 · 품목 · 금액은 가상 데이터입니다.

> **상태: 골격 준비 중 (Wave 0).** 코드는 2026-11-22까지 올라옵니다. 이 README는 초안이며 제출 전(11/25)에 배포 URL · 테스트 방법 · 제출 커밋을 채웁니다.

## 핵심 기능

| 기능 | 내용 |
|---|---|
| 입고 · 출고 → 재고 | 입고 확정(실제 도착 수량 기준) · 출고 시 재고가 자동으로 바뀌고 이력이 한 줄씩 남음 |
| 취소 · 정정 | 원래 기록을 지우지 않고 반대 기록을 남겨 재고 복원. 재고보다 많은 출고는 거부 |
| 일괄 등록 | 엑셀 붙여넣기 · CSV → 미리보기 → 유효한 행만 반영, 중복 송장 차단 |
| 대시보드 | KPI · 단계별 건수 · 품목별 재고 · 품절 임박 카드 |
| AI 에이전트 | 품절 임박 발주서 초안(수치는 코드가 계산), 자연어 재고 조회 · 출고 — 확인 후에만 실행 |
| 권한 | 로그인한 사용자는 자기 데이터만 (DB의 행 단위 보안) |

전체 목록: [docs/09-features.md](docs/09-features.md)

## 시작하기 (팀원용)

> 골격이 올라온 뒤(11/23) 기준입니다. 값이 필요한 환경변수는 eple이 팀 비공개 채널로 개별 전달합니다. **키 · 비밀번호를 저장소 · 이슈 · AI 대화에 붙여 넣지 마세요.**

1. Node 24 확인
   ```powershell
   node -v
   ```
2. 내려받고 설치 (이때 비밀값 검사 훅이 자동으로 켜집니다)
   ```powershell
   git clone https://github.com/eple-lab/pack-flow.git
   ```
   ```powershell
   cd pack-flow; npm ci
   ```
3. 훅이 켜졌는지 확인 — `.githooks`가 나오면 됩니다
   ```powershell
   git config core.hooksPath
   ```
4. `.env.example`을 `.env.local`로 복사하고, 전달받은 값(dev 프로젝트 주소 · 공개 키, 본인 테스트 계정 2개, LLM 설정)을 채웁니다
5. 실행 확인
   ```powershell
   npm run dev
   ```
   브라우저에서 `http://localhost:3000` → 본인 테스트 계정으로 로그인 → 상단 [시연 데이터 초기화]
6. 내 작업 단위 열기: [docs/work-units/README.md](docs/work-units/README.md)에서 내 WU → 브랜치 `feat/WU-xx-주제`
7. AI 코딩 도구에 맡길 때: [AGENTS.md](AGENTS.md)를 읽게 하고, WU 문서를 통째로 주면서 이렇게 요청합니다.
   > 이 WU 문서의 '읽을 파일'만 읽고, '만들 · 고칠 파일'만 고쳐 줘. '하지 말 것'은 지켜 줘. 끝나면 '다 됐다의 기준'의 명령을 돌리고, 한 것 / 직접 확인한 것 / 확인 못 한 것으로 보고해 줘.
8. 막히면: 15분 혼자 → 15분 팀과 → GitHub 이슈([docs/11-issues.md](docs/11-issues.md))

## 자주 쓰는 명령

| 명령 | 내용 |
|---|---|
| `npm run dev` | 로컬 실행 |
| `npm run lint` · `npm run typecheck` · `npm run test:unit` | 커밋 전 검사 |
| `npm run test:db` | DB 함수 · 권한 테스트 (dev 프로젝트, 본인 테스트 계정) |
| `npm run test:e2e` | 화면 시나리오 테스트 |
| `npm run test:regression` | 시드 초기화 → 전체 테스트 → 결과표 생성 |

## 문서

| 문서 | 내용 |
|---|---|
| [docs/README.md](docs/README.md) | 문서 목차 |
| [docs/00-overview.md](docs/00-overview.md) | 문제 · 사용자 · 시나리오 |
| [docs/01-enterprise-architecture.md](docs/01-enterprise-architecture.md) | 아키텍처 |
| [docs/06-work-plan.md](docs/06-work-plan.md) | 파일 소유 구역 · 브랜치 · PR 규칙 |
| [docs/09-features.md](docs/09-features.md) · [docs/wireframes.html](docs/wireframes.html) | 기능 목록 · 화면 구성(브라우저로 열기) |
| [docs/work-units/](docs/work-units/README.md) | 작업 단위 |
| [docs/12-coding-guide.md](docs/12-coding-guide.md) | 코드 작성 가이드 (파일 머리 · 이력 · 주석 · 고친 줄 표시) |
| [AGENTS.md](AGENTS.md) | AI 에이전트 공통 규칙 |

## 팀

| GitHub | 맡은 부분 |
|---|---|
| eple | 백엔드 기반 · 골격 · 통합 · 배포 · 문서 |
| sorek-charlie | 재고 로직 · 시드 · QA |
| jkspawn | 프론트 / UI |
| skygaul | AI 에이전트 |

## 제출 정보 (11/25에 채움)

- 배포 URL:
- 테스트 방법: (시연 계정은 요청 시 제공 — 비밀번호는 이 문서에 적지 않습니다)
- 제출 커밋:
- 외부 코드 · 데이터 · 모델의 출처와 라이선스:
