/**
 * 응답 시간 측정 — small · large 시드 각각에서 GET /api/dashboard · GET /api/stock-logs의 응답 시간을 재어 docs/records/performance.md에 행으로 덧붙인다.
 *
 * 하는 일
 * 1. 테스트 계정 A로 로그인해 쿠키 세션을 만든다(사용자 JWT, 서비스 키 없음). 같은 세션을 대상 서버 요청에 싣는다.
 * 2. 시드(small → large)마다 초기화한 뒤 엔드포인트별로 첫 호출 1번(따로 기록) + 이어서 10번 호출해 p50 · 최대를 잰다.
 *    이력 1페이지는 GET /api/stock-logs?limit=20. GET이라 X-PF 헤더는 필요 없다.
 * 3. 대상은 E2E_BASE_URL(없으면 http://localhost:3000). 대상 서버의 DB가 .env.local의 프로젝트와 같아야 로그인 세션이 통한다.
 * 4. 끝나면 계정 A 데이터를 small로 되돌린다. 기록 파일이 없으면 07 5절 양식의 머리로 만든다.
 * 5. 행에는 호스트만 적는다(키 · 쿼리 · 이메일 없음, 쓰기 전에 가린다). 측정 환경은 MEASURE_ENV, 없으면 OS · 코어 수.
 *
 * 실행: npm run measure   (선택: E2E_BASE_URL=<주소> MEASURE_ENV="<PC 사양 · 네트워크>")
 * 근거: docs/07-test-strategy.md 5절 '응답 시간 측정', docs/work-units/WU-45-regression-runner.md
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — small · large 응답 시간 → performance.md (WU-45)
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error TS5097 — node가 직접 읽으려면 .ts 확장자가 필요하다(tsconfig에서 allowImportingTsExtensions를 켜면 이 줄은 지운다)
import { describeTarget, PERFORMANCE_HEADER, redact, renderPerfRow, seoulStamp, toTiming, type Timing } from '../../scripts/regression/report.ts';
// @ts-expect-error TS5097 — node가 직접 읽으려면 .ts 확장자가 필요하다(tsconfig에서 allowImportingTsExtensions를 켜면 이 줄은 지운다)
import { baseUrl, loadLocalEnv, loginWithCookies, REPO_ROOT, resetSeed, secretValues, type SeedName } from '../../scripts/regression/session.ts';

/** 첫 호출 뒤에 재는 횟수. */
const REPEAT = 10;

/** 경로를 첫 호출 1번 + REPEAT번 불러 걸린 시간(ms) 목록을 돌려준다. 200이 아니면 상태 코드만 담은 Error. */
async function sample(base: string, path: string, cookie: string): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < REPEAT + 1; i += 1) {
    const start = performance.now();
    const res = await fetch(`${base}${path}`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(90_000) });
    await res.arrayBuffer(); // 본문까지 받아야 응답 시간이다
    times.push(performance.now() - start);
    if (res.status !== 200) throw new Error(`${path.split('?')[0]} 호출 실패 (HTTP ${res.status})`);
  }
  return times;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const base = baseUrl();
  const target = describeTarget(base);
  const environment = process.env.MEASURE_ENV?.trim() || `${platform()} · ${cpus().length}코어 · Node ${process.versions.node}`;
  const secrets = secretValues();

  const session = await loginWithCookies('A');
  const rows: string[] = [];
  const seeds: SeedName[] = ['small', 'large'];
  try {
    for (const seed of seeds) {
      const counts = await resetSeed(session.client, seed);
      console.log(`[측정] ${seed} 시드(품목 ${counts.items} · 이력 ${counts.logs}) → ${target}`);
      const cookie = session.cookieHeader();
      const dashboard: Timing = toTiming(await sample(base, '/api/dashboard', cookie));
      const stockLogs: Timing = toTiming(await sample(base, '/api/stock-logs?limit=20', cookie));
      console.log(
        `[측정] 대시보드 p50 ${Math.round(dashboard.p50)}ms · 최대 ${Math.round(dashboard.max)}ms (첫 ${Math.round(dashboard.first)}ms) / ` +
          `이력 p50 ${Math.round(stockLogs.p50)}ms · 최대 ${Math.round(stockLogs.max)}ms (첫 ${Math.round(stockLogs.first)}ms)`,
      );
      rows.push(
        renderPerfRow({ seed, counts, target, environment, dashboard, stockLogs, timestamp: seoulStamp(new Date()).display }),
      );
    }
  } finally {
    // 측정 중 오류가 나도 데이터는 small로 되돌린다(실패하면 알리기만)
    await resetSeed(session.client, 'small').catch(() => console.warn('[측정] 주의: small 시드로 되돌리지 못했습니다'));
  }

  const dir = join(REPO_ROOT, 'docs', 'records');
  const file = join(dir, 'performance.md');
  mkdirSync(dir, { recursive: true });
  if (!existsSync(file)) writeFileSync(file, PERFORMANCE_HEADER, 'utf8');
  appendFileSync(file, redact(rows.join(''), secrets), 'utf8');
  console.log(`[측정] docs/records/performance.md에 ${rows.length}행 추가`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(`[측정] 멈춤 — ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    process.exit(1);
  },
);
