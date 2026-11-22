# eple 이어받기 노트

마지막 갱신: 2026-11-20 · 쓴 세션: eple의 pack-flow 문서 정리 세션(Claude, 11/19~20) · **다음 세션(eple의 골격 Wave 0)이 이 파일부터 읽는다.**

팀원이 여러 명이라 파일 이름 앞에 `eple-`을 붙였다. 이 노트는 **eple의 작업 흐름**을 이어받기 위한 것이다(팀원 각자의 진행은 work-units와 이슈로 본다).

## 세션 정보

| 항목 | 내용 |
|---|---|
| 목적 | 해커톤 계획서(`pack-flow-plan.md`)를 엔터프라이즈 아키텍처 관점의 작업 문서로 나누고, 4명이 **파일이 겹치지 않게 병렬로** 일하며 각자 에이전트가 문서만 보고 움직일 수 있게 한다 |
| 작업 위치 | 저장소 `eple-lab/pack-flow`(공개), 폴더 `docs/`, 루트 `AGENTS.md` · `README.md` |
| 참고한 곳 | `assignment/바이브 코딩 해커톤`(해커톤 안내 · ERP 주제), `task-hive`(문서 구조 · 파일 머리 · 고친 기록), `healing-forest-trip`(이슈 양식 · 바꾼 줄 주석 · 훅), `pack-flow-workspace/concept`(화면 시안, 참고만) |
| 관련 세션 | 다음: eple의 골격(Wave 0) 세션 — 이 노트로 시작. 팀원 세션은 11/23부터 각자 |
| 남은 기간 | 11/22(일)까지 골격 → 11/23(월) 팀원 합류 → 11/24 14시 기능 동결 → 11/26 10:00 제출 |

## 1. 지금 어디까지 왔나

| 항목 | 상태 |
|---|---|
| 기획 · 설계 문서 `docs/00~13`, `wireframes.html`, `work-units/`(WU 22개 + 양식) | 끝. 로컬 main에 커밋 |
| 루트 `AGENTS.md` · `README.md` | 초안. 골격 경로 · 명령에 맞춰 WU-01에서 다듬는다 |
| 코드 | 2026-11-23: WU-01 · 02 · 03 · 04 · 05 · 08 코드 커밋 끝(`b757e8b`까지). 남은 것: Supabase 연결 · 적용 · 실제 로그인 확인, WU-06 Render 배포, WU-07 이슈. 검토 기록 [records/eple-skeleton-review.md](records/eple-skeleton-review.md) |
| 원격(origin) | 2026-11-20 push 완료. Claude 커밋은 모두 작성자 `eple-lab (Claude)`(push 전에 folia로 잘못 된 18개를 정리함) |
| Supabase · Render · Gemini 계정 | 아직 안 만듦 |

## 2. 다음에 할 일 (순서대로)

1. **[08](08-open-questions.md) 1절을 정한다** — Q-02 Gemini 키 발급자, Q-03 Supabase · Render 계정 주인 · 팀원 초대, Q-05 팀원 Node 24 확인 요청
2. **[WU-00 골격](work-units/WU-00-skeleton.md)을 WU-01 → 08 순서로** (main 직접 push, D-13). 각 WU의 "다 됐다의 기준"을 직접 돌려 확인
   - WU-01 골격 · 훅 · CI · `.gitignore` → WU-02 Supabase 두 개 · 스키마 · RLS · 함수 자리 · 계정 → WU-03 타입 · 인증 · 검증 스키마 · 공통 유틸 · 호출 래퍼 → WU-04 API stub · 목 · `api-client` → WU-05 앱 뼈대 · 공통 조각 → WU-06 Render 배포 → WU-08 테스트 기반 · 초기화 함수 → WU-07 WU 이슈 올리기
   - 범위가 커서(D-21) **WU 하나씩 하위 세션에 맡기고 결과를 직접 확인**하는 방식을 추천한다(task-hive HANDOFF 방식: 한 번에 하나, 규모를 먼저 알리고)
3. 11/22 밤 [WU-00 끝 점검](work-units/WU-00-skeleton.md) — 배포 URL, 팀 공지, WU 이슈
4. 11/23 오전: 팀 공유 → 08 2절(Q-11~17) 결정 → 이후 eple도 브랜치 + PR(리뷰어 sorek-charlie)

## 3. 다음 세션이 읽을 순서

1. 이 노트
2. [docs/README.md](README.md) — 목차
3. [02 결정 기록](02-decisions.md) — D-01~26, P-01~19 (모두 확정)
4. [06 작업 계획](06-work-plan.md) 1절(파일 소유 구역) · 4절(브랜치 · PR · 병합)
5. [WU-00 골격](work-units/WU-00-skeleton.md) — 지금 할 일
6. 필요할 때: [03 데이터 모델](03-data-model.md), [04 API 계약](04-api-contract.md)(4절 입력 규칙 포함), [05 보안](05-security.md), [12 코드 작성 가이드](12-coding-guide.md)

## 4. 이 세션에서 정한 것 (요약 — 원본은 02)

- 데이터 4테이블 + 재고는 **Postgres 함수(RPC) 한 트랜잭션**(D-10), Supabase 두 개(dev · demo) + Vitest · Playwright(D-11)
- 브랜치: 11/22까지 eple main 직접, 11/23부터 전원 `feat/WU-번호-주제` + PR + merge commit(D-13~15)
- 서비스 키 다섯 겹 · git 훅 자동 설치 · Actions 같은 검사(D-20)
- **구조 작업은 eple로**(D-21): 골격에서 공통 층을 완성본으로 깐다 → eple Wave 0 분량이 크다
- 품목 화면 추가(D-22), 화면 원본 `wireframes.html`(D-23), 입력 규칙 04 4절(D-24), 코드 작성 가이드(D-25), 시연 순서 출고 → 카드 → 입고(D-26)

## 5. 주의할 점 (이 세션에서 배운 것)

- **커밋 작성자:** Claude가 커밋할 때는 레이어 2 규칙대로 그 커밋에만 `git -c user.name="eple-lab (Claude)" -c user.email=<eple 공개 주소> commit …`(하위 세션은 `eple-lab-sub (Claude)`). 저장소 설정은 바꾸지 않는다. 이 세션은 처음에 레이어 2 원문을 읽지 않고 전역 설정(folia)으로 커밋했다가 정리했다 — **세션의 첫 커밋 전에 가이드 `layers/2-project-common.md` · `3-git-projects.md` 원문을 읽는다.**
- **공개 저장소:** 문서 · 코드를 쓴 뒤 매번 실명 · 비밀값 · 이메일 패턴 검사를 직접 돌린다. 팀원은 GitHub 아이디로만 적는다. 문서에 비밀값 패턴 예시를 그대로 적으면 훅에 걸린다(정규식은 `scripts/check-secrets.sh` 한곳).
- **원본은 하나:** 화면은 `wireframes.html`, 입력 규칙 · 오류 문구는 04 4절, 파일 주인은 06 1절, 결정은 02. 다른 문서는 링크만.
- **push 전 확인:** 바뀐 파일을 보여 주고 "형상관리에 올려도 될까요?"로 묻는다(가이드 update-rules).
- 커밋은 카테고리별로 나눈다(eple이 선호).

## 6. 확인하지 못한 것

- Supabase 무료 플랜의 팀원 초대 가능 여부, 이메일 확인 끄기 설정 위치, Gemini 실제 하루 한도, GitHub Push protection의 공개 저장소 무료 여부
- `wireframes.html`의 다크 모드 표시(앱 안 브라우저가 로컬 파일을 밝게만 그림)
- 이 문서들대로 Wave 0을 주말 이틀에 끝낼 수 있는지 — 진행하며 범위를 조정한다
