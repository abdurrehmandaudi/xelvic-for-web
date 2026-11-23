import { apiPathFrom } from "@/config/urls";
import { duration } from "@/utils/format";
import type { Drop } from "@/types/api";

export type KidsShelfKey = "all" | "shorts" | "long" | "cartoons" | "stories" | "games";

export interface KidsShelf {
  key: KidsShelfKey;
  label: string;
  api?: string;
}

export const KIDS_SHELVES: KidsShelf[] = [
  { key: "all", label: "All" },
  { key: "shorts", label: "Shorts", api: "shorts" },
  { key: "long", label: "Long", api: "long" },
  { key: "cartoons", label: "Cartoons", api: "cartoons" },
  { key: "stories", label: "Stories", api: "stories" },
  { key: "games", label: "Games" },
];

export function kidsShelf(key: KidsShelfKey): KidsShelf {
  return KIDS_SHELVES.find((shelf) => shelf.key === key) ?? KIDS_SHELVES[0];
}

export function kidsName(drop: Drop): string {
  return String(drop.title ?? "").trim() || String(drop.body ?? "").trim();
}

export function kidsPoster(drop: Drop): string | null {
  if (drop.kind === "audio") {
    return drop.cover?.thumbnail_url || drop.cover?.content_url || null;
  }
  return drop.asset?.thumbnail_url || drop.asset?.content_url || null;
}

export function kidsIsClip(drop: Drop): boolean {
  return drop.kind === "video" || drop.kind === "vibe";
}

export function kidsLength(drop: Drop): string {
  const ms = drop.asset?.duration_ms;
  if (typeof ms !== "number" || ms <= 0) return "";
  return duration(ms / 1000);
}

export function kidsDoor(drop: Drop): string {
  return drop.kind === "vibe"
    ? `/app/drops?vibe=${encodeURIComponent(String(drop.id))}`
    : `/app/drops/${encodeURIComponent(String(drop.id))}`;
}

export function kidsCursor(next: string | null | undefined): string | undefined {
  const path = apiPathFrom(next);
  if (!path) return undefined;
  const query = path.split("?")[1];
  if (!query) return undefined;
  return new URLSearchParams(query).get("cursor") || undefined;
}

export function mergeNewest(...groups: Drop[][]): Drop[] {
  const seen = new Set<string>();
  const rows: Drop[] = [];
  for (const group of groups) {
    for (const drop of group) {
      const id = String(drop.id);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(drop);
    }
  }
  rows.sort((left, right) => {
    const leftAt = left.created_at ? Date.parse(left.created_at) : Number.NaN;
    const rightAt = right.created_at ? Date.parse(right.created_at) : Number.NaN;
    const leftKnown = Number.isFinite(leftAt);
    const rightKnown = Number.isFinite(rightAt);
    if (leftKnown && rightKnown && leftAt !== rightAt) return rightAt - leftAt;
    if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
    return String(left.id).localeCompare(String(right.id));
  });
  return rows;
}