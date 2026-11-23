# AI 활용 · 디버깅 사례 — jkspawn

작성일: 2026-11-23 · 근거: [07 테스트 전략](../07-test-strategy.md) 5절 · D-34 · AGENTS.md 4절 · 11/25 skygaul이 `ai-cases.md`로 모음

## 사례 1 — 대시보드 불러오기가 effect 안에서 setState를 불러 lint에 두 번 걸림 (작성: jkspawn, 2026-11-23, WU-11)

- 맡긴 것: Claude Code(Claude Opus 5.5)에 WU-11 문서를 주고 "읽을 파일만 읽고 만들 · 고칠 파일만 고쳐, 끝나면 다 됐다의 기준 명령을 돌려 보고"를 요청했다. 그중 대시보드를 `api.dashboard()`로 불러와 로딩 · 오류 · 내용 세 상태를 그리는 부분.
- AI가 낸 것: `src/components/dashboard/DashboardView.tsx`에 `useCallback`으로 `load()`(시작할 때 `setState({ status: 'loading' })` → 응답 뒤 `ready`/`error`)를 만들고 `useEffect(() => { void load(); }, [load])`로 처음 한 번 불렀다.
- 문제: 렌더 시험(C-01~C-14 14개)과 typecheck · test:unit(456개)은 모두 통과했지만, 끝에 돌린 `npm run lint`가 `react-hooks/set-state-in-effect` 오류 1건으로 실패했다("Calling setState synchronously within an effect can trigger cascading renders"). PR 표의 C-22.
  - 1차 수정: `load()`에서 처음의 `setState('loading')`만 빼고 응답 뒤에만 setState하는 `fetchDashboard()`로 바꿨다 → **같은 오류가 다시 났다.** 규칙이 "effect 안에서 부른 함수가 setState를 부르는지"를 함수 단위로 보기 때문에, await 뒤라도 같은 함수 안에 있으면 걸린다.
- 원인: 처음 불러오기를 effect 본문에서 setState를 직접(또는 그런 함수를 통해) 부르는 모양으로 짰다. 렌더 시험은 서버 렌더(`renderToString`)라 effect가 돌지 않아서 이 문제를 못 잡았고, lint만 잡을 수 있었다.
- 고친 것: effect 안에서 `api.dashboard().then(...).catch(...)`를 바로 부르고, **응답 콜백 안에서만** setState하게 바꿨다. 화면을 떠난 뒤 늦게 온 응답은 `current` 플래그로 버린다. [다시 시도]는 이벤트 처리기에서 `loading`으로 바꾸고 `attempt` 상태를 올려 effect를 다시 돌린다. 커밋 `7c6211a`(같은 커밋 안에서 고친 뒤 커밋).
- 다시 확인: `npm run lint` → 오류 0(exit 0), `npm run typecheck` → 통과, `npm run test:unit` → 19파일 456개 통과. 브라우저(`NEXT_PUBLIC_USE_MOCK=1`)에서 `/`를 열어 "불러오는 중…" 뒤 KPI 3 · 53 · 1 · 0 · 0이 보이는 것을 확인(C-15).
- 배운 것: 렌더 시험이 통과해도 effect · 이벤트 같은 브라우저 동작은 검증되지 않는다. lint를 "끝에 한 번"이 아니라 effect를 쓴 직후에 돌리면 더 빨리 잡는다.
