/**
 * 화면 쪽 오류 클래스 ApiError — api-client와 목 모드가 함께 던진다.
 *
 * 하는 일
 * 1. 오류 코드(04 2절, 화면 전용 PF_NETWORK · PF_TIMEOUT 포함)와 detail을 담고, message는 04 4.4 문구를 코드에서 만든다.
 * 2. 별도 파일인 이유: api-client와 목 모드가 서로를 가져오는 순환을 피하려는 것이다.
 *
 * 근거: docs/04-api-contract.md 2 · 4.4, WU-04 3번
 * 구역: eple (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-23  eple  처음 작성 — ApiError 분리 (WU-04)
 */
import type { PfErrorCode } from '@/types/erp';
import { messageFor } from './errors';

/** api-client가 던지는 오류. `message`는 화면에 그대로 보여 줘도 되는 04 4.4 문구. */
export class ApiError extends Error {
  readonly code: PfErrorCode;
  readonly detail: Record<string, unknown> | null;
  /** HTTP 상태. 서버에 닿지 못한 경우(PF_NETWORK · PF_TIMEOUT)는 null */
  readonly status: number | null;

  constructor(code: PfErrorCode, detail: Record<string, unknown> | null = null, status: number | null = null) {
    super(messageFor(code, detail));
    this.name = 'ApiError';
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}
