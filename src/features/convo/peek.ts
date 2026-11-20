/**
 * What the character over the composer is, and whether it is up at all.
 *
 * Ported from `peekOn` in `app/lib/screens/chat.dart`, which is four lines of
 * Dart with a page of reasons above them. This is those four lines, because the
 * rule between the two characters is the whole feature and it is worth being
 * able to test without a browser.
 *
 * **Three things can be true at once and only one picture fits on the border**,
 * so the order between them is a rule and lives here rather than in the widget
 * that draws it:
 *
 * 1. Somebody is writing to me — that is *their* `typing` pose, and it wins.
 * 2. Somebody is merely on one of my places — my convo or my profile, with
 *    nothing being written — which is their `wait` pose.
 * 3. Neither, and the figure is on its way out.
 *
 * Writing wins over merely being somewhere of mine because it is the more
 * particular fact of the two, and the only one where somebody is *doing*
 * something rather than just being there — which is most of the time anyway,
 * since writing to somebody means having their convo open.
 *
 * When neither is true the last pose is kept and `up` goes false, so that the
 * character has something to *be* while it slides back down. Dropping the pose
 * instead would have it vanish off the border rather than leave through it.
 */

import type { FigureArt } from "@/features/marketplace/model";
import type { Gaze } from "@/features/presence/looking";

/** The pose to draw, and whether the figure stands over the composer. */
export interface PeekState {
  pose: string | null;
  up: boolean;
}

/**
 * The state of the figure for one reading of the screen.
 *
 * `last` is the pose drawn a moment ago — the screen's memory, not this
 * function's, because the phone keeps it as state in the screen for the same
 * reason: it is the difference between a figure that leaves and one that
 * disappears.
 *
 * The phone's `poses.typing` and `poses.wait` are non-nullable Strings, so its
 * two branches have nothing to fall back to. Here a figure may genuinely have no
 * picture for a pose — a shelf row with an empty upload — so the branch falls
 * back to `last`, which is the same answer the phone's `last` is for: keep
 * drawing something rather than blink out mid-slide.
 */
export function peekOn({
  typing,
  gaze,
  last,
  poses,
}: {
  /** Whether the other person is writing to me right now. */
  typing: boolean;
  /** Their gaze, when it is on one of my places. */
  gaze: Gaze | null;
  /** The pose drawn a moment ago, or nothing yet. */
  last: string | null;
  /** Their figure's three pictures. See `figurePoses`. */
  poses: FigureArt;
}): PeekState {
  const pose = typing
    ? poses.typing ?? last
    : gaze
      ? poses.wait ?? last
      : last;
  return { pose, up: typing || gaze != null };
}

/**
 * The characters in words, for a reader who cannot see the figure.
 *
 * The phone removed its own words when the figure arrived — `online` and
 * `typing...` were taken off the composer because the character says it better
 * and does not need a translation. A screen reader gets no figure at all, so the
 * sentence lives here instead: one line, never drawn, and the only place these
 * words exist on either client.
 *
 * Nothing is said while the figure is down, and nothing is said about a place
 * this build does not know — a gaze is only ever `chat` or `profile`.
 */
export function peekWords({
  typing,
  gaze,
  name,
}: {
  typing: boolean;
  gaze: Gaze | null;
  name: string;
}): string {
  if (typing) return `${name} is typing...`;
  if (gaze?.look === "chat") return `${name} has this convo open`;
  if (gaze?.look === "profile") return `${name} is looking at your profile`;
  return "";
}
