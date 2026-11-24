'use client';

/**
 * 일괄 등록 미리보기 표 — 서버 미리보기 결과(BulkRow[])를 그대로 보이고, 유효한 행만 반영 버튼으로 보낸다.
 *
 * 하는 일
 * 1. 행마다 원본 줄 번호 · 값 · 상태. 유효 행은 초록, 오류 행은 빨강 + 사유(서버가 준 errors 그대로).
 * 2. 반영 여부를 화면에서 정하지 않는다 — 서버가 valid로 준 행만 반영 후보다(WU-13 하지 말 것).
 * 3. [유효한 N행 반영]은 유효 행이 0이거나 이미 반영했으면 잠긴다. 요청 중에도 잠근다(SubmitButton).
 *
 * 근거: docs/04-api-contract.md 3.6 · 4.5, docs/work-units/WU-13-bulk.md 2 · 3 · 5번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-13
 * 2026-11-24  jkspawn  미리보기 표 · 유효/오류 표시 · 반영 버튼 구현 (WU-13)
 */
import { EmptyState } from '@/components/common/EmptyState';
import { SubmitButton } from '@/components/common/SubmitButton';
import { formatEmpty, formatNumber } from '@/lib/format';
import type { BulkRow, BulkRowInput } from '@/types/erp';
import styles from './bulk.module.css';

/** 서버가 유효로 준 행만 반영 본문(BulkRowInput)으로 바꾼다. 값은 미리보기 응답 그대로. */
export function validRowsForCommit(rows: BulkRow[]): BulkRowInput[] {
  return rows
    .filter((row) => row.valid && row.qty !== null && (row.kind === '입고' || row.kind === '출고'))
    .map((row) => ({
      line: row.line,
      kind: row.kind as BulkRowInput['kind'],
      sku_id: row.sku_id,
      qty: row.qty as number,
      partner: row.partner,
      invoice_no: row.invoice_no,
      memo: row.memo,
    }));
}

/**
 * 미리보기 표.
 *
 * props
 * - rows: `POST /api/bulk/preview` 응답 rows
 * - committed: 이 미리보기로 이미 반영했는지(다시 누르지 못하게)
 * - onCommit: [유효한 N행 반영] — Promise
 *
 * testid: bulk-preview-empty, bulk-summary, bulk-row-<line>, bulk-row-error-<line>, btn-bulk-commit
 */
export function PreviewTable({
  rows,
  committed,
  onCommit,
}: {
  rows: BulkRow[];
  committed: boolean;
  onCommit: () => Promise<void>;
}) {
  if (rows.length === 0) return <EmptyState title="행이 없어요" testid="bulk-preview-empty" />;

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className={styles.box}>
      <h2 className={styles.title}>미리보기</h2>
      <p className={styles.summary} data-testid="bulk-summary">
        전체 {formatNumber(rows.length)}행 · 유효 {formatNumber(validCount)}행 · 오류 {formatNumber(invalidCount)}행
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.num}>
                줄
              </th>
              <th scope="col">구분</th>
              <th scope="col">품목코드</th>
              <th scope="col" className={styles.num}>
                수량
              </th>
              <th scope="col">거래처</th>
              <th scope="col">송장번호</th>
              <th scope="col">비고</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.line}
                className={row.valid ? styles.valid : styles.invalid}
                data-testid={`bulk-row-${row.line}`}
              >
                <td className={styles.num}>{row.line}</td>
                <td>{formatEmpty(row.kind)}</td>
                <td>{formatEmpty(row.sku_id)}</td>
                <td className={styles.num}>{row.qty === null ? formatEmpty(null) : formatNumber(row.qty)}</td>
                <td>{formatEmpty(row.partner)}</td>
                <td>{formatEmpty(row.invoice_no)}</td>
                <td>{formatEmpty(row.memo)}</td>
                {row.valid ? (
                  <td className={styles.ok}>유효</td>
                ) : (
                  <td className={styles.reason} data-testid={`bulk-row-error-${row.line}`}>
                    {row.errors.join(' · ') || '오류'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.row}>
        <span className={styles.spacer} />
        <SubmitButton
          type="button"
          testid="btn-bulk-commit"
          disabled={validCount === 0 || committed}
          onClick={onCommit}
        >
          {`유효한 ${formatNumber(validCount)}행 반영`}
        </SubmitButton>
      </div>
    </div>
  );
}
