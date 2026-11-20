import { EMOJI, EMOJI_GROUPS, type EmojiRow } from "./data";

export { EMOJI, EMOJI_GROUPS };
export type { EmojiRow };
// The CDN naming lives on its own so that drawing an emoji does not have to
// pull the table in with it; a tile in the picker wants both, and gets both.
export { cdnKey, motionUrl, stillUrl } from "./cdn";

/** How many results a search is allowed to draw at once. */
export const SEARCH_LIMIT = 120;

/** Every emoji in one of the table's groups, in the order the table holds them. */
export function groupRows(group: number): EmojiRow[] {
  return EMOJI.filter((row) => row[2] === group);
}

/**
 * Every emoji whose name or search words carry all of the words typed.
 *
 * All of them, not any: "cat face" is somebody narrowing down, and a rule that
 * matched either word would answer with every cat and every face there is.
 */
export function searchRows(query: string, limit = SEARCH_LIMIT): EmojiRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const found: EmojiRow[] = [];
  for (const row of EMOJI) {
    const haystack = `${row[1]} ${row[6]}`;
    if (words.every((word) => haystack.includes(word))) {
      found.push(row);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/** What the table says about one emoji, or null for a character it does not hold. */
export function rowOf(char: string): EmojiRow | null {
  return EMOJI.find((row) => row[0] === char) ?? null;
}

/** The five skin-tone modifiers, in the order Unicode defines them. */
export const TONES = ["\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"] as const;

/**
 * One emoji wearing a skin tone, or the emoji itself for no tone.
 *
 * The modifier goes after the emoji's **first** code point and a variation
 * selector that was holding that code point's place is dropped with it — 👋🏽 is
 * `1f44b 1f3fd`, and ☝🏽 is `261d 1f3fd` and not `261d fe0f 1f3fd`. Anything the
 * emoji carries after its first code point — a joiner, a second person — is
 * left exactly where it was.
 */
export function toned(char: string, tone: number): string {
  const skin = TONES[tone - 1];
  if (!skin) return char;
  const parts = [...char];
  const [first, ...rest] = parts;
  if (rest[0] === "️") rest.shift();
  return `${first}${skin}${rest.join("")}`;
}

/**
 * Which emoji a tile is actually drawing: the plain one, or the tinted form of
 * it. `tone` is 0 for no tone, or 1–5 for the five modifiers.
 */
export function shownChar(row: EmojiRow, tone: number): string {
  return tone > 0 && row[3] === 1 ? toned(row[0], tone) : row[0];
}

/** Whether Google draws this emoji, and whether Google animates it. */
export interface EmojiDrawing {
  still: boolean;
  motion: boolean;
}

/**
 * What Google has for one emoji wearing one tone.
 *
 * The ten digits in a row are the answer, not the plain emoji's own flags: the
 * toned forms are separate artwork on the CDN and they are much sparser — of
 * the 1615 of them, 250 move against 605 of the 1906 plain ones. A row that
 * takes no tone has no digits and answers with its plain flags, which is what a
 * tile showing it tint-less already asked for.
 */
export function artOf(row: EmojiRow, tone: number): EmojiDrawing {
  const masks = row[7];
  if (tone <= 0 || row[3] !== 1 || masks.length < 10) {
    return { still: row[4] === 1, motion: row[5] === 1 };
  }
  return {
    still: masks[tone - 1] === "1",
    motion: masks[tone + 4] === "1",
  };
}

/** How many emoji the recent shelf holds. */
export const RECENT_LIMIT = 24;/**
 * A recent shelf with one emoji moved to the front of it.
 *
 * Newest first and one of each: the shelf is a row of the last few things
 * somebody reached for, and the same emoji twice in it is a row that has
 * stopped being useful.
 */
export function rememberRecent(
  list: readonly string[],
  char: string,
  cap = RECENT_LIMIT,
): string[] {
  return [char, ...list.filter((one) => one !== char)].slice(0, cap);
}
