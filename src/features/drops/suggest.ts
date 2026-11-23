import { socialService, type Suggestion } from "@/services/social.service";

export type SuggestKind = "popular" | "nearby" | "mutual" | "contacts";

export const SUGGEST_CYCLE: SuggestKind[] = ["popular", "nearby", "mutual", "contacts"];

const FIRST_AFTER = 3;
const SECOND_AFTER = 13;
const GAP_LEAST = 10;
const GAP_MOST = 14;
const MOST_PER_SITTING = 3;

export interface SuggestSpot {
  after: number;
  kind: SuggestKind;
}

function rolled(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function nextKind(
  at: number,
  dismissed: Set<string>,
): { kind: SuggestKind; next: number } | null {
  for (let step = 0; step < SUGGEST_CYCLE.length; step += 1) {
    const kind = SUGGEST_CYCLE[(at + step) % SUGGEST_CYCLE.length];
    if (!dismissed.has(kind)) return { kind, next: at + step + 1 };
  }
  return null;
}

export function suggestShelfSpots(
  count: number,
  {
    seed,
    lastKind,
    dismissed = new Set<string>(),
  }: { seed: number; lastKind?: SuggestKind | null; dismissed?: Set<string> },
): SuggestSpot[] {
  if (count < FIRST_AFTER) return [];
  const at = lastKind ? SUGGEST_CYCLE.indexOf(lastKind) + 1 : 0;
  let upNext = at < 0 ? 0 : at % SUGGEST_CYCLE.length;
  const roll = rolled(seed);
  const out: SuggestSpot[] = [];
  let after = FIRST_AFTER;
  let first = true;
  while (out.length < MOST_PER_SITTING && after <= count) {
    const picked = nextKind(upNext, dismissed);
    if (!picked) break;
    out.push({ after, kind: picked.kind });
    upNext = picked.next;
    if (first) {
      after = SECOND_AFTER;
      first = false;
    } else {
      after += GAP_LEAST + Math.floor(roll() * (GAP_MOST - GAP_LEAST + 1));
    }
  }
  return out;
}

export interface SuggestState {
  lastKind?: SuggestKind | null;
  dismissedKinds: Set<string>;
  cutDay: string;
}

const KEY = "xelvic.suggest.shelf";

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

interface StoredRow {
  day?: string;
  lastKind?: string;
  dismissed?: string[];
  cutDay?: string;
}

function readAll(): Record<string, StoredRow> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, StoredRow>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    return;
  }
}

const EMPTY: SuggestState = { lastKind: null, dismissedKinds: new Set(), cutDay: "" };

export function loadSuggestState(account: string): SuggestState {
  if (!account) return EMPTY;
  const row = readAll()[account];
  if (!row) return EMPTY;
  const sameDay = `${row.day ?? ""}` === today();
  const last = `${row.lastKind ?? ""}` as SuggestKind;
  const dismissed = new Set<string>();
  if (sameDay && Array.isArray(row.dismissed)) {
    for (const kind of row.dismissed) {
      if (SUGGEST_CYCLE.includes(kind as SuggestKind)) dismissed.add(kind);
    }
  }
  return {
    lastKind: SUGGEST_CYCLE.includes(last) ? last : null,
    dismissedKinds: dismissed,
    cutDay: sameDay ? `${row.cutDay ?? ""}` : "",
  };
}

function saveSuggestState(account: string, state: SuggestState) {
  if (!account) return;
  const all = readAll();
  all[account] = {
    day: today(),
    lastKind: state.lastKind ?? "",
    dismissed: [...state.dismissedKinds]
      .filter((kind) => SUGGEST_CYCLE.includes(kind as SuggestKind))
      .sort(),
    cutDay: state.cutDay,
  };
  writeAll(all);
}

export function nextSuggestKind(state: SuggestState): SuggestKind {
  if (!state.lastKind) return SUGGEST_CYCLE[0];
  const at = SUGGEST_CYCLE.indexOf(state.lastKind) + 1;
  return SUGGEST_CYCLE[at % SUGGEST_CYCLE.length];
}

export function momentsCutToday(state: SuggestState): boolean {
  return state.cutDay !== "" && state.cutDay === today();
}

export function rememberShown(account: string, kind: SuggestKind) {
  const state = loadSuggestState(account);
  saveSuggestState(account, { ...state, lastKind: kind });
}

export function dismissKind(account: string, kind: SuggestKind) {
  const state = loadSuggestState(account);
  saveSuggestState(account, {
    ...state,
    lastKind: kind,
    dismissedKinds: new Set([...state.dismissedKinds, kind]),
  });
}

export function cutMoments(account: string) {
  const state = loadSuggestState(account);
  saveSuggestState(account, { ...state, cutDay: today() });
}

export async function fetchSuggestions(kind: SuggestKind, limit = 5): Promise<Suggestion[]> {
  try {
    const answer = await socialService.suggest(kind, limit);
    return Array.isArray(answer.results) ? answer.results : [];
  } catch {
    return [];
  }
}

export const SUGGEST_WORDS: Record<SuggestKind, string> = {
  popular: "Popular",
  nearby: "Nearby",
  mutual: "Mutual",
  contacts: "From contacts",
};
