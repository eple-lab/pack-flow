'use client';

/**
 * 입출고 화면의 일괄 등록 탭 — 붙여넣기 · CSV → [미리보기](서버) → [유효한 N행 반영](서버) → 결과.
 *
 * 하는 일
 * 1. 미리보기는 `POST /api/bulk/preview`, 반영은 `POST /api/bulk/commit`. 반영 여부 · 사유는 서버 응답 그대로 보인다.
 * 2. 빈 붙여넣기는 서버를 부르지 않고 "행이 없어요"(반영 버튼 없음).
 * 3. 글자 · 형식이 바뀌면 이전 미리보기 · 결과를 지운다(옛 미리보기로 반영하지 않게).
 * 4. 결과: "N행 반영, M행 제외" + 제외 사유(미리보기 오류 행 + 반영 때 서버가 건너뛴 행).
 * 5. 실패는 onError(배너). 성공 알림 · 목록 새로고침은 onApplied(TradesView).
 *
 * 근거: docs/04-api-contract.md 3.6 · 4.4, docs/02-decisions.md P-15 · P-16, docs/work-units/WU-13-bulk.md 2 · 3번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-24  jkspawn  처음 작성 — 일괄 등록 탭(미리보기 · 반영 · 결과) (WU-13)
 */
import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { BODY_MAX_BYTES } from '@/lib/validation';
import type { BulkCommitResult, BulkFormat, BulkRow } from '@/types/erp';
import { CsvUpload } from './CsvUpload';
import { PasteBox } from './PasteBox';
import { PreviewTable, validRowsForCommit } from './PreviewTable';
import styles from './bulk.module.css';

/** 결과 상자에 보일 줄: 반영 수 · 제외 수 · 제외 사유. 숫자는 서버 응답 그대로 센다. */
export function bulkResultLines(preview: BulkRow[], result: BulkCommitResult): { headline: string; reasons: string[] } {
  const invalid = preview.filter((r) => !r.valid);
  const excluded = invalid.length + result.skipped.length;
  const reasons = [
    ...invalid.map((r) => `${r.line}줄: ${r.errors.join(' · ') || '오류'}`),
    ...result.skipped.map((s) => `${s.line}줄: ${s.message}`),
  ];
  return { headline: `${formatNumber(result.applied)}행 반영, ${formatNumber(excluded)}행 제외`, reasons };
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
}

/**
 * 일괄 등록 탭.
 *
 * props
 * - onApplied(message): 반영 성공(알림 · 목록 새로고침)
 * - onError(error): 미리보기 · 반영 실패(배너)
 *
 * testid: bulk-result (그 밖은 PasteBox · CsvUpload · PreviewTable)
 * 부작용: POST /api/bulk/preview(저장 없음), POST /api/bulk/commit(구매 · 판매 · 재고 변경 — P-15)
 */
export function BulkTab({ onApplied, onError }: { onApplied: (message: string) => void; onError: (error: unknown) => void }) {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<BulkFormat>('tsv');
  const [preview, setPreview] = useState<BulkRow[] | null>(null);
  const [result, setResult] = useState<BulkCommitResult | null>(null);

  const change = (nextText: string, nextFormat: BulkFormat) => {
    setText(nextText);
    setFormat(nextFormat);
    setPreview(null);
    setResult(null);
  };

  async function runPreview() {
    setResult(null);
    if (text.trim() === '') {
      setPreview([]);
      return; // 빈 붙여넣기는 서버를 부르지 않는다
    }
    try {
      const { rows } = await api.bulkPreview({ format, text });
      setPreview(rows);
    } catch (error) {
      setPreview(null);
      onError(toApiError(error));
    }
  }

  async function runCommit() {
    if (!preview) return;
    try {
      const committed = await api.bulkCommit(validRowsForCommit(preview));
      setResult(committed);
      onApplied(bulkResultLines(preview, committed).headline);
    } catch (error) {
      onError(toApiError(error));
    }
  }

  const summary = preview && result ? bulkResultLines(preview, result) : null;

  return (
    <div className={styles.panel}>
      <PasteBox text={text} format={format} onChange={change} onPreview={runPreview} />
      <CsvUpload
        onLoad={(content) => change(content, 'csv')}
        onTooLarge={() => onError(new ApiError('PF_VALIDATION', { field: 'text', reason: 'too_long', max: BODY_MAX_BYTES }))}
      />
      {preview && <PreviewTable rows={preview} committed={result !== null} onCommit={runCommit} />}
      {summary && (
        <div className={styles.result} data-testid="bulk-result" role="status">
          <p className={styles.summary}>{summary.headline}</p>
          {summary.reasons.length > 0 && (
            <ul className={styles.resultList}>
              {summary.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
