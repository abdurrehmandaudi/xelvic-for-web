import { useSyncExternalStore } from "react";
import { mediaUrl } from "@/config/urls";
import { session } from "@/store/session";

export interface Transfer {
  received: number;
  total: number | null;
  live: boolean;
  paused: boolean;
  done: boolean;
  failed: boolean;
}

const IDLE: Transfer = {
  received: 0,
  total: null,
  live: false,
  paused: false,
  done: false,
  failed: false,
};

const rows = new Map<string, Transfer>();
const parts = new Map<string, Blob[]>();
const stops = new Map<string, AbortController>();
const lastEmit = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

const EMIT_MS = 100;

function keep(url: string, next: Transfer) {
  rows.set(url, next);
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function transferOf(url: string): Transfer {
  return rows.get(url) ?? IDLE;
}

export function useTransfer(url: string | null | undefined): Transfer {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  return url ? transferOf(url) : IDLE;
}

export function transferBlob(url: string): Blob | null {
  const chunks = parts.get(url);
  if (!chunks || !chunks.length) return null;
  return new Blob(chunks);
}

export function rangeHeader(received: number): string | null {
  return received > 0 ? `bytes=${received}-` : null;
}

export function totalFrom(
  contentRange: string | null,
  contentLength: string | null,
  from: number,
): number | null {
  if (contentRange) {
    const all = /\/(\d+)\s*$/.exec(contentRange);
    if (all) return Number(all[1]);
  }
  const length = Number(contentLength);
  if (contentLength !== null && Number.isFinite(length) && length > 0) {
    return from + length;
  }
  return null;
}

function totalOf(response: Response, start: number): number | null {
  return totalFrom(
    response.headers.get("content-range"),
    response.headers.get("content-length"),
    start,
  );
}

export function begin(url: string, known?: number | null): void {
  const absolute = mediaUrl(url);
  if (!absolute || stops.has(url)) return;
  const held = rows.get(url);
  if (held?.done) return;
  const start = held?.received ?? 0;
  if (!held || start === 0) parts.set(url, []);
  keep(url, {
    received: start,
    total: held?.total ?? known ?? null,
    live: true,
    paused: false,
    done: false,
    failed: false,
  });
  const controller = new AbortController();
  stops.set(url, controller);
  void read(url, absolute, start, known ?? null, controller);
}

async function read(
  url: string,
  absolute: string,
  start: number,
  known: number | null,
  controller: AbortController,
) {
  try {
    const headers: Record<string, string> = {};
    const token = session.access();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (start > 0) headers.Range = rangeHeader(start)!;
    const response = await fetch(absolute, {
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    if (response.status === 416) {
      parts.set(url, []);
      stops.delete(url);
      keep(url, {
        ...transferOf(url),
        received: 0,
        live: false,
        failed: false,
        paused: false,
      });
      begin(url, known);
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let from = start;
    if (from > 0 && response.status !== 206) {
      parts.set(url, []);
      from = 0;
    }
    const total = totalOf(response, from) ?? known;
    const chunks = parts.get(url) ?? [];
    const reader = response.body?.getReader();
    if (!reader) {
      const whole = await response.blob();
      parts.set(url, [whole]);
      keep(url, {
        received: whole.size,
        total: total ?? whole.size,
        live: false,
        paused: false,
        done: true,
        failed: false,
      });
      return;
    }
    let received = from;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(new Blob([value]));
      received += value.byteLength;
      const now = Date.now();
      if (now - (lastEmit.get(url) ?? 0) >= EMIT_MS) {
        lastEmit.set(url, now);
        keep(url, {
          received,
          total,
          live: true,
          paused: false,
          done: false,
          failed: false,
        });
      }
    }
    parts.set(url, chunks);
    lastEmit.delete(url);
    keep(url, {
      received,
      total: total ?? received,
      live: false,
      paused: false,
      done: true,
      failed: false,
    });
  } catch {
    if (controller.signal.aborted) {
      const held = transferOf(url);
      if (!held.done) {
        keep(url, { ...held, live: false, paused: true, failed: false });
      }
      return;
    }
    keep(url, { ...transferOf(url), live: false, paused: false, failed: true });
  } finally {
    if (stops.get(url) === controller) stops.delete(url);
  }
}

export function pause(url: string): void {
  const controller = stops.get(url);
  if (!controller) return;
  controller.abort();
}

export function resume(url: string): void {
  if (stops.has(url)) return;
  const held = transferOf(url);
  if (held.done) return;
  begin(url, held.total);
}

export function forget(url: string): void {
  stops.get(url)?.abort();
  stops.delete(url);
  parts.delete(url);
  rows.delete(url);
  lastEmit.delete(url);
  version += 1;
  for (const listener of listeners) listener();
}