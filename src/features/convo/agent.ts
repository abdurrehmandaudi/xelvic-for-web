import { useSyncExternalStore } from "react";

export interface AgentTurn {
  thread: string | null;
  typing: boolean;
  partial: string;
  failed: boolean;
  asked: boolean;
}

const IDLE: AgentTurn = {
  thread: null,
  typing: false,
  partial: "",
  failed: false,
  asked: false,
};

const ASK_MS = 30_000;

let turn: AgentTurn = IDLE;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function stopTimer() {
  if (timer === null) return;
  clearTimeout(timer);
  timer = null;
}

function keep(next: AgentTurn) {
  turn = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAgentTurn(): AgentTurn {
  return useSyncExternalStore(
    subscribe,
    () => turn,
    () => turn,
  );
}

export function agentTurn(): AgentTurn {
  return turn;
}

export function agentWriting(held: AgentTurn = turn): boolean {
  return held.typing || held.partial !== "";
}

export function agentFrame(frame: { event?: string; data?: unknown }): void {
  const event = frame.event;
  if (event !== "agent.typing" && event !== "agent.token") return;
  const data = (frame.data ?? {}) as Record<string, unknown>;
  const about = String(data.thread ?? data.thread_id ?? "");
  if (!about) return;
  if (turn.thread && about !== turn.thread) return;
  if (event === "agent.typing") {
    const on = data.on === true;
    stopTimer();
    keep({
      thread: about,
      typing: on,
      partial: "",
      failed: !on && data.failed === true,
      asked: false,
    });
    return;
  }
  const text = typeof data.text === "string" ? data.text : "";
  if (!text) return;
  stopTimer();
  keep({
    thread: about,
    typing: false,
    partial: turn.partial + text,
    failed: false,
    asked: false,
  });
}

export function agentAsked(thread: string): void {
  if (!thread) return;
  stopTimer();
  keep({ thread, typing: true, partial: "", failed: false, asked: true });
  timer = setTimeout(() => {
    timer = null;
    if (turn.asked) keep({ ...turn, typing: false, asked: false });
  }, ASK_MS);
}

export function agentSettled(thread?: string | null): void {
  if (!turn.typing && !turn.partial && !turn.asked) return;
  if (thread && turn.thread && thread !== turn.thread) return;
  stopTimer();
  keep({ ...turn, typing: false, partial: "", failed: false, asked: false });
}
