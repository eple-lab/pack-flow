/**
 * 라우트 목록 시험 — 04 3절 표와 src/app/api의 route.ts 파일 · 메서드가 1:1인지.
 *
 * 하는 일
 * 1. docs/04-api-contract.md의 3절 표에서 `GET /api/...` 모양의 첫 칸을 읽어 (메서드, 경로) 목록을 만든다.
 * 2. src/app/api 아래 route.ts를 훑어 `export const GET/POST/...` 메서드를 읽는다.
 * 3. 두 목록이 같아야 한다. 04에 없지만 허용하는 것은 EXTRA(로그아웃)뿐이다 — 늘리려면 04부터 고친다.
 *
 * 근거: docs/04-api-contract.md 3절, WU-04 (R1 기준)
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 04 3절 ↔ 라우트 파일 1:1 시험 (WU-04)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
/** 04 3절에 없지만 있는 라우트: 로그인 화면의 짝(로그아웃). 04 3.1 본문에 "로그아웃은 Supabase Auth를 화면에서 직접"이라고만 있다. */
const EXTRA = ['POST /api/auth/logout'];

function documentedRoutes(): string[] {
  const doc = readFileSync(path.join(ROOT, 'docs/04-api-contract.md'), 'utf8');
  const start = doc.indexOf('\n## 3. 라우트');
  const end = doc.indexOf('\n## 4.');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const routes: string[] = [];
  for (const line of doc.slice(start, end).split('\n')) {
    const match = /^\| `(GET|POST|PATCH|PUT|DELETE) (\/api\/[^`?\s]+)/.exec(line);
    if (match) routes.push(`${match[1]} ${match[2]}`);
  }
  return routes;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function implementedRoutes(): string[] {
  const apiDir = path.join(ROOT, 'src/app/api');
  const routes: string[] = [];
  for (const file of walk(apiDir).filter((f) => path.basename(f) === 'route.ts')) {
    const urlPath = '/api/' + path.relative(apiDir, path.dirname(file)).split(path.sep).filter(Boolean).join('/');
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/export (?:const|async function|function) (GET|POST|PATCH|PUT|DELETE)\b/g)) {
      routes.push(`${m[1]} ${urlPath.replace(/\/$/, '')}`);
    }
  }
  return routes;
}

/** 문서의 {id} · {sku_id}를 Next 폴더 이름 [id] · [sku_id]로 */
const toNext = (route: string) => route.replace(/\{(\w+)\}/g, '[$1]');

describe('R1: 라우트 목록 ↔ 04 3절', () => {
  it('R1-1 04 3절에서 읽은 라우트가 24개 이상이다(파서 점검: 3.1~3.8 표 합계 24)', () => {
    expect(documentedRoutes().length).toBeGreaterThanOrEqual(24);
  });

  it('R1-2 문서에 있는 라우트는 모두 파일 · 메서드가 있다', () => {
    const implemented = new Set(implementedRoutes());
    const missing = documentedRoutes().map(toNext).filter((r) => !implemented.has(r));
    expect(missing).toEqual([]);
  });

  it('R1-3 파일에 있는 라우트는 04에 있거나 허용 목록(EXTRA)에 있다', () => {
    const documented = new Set(documentedRoutes().map(toNext));
    const extra = implementedRoutes().filter((r) => !documented.has(r) && !EXTRA.includes(r));
    expect(extra).toEqual([]);
  });

  it('R1-4 같은 라우트가 두 번 정의되지 않는다', () => {
    const list = implementedRoutes();
    expect(new Set(list).size).toBe(list.length);
  });
});
