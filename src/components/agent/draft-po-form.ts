/**
 * 발주서 초안 패널의 수정 칸 처리 — 표의 수정 값(수량 · 거래처)을 확정 요청으로 바꾸는 순수 함수.
 *
 * 하는 일
 * 1. 초안 표(PoDraftLine)를 수정할 줄(수량 · 거래처 글자)로 바꾼다. 처음 값은 코드가 계산한 값 그대로다.
 * 2. 수정한 글자를 `poConfirm` 스키마로 검사해 확정 요청의 줄로 바꾼다. 화면 · 서버가 같은 스키마를 쓴다(04 4절).
 *    틀린 줄은 그 칸(수량 · 거래처) 아래에 보일 오류로 돌려주고, 한 줄이라도 틀리면 요청을 보내지 않는다.
 * 3. 금액(purchase_cost)은 단가 × 수량이다. 서버는 이 값을 범위만 확인하고(04 3.8: 사용자가 고친 값) 다시 계산하지 않는다.
 *    LLM 문안은 여기 들어오지 않는다 — 저장은 사용자가 확인한 표 값만 쓴다.
 *
 * 근거: docs/04-api-contract.md 3.8 · 4.2 · 4.3, docs/work-units/WU-33-draft-po.md 3 · 4번 · 입력 · 오류 처리
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  skygaul  처음 작성 — 수정 칸 → 확정 줄 · 알림 문구 (WU-33)
 */
import { toIntegerInput } from '@/components/trades/form-utils';
import { parseWith, poConfirm } from '@/lib/validation';
import type { PoConfirmLine, PoDraftLine } from '@/types/agent';
import type { Purchase, ValidationDetail } from '@/types/erp';

/** 표에서 고칠 수 있는 한 줄. qty는 입력 글자 그대로(쉼표 · 공백 포함 가능). */
export type DraftRow = {
  sku_id: string;
  item_name: string;
  unit_cost: number;
  qty: string;
  supplier: string;
};

/** 칸 아래 오류 하나. detail은 FieldError가 04 4.3 문구로 바꾼다. */
export type RowError = { field: 'order_qty' | 'supplier'; detail: Pick<ValidationDetail, 'reason' | 'min' | 'max'> };

/** 초안 표 → 수정할 줄. 수량은 추천 수량, 거래처는 계산된 거래처로 시작한다. */
export function rowsFromDraft(lines: readonly PoDraftLine[]): DraftRow[] {
  return lines.map((line) => ({
    sku_id: line.sku_id,
    item_name: line.item_name,
    unit_cost: line.unit_cost,
    qty: String(line.recommended_qty),
    supplier: line.supplier,
  }));
}

/** 예상 금액 = 단가 × 수량. 수량 글자가 정수가 아니면 null(표에는 '—'). */
export function estimateCost(unitCost: number, qtyText: string): number | null {
  const qty = toIntegerInput(qtyText);
  return typeof qty === 'number' && Number.isInteger(qty) ? unitCost * qty : null;
}

/** zod가 돌려준 칸 이름(`lines[0].order_qty`)에서 마지막 칸 이름만 꺼낸다. */
function lastField(field: string): string {
  return field.split(/[.[\]]+/).filter(Boolean).pop() ?? field;
}

/**
 * 수정한 줄을 검사해 확정 요청의 줄로 바꾼다. 줄마다 따로 검사해서 어느 줄이 틀렸는지 알려 준다.
 * @returns 모두 맞으면 `{ ok: true, lines }`, 하나라도 틀리면 `{ ok: false, errors }`(품목코드 → 칸 오류)
 */
export function buildConfirmLines(
  rows: readonly DraftRow[],
): { ok: true; lines: PoConfirmLine[] } | { ok: false; errors: Record<string, RowError> } {
  const lines: PoConfirmLine[] = [];
  const errors: Record<string, RowError> = {};

  for (const row of rows) {
    const qty = toIntegerInput(row.qty);
    const checked = parseWith(poConfirm, {
      lines: [
        {
          sku_id: row.sku_id,
          supplier: row.supplier.trim(),
          order_qty: qty,
          // 수량이 숫자가 아니면 금액 검사가 수량 오류를 가리지 않게 0으로 둔다
          purchase_cost: typeof qty === 'number' ? row.unit_cost * qty : 0,
        },
      ],
    });
    if (checked.ok) {
      lines.push(...checked.data.lines);
      continue;
    }
    const { field, reason, min, max } = checked.detail;
    const name = lastField(field);
    errors[row.sku_id] = {
      // 금액이 상한을 넘는 것은 수량을 줄여야 하므로 수량 칸 아래에 보인다. 칸이 아닌 오류도 수량 칸으로 모은다.
      field: name === 'supplier' ? 'supplier' : 'order_qty',
      detail: { reason, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) },
    };
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, lines };
}

/** 확정 뒤 알림. 한 건이면 "P-105 발주완료 1건", 여러 건이면 번호를 모두 적는다. */
export function confirmMessage(purchases: readonly Purchase[]): string {
  return `${purchases.map((p) => p.purchase_id).join(' · ')} 발주완료 ${purchases.length}건`;
}

// ── 확정 중간 실패(일부 저장) ────────────────────────────────────────────
// 줄마다 따로 저장해서 중간 줄이 거부되면 앞 줄은 이미 저장돼 있다. 같은 줄을 다시 보내면 중복 발주가 되므로,
// 서버가 오류 detail에 싣는 saved_count · saved(draft-po.ts confirmPoLines)를 읽어 저장된 줄을 표에서 뺀다.

/** 이미 저장된 앞 줄: 건수와 구매 번호(번호는 비어 있을 수 있다). */
export type PartialSave = { count: number; ids: string[] };

/**
 * 확정 오류의 detail에서 저장된 앞 줄을 읽는다. 저장된 것이 없거나 모양이 틀리면 null(그때는 표를 그대로 둔다).
 * 건수(saved_count)가 기준이고, 번호(saved)는 글자인 것만 쓴다.
 */
export function partialSaveOf(detail: Record<string, unknown> | null | undefined): PartialSave | null {
  const count = detail?.saved_count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) return null;
  const saved = detail?.saved;
  const ids = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  return { count, ids };
}

/** 이미 저장된 앞 줄(count건)을 뺀 남은 줄. 수정한 값은 그대로 둔다. 건수가 줄 수보다 많아도 안전하다. */
export function remainingRows(rows: readonly DraftRow[], count: number): DraftRow[] {
  return rows.slice(Math.max(0, count));
}

/** 연달아 일부 저장되면 이미 저장된 전체(건수 · 번호)를 합친다. */
export function mergePartial(previous: PartialSave | null, next: PartialSave): PartialSave {
  return { count: (previous?.count ?? 0) + next.count, ids: [...(previous?.ids ?? []), ...next.ids] };
}

/** 일부 저장 안내 문구. 번호를 모르면 건수만 적는다. */
export function partialSaveMessage(partial: PartialSave, remaining: number): string {
  const ids = partial.ids.length > 0 ? `(${partial.ids.join(' · ')})` : '';
  return `앞 ${partial.count}건${ids}은 이미 저장됐어요. 남은 ${remaining}건은 저장되지 않았어요. 표를 확인하고 다시 [발주 등록]을 누르면 남은 줄만 등록돼요.`;
}

/** 확정 성공 알림. 앞서 일부가 저장돼 있었다면 그 건수도 함께 적는다. */
export function doneMessage(purchases: readonly Purchase[], earlier: PartialSave | null): string {
  const base = confirmMessage(purchases);
  if (!earlier) return base;
  return `${base} (앞서 저장된 ${earlier.count}건 포함 모두 ${earlier.count + purchases.length}건)`;
}
