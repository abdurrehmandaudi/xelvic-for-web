export const PICK_LIMIT = 10;

export interface PickStep {
  picked: string[];
  full: boolean;
  empty: boolean;
}

export function pickNext(
  picked: string[],
  id: string,
  limit = PICK_LIMIT,
): PickStep {
  if (!picked.includes(id) && picked.length >= limit) {
    return { picked, full: true, empty: false };
  }
  const next = picked.includes(id)
    ? picked.filter((held) => held !== id)
    : [...picked, id];
  return { picked: next, full: false, empty: next.length === 0 };
}

export function pileHolds(rows: string[], picked: string[], limit = PICK_LIMIT) {
  const all = rows.length;
  if (all === 0) return false;
  return picked.length === (all < limit ? all : limit);
}

export function pileTake(rows: string[], limit = PICK_LIMIT) {
  return rows.slice(0, limit);
}
