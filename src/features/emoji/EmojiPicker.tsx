import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  FaBurger,
  FaClockRotateLeft,
  FaFaceSmile,
  FaFlag,
  FaFutbol,
  FaHand,
  FaHeart,
  FaLightbulb,
  FaPaw,
  FaPlaneDeparture,
} from "react-icons/fa6";
import { cn } from "@/utils/cn";
import { STORAGE_KEYS } from "@/constants/storage";
import {
  SHELF,
  SHELF_FOOTER,
  SHELF_GRID,
  SHELF_SEARCH,
  SHELF_TITLE,
  SHELF_TITLE_TEXT,
} from "@/components/ui/shelf";
import { EmojiArt } from "./EmojiArt";
import {
  artOf,
  EMOJI_GROUPS,
  groupRows,
  RECENT_LIMIT,
  rememberRecent,
  rowOf,
  searchRows,
  shownChar,
  type EmojiRow,
} from "./model";

/** One real icon for each group, in the table's own order. */
const GROUP_ICONS = [
  FaFaceSmile,
  FaHand,
  FaPaw,
  FaBurger,
  FaPlaneDeparture,
  FaFutbol,
  FaLightbulb,
  FaHeart,
  FaFlag,
] as const;

/** The shelf of recent emoji, as this device last left it. */
function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentEmoji);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((one): one is string => typeof one === "string").slice(0, RECENT_LIMIT);
  } catch {
    // A private window, a blocked store or a value somebody else wrote: none
    // of them is worth an empty picker.
    return [];
  }
}

function writeRecent(list: readonly string[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.recentEmoji, JSON.stringify(list));
  } catch {
    /* the shelf simply does not survive this session */
  }
}

export function EmojiPicker({
  onPick,
  onClose,
  className,
}: {
  /** Handed one emoji character, ready to go straight into the message. */
  onPick: (char: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(0);
  /** Whether the page on screen is a group or the recent shelf. */
  const [shelf, setShelf] = useState<"group" | "recent">("group");
  const [tone, setTone] = useState(0);
  const [toneOpen, setToneOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const root = useRef<HTMLDivElement>(null);
  // One emoji to stand for the tone itself: the raised hand, which is the one
  // everybody recognises wearing a tone, drawn with Google's art like a tile.
  const toneSample = useMemo(() => rowOf("✋"), []);

  const rows = useMemo<EmojiRow[]>(() => {
    const search = query.trim();
    if (search) return searchRows(search);
    if (shelf === "recent") {
      return recent
        .map((char) => rowOf(char))
        .filter((row): row is EmojiRow => row !== null);
    }
    return groupRows(group);
  }, [query, group, shelf, recent]);

  const searching = Boolean(query.trim());
  // Only offered where there is something for it to change: no group outside
  // People & Body has a single emoji a tone can be put on.
  const toneReady =
    toneSample && rows.some((row) => row[3] === 1) ? toneSample : null;

  // A press anywhere else puts the panel away. Taken on `pointerdown` rather
  // than on a click, so the panel is gone before the thing that was pressed
  // reacts — and this listener is added after the press that opened the panel
  // has already been dispatched, so opening it cannot immediately close it.
  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);

  function pick(row: EmojiRow) {
    const char = shownChar(row, tone);
    setRecent((list) => {
      const next = rememberRecent(list, char);
      writeRecent(next);
      return next;
    });
    onPick(char);
  }

  const title = searching
    ? `${rows.length} emoji matching “${query.trim()}”`
    : shelf === "recent"
      ? "Recent"
      : EMOJI_GROUPS[group];

  return (
    <div
      ref={root}
      className={cn(SHELF, className)}
      role="dialog"
      aria-label="Emoji"
    >
      <div className={SHELF_SEARCH}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emoji"
            aria-label="Search emoji"
            className="h-8 w-full rounded-md border border-line bg-card pl-8 pr-3 text-[12px] font-medium text-ink outline-none transition placeholder:text-dim focus:border-accent"
          />
        </div>
      </div>

      <div className={SHELF_TITLE}>
        <p className={SHELF_TITLE_TEXT}>{title}</p>
        {toneReady && !searching ? (
          <button
            type="button"
            onClick={() => setToneOpen((open) => !open)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold transition",
              toneOpen || tone > 0
                ? "border-[color-mix(in_srgb,var(--accent)_30%,var(--line))] bg-[var(--accent-soft)] text-accent"
                : "border-line text-dim hover:text-ink",
            )}
            aria-expanded={toneOpen}
          >
            <span className="grid size-4 place-items-center text-[13px] leading-none">
              <EmojiArt
                char={shownChar(toneReady, tone)}
                motion={false}
                still={artOf(toneReady, tone).still}
              />
            </span>
            {tone === 0 ? "Tone" : `Tone ${tone}`}
          </button>
        ) : null}
      </div>

      {toneOpen && toneReady ? (
        <div className="flex items-center gap-1 px-3 pb-1.5">
          {[0, 1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTone(value);
                setToneOpen(false);
              }}
              className={cn(
                "grid size-8 place-items-center rounded-[9px] text-[20px] transition",
                tone === value ? "bg-[var(--accent-soft)] ring-1 ring-accent" : "hover:bg-[var(--accent-soft)]",
              )}
              aria-label={value === 0 ? "No skin tone" : `Skin tone ${value}`}
              aria-pressed={tone === value}
            >
              <EmojiArt
                char={shownChar(toneReady, value)}
                motion={false}
                still={artOf(toneReady, value).still}
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className={SHELF_GRID}>
        {rows.length ? (
          <div className="grid grid-cols-8 gap-1">
            {rows.map((row) => {
              const char = shownChar(row, tone);
              const art = artOf(row, tone);
              return (
                <button
                  key={`${row[0]}-${char}`}
                  type="button"
                  onClick={() => pick(row)}
                  className="grid size-9 place-items-center text-[22px] transition-all active:scale-95"
                  title={row[1]}
                  aria-label={row[1]}
                >
                  <EmojiArt char={char} motion={art.motion} still={art.still} />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-2 py-6 text-center text-[11px] text-dim">
            {searching
              ? `Nothing called “${query.trim()}”.`
              : shelf === "recent"
                ? "The emoji you use most will gather here."
                : "Nothing in this group."}
          </p>
        )}
      </div>

      <div className={SHELF_FOOTER}>
        <button
          type="button"
          onClick={() => {
            setShelf("recent");
            setQuery("");
          }}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-[5px] transition",
            !searching && shelf === "recent"
              ? "bg-[var(--accent-soft)] text-accent ring-1 ring-accent"
              : "text-dim hover:bg-[var(--accent-soft)] hover:text-accent",
          )}
          title="Recent"
          aria-label="Recent emoji"
          aria-pressed={!searching && shelf === "recent"}
        >
          <FaClockRotateLeft className="size-[14px]" aria-hidden />
        </button>
        {EMOJI_GROUPS.map((name, index) => {
          const Mark = GROUP_ICONS[index];
          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                setGroup(index);
                setShelf("group");
                setQuery("");
              }}
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-[5px] transition",
                !searching && shelf === "group" && group === index
                  ? "bg-[var(--accent-soft)] text-accent ring-1 ring-accent"
                  : "text-dim hover:bg-[var(--accent-soft)] hover:text-accent",
              )}
              title={name}
              aria-label={name}
              aria-pressed={!searching && shelf === "group" && group === index}
            >
              {Mark ? (
                <Mark className="size-[14px]" aria-hidden />
              ) : (
                <span className="text-[14px]">•</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
