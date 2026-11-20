import { useEffect, useMemo, useRef } from "react";
import { Pose } from "@/features/marketplace/marks";
import {
  BUNDLED_POSES,
  CLASSIC_FIGURE,
  figureOnChat,
  figurePoses,
  type FigureArt,
} from "@/features/marketplace/model";
import { peekOn, peekWords } from "@/features/convo/peek";
import type { Gaze } from "@/features/presence/looking";
import { useCatalogue } from "@/hooks/useMarketplace";
import { cn } from "@/utils/cn";

/**
 * The character that comes up over the composer — both of them.
 *
 * Ported from `_peek` in `app/lib/screens/chat.dart`. The phone's answer to "is
 * somebody writing to me" is not a line of words but *their* character, standing
 * up out of the seam between the thread and the box — and it has **two** poses,
 * which is what the owner asked for on 2026-11-12: *"usme typing aur wait 2
 * charector hai aur dono jaise work kar raha hai app me waise isme bhi karna
 * chahiye"*.
 *
 * 1. `typing` — they are writing to me. This is what the web got in the round
 *    before this one, and it is the pose that wins when both facts are true.
 * 2. `wait` — they are *merely there*: my convo or my profile is open on their
 *    phone and they are doing nothing with it. The fact behind it is a gaze
 *    (`features/presence/looking.ts`), and without that half of the feature this
 *    pose could never be drawn at all — which is exactly why the first attempt
 *    at this looked nothing like the app.
 *
 * Which of the two it is, and whether the figure is up at all, is `peekOn` in
 * `features/convo/peek.ts` — the phone's own four lines, kept out of this file
 * so the rule can be tested without a browser. What is here is the drawing.
 *
 * The rule the feature turns on is *whose* character it is, and it is the
 * phone's rule unchanged: the figure that comes up while somebody writes to me
 * is the one their account is wearing, because it is them. My own theme decides
 * what they see on their screen and not a pixel of what I see on mine. So the key
 * is read off the other participant's card — `character`, which
 * `UserCardSerializer` has carried on every card all along — and resolved against
 * the same shelf the shop sells from.
 *
 * **Three numbers, all the phone's.** `PEEK_SIZE` is `kPeekSize`: the height of
 * the *picture*, not of the person in it, because each pose is squared on its own
 * artwork — the figure stands the full height of that square and about three
 * fifths of its width, the rest being the ground that got squared off around her.
 * `PEEK_RISE` is `kPeekAt`: how far up the character is drawn as a fraction of
 * its own height, which is the sliver that clears the composer's own fill.
 * `PEEK_CLEAR` is `kPeekClear`: the room the newest message keeps clear of the
 * character, held as the list's bottom inset **whether the character is up or
 * not** — a fixed inset and not one that grows with the peek, because a list that
 * jumped its last message up each time somebody started typing would be worse
 * than the overlap it is avoiding.
 *
 * **What this cannot do, and says so.** The phone's chain is the worn figure,
 * then the figure their *theme* ships, then the app's own. The web's catalogue
 * carries a figure's name and pictures but not the theme's figure pictures, so
 * the middle rung is missing here and an account wearing no shop figure falls
 * back to the bundled one — the same limit, and the same fallback, that
 * `PosedBio` records for the profile. A studio-set peek size is read from the
 * figure's own row; a *theme's* `figure_peek` is on the theme's row and is
 * likewise not reached from here.
 *
 * It is drawn, never pressed: it sits over the attach button and the mic, it
 * takes no taps, and it is announced to a screen reader as words instead, which
 * is the one place the phone's words still exist.
 */

/** How big the character is drawn. The phone's `kPeekSize`. */
export const PEEK_SIZE = 84;

/** How far up it is drawn, as a fraction of its own height. The phone's `kPeekAt`. */
export const PEEK_RISE = 0.86;

/**
 * The room the newest message keeps clear of it, in pixels. The phone's
 * `kPeekClear`, which is `kPeekSize * -kPeekAt + 10`.
 */
export const PEEK_CLEAR = Math.round(PEEK_SIZE * PEEK_RISE) + 10;

/** How long the character takes to rise or to leave. The phone's 260 ms. */
const PEEK_SLIDE = 260;

/** Nothing to draw, and nothing standing. What a figure placed off the convo gets. */
const NO_PEEK = { pose: null, up: false } as const;

export function TypingPeek({
  character,
  typing,
  gaze,
  name,
  className,
}: {
  /** The Drip key the other person wears, as their card carries it. */
  character?: string | null;
  /** Whether they are writing to me right now. */
  typing: boolean;
  /** What they are looking at, when it is something of mine. */
  gaze: Gaze | null;
  /** What to call them in the sentence a screen reader hears. */
  name: string;
  className?: string;
}) {
  const catalogue = useCatalogue();

  /**
   * Their figure's row, or nothing. The app's own figure is answered from the
   * bundle rather than from its shelf row — see `figureArt` — so `classic` and
   * an account wearing nothing at all land on the same drawing, which is what
   * the phone does too.
   */
  const figure = useMemo(() => {
    const key = (character ?? "").trim();
    if (!key || key === CLASSIC_FIGURE) return null;
    return catalogue.data?.characters?.find((row) => row.key === key) ?? null;
  }, [character, catalogue.data]);

  /**
   * Whether this figure is allowed over a composer at all. Staff may have said
   * it is for the profile alone, and then nothing is drawn where one would be —
   * for either pose. The phone gates its whole `peekOn` call on this, so a
   * figure placed off the convo is not merely a figure that never rises: it is a
   * figure with no state at all.
   */
  const allowed = figureOnChat(figure?.placement);

  /**
   * Their three pictures, memoised so the identity below means something.
   *
   * `figurePoses` folds the app's fallback chain — a figure with only one upload
   * is drawn with that one for every pose — and it returns a fresh object on
   * every call, which is why it is held here rather than called twice.
   */
  const art = useMemo<FigureArt>(
    () => (figure ? figurePoses(figure) : BUNDLED_POSES),
    [figure],
  );

  /**
   * The pose drawn a moment ago, so the figure has something to be while it
   * slides back down. The phone keeps this as `_pose` in the screen's own state
   * and sets it from the typing frame and from the gaze; here the same fact
   * falls out of the last render that had a pose.
   *
   * It is remembered against the art it came from, which is a small deliberate
   * difference from the phone: a phone's poses are three files in its own
   * bundle and cannot go away, while these are URLs on the shelf, and somebody
   * who changes their figure mid-convo would otherwise leave a path to a
   * picture that is no longer theirs to draw.
   */
  const memory = useRef<{ art: FigureArt; pose: string } | null>(null);
  const last = memory.current?.art === art ? memory.current.pose : null;

  const state = allowed
    ? peekOn({ typing, gaze, last, poses: art })
    : NO_PEEK;
  const { pose, up } = state;

  useEffect(() => {
    if (pose) memory.current = { art, pose };
  }, [art, pose]);

  const words = up ? peekWords({ typing, gaze, name }) : "";
  const size = figure?.peek_size || PEEK_SIZE;

  return (
    <>
      {/* The picture is a positioned layer rather than a row, so the composer's
          own height is the only height in this slot and putting the character
          away does not move the box — which is the bug the phone fixed on
          2026-10-12, where a pose coming and going rebuilt the field and closed
          the keyboard. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex justify-center",
          className,
        )}
        data-peek={up ? "up" : "down"}
        data-pose={up ? (typing ? "typing" : "wait") : "down"}
      >
        <span
          className="block transition-[transform,opacity] ease-out"
          style={{
            transitionDuration: `${PEEK_SLIDE}ms`,
            transform: `translateY(${up ? -PEEK_RISE * 100 : 0}%)`,
            opacity: up ? 1 : 0,
          }}
        >
          <Pose src={pose} size={size} />
        </span>
      </div>
      {/* The words the phone removed are still here for a reader who cannot see
          the figure: one line, never drawn, and it says which of the two
          characters is standing — writing to me, or merely being there. */}
      <span className="sr-only" role="status" aria-live="polite">
        {words}
      </span>
    </>
  );
}

export default TypingPeek;
