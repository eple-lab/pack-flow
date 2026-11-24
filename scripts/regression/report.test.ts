/**
 * 회귀 결과표 · 측정 순수 함수 시험.
 *
 * 기대(먼저 적음)
 * - extractId: 'T-S1-1 재고 …' → T-S1-1, 'C-01 …' → C-01, 'T-INV-3' → T-INV-3, ID 없는 이름 · 중간에 ID가 낀 이름 · 소문자 → null
 * - groupResults: 같은 ID 둘 중 하나 실패 → 한 줄 '실패'(시간 합계), 전부 건너뜀 → '건너뜀', ID 없음 → '기타'(맨 끝, 메모에 이름)
 * - renderReport: 07 5절 양식(머리 · 표 · 합계 줄), 실패 줄 · 미실행 줄 포함, 실패해도 문서가 나온다
 * - hasFailure: 실패 하나면 true, 미실행만 있으면 false(호출자가 notRun은 따로 넘김)
 * - parse*: 각 리포터 샘플 → 같은 CaseResult. 모양이 다르면 Error
 * - p50 · toTiming: [5,1,3] → 3, [1,2,3,4] → 2.5, 첫 호출은 빼고 계산, 값 없음 · 호출 1번뿐이면 Error
 * - redact: 이메일 · JWT · Bearer · 키 접두사 · 사용자 경로 · URL 쿼리 · 알려 준 비밀값 · 긴 영숫자가 모두 사라진다
 * - 결과표 · 측정 행 전체 문자열에 이메일 · 비밀번호 · 키를 일부러 넣어도 출력에 없다
 * - hostOnly: 계정 · 쿼리 · 경로 제거, 주소 아님 → '알 수 없음'
 * - seoulStamp: 2026-11-23T15:30:00Z → 2026-11-24 00:30 (한국 시간으로 날짜가 넘어감)
 * - (#49 리뷰) C-24 redact: `Cookie: sb-…-auth-token=값; …` · `set-cookie: …` · `"authorization": "Basic …"` · 맨몸 `sb-proj-auth-token.0=값`
 *   → 원래 값이 하나도 안 남고 헤더 이름은 남는다
 * - (#49 리뷰) C-25 redact: 평범한 글(`PRD-001 재고 10`)은 그대로
 * - (#49 리뷰) C-26 withExitCode: (실패 없음, 코드 1) → 실패 한 건 추가 / (코드 0) → 그대로 / (이미 실패 있음, 코드 1) → 그대로 / 원본 불변
 * - (#68) C-27 redact ANSI: `ESC[31m…ESC[39m` → 색 코드만 사라지고 글은 그대로 / `ESC[2mexpect(ESC[22m` → ESC 문자 없음
 * - (#68) C-28 redact 경로: `file:///C:/work/me/git/pack-flow/src/…/demo.json` → `<repo>/src/lib/seed/demo.json`(`C:` · `work/me` 없음) /
 *   윈도 사용자 폴더 경로(가짜 이름 kim) → `kim` 없음 / `D:/other/place/file.ts`(저장소 아님) → `[경로]` / POSIX 홈 아래 pack-flow 경로 → `<repo>/tests/a.ts`
 *   (가짜 사용자 경로는 비밀값 검사 훅에 걸리지 않게 시험 안에서 이어 붙여 만든다)
 * - (#68) C-29 redact 경로 아님: `https://pack-flow.onrender.com/api/health` · `http://localhost:3000/` · `PRD-001 재고 10` · `T-S1-1 | 통과 | 0.8s` → 그대로
 *
 * 근거: WU-45 · docs/07-test-strategy.md 5절
 * 구역: eple (docs/06-work-plan.md 1절 '테스트 기반')
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — 결과표 · p50 · 가리기 시험 (WU-45)
 * 2026-11-24  eple  헤더형 비밀 가리기 · 비정상 종료 코드 반영 시험 추가 (#49 리뷰)
 * 2026-11-24  eple  색 코드 제거 · 절대 경로 가리기 시험 추가 C-27~C-29 (WU-24 #68)
 */
import { describe, expect, it } from 'vitest';
import {
  cell,
  describeTarget,
  extractId,
  groupResults,
  hasFailure,
  hostOnly,
  p50,
  parseJunit,
  parsePlaywrightJson,
  parseVitestJson,
  redact,
  renderPerfRow,
  renderReport,
  runnerLabel,
  seoulStamp,
  toTiming,
  withExitCode,
  type CaseResult,
} from './report';

// 시험용 가짜 비밀값은 조각을 이어 만든다 — 소스에 이메일 · 토큰 · 경로 모양이 글자 그대로 남지 않게(비밀값 검사 통과)
const AT = '@';
const mail = (user: string): string => `${user}${AT}packflow.test`;
const fakeJwt = (): string => ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTYifQ', 'c2lnbmF0dXJl'].join('.');
const winHome = (): string => ['C:', 'Users', 'someone', 'project'].join('\\');

const pass = (name: string, durationMs = 100, source = 'db'): CaseResult => ({ source, name, status: 'passed', durationMs });
const fail = (name: string, message = '기대 409, 실제 500', durationMs = 200): CaseResult => ({ source: 'db', name, status: 'failed', durationMs, message });
const skip = (name: string): CaseResult => ({ source: 'db', name, status: 'skipped', durationMs: 0 });

describe('extractId', () => {
  it('C-01 이름 앞의 ID를 꺼낸다', () => {
    expect(extractId('T-S1-1 재고 10에서 6개 출고')).toBe('T-S1-1');
    expect(extractId('C-01 small 시드의 규모')).toBe('C-01');
    expect(extractId('T-INV-3 구매 상태별 기록')).toBe('T-INV-3');
    expect(extractId('T-S1-1')).toBe('T-S1-1');
    expect(extractId('T-AI-1a 초안')).toBe('T-AI-1a');
  });
  it('C-02 ID가 없거나 맨 앞이 아니면 null (실패해야 하는 경우)', () => {
    expect(extractId('재고 출고')).toBeNull();
    expect(extractId('출고 T-S1-1')).toBeNull();
    expect(extractId('t-s1-1 소문자')).toBeNull();
    expect(extractId('')).toBeNull();
    expect(extractId('AI-driven 낱말')).toBeNull();
    expect(extractId('T-S1-1재고')).toBeNull();
  });
});

describe('groupResults', () => {
  it('C-03 같은 ID가 여럿이면 한 줄로 합치고 하나라도 실패면 실패', () => {
    const rows = groupResults([pass('C-01 demo', 100), fail('C-01 small', '값이 다름', 250), pass('T-S1-1 출고', 50)]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'C-01', result: '실패', durationMs: 350 });
    expect(rows[0].memo).toContain('테스트 2개');
    expect(rows[0].memo).toContain('값이 다름');
    expect(rows[1]).toMatchObject({ id: 'T-S1-1', result: '통과' });
  });
  it('C-04 전부 건너뜀이면 건너뜀, ID 없는 테스트는 맨 끝 기타 줄(이름이 메모)', () => {
    const rows = groupResults([pass('이름만 있는 시험'), skip('T-S2-1 건너뜀'), pass('T-S1-1 통과')]);
    expect(rows.map((r) => r.id)).toEqual(['T-S2-1', 'T-S1-1', '기타']);
    expect(rows[0].result).toBe('건너뜀');
    expect(rows[2].memo).toBe('이름만 있는 시험');
  });
  it('C-05 빈 목록이면 빈 표', () => {
    expect(groupResults([])).toEqual([]);
  });
});

describe('renderReport', () => {
  const header = { timestamp: '2026-11-25 14:10', commit: 'abc1234', target: '로컬 (localhost:3000)', seed: 'small', runner: 'sorek-charlie' };
  it('C-06 07 5절 양식: 머리 · 표 · 합계, 실패 줄에 메시지', () => {
    const doc = renderReport(header, [pass('T-S1-1 출고', 800), fail('T-S3-2 재고 부족', '재고 4인데 50 출고가 409 대신 500', 500)]);
    expect(doc).toContain('# 회귀 테스트 결과 2026-11-25 14:10');
    expect(doc).toContain('- 커밋: abc1234 / 대상: 로컬 (localhost:3000) / 시드: small / 실행: sorek-charlie');
    expect(doc).toContain('| ID | 결과 | 걸린 시간 | 메모 |');
    expect(doc).toContain('| T-S1-1 | 통과 | 0.8s |  |');
    expect(doc).toContain('| T-S3-2 | 실패 | 0.5s | 재고 4인데 50 출고가 409 대신 500 |');
    expect(doc).toContain('통과 1 / 실패 1 / 건너뜀 0');
  });
  it('C-07 미실행은 표에 줄로 적고 합계에 붙이며 실패로 세지 않는다', () => {
    const cases = [pass('T-S1-1 출고')];
    const doc = renderReport(header, cases, [{ label: 'E2E 전체', reason: '대상 서버가 응답하지 않음' }]);
    expect(doc).toContain('| E2E 전체 | 미실행 | - | 대상 서버가 응답하지 않음 |');
    expect(doc).toContain('통과 1 / 실패 0 / 건너뜀 0 / 미실행 1');
    expect(hasFailure(cases)).toBe(false);
  });
  it('C-08 실패가 하나라도 있으면 hasFailure true', () => {
    expect(hasFailure([pass('T-S1-1'), fail('C-01 x')])).toBe(true);
    expect(hasFailure([])).toBe(false);
  });
  it('C-09 표 칸의 | 와 줄바꿈을 정리한다', () => {
    expect(cell('a | b\nc')).toBe('a \\| b c');
  });
});

describe('리포터 해석', () => {
  it('C-10 Vitest JSON → 통과 · 실패 · 건너뜀', () => {
    const json = {
      testResults: [
        {
          assertionResults: [
            { title: 'T-S1-1 출고', status: 'passed', duration: 12 },
            { title: 'T-S3-2 부족', status: 'failed', duration: 5, failureMessages: ['AssertionError: 기대 409\n  at x'] },
            { title: 'C-03 건너뜀', status: 'skipped', duration: null },
          ],
        },
      ],
    };
    const out = parseVitestJson(json, 'db');
    expect(out.map((c) => c.status)).toEqual(['passed', 'failed', 'skipped']);
    expect(out[1].message).toContain('기대 409');
    expect(() => parseVitestJson({}, 'db')).toThrow('Vitest JSON');
    expect(() => parseVitestJson(null, 'db')).toThrow('Vitest JSON');
  });

  it('C-11 Playwright JSON → 중첩 suite를 따라가며 expected=통과, unexpected=실패', () => {
    const json = {
      suites: [
        {
          specs: [],
          suites: [
            {
              specs: [
                { title: 'T-S1-5 화면', tests: [{ status: 'expected', results: [{ duration: 300 }] }] },
                { title: 'T-S2-9 화면', tests: [{ status: 'unexpected', results: [{ duration: 100, error: { message: '요소 없음' } }] }] },
                { title: 'C-02 건너뜀', tests: [{ status: 'skipped', results: [] }] },
              ],
            },
          ],
        },
      ],
    };
    const out = parsePlaywrightJson(json, 'e2e');
    expect(out.map((c) => [c.name, c.status])).toEqual([
      ['T-S1-5 화면', 'passed'],
      ['T-S2-9 화면', 'failed'],
      ['C-02 건너뜀', 'skipped'],
    ]);
    expect(out[1].message).toBe('요소 없음');
    expect(() => parsePlaywrightJson({}, 'e2e')).toThrow('Playwright JSON');
  });

  it('C-12 node:test JUnit XML → 이름 · 시간 · 실패 · 건너뜀, 이스케이프 풀기', () => {
    const xml = `<?xml version="1.0"?><testsuites><testsuite name="x" tests="3">
      <testcase name="C-01 demo &apos;시드&apos;" time="0.0123" classname="test"/>
      <testcase name="T-S4-1 small" time="0.5" classname="test"><failure message="값이 다름 &amp; 틀림" type="x">상세</failure></testcase>
      <testcase name="C-02 건너뜀" time="0" classname="test"><skipped/></testcase>
    </testsuite></testsuites>`;
    const out = parseJunit(xml, 'seed');
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ name: "C-01 demo '시드'", status: 'passed', durationMs: 12 });
    expect(out[1]).toMatchObject({ status: 'failed', message: '값이 다름 & 틀림', durationMs: 500 });
    expect(out[2].status).toBe('skipped');
    expect(() => parseJunit('<html/>', 'seed')).toThrow('JUnit');
  });
});

describe('응답 시간', () => {
  it('C-13 p50: 홀수 · 짝수 · 한 개', () => {
    expect(p50([5, 1, 3])).toBe(3);
    expect(p50([1, 2, 3, 4])).toBe(2.5);
    expect(p50([7])).toBe(7);
  });
  it('C-14 p50 빈 배열은 Error', () => {
    expect(() => p50([])).toThrow();
  });
  it('C-15 toTiming: 첫 호출은 따로, 나머지로 p50 · 최대', () => {
    const t = toTiming([900, 10, 30, 20]);
    expect(t).toEqual({ first: 900, p50: 20, max: 30, count: 3 });
  });
  it('C-16 toTiming: 호출이 1번뿐이면 Error', () => {
    expect(() => toTiming([100])).toThrow();
    expect(() => toTiming([])).toThrow();
  });
  it('C-17 renderPerfRow: 한 줄, 칸 8개, ms 표기', () => {
    const row = renderPerfRow({
      seed: 'small',
      counts: { items: 5, logs: 20 },
      target: '로컬 (localhost:3000)',
      environment: 'win32 · 8코어',
      dashboard: { first: 900, p50: 120.4, max: 300, count: 10 },
      stockLogs: { first: 800, p50: 90, max: 150.6, count: 10 },
      timestamp: '2026-11-24 10:00',
    });
    expect(row).toBe('| small | 품목 5 · 이력 20 | 로컬 (localhost:3000) | win32 · 8코어 | 120ms / 300ms | 90ms / 151ms | 900ms / 800ms | 2026-11-24 10:00 |\n');
  });
});

describe('가리기 (이메일 · 키 · 비밀번호가 결과 파일에 남지 않는다)', () => {
  const jwt = fakeJwt();
  it('C-18 패턴: 이메일 · JWT · Bearer · 키 접두사 · 경로 · URL 쿼리 · 긴 값', () => {
    const text = [
      mail('user-a'),
      jwt,
      'Bearer abc.def-ghi',
      ['sb', 'secret', 'ABCDEFGHIJ123456'].join('_'),
      winHome(),
      ['', 'home', 'someone', 'x'].join('/'),
      'https://x.supabase.co/rest?apikey=SECRET&b=1',
      'a'.repeat(40),
    ].join(' ');
    const out = redact(text);
    for (const leak of ['packflow.test', 'eyJ', 'abc.def-ghi', 'ABCDEFGHIJ', 'someone', 'SECRET', 'aaaaaaaaaaaaaaaa']) {
      expect(out).not.toContain(leak);
    }
  });
  it('C-19 알려 준 비밀값은 어떤 모양이어도 가린다. 4글자 미만은 무시(실패해야 하는 경우의 경계)', () => {
    expect(redact('비밀번호는 Pw!9x 입니다', ['Pw!9x'])).not.toContain('Pw!9x');
    expect(redact('abc abc', ['abc'])).toBe('abc abc');
  });
  it('C-20 결과표 · 측정 행 전체에 일부러 넣은 비밀이 없다', () => {
    const secretMail = mail('sorek-a');
    const header = { timestamp: '2026-11-25 14:10', commit: 'abc1234', target: describeTarget(`https://user:pw${AT}pack-flow.example.com/x?key=${jwt}`), seed: 'small', runner: runnerLabel(`bad name${AT}x.example`) };
    const doc = renderReport(header, [fail('T-S1-1 로그인', `로그인 실패 ${secretMail} ${jwt}`), pass(`이름에 ${secretMail}`)]);
    const row = renderPerfRow({
      seed: 'small',
      counts: { items: 5, logs: 20 },
      target: `배포 (${secretMail})`,
      environment: jwt,
      dashboard: { first: 1, p50: 1, max: 1, count: 10 },
      stockLogs: { first: 1, p50: 1, max: 1, count: 10 },
      timestamp: 't',
    });
    for (const text of [doc, row]) {
      expect(text).not.toContain('packflow.test');
      expect(text).not.toContain('eyJ');
      expect(text).not.toContain('user:pw');
      expect(text).not.toContain('key=');
    }
    expect(doc).toContain('pack-flow.example.com');
    expect(doc).toContain('실행: 미기재');
  });
});

describe('헤더형 비밀 가리기 · 종료 코드 (#49 리뷰)', () => {
  it('C-24 cookie · set-cookie · authorization · sb 세션 쿠키는 값을 모르는 채로도 가린다(이름은 남김)', () => {
    const cookie = redact('Cookie: sb-abc-auth-token=base64-xyz; other=1');
    expect(cookie).toContain('Cookie:');
    for (const leak of ['base64-xyz', 'other=1']) expect(cookie).not.toContain(leak);

    const setCookie = redact('set-cookie: sid=SESSVALUE123; Path=/; HttpOnly');
    expect(setCookie).toContain('set-cookie:');
    expect(setCookie).not.toContain('SESSVALUE123');

    const auth = redact('{"authorization": "Basic abc", "x": 1}');
    expect(auth).toContain('"authorization"');
    expect(auth).not.toContain('Basic abc');
    expect(redact('{"cookie": "a=SECRETCOOKIE"}')).not.toContain('SECRETCOOKIE');

    const bare = redact('요청 실패 sb-proj-auth-token.0=AbC123 끝');
    expect(bare).not.toContain('AbC123');
    expect(bare).toContain('sb-…-auth-token=[세션]');
    expect(bare).toContain('끝');
  });
  it('C-25 평범한 글은 그대로 둔다', () => {
    expect(redact('PRD-001 재고 10')).toBe('PRD-001 재고 10');
  });
  it('C-27 터미널 색 코드를 지운다', () => {
    expect(redact('\x1b[31mTest timeout of 30000ms exceeded.\x1b[39m')).toBe('Test timeout of 30000ms exceeded.');
    const mixed = redact('\x1b[2mexpect(\x1b[22m\x1b[31mreceived\x1b[39m\x1b[2m)\x1b[22m 끝\x1b');
    expect(mixed).not.toContain('\x1b');
    expect(mixed).toContain('expect(');
    expect(mixed).toContain('끝');
  });
  it('C-28 절대 경로를 가린다(저장소 안 경로는 남김)', () => {
    const url = redact('Module "file:///C:/work/me/git/pack-flow/src/lib/seed/demo.json" needs an import attribute');
    expect(url).toContain('<repo>/src/lib/seed/demo.json');
    expect(url).not.toContain('C:');
    expect(url).not.toContain('work/me');
    // 가짜 사용자 경로 — 비밀값 검사 훅이 글자 그대로의 사용자 폴더 경로를 막으므로 이어 붙여 만든다
    const winHome = ['C:', 'Users', 'kim', 'x.txt'].join('\\');
    const posixHome = ['', 'home', 'someone', 'pack-flow', 'tests', 'a.ts'].join('/');
    expect(redact(winHome)).not.toContain('kim');
    expect(redact('오류 D:/other/place/file.ts 에서')).toBe('오류 [경로] 에서');
    expect(redact(posixHome)).toBe('<repo>/tests/a.ts');
    expect(redact('E:\\dev\\pack-flow\\src\\a.ts:3')).toBe('<repo>/src/a.ts:3');
  });
  it('C-29 경로가 아닌 글은 그대로 둔다', () => {
    for (const t of [
      'https://pack-flow.onrender.com/api/health',
      'http://localhost:3000/',
      'PRD-001 재고 10',
      'T-S1-1 | 통과 | 0.8s',
    ]) {
      expect(redact(t)).toBe(t);
    }
  });
  it('C-26 withExitCode: 실패 없이 비정상 종료면 실패 한 건 추가, 코드 0이거나 이미 실패가 있으면 그대로', () => {
    const base = [pass('T-S1-1 출고')];
    const added = withExitCode(base, 'db', 1);
    expect(added).toHaveLength(2);
    expect(added[1]).toMatchObject({ source: 'db', name: 'db 묶음 비정상 종료', status: 'failed', durationMs: 0 });
    expect(added[1].message).toContain('종료 코드 1');
    expect(hasFailure(added)).toBe(true);
    expect(base).toHaveLength(1); // 원본 불변

    expect(withExitCode(base, 'db', 0)).toBe(base);
    const already = [pass('a'), fail('C-01 x')];
    expect(withExitCode(already, 'db', 1)).toBe(already);
  });
});

describe('머리 정보', () => {
  it('C-21 hostOnly · describeTarget: 호스트만, 로컬/배포 구분, 주소가 아니면 알 수 없음', () => {
    expect(hostOnly(`https://u:p${AT}pack-flow.example.com/a?k=1#h`)).toBe('pack-flow.example.com');
    expect(describeTarget('http://localhost:3000')).toBe('로컬 (localhost:3000)');
    expect(describeTarget('https://pack-flow.example.com')).toBe('배포 (pack-flow.example.com)');
    expect(hostOnly('주소 아님')).toBe('알 수 없음');
  });
  it('C-22 seoulStamp: UTC 15:30은 한국 시간 다음 날 00:30', () => {
    expect(seoulStamp(new Date('2026-11-23T15:30:00Z'))).toEqual({ file: '20261124-0030', display: '2026-11-24 00:30' });
  });
  it('C-23 runnerLabel: GitHub 아이디 모양이면 그대로, 비었거나 이상하면 미기재', () => {
    expect(runnerLabel('sorek-charlie')).toBe('sorek-charlie');
    expect(runnerLabel(undefined)).toBe('미기재');
    expect(runnerLabel('  ')).toBe('미기재');
    expect(runnerLabel(`a${AT}b.example`)).toBe('미기재');
  });
});
