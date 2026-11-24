'use client';

/**
 * 일괄 등록 붙여넣기 칸 — 엑셀 · 시트에서 복사한 6열(TSV) 또는 CSV 글자, 형식 선택, [예시 붙여넣기], [미리보기].
 *
 * 하는 일
 * 1. 글자 · 형식은 부모(BulkTab)가 들고 있다. 이 칸은 입력과 버튼만 그린다.
 * 2. [예시 붙여넣기]는 시연용 10행(오류 3행: 미등록 품목코드 · 수량 0 · 같은 붙여넣기 송장 중복)을 넣는다.
 * 3. [미리보기]는 SubmitButton — 요청 중 잠근다.
 *
 * 근거: docs/04-api-contract.md 3.6, docs/work-units/WU-13-bulk.md 2 · 4번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-13
 * 2026-11-24  jkspawn  붙여넣기 칸 · 형식 선택 · 예시 붙여넣기 · 미리보기 버튼 구현 (WU-13)
 */
import { useId } from 'react';
import { SubmitButton } from '@/components/common/SubmitButton';
import { BULK_HEADER } from '@/lib/bulk/parse';
import type { BulkFormat } from '@/types/erp';
import styles from './bulk.module.css';

/**
 * 시연용 예시 10행(머리글 포함 TSV). demo 시드(PRD-001~003) 기준으로
 * 5번째 줄 미등록 품목코드(PRD-999) · 7번째 줄 수량 0 · 9번째 줄 같은 붙여넣기 송장 중복(S-INV-202)이 섞여 있다 → 7행 반영(T-S3-5).
 */
export const BULK_SAMPLE = [
  BULK_HEADER.join('\t'),
  '입고\tPRD-001\t10\t가나물산\tINV-101\t',
  '입고\tPRD-002\t20\t가나물산\tINV-102\t',
  '출고\tPRD-001\t2\t스마트스토어\tS-INV-201\t',
  '입고\tPRD-999\t5\t가나물산\tINV-103\t미등록 품목',
  '출고\tPRD-002\t5\t쿠팡\tS-INV-202\t',
  '출고\tPRD-003\t0\t쿠팡\tS-INV-203\t수량 0',
  '입고\tPRD-003\t4\t다라상사\tINV-104\t',
  '출고\tPRD-002\t1\t쿠팡\tS-INV-202\t송장 중복',
  '입고\tPRD-001\t3\t다라상사\t\t송장 없음',
  '출고\tPRD-003\t1\t스마트스토어\tS-INV-204\t',
].join('\n');

/**
 * 붙여넣기 칸.
 *
 * props
 * - text · format: 지금 글자와 형식
 * - onChange(text, format): 글자 · 형식이 바뀌었을 때
 * - onPreview: [미리보기] — Promise를 돌려주면 끝날 때까지 잠긴다
 *
 * testid: bulk-textarea, bulk-format, btn-bulk-sample, btn-bulk-preview
 */
export function PasteBox({
  text,
  format,
  onChange,
  onPreview,
}: {
  text: string;
  format: BulkFormat;
  onChange: (text: string, format: BulkFormat) => void;
  onPreview: () => Promise<void>;
}) {
  const id = useId();
  return (
    <div className={styles.box}>
      <h2 className={styles.title}>붙여넣기</h2>
      <p className={styles.hint}>
        열 순서: {BULK_HEADER.join(' · ')} (첫 줄 머리글은 있어도 되고 없어도 돼요)
      </p>
      <label className={styles.label} htmlFor={`${id}-text`}>
        엑셀 · 구글 시트에서 6열을 복사해 붙여 넣으세요
      </label>
      <textarea
        id={`${id}-text`}
        className={styles.textarea}
        data-testid="bulk-textarea"
        value={text}
        onChange={(event) => onChange(event.target.value, format)}
        spellCheck={false}
      />
      <div className={styles.row}>
        <label className={styles.label} htmlFor={`${id}-format`}>
          형식
        </label>
        <select
          id={`${id}-format`}
          className={styles.select}
          data-testid="bulk-format"
          value={format}
          onChange={(event) => onChange(text, event.target.value as BulkFormat)}
        >
          <option value="tsv">붙여넣기(탭)</option>
          <option value="csv">CSV(쉼표)</option>
        </select>
        <button
          type="button"
          className={styles.secondary}
          data-testid="btn-bulk-sample"
          onClick={() => onChange(BULK_SAMPLE, 'tsv')}
        >
          예시 붙여넣기
        </button>
        <span className={styles.spacer} />
        <SubmitButton type="button" testid="btn-bulk-preview" onClick={onPreview}>
          미리보기
        </SubmitButton>
      </div>
    </div>
  );
}
