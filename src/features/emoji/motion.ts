/**
 * When an emoji is allowed to move.
 *
 * One rule, and it is the pointer's: **an emoji moves while a pointer is resting
 * on it, and at no other time.** It arrived in two steps from the owner. First
 * the thread: *"ye jo continue animate ho raha hai jabki send karne par aur hover
 * karne par animate hona chahiye"* — a message is read, not browsed, and every
 * bubble running its own animation for as long as it is on screen is a thread
 * nobody can read. Then the panel, where the same fault was worse because the
 * whole grid moved at once: *"usme emoji animate continue hote hi rahte please
 * ise aisa kijiye ki kewal hover karne par hi emoji animate kare"*.
 *
 * So being on screen stopped being a reason to move for a tile as well, and
 * became only a condition: nothing plays for something scrolled out of sight,
 * which is why `wanted` still asks. What moves a tile is the pointer, and what
 * moves an emoji in a sentence is the pointer plus the single pass a send or an
 * arrival asks for (`EmojiArt`'s `burst`, which is not asked here at all).
 *
 * A consequence worth naming rather than discovering: on a device with no
 * pointer that can rest — a phone, a tablet — the panel is still, because a
 * touch arrives and leaves in the same instant. That is the rule as asked for,
 * and it is the same stillness a message's emoji keep there.
 *
 * **A pointer resting on one buys it a place past the budget.** The budget is
 * real — a few dozen Lottie players is a stutter — but the emoji somebody has
 * walked up to and is deciding about is the one that most deserves to be in it.
 * There is only ever one of those, so it may go one over; and it gives that
 * place back when the pointer leaves, because otherwise walking a pointer along
 * a row would leave every tile it crossed running for good.
 */

/** How many emoji may move at once for the whole app. */
export const MOST_MOVING = 24;

/** What a drawing is part of: a tile in a grid, or an emoji in a sentence. */
export type Mode = "tile" | "text";

/** What a drawing is doing. */
export type Phase = "off" | "loading" | "playing";

/**
 * Whether this drawing should be moving at all.
 *
 * The same answer for a tile and for an emoji in a sentence, which is why the
 * mode is no longer an argument: a still emoji is what both of them are until a
 * pointer rests on one, and the only thing that plays without one is a burst.
 */
export function wanted(inView: boolean, hovered: boolean): boolean {
  return inView && hovered;
}

/**
 * Whether there is room for it to start.
 *
 * A pointer is the one thing allowed past the budget, and it is asked with
 * `hovered` rather than through a separate argument because the answer is the
 * same question: who is asking.
 */
export function spare(moving: number, hovered: boolean, cap = MOST_MOVING): boolean {
  return hovered || moving < cap;
}

/**
 * Whether a drawing that took its place because a pointer was on it should give
 * that place back.
 *
 * Only when the budget is actually overdrawn. A pointer that landed while there
 * was room took a place it was entitled to, and keeps it.
 */
export function giveBack(
  byPointer: boolean,
  hovered: boolean,
  moving: number,
  cap = MOST_MOVING,
): boolean {
  return byPointer && !hovered && moving > cap;
}
