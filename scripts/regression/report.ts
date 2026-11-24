/**
 * 회귀 결과표 · 응답 시간 기록의 순수 함수 모음 — ID 묶기, 표 만들기, p50, 비밀값 가리기.
 *
 * 하는 일
 * 1. Vitest JSON · Playwright JSON · node:test JUnit 결과를 한 모양(CaseResult)으로 바꾼다.
 * 2. 테스트 이름 앞의 ID(T-S1-1 · C-01 …)로 묶어 07 5절 양식의 결과표 문서를 만든다. ID가 없으면 '기타'.
 * 3. 응답 시간(p50 · 최대)을 계산하고 performance.md 행을 만든다.
 * 4. 결과 · 기록 파일에 쓰기 전에 redact()로 이메일 · 토큰 · 키 · 사용자 경로를 가린다.
 * 5. DB · 네트워크 · 파일을 건드리지 않는다. 실제 실행은 tests/regression/run.ts · measure.ts가 한다.
 *    (순수 함수를 여기 둔 이유: vitest unit 묶음이 scripts/**만 잡고 tests/regression은 안 잡는다)
 *
 * 근거: docs/07-test-strategy.md 5절 · docs/work-units/WU-45-regression-runner.md
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 결과 묶기 · 결과표 · p50 · 가리기 (WU-45)
 * 2026-11-24  eple  헤더형 비밀(cookie · authorization · sb 세션 쿠키) 가리기 + 비정상 종료 코드 반영 withExitCode (#49 리뷰)
 * 2026-11-24  eple  redact에 터미널 색 코드 제거 · 절대 경로 가리기 — 회귀 결과표에 PC 경로가 남음 (WU-24 #68)
 * 2026-11-24  eple  따옴표 안 공백 경로도 끝까지 가림 (#70 리뷰)
 */

/** 한 테스트의 결과. */
export type CaseResult = {
  /** 출처: 'db' | 'e2e' | 'seed' 등 */
  source: string;
  /** 테스트 이름 전체 */
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  /** 걸린 시간(ms) */
  durationMs: number;
  /** 실패했을 때 메시지(가리기 전 원문) */
  message?: string;
};

/** 결과표의 한 줄. */
export type TableRow = {
  id: string;
  result: '통과' | '실패' | '건너뜀';
  durationMs: number;
  memo: string;
};

/** 실행하지 못한 묶음(예: 대상 서버가 없어 E2E를 못 돌림). 실패로 세지 않는다. */
export type NotRun = { label: string; reason: string };

/** 테스트 이름 앞의 ID. 예: T-S1-1, T-INV-3, T-AI-1a, C-01. 없으면 null. */
export function extractId(name: string): string | null {
  const match = /^([A-Z]{1,4}(?:-[A-Za-z0-9]+)+)(?=\s|$)/.exec(name.trim());
  // 숫자가 하나는 있어야 ID로 본다(AI-driven 같은 낱말 오탐 방지). 끝 글자 접미사 허용: T-AI-1a
  return match && /\d/.test(match[1]) ? match[1] : null;
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).find((line) => line.trim() !== '')?.trim() ?? '';
}

/**
 * 결과를 ID로 묶어 표의 줄로 만든다. 같은 ID가 여럿이면 한 줄로 합친다:
 * 하나라도 실패면 '실패', 전부 건너뜀이면 '건너뜀', 아니면 '통과'. 시간은 합계.
 * ID 없는 테스트는 줄마다 '기타'(메모에 테스트 이름). 줄 순서는 ID가 처음 나온 순서, '기타'는 맨 끝.
 */
export function groupResults(cases: CaseResult[]): TableRow[] {
  const byId = new Map<string, CaseResult[]>();
  const others: CaseResult[] = [];
  for (const c of cases) {
    const id = extractId(c.name);
    if (id === null) {
      others.push(c);
    } else {
      const list = byId.get(id);
      if (list) list.push(c);
      else byId.set(id, [c]);
    }
  }

  const rows: TableRow[] = [];
  for (const [id, list] of byId) {
    const failed = list.filter((c) => c.status === 'failed');
    const allSkipped = list.every((c) => c.status === 'skipped');
    const result: TableRow['result'] = failed.length > 0 ? '실패' : allSkipped ? '건너뜀' : '통과';
    const durationMs = list.reduce((sum, c) => sum + c.durationMs, 0);
    const notes: string[] = [];
    if (list.length > 1) notes.push(`테스트 ${list.length}개`);
    for (const c of failed) notes.push(c.message ? firstLine(c.message) : '실패(메시지 없음)');
    rows.push({ id, result, durationMs, memo: notes.join(' / ') });
  }
  for (const c of others) {
    const result: TableRow['result'] = c.status === 'failed' ? '실패' : c.status === 'skipped' ? '건너뜀' : '통과';
    const detail = c.status === 'failed' && c.message ? ` — ${firstLine(c.message)}` : '';
    rows.push({ id: '기타', result, durationMs: c.durationMs, memo: `${c.name}${detail}` });
  }
  return rows;
}

/** 시간(ms)을 '0.8s' 모양으로. */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 표 칸에 넣을 글: 가리기 → 줄바꿈을 공백으로 → | 이스케이프 → 길면 자름. */
export function cell(text: string, max = 120): string {
  const clean = redact(text).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** 줄 목록의 통계. */
export function summarize(rows: TableRow[]): { passed: number; failed: number; skipped: number } {
  return {
    passed: rows.filter((r) => r.result === '통과').length,
    failed: rows.filter((r) => r.result === '실패').length,
    skipped: rows.filter((r) => r.result === '건너뜀').length,
  };
}

/** 결과표 문서의 머리 정보. */
export type ReportHeader = {
  /** 'YYYY-MM-DD HH:mm' (Asia/Seoul) */
  timestamp: string;
  commit: string;
  /** 예: '로컬 (localhost:3000)' */
  target: string;
  seed: string;
  runner: string;
};

/**
 * 07 5절 양식의 결과표 문서(마크다운)를 만든다. 모든 글자에 가리기를 적용한다.
 * 실패가 있어도 문서는 만든다(종료 코드는 호출자가 정한다). 미실행 묶음은 표 끝에 줄로 적고 합계에도 붙인다.
 */
export function renderReport(header: ReportHeader, cases: CaseResult[], notRun: NotRun[] = []): string {
  const rows = groupResults(cases);
  const sum = summarize(rows);
  const lines: string[] = [
    `# 회귀 테스트 결과 ${cell(header.timestamp)}`,
    '',
    `- 커밋: ${cell(header.commit)} / 대상: ${cell(header.target)} / 시드: ${cell(header.seed)} / 실행: ${cell(header.runner)}`,
    '',
    '| ID | 결과 | 걸린 시간 | 메모 |',
    '|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(`| ${cell(row.id)} | ${row.result} | ${formatSeconds(row.durationMs)} | ${cell(row.memo)} |`);
  }
  for (const item of notRun) {
    lines.push(`| ${cell(item.label)} | 미실행 | - | ${cell(item.reason)} |`);
  }
  const notRunText = notRun.length > 0 ? ` / 미실행 ${notRun.length}` : '';
  lines.push('', `통과 ${sum.passed} / 실패 ${sum.failed} / 건너뜀 ${sum.skipped}${notRunText}`, '');
  return lines.join('\n');
}

/** 실패가 하나라도 있으면 true(종료 코드 1의 기준). 미실행은 실패가 아니다. */
export function hasFailure(cases: CaseResult[]): boolean {
  return cases.some((c) => c.status === 'failed');
}

/**
 * 결과 파일은 있는데 하위 명령이 0이 아닌 코드로 끝났고, 파일에 실패 건이 없으면
 * '묶음 비정상 종료' 실패 한 건을 덧붙인 새 목록을 돌려준다(종료 코드를 버려 통과로 보이는 것을 막는다).
 * 종료 코드 0이거나 이미 실패 건이 있으면 그대로 돌려준다. 원본은 바꾸지 않는다.
 */
export function withExitCode(cases: CaseResult[], label: string, code: number): CaseResult[] {
  if (code === 0 || hasFailure(cases)) return cases;
  return [
    ...cases,
    {
      source: label,
      name: `${label} 묶음 비정상 종료`,
      status: 'failed',
      durationMs: 0,
      message: `종료 코드 ${code} — 결과 파일에 실패가 없지만 실행이 비정상 종료됨(미수집 실패)`,
    },
  ];
}

// ── 결과 파일 → CaseResult ────────────────────────────────────────────

type VitestJson = {
  testResults?: {
    assertionResults?: { title?: string; status?: string; duration?: number | null; failureMessages?: string[] }[];
  }[];
};

/** Vitest JSON 리포터 결과를 바꾼다. 모양이 다르면 Error를 던진다(조용히 0건이 되는 것을 막는다). */
export function parseVitestJson(json: unknown, source: string): CaseResult[] {
  const data = json as VitestJson | null;
  if (!data || !Array.isArray(data.testResults)) throw new Error(`${source}: Vitest JSON 모양이 아닙니다`);
  const out: CaseResult[] = [];
  for (const file of data.testResults) {
    for (const t of file.assertionResults ?? []) {
      const status = t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped';
      out.push({
        source,
        name: t.title ?? '(이름 없음)',
        status,
        durationMs: t.duration ?? 0,
        message: status === 'failed' ? (t.failureMessages?.[0] ?? '') : undefined,
      });
    }
  }
  return out;
}

type PwSuite = {
  specs?: { title?: string; tests?: { status?: string; results?: { duration?: number; error?: { message?: string } }[] }[] }[];
  suites?: PwSuite[];
};

/** Playwright JSON 리포터 결과를 바꾼다. expected → 통과, skipped → 건너뜀, 나머지(unexpected · flaky) → 실패. */
export function parsePlaywrightJson(json: unknown, source: string): CaseResult[] {
  const data = json as { suites?: PwSuite[] } | null;
  if (!data || !Array.isArray(data.suites)) throw new Error(`${source}: Playwright JSON 모양이 아닙니다`);
  const out: CaseResult[] = [];
  const walk = (suite: PwSuite): void => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const status = t.status === 'expected' ? 'passed' : t.status === 'skipped' ? 'skipped' : 'failed';
        const results = t.results ?? [];
        out.push({
          source,
          name: spec.title ?? '(이름 없음)',
          status,
          durationMs: results.reduce((sum, r) => sum + (r.duration ?? 0), 0),
          message: status === 'failed' ? results.find((r) => r.error?.message)?.error?.message : undefined,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of data.suites) walk(suite);
  return out;
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** node:test의 JUnit 리포터 XML을 바꾼다(testcase만 읽는다). 모양이 다르면 Error. */
export function parseJunit(xml: string, source: string): CaseResult[] {
  if (!xml.includes('<testsuite')) throw new Error(`${source}: JUnit XML 모양이 아닙니다`);
  const out: CaseResult[] = [];
  const re = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const m of xml.matchAll(re)) {
    const attrs = m[1];
    const body = m[2] ?? '';
    const name = /\bname="([^"]*)"/.exec(attrs)?.[1];
    const time = /\btime="([^"]*)"/.exec(attrs)?.[1];
    const hasFailure = /<(?:failure|error)\b/.test(body);
    const failureMessage = /<(?:failure|error)\b[^>]*?\bmessage="([^"]*)"/.exec(body)?.[1] ?? '';
    const skipped = /<skipped\b/.test(body);
    out.push({
      source,
      name: unescapeXml(name ?? '(이름 없음)'),
      status: hasFailure ? 'failed' : skipped ? 'skipped' : 'passed',
      durationMs: Math.round(Number(time ?? 0) * 1000),
      message: hasFailure ? unescapeXml(failureMessage) : undefined,
    });
  }
  return out;
}

// ── 응답 시간 ────────────────────────────────────────────────────────

/** 중앙값(p50). 짝수 개면 가운데 두 값의 평균. 빈 배열이면 Error. */
export function p50(values: number[]): number {
  if (values.length === 0) throw new Error('p50: 값이 없습니다');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 최댓값. 빈 배열이면 Error. */
export function maxOf(values: number[]): number {
  if (values.length === 0) throw new Error('최댓값: 값이 없습니다');
  return Math.max(...values);
}

/** 한 엔드포인트의 측정: 첫 호출 따로, 나머지로 p50 · 최대. */
export type Timing = { first: number; p50: number; max: number; count: number };

/** 호출 시간 목록(앞이 첫 호출)을 Timing으로. 호출이 2번 미만이면 Error. */
export function toTiming(samples: number[]): Timing {
  if (samples.length < 2) throw new Error('측정은 첫 호출 + 1회 이상이 필요합니다');
  const rest = samples.slice(1);
  return { first: samples[0], p50: p50(rest), max: maxOf(rest), count: rest.length };
}

/** 'ms' 표기(소수 없이). */
export function formatMs(ms: number): string {
  return `${Math.round(ms)}ms`;
}

/** performance.md의 머리(파일이 없을 때 만든다). 07 5절 양식에 '첫 호출' · '측정 일시' 칸을 더했다. */
export const PERFORMANCE_HEADER = [
  '# 응답 시간 측정 (Step 4)',
  '',
  '각 엔드포인트를 첫 호출 1번(잠에서 깨는 시간 포함, 따로 적음) + 이어서 10번 호출해 그 10번의 p50 · 최대를 적는다.',
  '`npm run measure`가 행을 덧붙인다(WU-45). 이력 1페이지는 `GET /api/stock-logs?limit=20`.',
  '',
  '| 시드 | 행 수 | 대상 | 측정 환경 | 대시보드 p50 / 최대 | 이력 1페이지 p50 / 최대 | 첫 호출 (대시보드 / 이력) | 측정 일시 |',
  '|---|---|---|---|---|---|---|---|',
  '',
].join('\n');

export type PerfRowInput = {
  seed: string;
  counts: { items: number; logs: number };
  target: string;
  environment: string;
  dashboard: Timing;
  stockLogs: Timing;
  timestamp: string;
};

/** performance.md에 덧붙일 한 줄(끝 줄바꿈 포함, 가리기 적용). */
export function renderPerfRow(input: PerfRowInput): string {
  const t = (x: Timing): string => `${formatMs(x.p50)} / ${formatMs(x.max)}`;
  const cols = [
    input.seed,
    `품목 ${input.counts.items} · 이력 ${input.counts.logs}`,
    input.target,
    input.environment,
    t(input.dashboard),
    t(input.stockLogs),
    `${formatMs(input.dashboard.first)} / ${formatMs(input.stockLogs.first)}`,
    input.timestamp,
  ];
  return `| ${cols.map((c) => cell(c)).join(' | ')} |\n`;
}

// ── 머리 정보 · 가리기 ───────────────────────────────────────────────

/** 주소에서 호스트(+포트)만 꺼낸다. 계정 · 경로 · 쿼리 · 해시는 버린다. 주소가 아니면 '알 수 없음'. */
export function hostOnly(url: string): string {
  try {
    return new URL(url).host || '알 수 없음';
  } catch {
    return '알 수 없음';
  }
}

/** 대상 표기: localhost · 127.0.0.1이면 '로컬', 아니면 '배포'. */
export function describeTarget(url: string): string {
  const host = hostOnly(url);
  const name = host.split(':')[0];
  const local = name === 'localhost' || name === '127.0.0.1' || host.startsWith('[::1]');
  return `${local ? '로컬' : '배포'} (${host})`;
}

/** Asia/Seoul 기준 'YYYYMMDD-HHmm'(파일 이름)과 'YYYY-MM-DD HH:mm'(표시). */
export function seoulStamp(date: Date): { file: string; display: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  const ymd = `${get('year')}${get('month')}${get('day')}`;
  return {
    file: `${ymd}-${get('hour')}${get('minute')}`,
    display: `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`,
  };
}

/** 실행자 표기: REGRESSION_RUNNER 같은 명시 값이 GitHub 아이디 모양이면 그대로, 아니면 '미기재'. */
export function runnerLabel(value: string | undefined): string {
  const v = value?.trim() ?? '';
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(v) ? v : '미기재';
}

// 윈도 절대 경로(`file:///C:/…` · `C:\…` · `C:/…`). 앞이 영숫자면(`https:` 등) 경로가 아니다.
const WIN_PATH_RE = /(?<![A-Za-z0-9])(?:file:\/\/\/)?[A-Za-z]:[\\/][^\s'"<>)]*/g;
// POSIX 절대 경로(`/home/` · `/Users/` · `/root/`). 주소 안의 `/home/`은 앞 글자 때문에 걸리지 않는다.
const POSIX_PATH_RE = /(?<![A-Za-z0-9.:/_-])(?:file:\/\/)?\/(?:home|Users|root)\/[^\s'"<>)]*/g;

// 따옴표(`"` · `'` · 백틱)로 연 절대 경로: 같은 따옴표로 닫힐 때까지(공백 포함, 줄바꿈 제외) 한 덩어리.
const QUOTED_WIN_PATH_RE = /(["'`])((?:file:\/\/\/)?[A-Za-z]:[\\/][^\r\n]*?)\1/g;
const QUOTED_POSIX_PATH_RE = /(["'`])((?:file:\/\/)?\/(?:home|Users|root)\/[^\r\n]*?)\1/g;

/** 절대 경로 한 덩어리를 가린다. `pack-flow` 폴더가 있으면 `<repo>/뒷부분`, 없으면 `[경로]`. */
function maskPath(match: string): string {
  const norm = match.replace(/\\/g, '/');
  const at = norm.indexOf('/pack-flow/');
  return at >= 0 ? `<repo>/${norm.slice(at + '/pack-flow/'.length)}` : '[경로]';
}

/**
 * 결과 · 기록 파일에 쓰기 전에 비밀값 · 개인정보를 가린다.
 * (#68) 맨 먼저 터미널 색 코드(ANSI `ESC[…m` 등)를 지운다(표 칸이 깨짐). 이어서 절대 경로(`file:///C:/…` · `C:\…` · `C:/…` ·
 * `/home/` · `/Users/` · `/root/`로 시작)를 가린다: 경로에 `pack-flow` 폴더가 있으면 그 앞까지를 `<repo>/`로 바꿔 저장소 안 경로만 남기고,
 * 없으면 통째로 `[경로]`. `https://…` 같은 주소는 건드리지 않는다.
 * secrets: 실행 환경의 실제 값들(비밀번호 · 키 등). 4글자 미만은 무시한다(오탐 방지).
 * 가리는 것: 알려 준 값, 이메일, JWT, Bearer 토큰, 접두사 있는 키(sb_ · sk- · AIza · ghp_ …),
 * 사용자 홈 경로, URL 쿼리, 32자 이상 긴 영숫자 덩어리.
 * (#49 리뷰) 값을 몰라도 가리는 헤더 모양: `cookie:` · `set-cookie:` · `authorization:` 줄(JSON `"cookie": "…"` 포함)은
 * 이름은 두고 값만 `[가림]`, Supabase 세션 쿠키 `sb-…-auth-token(.N)=값`은 `sb-…-auth-token=[세션]`으로 바꾼다.
 */
export function redact(text: string, secrets: string[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= 4) out = out.split(secret).join('[가림]');
  }
  return out
    // [#68 수정] 터미널 색 코드가 표 칸에 남음 → 맨 먼저 지움 (eple)
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b/g, '')
    // [#70 리뷰] 따옴표 안 경로가 공백에서 끊겨 일부가 남음 → 닫는 따옴표까지 가림 (eple)
    .replace(QUOTED_WIN_PATH_RE, (_m, q: string, path: string) => `${q}${maskPath(path)}${q}`)
    .replace(QUOTED_POSIX_PATH_RE, (_m, q: string, path: string) => `${q}${maskPath(path)}${q}`)
    // [#68 수정] PC 절대 경로가 남음 → 저장소 안 경로만 남기고 가림 (eple)
    .replace(WIN_PATH_RE, maskPath)
    .replace(POSIX_PATH_RE, maskPath)
    .replace(/("(?:set-cookie|cookie|authorization)"\s*:\s*)"(?:[^"\\]|\\.)*"/gi, '$1"[가림]"')
    .replace(/\b((?:set-cookie|cookie|authorization)\s*:)[^\r\n]*/gi, '$1 [가림]')
    .replace(/sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?=[^;\s'"]+/g, 'sb-…-auth-token=[세션]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[이메일]')
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}(?:\.[A-Za-z0-9_-]*)?/g, '[토큰]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [토큰]')
    .replace(/(?:sb_(?:secret|publishable)_|sk-|AIza|ghp_|gho_|github_pat_|xox[bp]-)[A-Za-z0-9_-]{6,}/g, '[키]')
    .replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s'"]+/g, '[사용자경로]')
    .replace(/\/(?:Users|home)\/[A-Za-z0-9._-]+/g, '[사용자경로]')
    .replace(/(https?:\/\/[^\s?#'")]+)\?[^\s'")]*/g, '$1?[가림]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[긴값]');
}
