'use client';

/**
 * 에이전트 패널의 발주서 초안 — 불러오기 · 표(수량 · 거래처 수정) · AI 문안 · [발주 등록(확인)] · [취소].
 *
 * 하는 일
 * 1. 열릴 때 api.draftPo(sku_ids)를 한 번 부른다. 표(재고 · 안전재고 · 추천 수량 · 단가 · 근거)는 서버가 코드로 계산한 값이다.
 * 2. LLM이 실패해도 표는 그대로 보이고 문안 자리에 이유가 나온다(P-08) — 미리 써 둔 문안을 AI 결과처럼 보이지 않는다.
 * 3. 수량 · 거래처만 고칠 수 있다. [발주 등록(확인)]은 poConfirm 스키마로 먼저 검사하고(틀리면 칸 아래 오류, 요청 안 보냄),
 *    통과하면 api.confirmPo로 보낸다. 문안(LLM)은 보내지 않는다 — 저장은 표 값만 쓴다.
 * 4. 이 화면은 '발주서 발송'이 아니다. 구매(발주완료)로 저장만 하며, 실제 발송 기능은 시연용 표시뿐이다.
 *
 * 근거: docs/work-units/WU-33-draft-po.md 3 · 4 · 5번, docs/04-api-contract.md 3.8 · 4.3 · 4.4, docs/02-decisions.md P-08
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple     자리 생성 (WU-01) — 구현은 skygaul WU-33
 * 2026-11-23  skygaul  발주서 초안 패널 구현 — 불러오기 · 표 수정 · 확정 · 취소 (WU-33)
 * 2026-11-23  skygaul  확정 중간 실패 시 저장된 줄을 표에서 빼고 안내 — 중복 발주 방지, 리뷰 후속 (WU-33)
 * 2026-11-25  skygaul  확정이 성공(일부 줄만 저장 포함)하면 대시보드에 데이터 변경 알림 (#77)
 */
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { FieldError } from '@/components/common/FieldError';
import { Loading } from '@/components/common/Loading';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useToast } from '@/components/common/Toast';
import { notifyDataChanged } from '@/components/dashboard/data-changed';
import { api, ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import type { PoDraft } from '@/types/agent';
import styles from './agent.module.css';
import {
  buildConfirmLines,
  doneMessage,
  estimateCost,
  mergePartial,
  partialSaveMessage,
  partialSaveOf,
  remainingRows,
  rowsFromDraft,
  type DraftRow,
  type PartialSave,
  type RowError,
} from './draft-po-form';
import { thenNotify } from './notify-after';

type View =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; draft: PoDraft; rows: DraftRow[] }
  | { status: 'done'; message: string }
  | { status: 'cancelled' };

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
}

/**
 * 초안 내용 묶음(불러온 값을 받는 순수 그리기). 시험에서 값을 넣어 그린다.
 *
 * props
 * - draft: `POST /api/agent/draft-po` 응답
 * - rows: 수정 중인 줄(수량 · 거래처 글자)
 * - errors: 품목코드 → 칸 오류(수량 · 거래처)
 * - onQty · onSupplier: 칸을 고칠 때, onConfirm · onCancel: 버튼
 *
 * testid: draft-empty, draft-llm-error, draft-message, draft-row-<sku_id>, draft-qty-<sku_id>, draft-supplier-<sku_id>,
 *         field-error-draft-qty-<sku_id>, field-error-draft-supplier-<sku_id>, btn-draft-confirm, btn-draft-cancel
 */
export function DraftPoContent({
  draft,
  rows,
  errors,
  onQty,
  onSupplier,
  onConfirm,
  onCancel,
}: {
  draft: PoDraft;
  rows: readonly DraftRow[];
  errors: Record<string, RowError>;
  onQty: (sku_id: string, value: string) => void;
  onSupplier: (sku_id: string, value: string) => void;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  if (draft.lines.length === 0) return <EmptyState title="지금 발주할 품목이 없어요" testid="draft-empty" />;

  const basisOf = new Map(draft.lines.map((line) => [line.sku_id, line]));

  return (
    <>
      {draft.llm_error ? (
        <div className={styles.llmError} data-testid="draft-llm-error" role="status">
          AI 문안을 만들지 못했어요. {draft.llm_error.message} 아래 계산 결과로 직접 발주할 수 있어요
        </div>
      ) : (
        draft.message && (
          <div className={styles.messageBox}>
            <span className={styles.messageLabel}>AI가 쓴 발주서 문안 (참고용)</span>
            <pre className={styles.message} data-testid="draft-message">
              {draft.message}
            </pre>
          </div>
        )
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">품목</th>
              <th scope="col" className={styles.num}>
                재고 / 안전
              </th>
              <th scope="col">추천 수량</th>
              <th scope="col" className={styles.num}>
                단가(원)
              </th>
              <th scope="col" className={styles.num}>
                예상 금액(원)
              </th>
              <th scope="col">거래처</th>
              <th scope="col">근거</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const line = basisOf.get(row.sku_id);
              const error = errors[row.sku_id];
              const qtyId = `draft-qty-${row.sku_id}`;
              const supplierId = `draft-supplier-${row.sku_id}`;
              return (
                <tr key={row.sku_id} data-testid={`draft-row-${row.sku_id}`}>
                  <td>
                    <span className={styles.sku}>{row.sku_id}</span>
                    <br />
                    {row.item_name}
                  </td>
                  <td className={styles.num}>
                    {formatNumber(line?.stock_qty)} / {formatNumber(line?.safety_stock)}
                  </td>
                  <td>
                    <input
                      className={`${styles.input} ${styles.inputNum}`}
                      inputMode="numeric"
                      aria-label={`${row.item_name} 수량`}
                      data-testid={qtyId}
                      value={row.qty}
                      onChange={(event) => onQty(row.sku_id, event.target.value)}
                    />
                    {error?.field === 'order_qty' && <FieldError field={qtyId} detail={error.detail} />}
                  </td>
                  <td className={styles.num}>{formatNumber(row.unit_cost)}</td>
                  <td className={styles.num}>{formatNumber(estimateCost(row.unit_cost, row.qty))}</td>
                  <td>
                    <input
                      className={styles.input}
                      aria-label={`${row.item_name} 거래처`}
                      data-testid={supplierId}
                      value={row.supplier}
                      onChange={(event) => onSupplier(row.sku_id, event.target.value)}
                    />
                    {error?.field === 'supplier' && <FieldError field={supplierId} detail={error.detail} />}
                  </td>
                  <td className={styles.basis}>{line?.basis}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.notice}>
        발주서 발송(시연용): 이 화면은 실제로 발송되지 않아요. [발주 등록]은 구매(발주완료)로 저장만 해요. 수량 · 거래처는 고칠 수 있어요.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} data-testid="btn-draft-cancel" onClick={onCancel}>
          취소
        </button>
        <SubmitButton type="button" testid="btn-draft-confirm" onClick={onConfirm}>
          발주 등록(확인)
        </SubmitButton>
      </div>
    </>
  );
}

/**
 * 확정이 중간에 거부돼 앞 줄만 저장됐을 때의 안내. 저장된 번호 · 남은 건수 · 다시 누르면 남은 줄만 등록된다는 것을 알린다.
 * testid: draft-partial
 */
export function DraftPoPartialNotice({ partial, remaining }: { partial: PartialSave; remaining: number }) {
  return (
    <p className={styles.notice} role="status" data-testid="draft-partial">
      {partialSaveMessage(partial, remaining)}
    </p>
  );
}

/**
 * 발주서 초안 패널 본문. 서버 호출은 api-client만 쓴다(AGENTS.md 3절).
 * 호출하는 쪽이 요청마다 `key`를 달아 새로 그린다(AgentPanel).
 *
 * props
 * - skuIds: 초안 대상 품목코드(없으면 품절 임박 전체)
 *
 * testid: draft-done, draft-cancelled, error-banner(배너), toast(알림), 그 밖은 DraftPoContent의 testid
 * 부작용: POST /api/agent/draft-po(LLM 호출 상한 +1), POST /api/agent/draft-po/confirm(구매 등록)
 */
export function DraftPoView({ skuIds }: { skuIds?: string[] }) {
  const toast = useToast();
  const [view, setView] = useState<View>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState<Record<string, RowError>>({});
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [partial, setPartial] = useState<PartialSave | null>(null);
  const skuKey = skuIds?.join(',') ?? '';

  useEffect(() => {
    // 응답 콜백 안에서만 setState한다(effect 본문 동기 setState 금지 — lint react-hooks/set-state-in-effect)
    let current = true;
    api
      .draftPo(skuKey ? skuKey.split(',') : undefined)
      .then((draft) => {
        if (current) setView({ status: 'ready', draft, rows: rowsFromDraft(draft.lines) });
      })
      .catch((error: unknown) => {
        if (current) setView({ status: 'error', error: toApiError(error) });
      });
    return () => {
      current = false;
    };
  }, [skuKey, attempt]);

  /** 초안을 다시 만든다(이벤트 처리기라 loading으로 바로 바꾸고 effect를 다시 돌린다). */
  const reload = () => {
    setView({ status: 'loading' });
    setErrors({});
    setBanner(null);
    setPartial(null);
    setAttempt((n) => n + 1);
  };

  const edit = (sku_id: string, patch: Partial<Pick<DraftRow, 'qty' | 'supplier'>>) => {
    setView((prev) =>
      prev.status === 'ready' ? { ...prev, rows: prev.rows.map((row) => (row.sku_id === sku_id ? { ...row, ...patch } : row)) } : prev,
    );
    setErrors((prev) => {
      if (!(sku_id in prev)) return prev;
      const { [sku_id]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
  };

  const confirm = async () => {
    if (view.status !== 'ready') return;
    const built = buildConfirmLines(view.rows);
    if (!built.ok) {
      setErrors(built.errors);
      return; // 요청을 보내지 않는다
    }
    setErrors({});
    try {
      // [#77 bug] 발주 확정이 성공해도 대시보드 '진행 단계'가 새로고침 전까지 그대로였다 → 성공한 뒤 데이터 변경 알림을 보낸다 (skygaul)
      const result = await thenNotify(() => api.confirmPo(built.lines), notifyDataChanged);
      const message = doneMessage(result.purchases, partial);
      toast.show(message);
      setBanner(null);
      setView({ status: 'done', message });
    } catch (error) {
      const apiError = toApiError(error);
      setBanner(apiError);
      // 중간 줄이 거부돼 앞 줄이 이미 저장됐다면 그 줄을 표에서 뺀다(같은 줄을 다시 보내면 중복 발주). 나머지 입력값은 그대로 둔다.
      const saved = partialSaveOf(apiError.detail);
      if (saved) {
        notifyDataChanged(); // [#77] 일부 줄은 이미 저장돼 구매 건수가 바뀌었으므로 이 경우에도 대시보드에 알린다 (skygaul)
        setPartial((prev) => mergePartial(prev, saved));
        setView((prev) => (prev.status === 'ready' ? { ...prev, rows: remainingRows(prev.rows, saved.count) } : prev));
      }
    }
  };

  return (
    <div className={styles.stack}>
      <ErrorBanner error={view.status === 'error' ? view.error : banner} onRetry={view.status === 'error' ? reload : undefined} />

      {view.status === 'loading' && <Loading />}

      {view.status === 'ready' && partial && <DraftPoPartialNotice partial={partial} remaining={view.rows.length} />}

      {view.status === 'ready' && (
        <DraftPoContent
          draft={view.draft}
          rows={view.rows}
          errors={errors}
          onQty={(sku_id, qty) => edit(sku_id, { qty })}
          onSupplier={(sku_id, supplier) => edit(sku_id, { supplier })}
          onConfirm={confirm}
          onCancel={() => setView({ status: 'cancelled' })}
        />
      )}

      {view.status === 'done' && (
        <div className={styles.done} data-testid="draft-done">
          <p className={styles.doneText}>{view.message}</p>
          <p className={styles.muted}>저장했어요. 구매 목록(입출고 화면)에서 확인할 수 있어요.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={reload}>
              초안 다시 보기
            </button>
          </div>
        </div>
      )}

      {view.status === 'cancelled' && (
        <div className={styles.notice} data-testid="draft-cancelled">
          {partial ? `취소했어요. 앞서 저장된 ${partial.count}건은 그대로 남아 있어요.` : '취소했어요. 저장된 것은 없어요.'}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={reload}>
              초안 다시 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
