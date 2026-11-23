# Supabase 설정 기록 — packflow-dev · packflow-demo

작성일: 2026-11-23 · 작성: eple · 근거: D-11(프로젝트 2개), D-20(서비스 키 다섯 겹), D-28(계정 주인 · 초대), D-35(Data API 설정), [WU-00](../work-units/WU-00-skeleton.md) WU-02, [05 보안](../05-security.md) 2 · 3절

다시 만들거나 설정을 바꿀 때 이 순서를 따른다. **키 · 비밀번호 · DB 비밀번호는 이 문서에 적지 않는다.** 프로젝트 ref(주소 앞부분)도 적지 않는다(비밀은 아니지만 공개 저장소에 둘 이유가 없다).

## 1. 프로젝트

| 항목 | packflow-dev | packflow-demo |
|---|---|---|
| 쓰임 | 개발 · 테스트(팀원 개인 테스트 계정, P-17) | 배포(Render) · 시연 |
| 계정 주인 | eple (D-28) | eple (D-28) |
| 지역 | Northeast Asia (Seoul) | 같음 |
| 플랜 | 무료 (활성 프로젝트 2개 한도, 1주 미사용 시 일시정지) | 같음 |
| DB 비밀번호 | 자동 생성 → eple 비밀번호 관리자에만 | 같음 |
| 팀원 초대 | 하지 않음 — 초대가 조직 단위라면 demo까지 열린다(추측). 팀원은 dev 공개 키 + 개인 테스트 계정으로 개발(D-28 대안) | 하지 않음 |

## 2. 인증 (Authentication → Sign In / Providers)

| 설정 | dev | demo | 이유 |
|---|---|---|---|
| 이메일 · 비밀번호 로그인 | 켜기 | 켜기 | D-04 |
| Confirm email (이메일 확인) | **끄기** | 켜기(기본) | dev는 메일이 가지 않는 `@packflow.test` 주소로 테스트 계정을 만든다(08 Q-17) |
| Allow new users to sign up (회원가입) | 켜기(기본) | **끄기** | demo는 시연 계정 A · B만. 계정은 대시보드에서 만든다(D-20 ①) |

## 3. Data API (Project Settings → Data API 또는 API) — D-35

| 설정 | 값 | 이유 |
|---|---|---|
| Enable Data API | **켜기** | 앱이 `supabase-js`로 REST · RPC(`pf_*` 함수)를 부르는 통로 |
| Grant API access to new tables automatically | **끄기** | 새 테이블이 anon · authenticated에 자동으로 열리지 않게. 권한은 마이그레이션(`_rls.sql`)에 직접 적는다 — 실수로 열리는 것보다 안 보이는 쪽이 안전(05 3절) |
| Enable RLS on new tables automatically | **켜기** | 안전망. 마이그레이션도 모든 테이블에 RLS를 켠다 |

- 자동 권한을 끈 결과: 앞으로 **새로 만드는** 테이블 · 함수는 그 마이그레이션 안에 `grant`를 직접 적어야 화면 · API에서 보인다. 이미 있는 재고 함수를 `create or replace`로 고치면 권한은 그대로 남는다.
- 이 설정이 실제로 어떤 DB 권한을 바꾸는지는 화면으로 확인하지 못했다 → dev 적용 뒤 5절의 시험으로 확인한다.

## 4. 키와 저장 위치 (D-20)

| 키 | dev | demo |
|---|---|---|
| 주소 (`NEXT_PUBLIC_SUPABASE_URL`) | eple · 팀원 `.env.local` | Render 환경변수 |
| publishable(공개) 키 (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | eple · 팀원 `.env.local` (개별 전달) | Render 환경변수 |
| 프로젝트 ref (`SUPABASE_DEV_PROJECT_REF`) | eple `.env.local` (계정 스크립트 안전장치) | — |
| secret(서비스) 키 (`SUPABASE_SERVICE_ROLE_KEY`) | **eple PC `.env.local`에만** | **아무 데도 저장하지 않음** |

- 새 프로젝트의 키는 publishable · secret 형식이다. 이름이 옛 형식(anon · service_role)인 환경변수 칸에 그대로 넣는다.
- 키가 한 번이라도 저장소 · 대화 · 스크린샷에 나가면 즉시 재발급한다(05 2.1 '새었을 때').

## 5. 적용 순서와 확인

| 순서 | 할 일 | 누가 | 확인 | 상태 |
|---|---|---|---|---|
| 1 | 1 · 2 · 3절 설정 (두 프로젝트) | eple | 화면 | 끝 (11/23) |
| 2 | `.env.local`에 dev 값, `npx supabase@3.2.0 login` | eple | — | 끝 (11/23) |
| 3 | dev 연결(`supabase link`, DB 비밀번호는 eple 입력) → 적용 목록 미리 보기(dry-run) | Claude · eple 확인 | 마이그레이션 6개 목록 | 끝 (11/23) |
| 4 | dev 적용(`supabase db push`) | Claude (eple 확인 후) | 테이블 · 정책 · 함수 목록 | 끝 (11/23) |
| 5 | 테스트 계정 8개(`npm run users:create`) | Claude | 비밀번호는 `.env.testusers.local`에만, 화면 출력 없음 | 끝 (11/23, eple 실행 · 전달 뒤 파일 삭제) |
| 6 | 실제 REST 시험: T-AUTH-4~6, 재고 함수 → `PF_NOT_IMPLEMENTED`, anon 조회 거부, `npm run test:db` | Claude | [eple-wu02-checks.md](eple-wu02-checks.md)에 결과 추가 | 끝 (11/23, 10건 통과) |
| 7 | 로그인 → 네 페이지 이동 (로컬 `npm run dev`) | eple · Claude | 화면 | 끝 (11/23, eple 확인: 네 페이지 이동 · 로그아웃 → `/login` · 로그아웃 뒤 `/items` 직접 입력 → `/login`) |
| 8 | demo 적용 → dev와 목록 비교(`db diff`) | Claude (eple 확인 후) | 차이 없음 | |
| 9 | demo 시연 계정 A · B (대시보드에서) | eple | — | |
| 10 | demo 주소로 계정 스크립트 실행 → 거부 | Claude | 거부 메시지, 계정 안 생김 | |
