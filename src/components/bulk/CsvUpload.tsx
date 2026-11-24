'use client';

/**
 * 일괄 등록 CSV 선택 — 파일을 읽어 붙여넣기 칸에 넣고 형식을 CSV로 바꾼다.
 *
 * 하는 일
 * 1. `.csv` 파일 하나를 브라우저에서 글자로 읽는다(서버로 파일을 올리지 않는다 — 미리보기 요청에 글자로 보낸다, 04 1절).
 * 2. 100KB를 넘는 파일은 읽지 않고 onTooLarge를 부른다(05 5절 상한. 최종 판정은 서버).
 *
 * 근거: docs/04-api-contract.md 1 · 3.6절, docs/05-security.md 5절, docs/work-units/WU-13-bulk.md 2번
 * 구역: jkspawn (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple  자리 생성 (WU-01) — 구현은 jkspawn WU-13
 * 2026-11-24  jkspawn  CSV 파일 읽기 · 크기 상한 구현 (WU-13)
 */
import { useId, useState } from 'react';
import { BODY_MAX_BYTES } from '@/lib/validation';
import styles from './bulk.module.css';

/**
 * CSV 파일 선택.
 *
 * props
 * - onLoad(text): 파일 내용을 읽었을 때
 * - onTooLarge(): 100KB를 넘었을 때
 *
 * testid: bulk-csv-input
 */
export function CsvUpload({ onLoad, onTooLarge }: { onLoad: (text: string) => void; onTooLarge: () => void }) {
  const id = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor={`${id}-file`}>
        또는 CSV 파일
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept=".csv,text/csv"
        data-testid="bulk-csv-input"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = ''; // 같은 파일을 다시 골라도 onChange가 오게
          if (!file) return;
          if (file.size > BODY_MAX_BYTES) {
            setFileName(null);
            onTooLarge();
            return;
          }
          setFileName(file.name);
          onLoad(await file.text());
        }}
      />
      {fileName && <span className={styles.label}>{fileName}</span>}
    </div>
  );
}
