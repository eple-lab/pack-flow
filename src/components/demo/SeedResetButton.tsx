'use client';

/**
 * 시연 데이터 초기화 버튼 — 상단 바에서 [시연 데이터 초기화] → 확인 창 → `POST /api/seed {dataset:"demo"}` → 대시보드 새로 열기.
 *
 * 하는 일
 * 1. 확인 창(ConfirmDialog)에서 "내 데이터만 지우고 demo로 다시 채운다, 되돌릴 수 없다"를 알린 뒤에만 요청한다(04 3.7).
 * 2. 성공하면 대시보드(`/`)를 새로 연다 — 다른 화면이면 이동, 대시보드면 새로고침. 화면들은 처음 그릴 때 데이터를
 *    불러오므로 새로 그려야 숫자가 바뀐다.
 * 3. 실패하면 확인 창을 닫고 버튼 아래에 ErrorBanner(error.message 그대로).
 * 4. 상단 바(TopBar, eple)에 이미 꽂혀 있다 — 레이아웃은 건드리지 않는다.
 *
 * 근거: docs/04-api-contract.md 3.7, docs/wireframes.html 2절, docs/work-units/WU-15-demo-polish.md 1번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  자리 생성 (WU-05) — 구현은 jkspawn WU-15
 * 2026-11-24  jkspawn  확인 창 → demo 시드 → 대시보드 새로 열기 구현 (WU-15)
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { api, ApiError } from '@/lib/api-client';
import type { SeedDataset } from '@/types/erp';
import styles from './demo.module.css';

/** 초기화에 쓰는 시드(시연용). */
export const DEMO_DATASET: SeedDataset = 'demo';

/** 확인 창 문구 — 무엇이 지워지고 되돌릴 수 있는지. */
export const SEED_CONFIRM_MESSAGE =
  '내 데이터(품목 · 구매 · 판매 · 이력)를 모두 지우고 시연용 데이터로 다시 채워요. 되돌릴 수 없어요';

/**
 * 시연 데이터 초기화 버튼.
 *
 * props
 * - onDone: 성공 뒤 할 일(시험용). 기본은 대시보드를 새로 연다
 *
 * testid: btn-seed-reset (확인 창은 confirm-dialog · confirm-ok · confirm-cancel)
 * 부작용: POST /api/seed — 로그인한 사용자 본인의 데이터를 지우고 demo로 다시 넣는다
 */
export function SeedResetButton({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function reset() {
    setPending(true);
    try {
      await api.seed(DEMO_DATASET);
      setOpen(false);
      if (onDone) onDone();
      // 대시보드에 있으면 새로고침(화면이 다시 불러오게), 다른 화면이면 대시보드로 이동(새로 그리며 불러온다)
      else if (window.location.pathname === '/') window.location.reload();
      else router.push('/');
    } catch (caught) {
      setOpen(false);
      setError(caught instanceof ApiError ? caught : new ApiError('PF_INTERNAL'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        data-testid="btn-seed-reset"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        시연 데이터 초기화
      </button>
      {error && (
        <div className={styles.error}>
          <ErrorBanner error={error} />
        </div>
      )}
      <ConfirmDialog
        open={open}
        message={SEED_CONFIRM_MESSAGE}
        confirmLabel="초기화"
        cancelLabel="닫기"
        pending={pending}
        onConfirm={() => void reset()}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
