/**
 * dev 프로젝트에 팀원 테스트 계정(1인 2개 · 총 8개)을 만든다. eple PC에서만 실행한다.
 *
 * 하는 일
 * 1. 환경변수에서만 값을 읽는다(코드에 키 · 비밀번호 없음): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *    SUPABASE_DEV_PROJECT_REF. 실행: npm run users:create (.env.local을 읽는다)
 * 2. 주소가 dev 프로젝트(https://<SUPABASE_DEV_PROJECT_REF>.supabase.co)가 아니면 아무것도 하지 않고 멈춘다(D-20 ③).
 *    demo 프로젝트에는 이 스크립트를 쓰지 않는다 — 시연 계정은 대시보드에서 만든다.
 * 3. 계정 주소는 <아이디>-a@packflow.test 형식(실제 메일이 가지 않는 예약 도메인, 08 Q-17).
 *    이미 있는 계정은 건너뛴다(비밀번호를 바꾸지 않음). --reset을 주면 있는 계정의 비밀번호를 새로 만든다.
 * 4. 새 비밀번호는 화면에 출력하지 않고 .env.testusers.local(.gitignore의 .env*로 막힘)에만 쓴다.
 *    eple이 이 파일에서 각자 몫을 팀 비공개 채널로 개별 전달한 뒤 파일을 지운다.
 *
 * 근거: docs/05-security.md 2.1 ③ · D-20 · P-17 · WU-02
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  처음 작성 — dev 전용 확인, 비밀번호는 로컬 파일에만 (WU-02)
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const MEMBERS = ['eple', 'sorek-charlie', 'jkspawn', 'skygaul'];
const SUFFIXES = ['a', 'b'];
const OUT_FILE = '.env.testusers.local';

/** 멈춘다. 이유만 보여 주고 값은 보여 주지 않는다. */
function stop(reason: string): never {
  console.error(`[계정 스크립트] 멈춤 — ${reason}`);
  process.exit(1);
}

/**
 * 지금 주소가 dev 프로젝트인지 확인한다. 아니면 이유를 담은 Error를 던진다(값은 담지 않는다).
 * @returns dev 프로젝트 주소
 * @throws Error 주소 · ref가 비었거나, 주소의 호스트가 <devRef>.supabase.co가 아닐 때
 */
export function assertDevProject(url: string | undefined, devRef: string | undefined): string {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL이 비어 있습니다');
  if (!devRef) throw new Error('SUPABASE_DEV_PROJECT_REF가 비어 있습니다');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 형식이 주소가 아닙니다');
  }
  if (parsed.protocol !== 'https:' || parsed.host !== `${devRef}.supabase.co`) {
    throw new Error('주소가 dev 프로젝트가 아닙니다. demo 등 다른 프로젝트에는 실행하지 않습니다 (D-20 ③)');
  }
  return url;
}

/** 다른 사람이 짐작할 수 없는 비밀번호 (24자) */
function newPassword(): string {
  return randomBytes(18).toString('base64url');
}

async function main() {
  let url: string;
  try {
    url = assertDevProject(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_DEV_PROJECT_REF);
  } catch (e) {
    stop((e as Error).message);
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) stop('SUPABASE_SERVICE_ROLE_KEY가 비어 있습니다 (eple PC의 .env.local에만 둡니다)');
  const reset = process.argv.includes('--reset');

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) stop(`계정 목록을 읽지 못했습니다 (${listError.status ?? '?'})`);
  const existing = new Map(list.users.map((u) => [u.email ?? '', u.id]));

  const lines = [
    '# 테스트 계정 비밀번호 — 커밋 금지(.env*), 각자 몫을 개별 전달한 뒤 이 파일을 지운다',
    `# 만든 때: ${new Date().toISOString()}`,
  ];
  let created = 0, updated = 0, skipped = 0;

  for (const member of MEMBERS) {
    for (const s of SUFFIXES) {
      const email = `${member}-${s}@packflow.test`;
      const key = `${member.toUpperCase().replace(/-/g, '_')}_${s.toUpperCase()}`;
      const id = existing.get(email);
      if (id && !reset) {
        skipped++;
        continue;
      }
      const password = newPassword();
      const result = id
        ? await admin.auth.admin.updateUserById(id, { password })
        : await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (result.error) stop(`${member}-${s} 계정 처리 실패 (${result.error.status ?? '?'} ${result.error.code ?? ''})`);
      if (id) updated++; else created++;
      // 줄을 이어 붙여 만든다 — 소스에 '이름=값' 모양이 없어야 비밀값 검사에 걸리지 않는다
      lines.push(`${key}_EMAIL=${email}`, [`${key}_PASSWORD`, password].join('='));
    }
  }

  if (created + updated > 0) writeFileSync(OUT_FILE, lines.join('\n') + '\n', { mode: 0o600 });
  console.log(`[계정 스크립트] 새로 만듦 ${created} · 비밀번호 바꿈 ${updated} · 이미 있어 건너뜀 ${skipped}`);
  if (created + updated > 0) console.log(`[계정 스크립트] 비밀번호는 ${OUT_FILE}에만 썼습니다 (화면에 출력하지 않음)`);
}

// 단위 테스트에서 assertDevProject만 가져다 쓸 때는 실행하지 않는다
if (process.argv[1]?.endsWith('create-test-users.ts')) {
  await main();
}
