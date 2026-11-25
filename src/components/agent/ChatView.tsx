'use client';

/**
 * 에이전트 패널의 챗봇 — 대화 목록 · 입력 · 제안 액션 카드([실행] · [취소]).
 *
 * 하는 일
 * 1. 메시지를 `api.chat`으로 보내고 답을 대화에 붙인다. 조회 답은 서버가 DB 값으로 만든 문장과 근거(facts)다.
 * 2. 변경 액션이면 카드를 열어 둔다. 사람이 [실행]을 눌러야 `api.executeAction`이 불린다(원칙 4). 서버가 받은 액션을
 *    처음부터 다시 검사하므로 화면은 받은 제안을 그대로 돌려보내기만 한다. [취소]는 아무것도 보내지 않는다.
 * 3. 새 메시지를 보내면 아직 열려 있던 이전 카드는 닫는다(오래된 제안이 나중에 실행되는 일을 막는다).
 * 4. 공백만 있는 메시지는 보내기 버튼이 잠긴다. 답 · 오류는 모두 글자로만 렌더링한다(dangerouslySetInnerHTML 금지).
 *
 * 근거: docs/work-units/WU-34-chat.md 6 · 7번, docs/04-api-contract.md 3.8, docs/05-security.md 4절
 * 구역: skygaul (docs/06-work-plan.md 1절)
 *
 * 이력
 * 2026-11-20  eple     자리 생성 (WU-01) — 구현은 skygaul WU-34
 * 2026-11-23  skygaul  챗봇 화면 구현 — 대화 · 입력 · 제안 카드 (WU-34)
 * 2026-11-25  skygaul  [실행]이 성공하면 대시보드에 데이터 변경 알림 (#77)
 */
import { useState } from 'react';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SubmitButton } from '@/components/common/SubmitButton';
import { notifyDataChanged } from '@/components/dashboard/data-changed';
import { api, ApiError } from '@/lib/api-client';
import type { AgentAction, ChatReply } from '@/types/agent';
import styles from './agent.module.css';
import { canSend, resultMessage } from './chat-form';
import { thenNotify } from './notify-after';

/** 대화 한 줄. 답의 `card`는 제안 카드 상태(none: 제안 없음, open: [실행] · [취소] 보임). */
export type ChatEntry =
  | { kind: 'user'; text: string }
  | { kind: 'reply'; reply: ChatReply; card: 'none' | 'open' | 'done' | 'cancelled' }
  | { kind: 'note'; text: string };

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('PF_INTERNAL');
}

/**
 * 챗봇 내용 묶음(받은 값을 그리는 순수 그리기). 시험에서 값을 넣어 그린다.
 *
 * props
 * - entries: 대화(내 말 · 답 · 실행 알림)
 * - input: 입력 칸 글자, busy: 요청 중(보내기 · 실행 잠김)
 * - onInput · onSend: 입력 · 보내기, onExecute(index) · onCancel(index): 제안 카드 버튼(index는 entries 안의 자리)
 *
 * testid: chat-input, btn-chat-send, chat-user-<n>, chat-reply-<n>, chat-facts-<n>, chat-note-<n>,
 *         chat-action-card, btn-action-execute, btn-action-cancel
 */
export function ChatContent({
  entries,
  input,
  busy,
  onInput,
  onSend,
  onExecute,
  onCancel,
}: {
  entries: readonly ChatEntry[];
  input: string;
  busy: boolean;
  onInput: (value: string) => void;
  onSend: () => void | Promise<void>;
  onExecute: (index: number) => void | Promise<void>;
  onCancel: (index: number) => void;
}) {
  // testid의 <n>: 같은 종류(내 말 · 답 · 알림) 안에서의 순서(0부터)
  const orderOf = (index: number) => entries.slice(0, index).filter((entry) => entry.kind === entries[index]!.kind).length;

  return (
    <>
      <div className={styles.chatLog} aria-live="polite">
        {entries.length === 0 && (
          <p className={styles.muted}>예) &quot;PRD-001 재고 몇 개야?&quot; · &quot;부족한 품목 알려 줘&quot; · &quot;무선 마우스 4개 출고해 줘&quot;</p>
        )}
        {entries.map((entry, index) => {
          if (entry.kind === 'user') {
            return (
              <p key={index} className={styles.bubbleUser} data-testid={`chat-user-${orderOf(index)}`}>
                {entry.text}
              </p>
            );
          }
          if (entry.kind === 'note') {
            return (
              <p key={index} className={styles.chatNote} data-testid={`chat-note-${orderOf(index)}`}>
                {entry.text}
              </p>
            );
          }
          const n = orderOf(index);
          const factEntries = Object.entries(entry.reply.facts);
          return (
            <div key={index} className={entry.reply.refused ? styles.bubbleRefused : styles.bubbleReply}>
              <p className={styles.chatText} data-testid={`chat-reply-${n}`}>
                {entry.reply.reply}
              </p>
              {factEntries.length > 0 && (
                <p className={styles.facts} data-testid={`chat-facts-${n}`}>
                  근거(서버 조회): {factEntries.map(([key, value]) => `${key} = ${value}`).join(' · ')}
                </p>
              )}
              {entry.card === 'open' && entry.reply.proposed_action && (
                <div className={styles.actionCard} data-testid="chat-action-card">
                  <p className={styles.muted}>[실행]을 눌러야 반영돼요.</p>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondary} data-testid="btn-action-cancel" disabled={busy} onClick={() => onCancel(index)}>
                      취소
                    </button>
                    <SubmitButton type="button" testid="btn-action-execute" disabled={busy} onClick={() => onExecute(index)}>
                      실행
                    </SubmitButton>
                  </div>
                </div>
              )}
              {entry.card === 'cancelled' && <p className={styles.muted}>취소했어요. 저장된 것은 없어요.</p>}
            </div>
          );
        })}
      </div>

      <form
        className={styles.chatForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend(input) && !busy) void onSend();
        }}
      >
        <input
          className={styles.input}
          aria-label="메시지"
          placeholder="재고 조회 · 출고를 말해 보세요"
          data-testid="chat-input"
          value={input}
          maxLength={600}
          onChange={(event) => onInput(event.target.value)}
        />
        <SubmitButton type="submit" testid="btn-chat-send" disabled={!canSend(input) || busy} pending={busy} pendingText="…">
          보내기
        </SubmitButton>
      </form>
    </>
  );
}

/**
 * 챗봇 패널 본문. 서버 호출은 api-client만 쓴다(AGENTS.md 3절).
 * 부작용: POST /api/agent/chat(LLM 호출 상한 +1), POST /api/agent/execute(사람이 [실행]을 눌렀을 때만, 재고 · 판매 · 구매가 바뀐다)
 */
export function ChatView() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!canSend(text) || busy) return;
    setBusy(true);
    setError(null);
    setInput('');
    // 이전에 열려 있던 제안 카드는 닫고(오래된 제안이 실행되지 않게) 내 말을 붙인다
    setEntries((prev) => [
      ...prev.map((entry) => (entry.kind === 'reply' && entry.card === 'open' ? { ...entry, card: 'cancelled' as const } : entry)),
      { kind: 'user', text },
    ]);
    try {
      const reply = await api.chat(text);
      const card = reply.proposed_action && reply.needs_confirmation ? 'open' : 'none';
      setEntries((prev) => [...prev, { kind: 'reply', reply, card }]);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  const setCard = (index: number, card: 'done' | 'cancelled') =>
    setEntries((prev) => prev.map((entry, i) => (i === index && entry.kind === 'reply' ? { ...entry, card } : entry)));

  const execute = async (index: number) => {
    const entry = entries[index];
    if (!entry || entry.kind !== 'reply' || entry.card !== 'open' || !entry.reply.proposed_action || busy) return;
    const action: AgentAction = entry.reply.proposed_action;
    setBusy(true);
    setError(null);
    try {
      // [#77 bug] 챗봇 [실행]이 성공해도 대시보드 재고 · 숫자가 새로고침 전까지 그대로였다 → 성공한 뒤 데이터 변경 알림을 보낸다 (skygaul)
      const { result } = await thenNotify(() => api.executeAction(action), notifyDataChanged);
      setCard(index, 'done');
      setEntries((prev) => [...prev, { kind: 'note', text: resultMessage(result) }]);
    } catch (caught) {
      setError(toApiError(caught)); // 실패하면 카드를 그대로 둔다(다시 누르거나 취소)
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.stack}>
      <ErrorBanner error={error} />
      <ChatContent
        entries={entries}
        input={input}
        busy={busy}
        onInput={setInput}
        onSend={send}
        onExecute={execute}
        onCancel={(index) => setCard(index, 'cancelled')}
      />
    </div>
  );
}
