import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bookmark,
  ChevronUp,
  EllipsisVertical,
  Heart,
  Hourglass,
  Music2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { FaRegCommentDots } from "react-icons/fa6";
import { FiShare2 } from "react-icons/fi";
import { Avatar } from "@/components/ui/Avatar";
import { AuthedImage, AuthedVideo } from "@/components/media/Media";
import { VerifiedTick } from "@/components/icons/Tick";
import { dropsService } from "@/services/drops.service";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { usePreferences } from "@/hooks/usePreferences";
import { useSaved } from "@/hooks/useSaved";
import { savedKindOf } from "@/store/saved";
import type { VibeEnd } from "@/hooks/useVibeEnd";

import type { Drop } from "@/types/api";
import { CommentsModal } from "./CommentsModal";
import { KeepButton } from "./KeepButton";
import { ShareSheet } from "./ShareSheet";
import { dropBase, reportDropLook } from "./model";
import { reportVibeLook } from "./reco";


export const FLOAT = "[text-shadow:0_0_6px_rgba(0,0,0,0.4)]";

/** The rates the panel offers, slowest first — `kRates`. */
const RATES = [0.5, 1, 1.5, 2];

/** What a finger held on the fast pad asks the clip for — `_fastRate`. */
const FAST = 2;

/** Everything a caller has to say about one clip for it to be drawn. */
export interface VibeSlideProps {
  vibe: Drop;
  active: boolean;
  /** Whether this slide is close enough to the thumb to hold a player. */
  near: boolean;
  muted: boolean;
  onToggleMute: () => void;
  playerOpen: boolean;
  onPlayer: (open: boolean) => void;
  ends: VibeEnd;
  onEnds: (end: VibeEnd) => void;
  /** Turn to the clip after this one, and answer whether there was one. */
  onNext: () => boolean;
  showHint: boolean;
  /** Draw the play-through line at the foot of the clip instead of the top. */
  progressBottom?: boolean;
}

export function VibeSlide({
  vibe: incoming,
  active,
  near,
  muted,
  onToggleMute,
  playerOpen,
  onPlayer,
  ends,
  onEnds,
  onNext,
  showHint,
  progressBottom = false,
}: VibeSlideProps) {
  const { t } = usePreferences();
  const { has, toggle: toggleSaved } = useSaved();
  const [vibe, setVibe] = useState(incoming);
  const [liked, setLiked] = useState(Boolean(incoming.liked));
  const [likes, setLikes] = useState(incoming.likes ?? 0);
  const [comments, setComments] = useState(incoming.comments ?? 0);
  const [shares, setShares] = useState(incoming.shares ?? 0);
  const [paused, setPaused] = useState(false);
  const [atMs, setAtMs] = useState(0);
  const [total, setTotal] = useState(0);
  const [boom, setBoom] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rate, setRate] = useState(1);
  const [fast, setFast] = useState(false);
  const [held, setHeld] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [footHeight, setFootHeight] = useState(0);

  const video = useRef<HTMLVideoElement | null>(null);
  const foot = useRef<HTMLDivElement | null>(null);
  const tap = useRef<number | null>(null);
  const long = useRef<number | null>(null);
  const longFired = useRef(false);
  const seen = useRef(false);

  const look = useRef({
    visible: 0,
    running: 0,
    pausedFor: 0,
    pausedRunning: 0,
    deepest: 0,
    rewinds: 0,
    ended: false,
    reported: true,
    autoplay: true,
  });
  const duration = useRef(0);
  const row = useRef(incoming);

  function startVisible() {
    if (document.hidden || look.current.running) return;
    look.current.running = performance.now();
  }

  function stopVisible() {
    const state = look.current;
    if (!state.running) return;
    state.visible += performance.now() - state.running;
    state.running = 0;
  }

 
  function reportLook(swiped: boolean) {
    const state = look.current;
    if (state.reported) return;
    state.reported = true;
    stopVisible();
    if (state.pausedRunning) {
      state.pausedFor += performance.now() - state.pausedRunning;
      state.pausedRunning = 0;
    }
    const played = Math.round(state.deepest);
    const length = duration.current;
    reportVibeLook(row.current, {
      ms: played,
      pct: length > 0 ? played / length : 0,
      completed: state.ended,
      visibleMs: Math.round(state.visible),
      durationMs: length > 0 ? length : null,
      toSwipeMs: swiped && !state.ended ? Math.round(state.visible) : null,
      rewinds: state.rewinds,
      pausedMs: Math.round(state.pausedFor),
      autoplay: state.autoplay,
    });
  }

  // Keep the copy in step with what a sheet handed back.
  useEffect(() => {
    row.current = incoming;
    setVibe(incoming);
    setLiked(Boolean(incoming.liked));
    setLikes(incoming.likes ?? 0);
    setComments(incoming.comments ?? 0);
    setShares(incoming.shares ?? 0);
  }, [incoming]);


  useEffect(() => {
    const element = video.current;
    if (!active) {
      reportLook(true);
      if (element) {
        element.pause();
        element.currentTime = 0;
      }
      setPaused(false);
      setAtMs(0);
      setTotal(0);
      setFast(false);
      setHeld(false);
      setScrub(null);
      return;
    }
    look.current = {
      visible: 0,
      running: 0,
      pausedFor: 0,
      pausedRunning: 0,
      deepest: 0,
      rewinds: 0,
      ended: false,
      reported: false,
      autoplay: true,
    };
    startVisible();
    setPaused(false);
    if (element) void element.play().catch(() => setPaused(true));
    if (!seen.current && !vibe.mine) {
      seen.current = true;
      void reportDropLook(vibe);
    }
  }, [active, vibe]);

  useEffect(() => {
    const state = look.current;
    if (paused) {
      if (!state.pausedRunning) state.pausedRunning = performance.now();
      return;
    }
    if (state.pausedRunning) {
      state.pausedFor += performance.now() - state.pausedRunning;
      state.pausedRunning = 0;
    }
  }, [paused]);

  useEffect(() => {
    if (!active) return;
    const hidden = () => {
      stopVisible();
      video.current?.pause();
    };
    const shown = () => {
      startVisible();
      if (!video.current?.paused) return;
      if (paused) return;
      void video.current?.play().catch(() => setPaused(true));
    };
    const onVisibility = () => (document.hidden ? hidden() : shown());
    document.addEventListener("visibilitychange", onVisibility);
    if (document.hidden) hidden();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, paused]);

  useEffect(() => {
    return () => reportLook(false);
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (held || paused) {
      element.pause();
      return;
    }
    if (active) void element.play().catch(() => setPaused(true));
  }, [held, active, paused, near]);

  useEffect(() => {
    const element = video.current;
    if (element) element.playbackRate = fast ? FAST : rate;
  }, [fast, rate, active, near]);

  useEffect(() => {
    const node = foot.current;
    if (!node) return;
    const read = () => setFootHeight(node.offsetHeight);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(read);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  const saved = has(savedKindOf(vibe), vibe.id);

  async function feel(on: boolean) {
    setLiked(on);
    setLikes((value) => Math.max(0, value + (on ? 1 : -1)));
    try {
      const answer = await dropsService.like(dropBase(vibe), vibe.id, on);
      setLiked(answer.liked);
      setLikes(answer.likes);
    } catch {
      setLiked(!on);
      setLikes((value) => Math.max(0, value + (on ? -1 : 1)));
    }
  }

  function onTap() {
    if (longFired.current) return;
    if (tap.current) window.clearTimeout(tap.current);
    tap.current = window.setTimeout(() => {
      tap.current = null;
      if (playerOpen) {
        onPlayer(false);
        return;
      }
      const element = video.current;
      if (!element) return;
      if (element.paused) {
        void element.play().catch(() => undefined);
        setPaused(false);
      } else {
        element.pause();
        setPaused(true);
      }
    }, 220);
  }

  function onDouble() {
    if (tap.current) {
      window.clearTimeout(tap.current);
      tap.current = null;
    }
    if (longFired.current) return;
    if (!liked) void feel(true);
    setBoom(true);
    window.setTimeout(() => setBoom(false), 620);
  }

  function startPress() {
    longFired.current = false;
    if (long.current) window.clearTimeout(long.current);
    long.current = window.setTimeout(() => {
      long.current = null;
      longFired.current = true;
      onPlayer(!playerOpen);
    }, 500);
  }

  function endPress() {
    if (long.current) {
      window.clearTimeout(long.current);
      long.current = null;
    }
  }

  function say(line: string | null) {
    setDraft(line);
    setCommentsOpen(true);
  }

  function togglePlay() {
    const playing = !(paused || held);
    if (held) setHeld(false);
    setPaused(playing);
  }

  function letGo(at: number) {
    const element = video.current;
    setHeld(false);
    setScrub(null);
    if (!element) return;
    const to = Math.max(0, Math.min(total, at)) / 1000;
    if (to < element.currentTime - 0.25) look.current.rewinds += 1;
    try {
      element.currentTime = to;
    } catch {
      // A seek can be refused before the clip has metadata; the next drag
      // tries again, and the play state is already what the finger said.
    }
    if (active && !paused) void element.play().catch(() => undefined);
  }

  const handle = vibe.author.username;
  const through = total > 0 ? Math.min(1, atMs / total) : 0;
  const shown = Math.min(total, scrub ?? atMs);

  return (
    <section
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-black"
      aria-label={`${vibe.author.name || handle}'s Vibe`}
    >
      <div
        role="presentation"
        onClick={onTap}
        onDoubleClick={onDouble}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={endPress}
        className="absolute inset-0"
      >
        {near ? (
          <AuthedVideo
            src={vibe.asset?.content_url}
            autoPlay={false}
            loop={ends === "replay"}
            muted={muted}
            playsInline
            videoRef={video}
            priority={active}
            onReady={() => {
              const element = video.current;
              if (!element || !active || paused || held) return;
              void element.play().catch(() => setPaused(true));
            }}
            onTimeUpdate={() => {
              const element = video.current;
              if (!element) return;
              const want = fast ? FAST : rate;
              if (element.playbackRate !== want) element.playbackRate = want;
              if (element.duration && Number.isFinite(element.duration)) {
                const running = element.duration * 1000;
                setTotal(running);
                setAtMs(Math.min(running, element.currentTime * 1000));
                duration.current = Math.round(running);
                look.current.deepest = Math.max(
                  look.current.deepest,
                  element.currentTime * 1000,
                );
              }
            }}
            onEnded={() => {
              look.current.ended = true;
              if (ends === "replay") return;
              if (onNext()) return;
              const element = video.current;
              if (!element) return;
              element.currentTime = 0;
              void element.play().catch(() => undefined);
            }}
            className="h-full w-full object-contain"
          />
        ) : (
          <AuthedImage
            src={vibe.asset?.thumbnail_url ?? null}
            alt=""
            className="h-full w-full object-contain"
            quiet
          />
        )}
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 h-[3px] bg-white/22",
          progressBottom ? "bottom-0 z-20" : "top-0",
        )}
      >
        <div
          className="h-full bg-white transition-[width] duration-150 ease-linear"
          style={{ width: `${through * 100}%` }}
        />
      </div>

      {paused && !playerOpen ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm">
            <svg
              viewBox="0 0 24 24"
              className="size-7 fill-current"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      ) : null}

      {/* The heart a double tap leaves behind: one white glyph that grows past
          its size, settles and fades, and leaves nothing behind. */}
      {boom ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Heart
            className={cn(
              "size-28 fill-white text-white opacity-0 motion-safe:animate-[vibeBoom_620ms_ease-out]",
              FLOAT,
            )}
          />
        </span>
      ) : null}

      {/* The rail: the column of buttons pressed about a clip somebody likes.
          It lifts over the player panel while one is open, because the panel is
          a slab over the foot and the rail is not a thing it is covering. */}
      <div
        className={cn(
          "absolute end-1 z-20 flex flex-col items-end gap-2 transition-[bottom]",
          playerOpen ? "bottom-[176px]" : "bottom-[40px]",
        )}
      >
        <div
          role="presentation"
          aria-label="Hold to play at double speed"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setFast(true);
          }}
          onPointerUp={() => setFast(false)}
          onPointerCancel={() => setFast(false)}
          onPointerLeave={() => setFast(false)}
          className="flex h-[96px] w-[76px] cursor-pointer touch-none select-none items-center justify-center"
        >
          {fast ? (
            <span
              className={cn("text-[13px] font-extrabold text-white", FLOAT)}
            >
              2×
            </span>
          ) : null}
        </div>
        <Rail
          label={t("Felt")}
          count={vibe.likes_off ? null : count(likes)}
          on={liked}
          onClick={() => void feel(!liked)}
          glyph={
            <Heart
              className={cn(
                "size-[28px]",
                liked ? "fill-accent text-accent" : "text-white",
              )}
              strokeWidth={2}
              aria-hidden
            />
          }
        />
        <Rail
          label={t("Comments")}
          count={count(comments)}
          onClick={() => say(null)}
          glyph={
            <FaRegCommentDots
              className="size-[25px] text-white"
              strokeWidth={2}
              aria-hidden
            />
          }
        />
        <Rail
          label={t("Share")}
          count={count(shares)}
          onClick={() => setShareOpen(true)}
          glyph={
            <FiShare2
              className="size-[25px] text-white"
              strokeWidth={2}
              aria-hidden
            />
          }
        />
        {/* The one glyph on this rail with no number under it, because a save is
            nobody else's business: it is not counted and nobody is told. */}
        <Rail
          label={saved ? t("Saved") : t("Save")}
          on={saved}
          onClick={() => void toggleSaved(savedKindOf(vibe), vibe.id)}
          glyph={
            <Bookmark
              className={cn(
                "size-[25px]",
                saved ? "fill-white text-white" : "text-white",
              )}
              strokeWidth={2}
              aria-hidden
            />
          }
        />
        <Rail
          label={t("Playback")}
          on={playerOpen}
          onClick={() => onPlayer(!playerOpen)}
          glyph={
            <EllipsisVertical
              className="size-[26px] text-white"
              strokeWidth={2.2}
              aria-hidden
            />
          }
        />
      </div>

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? t("Unmute") : t("Mute")}
        title={muted ? t("Unmute") : t("Mute")}
        aria-pressed={!muted}
        className="absolute end-3 top-[calc(env(safe-area-inset-top,0px)_+_68px)] z-20 flex size-7 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_2px_10px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-black/50 active:scale-95"
      >
        {muted ? (
          <VolumeX className="size-[15px]" strokeWidth={2} aria-hidden />
        ) : (
          <Volume2 className="size-[15px]" strokeWidth={2} aria-hidden />
        )}
      </button>

      {/* Who made it, what it says, and what it was made to. */}
      <div
        ref={foot}
        className="absolute inset-x-0 bottom-0 z-10 pb-[calc(env(safe-area-inset-bottom,0px)_+_12px)]"
      >
        <div className={cn("ps-2.5 pe-[68px]", FLOAT)}>
          <div className="flex items-center gap-2.5">
            <Link
              to={`/app/u/${encodeURIComponent(vibe.author.username)}`}
              aria-label={`Open @${handle}'s profile`}
              className="flex min-w-0 flex-1 items-center gap-2.5"
            >
              <Avatar user={vibe.author} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-[14px] font-extrabold">
                    @{handle}
                  </span>
                  {vibe.author.verified ? <VerifiedTick size={14} /> : null}
                </span>
              </span>
            </Link>
            {!vibe.mine ? (
              vibe.author_kept != null ? (
                <KeepButton
                  author={vibe.author}
                  known={vibe.author_kept === false}
                  kept={vibe.author_kept === true}
                />
              ) : active ? (
                <KeepButton author={vibe.author} />
              ) : null
            ) : null}
          </div>

          {vibe.collab?.people?.length ? (
            <p className="mt-1.5 truncate text-[12px] font-semibold text-white/90">
              with{" "}
              {vibe.collab.people
                .map((person) => person.name || person.username)
                .join(", ")}
            </p>
          ) : null}

          {vibe.body?.trim() ? (
            <div className="mt-1">
              <p
                className={cn(
                  "whitespace-pre-wrap break-words text-[13.5px] leading-[1.4] text-white",
                  !expanded && "line-clamp-2",
                )}
                onClick={() => setExpanded((value) => !value)}
              >
                {vibe.body}
              </p>
              {vibe.body.length > 46 ? (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="mt-1 text-[12.5px] font-bold text-white"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              ) : null}
            </div>
          ) : null}

          {vibe.mentions?.length ? (
            <p className="mt-2 flex flex-wrap gap-x-2.5 text-[12.5px] font-bold text-white">
              {vibe.mentions.map((person) => (
                <span key={person.id}>@{person.username}</span>
              ))}
            </p>
          ) : null}

          {vibe.music ? (
            <p className="mt-2 flex items-center gap-1.5 truncate text-[12.5px] text-white/88">
              <Music2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{vibe.music}</span>
            </p>
          ) : null}
        </div>

      </div>

      {showHint ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center"
          style={{ bottom: footHeight + 12 }}
        >
          <ChevronUp
            className="size-[22px] text-white"
            strokeWidth={2.2}
            aria-hidden
          />
          <span className="mt-0.5 text-[12px] font-semibold text-white/86">
            {t("Swipe for the next")}
          </span>
        </div>
      ) : null}

      {/* The player panel: a slab over the foot of the screen, which is what it
          has always done to the name and the caption. It is the stack's last
          child because it is the last thing drawn, and the rail lifts to clear
          it rather than being covered by it. */}
      {playerOpen ? (
        <div
          className="absolute inset-x-0 bottom-0 z-30 rounded-t-[20px] px-3.5 pb-[calc(env(safe-area-inset-bottom,0px)_+_12px)] pt-2.5 text-white"
          style={{ backgroundColor: "rgba(19,19,26,0.94)" }}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={paused || held ? "Play" : "Pause"}
              title={paused || held ? "Play" : "Pause"}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            >
              {paused || held ? (
                <Play className="size-5" fill="currentColor" aria-hidden />
              ) : (
                <Pause className="size-5" fill="currentColor" aria-hidden />
              )}
            </button>
            {/* Tabular figures, so the clock either side of the scrubber does
                not jiggle sideways as the seconds tick over. */}
            <span className="num w-7 shrink-0 text-[12px] font-bold">
              {clock(shown)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(1, total)}
              step={1}
              value={shown}
              aria-label="Seek"
              onPointerDown={() => {
                setHeld(true);
                setScrub(atMs);
              }}
              onChange={(event) => setScrub(Number(event.target.value))}
              onPointerUp={(event) => letGo(Number(event.currentTarget.value))}
              onPointerCancel={(event) =>
                letGo(Number(event.currentTarget.value))
              }
              onKeyUp={(event) => letGo(Number(event.currentTarget.value))}
              className="h-1 min-w-0 flex-1 cursor-pointer accent-white"
            />
            <span className="num w-9 shrink-0 text-end text-[12px] font-bold">
              {clock(total)}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5">
            {/* Speed as four chips rather than a slider: there are four rates
                anybody asks a clip for, and a continuous control between them
                would be a dial for 0.97×. */}
            {RATES.map((value) => {
              const on = rate === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRate(value)}
                  aria-pressed={on}
                  aria-label={`${rateLabel(value)} speed`}
                  className={cn(
                    "inline-flex items-center gap-[1.5px] rounded-full px-3.5 py-[6px] transition",
                    on
                      ? "bg-white text-[#13131a] shadow-[0_2px_10px_rgba(0,0,0,0.22)]"
                      : "bg-white/10 text-white hover:bg-white/20",
                  )}
                >
                  <span className="num text-[13px] font-extrabold leading-none tracking-[-0.2px]">
                    {value}
                  </span>
                  <span
                    className={cn(
                      "text-xl leading-none",
                      on ? "opacity-60" : "opacity-70",
                    )}
                  >
                    ×
                  </span>
                </button>
              );
            })}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => onPlayer(false)}
              className="rounded-full px-2.5 py-1.5 text-[13.5px] font-extrabold text-white transition hover:bg-white/10"
            >
              Done
            </button>
          </div>

          {/* The one setting the reel has, on the panel rather than behind the
              ⋮: the ⋮ is the feed's own menu and this is not a thing to do to a
              clip. The words for the two are not lost by the switch to glyphs —
              they are the line under the control, which changes as the choice
              does. */}
          <div className="mt-2.5">
            <div className="flex items-center gap-2">
              <Hourglass
                className="size-[18px] shrink-0 text-white"
                aria-hidden
              />
              <span className="text-[13px] font-semibold text-white/90">
                When it ends
              </span>
              <span className="flex-1" />
              <div className="flex overflow-hidden rounded-lg border border-white/25 bg-white/10">
                <EndChoice
                  end="next"
                  icon={<SkipForward className="size-[18px]" aria-hidden />}
                  on={ends === "next"}
                  onChoose={() => onEnds("next")}
                />
                <EndChoice
                  end="replay"
                  icon={<RotateCcw className="size-[18px]" aria-hidden />}
                  on={ends === "replay"}
                  onChoose={() => onEnds("replay")}
                />
              </div>
            </div>
            <p className="mt-0.5 text-[12px] text-white/62">
              {ends === "next"
                ? "The next Vibe plays"
                : "This Vibe plays again"}
            </p>
          </div>
        </div>
      ) : null}

      <CommentsModal
        drop={vibe}
        open={commentsOpen}
        draft={draft}
        onClose={() => setCommentsOpen(false)}
        onCommented={() => setComments((value) => value + 1)}
      />
      <ShareSheet
        drop={vibe}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={(sent) => setShares((value) => value + sent)}
      />
    </section>
  );
}

/** One half of "When it ends": a glyph, and whether it is the answer. */
function EndChoice({
  end,
  icon,
  on,
  onChoose,
}: {
  end: VibeEnd;
  icon: React.ReactNode;
  on: boolean;
  onChoose: () => void;
}) {
  const label = end === "next" ? "Next" : "Replay";
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-label={label}
      title={label}
      aria-pressed={on}
      className={cn(
        "flex h-[32px] w-[46px] items-center justify-center transition",
        on ? "bg-accent text-on-accent" : "text-white/72 hover:bg-white/10",
      )}
    >
      {icon}
    </button>
  );
}

/** A position, as a clock reads it. Minutes and seconds, and an hour is not a clip. */
function clock(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** A rate as the chips write it: `0.5×`, `1×`, `1.5×`, `2×`. */
function rateLabel(rate: number): string {
  return `${rate}×`;
}

/** One button on the rail: a glyph, its number, and the room a thumb needs. */
function Rail({
  label,
  count: number,
  glyph,
  on,
  onClick,
}: {
  label: string;
  count?: string | null;
  glyph: React.ReactNode;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={on}
      className={cn(
        "flex w-9 h-9 flex-col items-center justify-center gap-1 rounded-full px-1.5 py-1 text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.4)] transition hover:bg-white/15 active:scale-95",
      )}
    >
      {glyph}
    </button>
    {number ? (
        <span className="-mt-1.5 text-[13px] font-extrabold">{number}</span>
      ) : null}
    </div>
  );
}


