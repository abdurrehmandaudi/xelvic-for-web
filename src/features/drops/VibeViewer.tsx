import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChartColumn, EllipsisVertical, Video, X } from "lucide-react";
import { cn } from "@/utils/cn";

import type { Drop } from "@/types/api";
import { DropMenu } from "./DropMenu";
import { EditDrop } from "./EditDrop";
import { StatsSheet } from "./StatsSheet";
import { FLOAT, VibeSlide } from "./VibeSlide";
import { reportVibesShown } from "./reco";
import { useVibeEnd } from "@/hooks/useVibeEnd";
import { lockScroll } from "@/utils/scrollLock";

/**
 * Vibes: clips walked one at a time, filling the screen.
 *
 * Ported from `VibesScreen` in `screens/vibes.dart`. A swipe up is the next one
 * and a swipe down the last, which is the whole of the navigation — there is no
 * list and no grid, because a Vibe is watched rather than chosen. The shelf on
 * the Drops page is where one is *chosen*, and what it opens is this, turned so
 * that the one that was tapped is the first page and the rest of the shelf
 * below it.
 *
 * **Only one clip plays.** Every slide holds its own player and every player is
 * paused with the clip wound back to the beginning except the one in view; a
 * screen that left a dozen of them running would be a dozen decoders and a
 * machine that gets hot holding a list nobody is watching. Winding back is not
 * tidiness either — coming back to a clip that is already half-way through is
 * coming back to something somebody has not seen.
 *
 * **Nothing is drawn behind the controls.** The app had a flat scrim across the
 * top and took it away on 2026-10-14: a grey wash across the top inch of
 * somebody's clip to make three white icons legible is furniture over a
 * photograph. So the icons and the words carry their own shadow and the clip is
 * the screen. See `_float` at the top of `vibes.dart`.
 *
 * **This file is the walk, not the clip.** The clip — its rail, its scrubber,
 * its comment sheet, its caption — is `VibeSlide.tsx`, moved out on 2026-11-12
 * so the convo's Vibes panel could be the same experience rather than a second
 * drawing of one. What is left here is the chrome that belongs to a full-screen
 * screen: the portal, the bar over every page, the scroller, and the menu and
 * two sheets that belong to the clip in front rather than to a page.
 */

export function VibeViewer({
  vibes,
  index,
  onIndex,
  onClose,
  onRecord,
  onNeedMore,
}: {
  vibes: Drop[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** The bar's camera — a caller that can open the composer passes one. */
  onRecord?: () => void;
  /** A thumb nearing the end of the hand it was dealt — `Drops.vibeBatch`. */
  onNeedMore?: () => void;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(index);
  const [muted, setMuted] = useState(true);
  // The menu and the two sheets it can open, hoisted out of the slides: they
  // are about the clip in front, and a sheet drawn inside a snapped slide would
  // scroll away with it.
  const [menuOpen, setMenuOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Which clip has its player panel open, if any. Held by the walk rather than
  // by the slide for what it does to the walk: a panel over a clip is a thumb
  // off the list, and the list has to stop answering swipes while it is up — a
  // drag that moved the page under an open scrubber would take the thing being
  // scrubbed away mid-gesture. See `_playerFor` in `vibes.dart`.
  const [playerFor, setPlayerFor] = useState<string | null>(null);
  // The one answer for the whole app, remembered across visits.
  const [ends, setEnds] = useVibeEnd();
  // The one-off line telling a first reader that the walk answers a swipe. It
  // says what the screen does once, for somebody who has not seen one of these
  // before, and then gets out of the way — `_hint`/`_hintGone`.
  const [hint, setHint] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const current = vibes[at];

  // The page the walk is on, kept in step with the scroll rather than with the
  // prop alone: the prop says where it was *opened*, the scroll says where it
  // has been turned to since.
  useEffect(() => {
    setAt(index);
    pageAt.current = index;
  }, [index]);

  // Open on the slide that was tapped, not on the first one.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ top: index * node.clientHeight, behavior: "auto" });
    // Only on the way in: a later change of `index` is the scroll's own doing
    // arriving back round, and scrolling to it again would fight the thumb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The invite to swipe goes after a moment, and it never comes back: it is an
  // instruction and not a label.
  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  // What the shelf drew is a signal of its own — `Reco.served(vibes,
  // surface: 'vibes')` — because "impressions" counts times drawn rather than
  // times watched, and a clip swiped past still reached somebody. Sent once
  // for the hand the walk opened on, as the app sends it once per page it is
  // handed.
  const served = useRef(false);
  useEffect(() => {
    if (served.current) return;
    served.current = true;
    reportVibesShown(vibes);
  }, [vibes]);

  // Four pages ahead of the thumb is where the next hand is asked for; the app
  // keeps a batch ahead and the walk is not supposed to run out.
  useEffect(() => {
    if (at + 5 >= vibes.length) onNeedMore?.();
  }, [at, vibes.length, onNeedMore]);

  const settle = useRef<number | null>(null);
  // The page the walk was last seen on, so a rest that landed on the page it
  // was already on is not a turn: the scroll announces every stop, including
  // the one the list was opened on.
  const pageAt = useRef(index);
  const turned = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const page = Math.max(0, Math.min(vibes.length - 1, Math.round(node.scrollTop / node.clientHeight)));
    setAt(page);
    if (pageAt.current === page) return;
    pageAt.current = page;
    onIndex(page);
    // A turn is somebody who already knows how the walk answers, and a panel
    // belongs to the clip it was opened on.
    setHint(false);
    setPlayerFor(null);
  }, [vibes.length, onIndex]);

  /** Turn to the clip after this one, and answer whether there was one. */
  const nextPage = useCallback(() => {
    const node = scroller.current;
    if (!node || at + 1 >= vibes.length) return false;
    node.scrollTo({ top: (at + 1) * node.clientHeight, behavior: "smooth" });
    return true;
  }, [at, vibes.length]);

  useEffect(() => {
    // Counted, and this is one of the two effects that made counting necessary:
    // it re-runs as the walk moves and as the panels open, and each re-run used
    // to write back the value it had read before whatever opened meanwhile.
    const releaseScroll = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        // A player put down first: the panel is the thing on top of the walk,
        // and closing the whole screen from under it would be one answer to
        // two different questions.
        if (playerFor) {
          setPlayerFor(null);
          return;
        }
        onClose();
        return;
      }
      // The panel has the arrow keys' meaning while it is up: a drag across the
      // page under an open scrubber is the gesture the panel exists to refuse.
      if (playerFor) return;
      const node = scroller.current;
      if (!node) return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        node.scrollTo({ top: (at + 1) * node.clientHeight, behavior: "smooth" });
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        node.scrollTo({ top: Math.max(0, at - 1) * node.clientHeight, behavior: "smooth" });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [at, onClose, playerFor]);

  return createPortal(
    // `h-[100dvh]` rather than `inset-0`: a fixed box with all four edges pinned
    // resolves against the *layout* viewport, which on a phone is the tall one —
    // so with a browser bar on screen the strip along the bottom (the caption,
    // the comment rail, the clip's own player panel) sat underneath it, and the
    // page's scroll is locked while the walk is up, so nothing could bring them
    // back. The children are `h-full`, so they follow this height.
    <div
      className="fixed inset-x-0 top-0 z-[95] h-[100dvh] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Vibes"
    >
      {/* A phone-shaped stage rather than controls pinned to the edges of a
          desktop window. The clip is a portrait screen and the bar, rail and
          caption belong to it; on a wide display they were spread across two
          empty black wings with the video stranded in the middle. On a phone
          this is simply the screen. */}
      <div className="relative mx-auto h-full w-full max-w-[480px] overflow-hidden">
      {/* The bar floats over every page rather than sitting in the column: the
          clips are the screen and the controls are drawn on the one in front. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-1 px-2 pb-2.5 pt-[calc(env(safe-area-inset-top,0px)_+_6px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn("pointer-events-auto flex size-12 items-center justify-center rounded-full text-white transition hover:bg-white/10", FLOAT)}
        >
          <X className="size-6" strokeWidth={2.2} aria-hidden />
        </button>
        <span className="flex-1" />
        {/* One menu for everything that is *about* the clip in front of you,
            rather than something done *to* it — the same sheet a card in the
            feed opens, because a Vibe *is* a drop as far as that menu is
            concerned and the server agrees: `Vibe` carries the drop's own
            `comments_off` and `likes_off` for exactly this reason. */}
        <TopButton
          label="More"
          onClick={() => setMenuOpen(true)}
          disabled={!current}
        >
          <EllipsisVertical className="size-6" aria-hidden />
        </TopButton>
        <TopButton label="Your studio" onClick={() => navigate("/drops/vibes/studio")}>
          <ChartColumn className="size-6" aria-hidden />
        </TopButton>
        {onRecord ? (
          <TopButton label="New Vibe" onClick={onRecord}>
            <Video className="size-6" aria-hidden />
          </TopButton>
        ) : null}
      </div>

      <div
        ref={scroller}
        onScroll={() => {
          // A frame's rest is what decides the page, not every pixel of the
          // journey: a debounce is the browser's answer to `settle` on a scroll
          // whose end it does not announce.
          if (settle.current) window.clearTimeout(settle.current);
          settle.current = window.setTimeout(turned, 90);
        }}
        // A panel over a clip stops the walk answering swipes. `overflow-hidden`
        // rather than a second scroll listener: the browser refuses the gesture
        // before a single pixel of it is read.
        className={cn(
          "no-scrollbar h-full snap-y snap-mandatory overscroll-contain",
          playerFor ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {vibes.map((vibe, page) => (
          <VibeSlide
            key={String(vibe.id)}
            vibe={vibe}
            active={page === at}
            // Only the clip in front and its two neighbours are asked for.
            // The first version mounted a player for every clip in the hand —
            // thirty downloads and thirty decoders for a walk that starts on
            // one — which is why opening Vibes took as long as it did.
            near={Math.abs(page - at) <= 2}
            muted={muted}
            onToggleMute={() => setMuted((value) => !value)}
            playerOpen={playerFor === String(vibe.id)}
            onPlayer={(open) => setPlayerFor(open ? String(vibe.id) : null)}
            ends={ends}
            onEnds={setEnds}
            onNext={nextPage}
            showHint={hint && page === at && page < vibes.length - 1}
          />
        ))}
      </div>
      </div>

      {/* The menu and the two sheets it can open belong to the *walk* rather
          than to a page: the clip in front is the one they are about, and a
          sheet drawn inside a snapped slide would scroll away with it. */}
      {current ? (
        <>
          <DropMenu
            drop={current}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onStats={() => setStatsOpen(true)}
            onEdit={() => setEditOpen(true)}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ["drops"] })}
          />
          <StatsSheet drop={current} open={statsOpen} onClose={() => setStatsOpen(false)} />
          <EditDrop
            drop={current}
            open={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["drops"] })}
          />
        </>
      ) : null}
    </div>,
    document.body,
  );
}

/** One icon in the bar over the clip. */
function TopButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "pointer-events-auto flex size-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40",
        FLOAT,
      )}
    >
      {children}
    </button>
  );
}
