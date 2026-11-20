import { STORAGE_KEYS } from "@/constants/storage";

type Store = Pick<Storage, "getItem" | "setItem">;

export const RETRY_WINDOW_MS = 20_000;

const BROKEN = [
  /Cannot read properties of null \(reading 'use[A-Za-z]+'\)/,
  /Invalid hook call/,
];

export function isBrokenTree(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = typeof error.message === "string" ? error.message : "";
  return BROKEN.some((one) => one.test(message));
}

function store(): Store | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function lastRetry(where: Store | null, now: number): number {
  if (!where) return 0;
  try {
    const raw = where.getItem(STORAGE_KEYS.renderRetry);
    const when = raw ? Number(raw) : 0;
    if (!Number.isFinite(when) || when <= 0 || when > now) return 0;
    return when;
  } catch {
    return 0;
  }
}

export function retriedRecently(
  now: number = Date.now(),
  where: Store | null = store(),
): boolean {
  const last = lastRetry(where, now);
  return last > 0 && now - last < RETRY_WINDOW_MS;
}

export function claimRetry(
  now: number = Date.now(),
  where: Store | null = store(),
): boolean {
  if (!where) return false;
  if (retriedRecently(now, where)) return false;
  try {
    where.setItem(STORAGE_KEYS.renderRetry, String(now));
  } catch {
    return false;
  }
  return true;
}
