/**
 * One box for the two shelves that hang under the composer's plus.
 *
 * The owner's report of 2026-11-12: *"chatiput me plus par click karne par
 * sticker me jo sticker panel open ho raha hai please us panel ka hight aur
 * width exact emoji panel ke jitna kijiye"*. The two panels were written at
 * different times and had drifted apart, and the drift was measurable in the
 * running app, not a matter of opinion:
 *
 * - the emoji picker was **340x363** — a search row of 41, a title row of 29, a
 *   grid of 258 and a group bar of 33;
 * - the sticker sheet was **340x339** — the same search row, no title row at
 *   all, a grid of 264 and a pack bar of 32;
 * - and the sticker sheet's pack bar was drawn *only when the shelf had more
 *   than one pack*, so on a one-pack shelf the box moved again by another 32.
 *
 * Two panels of the same width that differ in height by a row's worth, and that
 * change height again depending on what came back from the network, is exactly
 * the sort of thing that reads as "not the same panel".
 *
 * They are now built from the same four rows, each with its own height written
 * down, so the box is the same by construction rather than by two numbers kept
 * in step by hand. Every number here was read off the running emoji picker
 * before the change; nothing about it moved except that its grid is now a fixed
 * height instead of a maximum one, so a search with three results no longer
 * makes it a different size from a search with three hundred.
 */

/** The box itself: same width, same border, same shadow, in both panels. */
export const SHELF =
  "flex w-[340px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-line bg-card shadow-[0_2px_14px_rgba(17,17,26,0.16)]";

/** The search row, measured at 41 px with an `h-8` field inside it. */
export const SHELF_SEARCH = "flex h-[41px] items-center gap-2 border-b border-line px-1.5";

/** The row naming what is on screen, measured at 29 px. */
export const SHELF_TITLE = "flex h-[29px] items-center justify-between gap-2 px-3";

/**
 * The room the pictures get, measured at 258 px — and the same fraction of a
 * short screen in both, so a phone does not turn one shelf into the other.
 */
export const SHELF_GRID = "h-[min(258px,42vh)] overflow-y-auto overscroll-contain px-2 py-2 scroll-thin";

/** The bar along the bottom, measured at 33 px, and always drawn. */
export const SHELF_FOOTER = "flex h-[33px] items-center gap-2 border-t border-line px-2";

/** The words in a title row: the same size, weight and colour in both. */
export const SHELF_TITLE_TEXT = "truncate text-[11px] font-bold text-dim";
