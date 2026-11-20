/**
 * The recording, sitting where the text field sits.
 *
 * This is the web's recording bar: it takes the field's place rather than the
 * composer's, so the mic stays exactly where it is while a note is being made.
 * A note is started with a tap and ended with another, so the strip carries
 * both endings — the bin throws the recording away, the Send keeps it — rather
 * than asking anyone to keep a mouse button down.
 *
 * What it draws is what the recorder is actually reading: the seconds since it
 * started and the loudness samples it has taken, oldest first. Nothing here is
 * a decoration standing in for a number nobody measured.
 */
import { Send, Trash2 } from "lucide-react";
import { duration } from "@/utils/format";

/** How many of the readings the strip has room to draw. */
const DRAWN_BARS = 26;

export function VoiceStrip({
  seconds,
  levels,
  onDiscard,
  onSend,
}: {
  seconds: number;
  levels: readonly number[];
  onDiscard: () => void;
  onSend: () => void;
}) {
  const bars = levels.slice(-DRAWN_BARS);

  return (
    <div
      className="flex min-h-[36px] flex-1 items-center gap-2.5 rounded-[18px] border border-transparent px-2 py-0.5"
      role="status"
      aria-live="polite"
      aria-label="Recording a voice note"
    >
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-[var(--bad)]" />
      <span className="num shrink-0 text-[13px] font-bold tabular-nums text-ink">
        {duration(Math.floor(seconds))}
      </span>

      <span className="flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
        {bars.length ? (
          bars.map((level, index) => (
            <span
              key={index}
              className="w-[3px] shrink-0 rounded-full bg-accent"
              style={{ height: `${Math.max(8, Math.min(100, level))}%`, opacity: 0.35 + (index / bars.length) * 0.65 }}
            />
          ))
        ) : (
          <span className="text-[10.5px] font-semibold text-dim">Listening…</span>
        )}
      </span>

      <button
        type="button"
        onClick={onDiscard}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--bad)] transition hover:bg-[color-mix(in_srgb,var(--bad)_12%,transparent)]"
        aria-label="Throw this voice note away"
      >
        <Trash2 className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSend}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition hover:brightness-105 active:scale-95"
        aria-label="Send this voice note"
      >
        <Send className="size-4" />
      </button>
    </div>
  );
}
