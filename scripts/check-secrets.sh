#!/usr/bin/env bash
# 비밀값 · 개인정보 검사 — 로컬 pre-commit 훅과 GitHub Actions가 같은 이 스크립트를 부른다.
#
# 하는 일
# 1. 검사 대상 diff에서 "추가된 줄"만 꺼낸다.
#    --staged          : 커밋될 내용 (git diff --cached)        ← .githooks/pre-commit
#    --range A...B     : PR의 base...head 차이                  ← .github/workflows/ci.yml
# 2. 아래 PATTERNS(정규식 원본은 이 파일 한곳뿐 — 문서에 예시를 적지 않는다)에 걸리는 줄을 찾는다.
# 3. .githooks/allow-patterns의 예외에 걸리는 줄은 뺀다(예외는 eple만 추가, 05 2.2).
# 4. 남은 줄이 있으면 "파일:줄번호: 내용"을 보여 주고 종료 코드 1. 없으면 0.
#
# 한계: 실명 · GitHub 아이디는 패턴으로 못 잡는다(PR 체크리스트로 눈으로 확인).
#
# 근거: docs/05-security.md 2.2 · D-20 ④ · WU-01
# 구역: eple (docs/06-work-plan.md 1절)
#
# 이력
# 2026-11-20  eple  처음 작성 — healing-forest-trip 0번 검사 + Supabase · Gemini 키, 파일 · 줄 표시 (WU-01)

set -u

PATTERNS=(
  # 이메일 주소
  '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}'
  # 사용자 홈 폴더 경로 (윈도우 · 맥 · 리눅스)
  '[A-Za-z]:[\/]+Users[\/]+[^\/ ]+'
  # (패턴 글자 자체가 걸리지 않게 / 를 [/]로 쓴다)
  '[/]Users[/][A-Za-z0-9._-]+[/]'
  '[/]home[/][A-Za-z0-9._-]+[/]'
  # GitHub · OpenAI · Slack · AWS 토큰
  '(ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_]{16,}'
  'sk-[A-Za-z0-9_-]{20,}'
  'xox[abpr]-[A-Za-z0-9-]{10,}'
  'AKIA[0-9A-Z]{16}'
  # JWT (Supabase 옛 anon · service_role 키 형식)
  'eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}'
  # Supabase 새 키 (secret · publishable 접두어)
  'sb_(secret|publishable)_[A-Za-z0-9_-]{10,}'
  # Google · Gemini API 키
  'AIza[0-9A-Za-z_-]{30,}'
  # 비밀 환경변수에 값이 붙은 줄 (.env.example처럼 값이 빈 줄은 통과)
  '(SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY|_PASSWORD)[[:space:]]*[=:][[:space:]]*["'"'"']?[^[:space:]"'"'"'#]'
)

mode="${1:---staged}"
case "$mode" in
  --staged) diff_cmd=(git diff --cached -U0 --no-color --no-ext-diff) ;;
  --range)
    if [ -z "${2:-}" ]; then echo "사용법: $0 --range <base>...<head>" >&2; exit 2; fi
    diff_cmd=(git diff -U0 --no-color --no-ext-diff "$2") ;;
  *) echo "사용법: $0 [--staged | --range <base>...<head>]" >&2; exit 2 ;;
esac

root="$(git rev-parse --show-toplevel)"
allow_file="$root/.githooks/allow-patterns"

joined="$(IFS='|'; echo "${PATTERNS[*]}")"

# diff를 먼저 받아 두고, git이 실패하면(잘못된 범위 등) 통과시키지 않고 멈춘다 — 검사 실패를 '깨끗함'으로 보지 않는다.
if ! diff_out="$("${diff_cmd[@]}")"; then
  echo "[비밀값 검사] git diff 실행에 실패해 검사하지 못했습니다: ${diff_cmd[*]}" >&2
  exit 2
fi

# 추가된 줄에 "파일:줄번호:" 를 붙인다. (diff 머리 +++ b/<파일>, @@ -a,b +c,d @@ 로 줄번호 계산)
added="$(printf '%s\n' "$diff_out" | awk '
  /^\+\+\+ / { f = substr($0, 7); next }
  /^@@ /     { split($3, a, ","); n = substr(a[1], 2) + 0; next }
  /^\+/      { print f ":" n ": " substr($0, 2); n++ }
')"

[ -z "$added" ] && exit 0

hits="$(printf '%s\n' "$added" | grep -E -- "$joined" || true)"

if [ -n "$hits" ] && [ -f "$allow_file" ]; then
  rules="$(grep -vE '^[[:space:]]*(#|$)' "$allow_file" || true)"
  if [ -n "$rules" ]; then
    rule_joined="$(printf '%s\n' "$rules" | paste -sd '|' -)"
    SEP="$(printf '\001')"
    # 예외는 "걸린 부분"이 예외 패턴과 맞을 때만 뺀다 — 같은 줄의 다른 비밀값까지 통과시키지 않도록
    # 줄에서 예외 패턴 부분을 지운 뒤 다시 검사한다.
    hits="$(printf '%s\n' "$hits" | while IFS= read -r line; do
      body="${line#*: }"
      # sed 구분자로 제어 문자(\001)를 써서 패턴 안의 / 와 겹치지 않게 한다
      cleaned="$(printf '%s\n' "$body" | sed -E "s${SEP}(${rule_joined})${SEP}${SEP}g")"
      if printf '%s\n' "$cleaned" | grep -qE -- "$joined"; then printf '%s\n' "$line"; fi
    done)"
  fi
fi

if [ -n "$hits" ]; then
  echo "[비밀값 검사] 아래 줄에서 키 · 이메일 · 개인 경로로 보이는 값을 찾아 멈췄습니다."
  # 걸린 값은 가려서 보여 준다 — Actions 로그는 공개 저장소에서 누구나 볼 수 있다.
  printf '%s\n' "$hits" | sed -E "s${SEP:=$(printf '\001')}(${joined})${SEP}‹가림›${SEP}g" | cut -c1-200
  echo
  echo "- 진짜 비밀값이면: 지우고 다시 git add → 커밋. 이미 push했다면 키를 즉시 재발급 (docs/05-security.md 2.1)."
  echo "- 비밀값이 아니면: --no-verify로 넘기지 말고, PR에 사유를 적어 eple에게 예외(.githooks/allow-patterns)를 요청하세요."
  exit 1
fi
exit 0
