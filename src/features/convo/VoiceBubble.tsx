import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent } from "react";
import { Pause, Play, TimerOff } from "lucide-react";
import type { Asset } from "@/types/api";
import { duration } from "@/utils/format";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { cn } from "@/utils/cn";
import {
  claimEar,
  holdsEar,
  releaseEar,
  subscribeEar,
} from "@/utils/playback";
import {
  SPEED_RING,
  WAVE_HEIGHT,
  WAVE_IDLE_BARS,
  WAVE_PULSE_MS,
  WAVE_TRACK_WIDTH,
  boundedWaveform,
  danceHeights,
  idleHeights,
  nextSpeed,
  sampleHeights,
  trackProgress,
  waveCell,
} from "./voiceclip";

/**
 * How many bars a recorded note draws.
 *
 * The stored reading is up to 56 points, and 56 of them across 150 pixels are
 * hairlines — a waveform that reads as a grey smear rather than as a sound.
 * Thirty bars is the phone's own weight: thick enough to see and to move,
 * and still one peak per bar of the reading.
 */
const WAVE_BARS = 30;

export function VoiceBubble({ asset }: { asset?: Asset | null }) {
  const element = useRef<HTMLAudioElement | null>(null);
  const media = useMediaUrl(asset?.content_url);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [read, setRead] = useState(0);
  const [speed, setSpeed] = useState<number>(SPEED_RING[0]);
  const [phase, setPhase] = useState(0);

  const held = useSyncExternalStore(
    subscribeEar,
    () => (element.current ? holdsEar(element.current) : false),
    () => false,
  );

  useEffect(() => {
    const node = element.current;
    return () => {
      if (node) releaseEar(node);
    };
  }, []);

  const shape = boundedWaveform(asset?.waveform, WAVE_BARS);
  const count = shape.length === 0 ? WAVE_IDLE_BARS : shape.length;
  const cell = waveCell(WAVE_TRACK_WIDTH, count);
  const dancing = playing && shape.length === 0;
  const breathing = playing && shape.length > 0;

  useEffect(() => {
    if (!dancing) {
      setPhase(0);
      return;
    }
    let frame = 0;
    const from = performance.now();
    const tick = (now: number) => {
      setPhase((((now - from) % WAVE_PULSE_MS) / WAVE_PULSE_MS) * 2 * Math.PI);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dancing]);

  const heights = shape.length
    ? sampleHeights(shape)
    : dancing
      ? danceHeights(count, phase)
      : idleHeights(count);

  const expired = asset?.available === false || asset?.purged_at != null;
  const local = asset?.duration_ms ? asset.duration_ms / 1000 : 0;
  const total = held && read > 0 ? read : local;
  const position = held ? at : 0;
  const progress = trackProgress(position, total);
  const loading = media.loading;
  const playable = Boolean(media.src) && !expired;

  function toggle() {
    const node = element.current;
    if (!node || !playable) return;
    if (!node.paused) {
      node.pause();
      return;
    }
    if (node.ended || (Number.isFinite(node.duration) && node.currentTime >= node.duration)) {
      node.currentTime = 0;
      setAt(0);
    }
    claimEar(node);
    node.playbackRate = held ? speed : SPEED_RING[0];
    void node.play().catch(() => undefined);
  }

  function seek(event: MouseEvent<HTMLDivElement>) {
    const node = element.current;
    if (!node || !held || total <= 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    node.currentTime = total * ratio;
    setAt(total * ratio);
  }

  function cycle() {
    if (!held) return;
    const next = nextSpeed(speed);
    setSpeed(next);
    if (element.current) element.current.playbackRate = next;
  }

  if (expired && !media.src) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-line bg-[var(--paper)] px-3 py-1.5">
        <TimerOff className="size-3.5 shrink-0 text-dim" aria-hidden />
        <span className="text-[11px] font-medium text-dim">Expired</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={loading || !playable}
        aria-label={playing ? "Pause" : "Play"}
        title={playing ? "Pause" : "Play"}
        className={cn(
          "relative flex size-11 bg-accent shrink-0 items-center justify-center rounded-full text-white ring-1 ring-inset ring-white/30 transition duration-150",
          playable ? "hover:scale-[1.05] active:scale-95" : "opacity-60",
          "disabled:cursor-default disabled:hover:scale-100",
        )}
      >
        {loading ? (
          <span
            className="size-[18px] animate-spin rounded-full border-2 border-white/35 border-t-white"
            aria-hidden
          />
        ) : playing ? (
          <Pause className="size-5 fill-current" aria-hidden />
        ) : (
          <Play className="size-5 translate-x-[1px] fill-current" aria-hidden />
        )}
      </button>

      <div style={{ width: WAVE_TRACK_WIDTH }} className="shrink-0">
        <div
          role="progressbar"
          aria-label="Audio waveform"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          onClick={seek}
          style={{ height: WAVE_HEIGHT }}
          className={cn(
            "relative -mx-0.5 px-0.5",
            held && total > 0 && "cursor-pointer",
          )}
        >
          <div className="flex h-full w-full items-center">
            {heights.map((height, index) => {
              const done = index / count < progress;
              return (
                <span
                  key={index}
                  className="flex h-full flex-1 items-center justify-center"
                >
                  <span
                    style={{
                      width: cell.thick,
                      height,
                      marginInline: cell.gap,
                      borderRadius: 999,
                      transformOrigin: "center",
                      backgroundColor: done
                        ? "var(--accent)"
                        : "color-mix(in srgb, var(--dim) 46%, transparent)",
                      backgroundImage: done
                        ? "linear-gradient(180deg, rgba(255,255,255,0.45), transparent 70%)"
                        : undefined,
                      ...(breathing
                        ? {
                            animation: `voice-dance ${760 + (index % 5) * 90}ms ease-in-out ${-((index % 10) * 70)}ms infinite`,
                          }
                        : null),
                    }}
                    className="voice-wave-bar transition-[background-color] duration-150"
                  />
                </span>
              );
            })}
          </div>

          {held && total > 0 ? (
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--accent)_80%,transparent),0_0_10px_color-mix(in_srgb,var(--accent)_70%,transparent)]"
              style={{
                left: `${Math.min(100, Math.max(0, progress * 100))}%`,
              }}
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold tabular-nums tracking-[0.01em] text-dim">
            <span className={cn(playing && "text-ink")}>
              {duration(position)}
            </span>
            <span className="opacity-60"> / {duration(total)}</span>
          </span>
          <button
            type="button"
            onClick={cycle}
            disabled={!held}
            aria-label="Playback speed"
            title="Playback speed"
            className={cn(
              "flex h-5 min-w-[36px] shrink-0 items-center justify-center rounded-full border px-2 text-[11px] font-bold tabular-nums transition-colors",
              held
                ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[var(--accent-soft)] text-accent"
                : "border-transparent bg-transparent text-dim",
              held && "hover:border-accent/60",
            )}
          >
            {held ? speed : SPEED_RING[0]}×
          </button>
        </div>
      </div>

      <audio
        ref={element}
        src={media.src ?? undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setAt(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setRead(Number.isFinite(value) ? value : 0);
        }}
      />
    </div>
  );
}
