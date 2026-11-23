/**
 * 회귀 실행기 — small 시드 초기화 → test:db → 시드 정답표 시험 → test:e2e → 결과표 생성.
 *
 * 하는 일
 * 1. 테스트 계정 A로 로그인해 small 시드로 초기화한다(사용자 JWT, 본인 데이터만. 서비스 키 없음 — D-20).
 * 2. Vitest db 묶음(tests/db · tests/api)을 JSON 리포터로 돌린다. `npm run test:db`와 같은 프로젝트 · 같은 시험이다
 *    (npm을 거치지 않고 node로 vitest를 직접 불러 리포터 인자를 안전하게 넘긴다).
 * 3. tests/regression/seed-expected.test.ts(sorek-charlie, node:test 형식 — vitest 묶음에 안 잡힘)를 node --test로 돌린다.
 * 4. Playwright(tests/e2e)를 JSON 리포터로 돌린다. 대상은 E2E_BASE_URL(없으면 http://localhost:3000).
 *    대상 서버가 안 떠 있거나 브라우저가 설치돼 있지 않으면 '미실행'과 이유를 결과표에 적고, 실패로 세지 않되 화면에 크게 알린다.
 * 5. 결과를 테스트 이름 앞 ID로 묶어 docs/records/regression-<YYYYMMDD-HHmm>.md(Asia/Seoul)로 쓴다.
 *    쓰기 전에 이메일 · 토큰 · 키 · 환경값을 가린다. 머리: 커밋 · 대상(호스트만) · 시드 · 실행자(REGRESSION_RUNNER, 없으면 미기재).
 * 6. 실패가 하나라도 있으면 종료 코드 1. 실행 자체가 깨져도(결과 파일이 없음) 실패 한 건으로 적고 1.
 *
 * 실행: npm run test:regression   (선택: REGRESSION_RUNNER=<GitHub 아이디> E2E_BASE_URL=<주소>)
 * 근거: docs/07-test-strategy.md 1 · 5절, docs/work-units/WU-45-regression-runner.md
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 시드 초기화 · db · 시드 정답표 · e2e → 결과표 (WU-45)
 * 2026-11-23  eple  tsconfig allowImportingTsExtensions를 켜고 TS5097 우회 주석 제거 (WU-45)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  describeTarget,
  hasFailure,
  parseJunit,
  parsePlaywrightJson,
  parseVitestJson,
  redact,
  renderReport,
  runnerLabel,
  seoulStamp,
  type CaseResult,
  type NotRun,
} from '../../scripts/regression/report.ts';
import { baseUrl, loadLocalEnv, loginWithCookies, REPO_ROOT, resetSeed, secretValues } from '../../scripts/regression/session.ts';

const SEED = 'small';

/** 하위 명령을 node로 실행한다(출력은 그대로 보여 준다). 종료 코드를 돌려준다. */
function runNode(args: string[], extraEnv: Record<string, string> = {}): number {
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  return result.status ?? 1;
}

/** 결과 파일을 읽는다. 없으면 null. */
function readIfExists(file: string): string | null {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** 실행 자체가 깨진 묶음을 실패 한 건으로 바꾼다(결과 파일이 없을 때). */
function crashed(label: string, code: number): CaseResult {
  return { source: label, name: `${label} 묶음 실행 오류`, status: 'failed', durationMs: 0, message: `결과 파일 없음 (종료 코드 ${code})` };
}

/** 대상 서버가 응답하는지(어떤 HTTP 응답이든 오면 켜진 것). */
async function isReachable(url: string): Promise<boolean> {
  try {
    await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
    return true;
  } catch {
    return false;
  }
}

/** Playwright 브라우저(chromium)가 설치돼 있는지. */
async function hasChromium(): Promise<boolean> {
  try {
    const mod = (await import('@playwright/test')) as unknown as {
      chromium?: { executablePath(): string };
      default?: { chromium: { executablePath(): string } };
    };
    const chromium = mod.chromium ?? mod.default?.chromium;
    return chromium ? existsSync(chromium.executablePath()) : false;
  } catch {
    return false;
  }
}

/** 현재 커밋 짧은 해시. 고친 파일이 있으면 '+수정중'을 붙인다. 못 읽으면 '알 수 없음'. */
function commitLabel(): string {
  const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (head.status !== 0) return '알 수 없음';
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout.trim() !== '';
  return `${head.stdout.trim()}${dirty ? '+수정중' : ''}`;
}

async function main(): Promise<number> {
  loadLocalEnv();
  const base = baseUrl();
  const tmp = mkdtempSync(join(tmpdir(), 'pf-regression-'));
  const cases: CaseResult[] = [];
  const notRun: NotRun[] = [];

  try {
    // 1. small 시드 초기화
    console.log(`[회귀] ${SEED} 시드 초기화`);
    const session = await loginWithCookies('A');
    const counts = await resetSeed(session.client, SEED);
    console.log(`[회귀] 시드 ${SEED}: 품목 ${counts.items} · 구매 ${counts.purchases} · 판매 ${counts.sales} · 이력 ${counts.logs}`);

    // 2. test:db (Vitest db 프로젝트)
    console.log('[회귀] test:db 실행');
    const dbJson = join(tmp, 'db.json');
    const dbCode = runNode([join(REPO_ROOT, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'db', '--reporter=default', '--reporter=json', `--outputFile.json=${dbJson}`]);
    const dbRaw = readIfExists(dbJson);
    cases.push(...(dbRaw ? parseVitestJson(JSON.parse(dbRaw), 'db') : [crashed('db', dbCode)]));

    // 3. 시드 정답표 시험 (node:test)
    console.log('[회귀] 시드 정답표 시험 실행');
    const seedXml = join(tmp, 'seed.xml');
    const seedCode = runNode(['--test', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=junit', `--test-reporter-destination=${seedXml}`, 'tests/regression/seed-expected.test.ts']);
    const seedRaw = readIfExists(seedXml);
    cases.push(...(seedRaw ? parseJunit(seedRaw, 'seed') : [crashed('seed', seedCode)]));

    // 4. test:e2e (Playwright)
    console.log(`[회귀] test:e2e 실행 준비 — 대상 ${describeTarget(base)}`);
    if (!(await isReachable(base))) {
      notRun.push({ label: 'E2E 전체', reason: `대상 서버(${describeTarget(base)})가 응답하지 않아 실행하지 않음` });
    } else if (!(await hasChromium())) {
      notRun.push({ label: 'E2E 전체', reason: 'Playwright 브라우저(chromium)가 설치돼 있지 않아 실행하지 않음(npx playwright install)' });
    } else {
      const e2eJson = join(tmp, 'e2e.json');
      const e2eCode = runNode([join(REPO_ROOT, 'node_modules/@playwright/test/cli.js'), 'test', '--reporter=list,json'], {
        PLAYWRIGHT_JSON_OUTPUT_NAME: e2eJson,
        E2E_BASE_URL: base,
      });
      const e2eRaw = readIfExists(e2eJson);
      cases.push(...(e2eRaw ? parsePlaywrightJson(JSON.parse(e2eRaw), 'e2e') : [crashed('e2e', e2eCode)]));
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // 5. 결과표 — 쓰기 전에 실제 비밀값까지 가린다
  const secrets = secretValues();
  const safeCases = cases.map((c) => ({ ...c, name: redact(c.name, secrets), message: c.message ? redact(c.message, secrets) : undefined }));
  const stamp = seoulStamp(new Date());
  const doc = redact(
    renderReport(
      { timestamp: stamp.display, commit: commitLabel(), target: describeTarget(base), seed: SEED, runner: runnerLabel(process.env.REGRESSION_RUNNER) },
      safeCases,
      notRun,
    ),
    secrets,
  );
  const outDir = join(REPO_ROOT, 'docs', 'records');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `regression-${stamp.file}.md`);
  writeFileSync(outFile, doc, 'utf8');

  console.log(`\n[회귀] 결과표: docs/records/regression-${stamp.file}.md`);
  console.log(doc.split('\n').at(-2) ?? '');
  for (const item of notRun) {
    console.warn(`[회귀] 주의: ${item.label} 미실행 — ${item.reason}. 이 결과표에는 E2E 판정이 없습니다.`);
  }
  return hasFailure(safeCases) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    // 오류 메시지는 환경값이 없도록 만든 문구만 온다(로그인 실패 · 환경변수 이름 등)
    console.error(`[회귀] 멈춤 — ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    process.exit(1);
  },
);
