/**
 * One emoji, drawn with Google's own artwork and — where Google animates it and
 * something has asked it to — moving.
 *
 * Three layers, in the order they earn their place:
 *
 * 1. **The character itself.** Written into the tile on the first frame, so it
 *    is something the instant the picker opens and stays something if the
 *    network is slow, blocked or gone. It is also the honest fallback for the
 *    fourteen emoji Google draws no picture of. It is painted only while it is
 *    the only drawing there is — the moment Google's artwork lands, the
 *    character steps out, because two drawings of one emoji are not one emoji.
 *    See `covered` at the foot of this file.
 * 2. **Google's still drawing**, laid over the character once it has loaded.
 *    This is what makes an emoji the machine's own font would draw as a box look
 *    like the emoji, whatever fonts the machine has. It is Google's set and only
 *    Google's: the owner asked for that plainly — *"dynamic emoji hata dijiye
 *    pahle jaise tha waise hi kijiye jo google ka"* — after a round of trying
 *    other sets, so the panel has no look to choose any more.
 * 3. **Google's animation**, played over the still, for the 605 emoji that have
 *    one — and only when something asks for it.
 *
 * **What asks for it is `motion.ts`'s decision, not this file's**, and the answer
 * is the same for a tile in the picker as for an emoji in a sentence: it moves
 * while a pointer is resting on it, and an emoji in a message also gets one pass
 * when that message is sent or arrives. Both rules are the owner's — the thread
 * first, *"ye jo continue animate ho raha hai jabki send karne par aur hover
 * karne par animate hona chahiye"*, and then the panel itself, *"usme emoji
 * animate continue hote hi rahte please ise aisa kijiye ki kewal hover karne par
 * hi emoji animate kare"*. The player is still only fetched by something that
 * needs it, so a chat that is only read, and a picker nobody points at, never
 * pay for it.
 *
 * `prefers-reduced-motion` is obeyed by not playing anything at all — the still
 * drawing is already there, so nothing has to be replaced, only withheld. A
 * hover does not override it: the setting is a person saying they do not want
 * things moving, and a pointer crossing a grid is exactly the accident it was
 * written for.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
// From `cdn.ts` and not `model.ts`: this component draws an emoji in a message
// as well as one in the picker, and reaching through the picker's arithmetic
// for a URL would put the picker's whole table on the chat screen.
import { motionUrl, stillUrl } from "./cdn";
import { giveBack, MOST_MOVING, spare, wanted, type Mode, type Phase } from "./motion";
import { lottiePlayer, type LottieInstance } from "./player";

type Watcher = (seen: boolean) => void;

const watching = new Map<Element, Watcher>();
let observer: IntersectionObserver | null = null;

/**
 * One IntersectionObserver for every emoji in the app.
 *
 * A hundred observers watching a hundred emoji is a hundred callbacks on every
 * scroll frame; this is one. Being seen is not a reason to move — the pointer is
 * — but it is a condition: nothing plays for something scrolled clean out of the
 * page, which is what this answers. The margin is a screen's worth of slack so
 * the edge of the viewport does not flicker a tile in and out of that condition.
 */
function watch(element: Element, tell: Watcher): () => void {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        watching.get(entry.target)?.(entry.isIntersecting);
      }
    },
    { rootMargin: "200px" },
  );
  watching.set(element, tell);
  observer.observe(element);
  return () => {
    watching.delete(element);
    observer?.unobserve(element);
  };
}

function prefersStill(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Emoji currently running an animation, across the whole app. */
let moving = 0;

export function EmojiArt({
  char,
  /** Google animates this one — `hasMotion` in the generated table. */
  motion,
  /** Google draws this one at all — `hasStill` in the generated table. */
  still = true,
  /** A tile in the picker, or an emoji inside something somebody said. */
  mode = "tile",
  /**
   * Play this one through, once, right now.
   *
   * A token rather than a flag, so that the same message can be sent twice and
   * be celebrated twice. It is how a sent or just-arrived message says "this
   * one is new" — see `Arrival` in `ChatPage`.
   */
  burst,
  className,
}: {
  char: string;
  motion: boolean;
  still?: boolean;
  mode?: Mode;
  burst?: number;
  className?: string;
}) {
  const holder = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLSpanElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [animated, setAnimated] = useState(false);

  // The pointer's own arrival and departure, and the burst, handed to the
  // effect below through refs so the handlers can be written once on the
  // element and still do nothing at all for an emoji with nothing to play.
  const arrived = useRef<() => void>(() => {});
  const departed = useRef<() => void>(() => {});
  const cheer = useRef<() => void>(() => {});

  useEffect(() => {
    if (!motion || prefersStill()) return;
    const tile = holder.current;
    const canvas = stage.current;
    if (!tile || !canvas) return;

    // `phase` is what this one is doing, and it is a local rather than state
    // because it changes inside a promise and in the observer's callback: a
    // re-render must never be what decides whether a player is running.
    let phase: Phase = "off";
    let instance: LottieInstance | null = null;
    let gone = false;
    let inView = false;
    let hovered = false;
    /** Started because a pointer was on it, so the place may have to go back. */
    let byPointer = false;
    /** Playing a one-pass burst, which runs to its own end whatever else moves. */
    let bursting = false;

    const release = () => {
      if (phase === "off") return;
      phase = "off";
      moving -= 1;
    };

    const start = (options: { once: boolean }) => {
      if (phase !== "off" || !spare(moving, hovered)) return;
      phase = "loading";
      byPointer = hovered;
      // A burst is a reason of its own to be moving, and the only one that
      // outlives the thing that asked for it: a message arrives, its emoji
      // play, and nothing the pointer or the scroll does while they play
      // should cut them short.
      bursting = options.once;
      moving += 1;
      void lottiePlayer().then((player) => {
        // The finger may have scrolled straight past while the player was
        // still arriving, in which case this one is no longer wanted.
        if (phase !== "loading" || gone || !canvas.isConnected) {
          release();
          return;
        }
        try {
          instance = player.loadAnimation({
            container: canvas,
            renderer: "svg",
            loop: !options.once,
            autoplay: true,
            path: motionUrl(char),
            rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
          });
          if (options.once) {
            // A burst is over when the animation is: the drawing behind it is
            // already there, so stopping is a return to stillness and not a
            // gap where something used to be.
            instance.addEventListener("complete", () => {
              if (phase === "off") return;
              stop();
              sync();
            });
          }
          phase = "playing";
          setAnimated(true);
        } catch {
          release();
        }
      });
    };

    const stop = () => {
      instance?.destroy();
      instance = null;
      byPointer = false;
      bursting = false;
      release();
      canvas.replaceChildren();
      if (!gone) setAnimated(false);
    };

    /** Whether this one should be moving, asked of everything that decides it. */
    const sync = () => {
      // A burst is the one thing that is not asked about: it was asked for, and
      // it stops when it is over. Without this the observer's very first
      // callback — "you are on screen", which is not a reason to move — would
      // stop a burst that had only just begun, which is exactly what it did
      // before this line existed.
      if (bursting) return;
      if (!wanted(inView, hovered)) {
        stop();
        return;
      }
      if (phase === "off") {
        start({ once: false });
        return;
      }
      if (giveBack(byPointer, hovered, moving, MOST_MOVING)) stop();
    };

    const leave = watch(tile, (seen) => {
      inView = seen;
      sync();
    });
    arrived.current = () => {
      hovered = true;
      sync();
    };
    departed.current = () => {
      hovered = false;
      sync();
    };
    cheer.current = () => {
      if (phase === "off") start({ once: true });
    };

    return () => {
      gone = true;
      arrived.current = () => {};
      departed.current = () => {};
      cheer.current = () => {};
      leave();
      stop();
    };
    // `mode` is not here because it is not read inside: it decides the markup
    // and the accessibility of the tile, and the rule for moving is the same
    // for both kinds of emoji.
  }, [char, motion]);

  // The burst is a token: every new value is one more play. Nothing happens on
  // the first render of something that was never told to celebrate.
  useEffect(() => {
    if (burst === undefined) return;
    cheer.current();
  }, [burst]);

  // One emoji, one drawing.
  //
  // The moment Google's drawing is on the page — the still has landed, or an
  // animation is playing over it — the character has done its job and must stop
  // being painted. It is not the same shape as Google's: the machine's glyph is
  // a different figure at a different size, so it shows around the still's edge
  // and, worse, *through* the animation, whose drawing is thinner than the still
  // it replaced. The owner's report is exactly that — *"kisi kisi emoji me do do
  // emoji aa raha hai ek hover karne par animate hota hai aur ek nahi hota hai"*
  // — and it is worst on the hover precisely because hovering is when the still
  // steps aside for the animation. Which emoji look doubled is decided by how
  // far the two figures part company; a grin is the same shape twice over and
  // hides it, folded hands and raised hands are not and do not.
  //
  // Opacity and not `visibility`, because the character is still the sentence it
  // was said in: in a message it stays in the DOM to be selected, copied and
  // read out — a tile was never anything but a button.
  const covered = drawn || animated;

  return (
    <span
      ref={holder}
      onPointerEnter={() => arrived.current()}
      onPointerLeave={() => departed.current()}
      className={cn("relative grid size-full place-items-center leading-none", className)}
      aria-hidden={mode === "tile" ? true : undefined}
    >
      <span
        className={cn(
          // Down over the same hundred milliseconds the still comes up in, so
          // the two drawings trade places instead of one blinking out under the
          // other.
          "col-start-1 row-start-1 transition-opacity duration-100",
          mode === "tile" && "select-none",
          covered && "opacity-0",
        )}
      >
        {char}
      </span>
      {still ? (
        <img
          src={stillUrl(char)}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onLoad={() => setDrawn(true)}
          onError={() => setDrawn(false)}
          className={cn(
            "col-start-1 row-start-1 size-full object-contain transition-opacity duration-100",
            drawn ? "opacity-100" : "opacity-0",
            animated && "invisible",
          )}
        />
      ) : null}
      <span ref={stage} className="col-start-1 row-start-1 size-full" />
    </span>
  );
}
