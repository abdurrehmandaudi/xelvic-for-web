import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Star, X } from "lucide-react";
import { Spinner } from "@/components/ui/Button";
import {
  SHELF,
  SHELF_FOOTER,
  SHELF_GRID,
  SHELF_SEARCH,
  SHELF_TITLE,
  SHELF_TITLE_TEXT,
} from "@/components/ui/shelf";
import { StickerArt } from "@/components/media/StickerArt";
import { cn } from "@/utils/cn";
import {
  siftShelf,
  stickersService,
  type ShelfSticker,
  type StickerKind,
} from "@/services/stickers.service";

type Narrow = "all" | "recent" | "saved";

const HOLD_MS = 420;

export function StickerSheet({
  open,
  onClose,
  onPick,
  className,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (sticker: ShelfSticker) => void;
  className?: string;
}) {
  const [rows, setRows] = useState<ShelfSticker[]>([]);
  const [find, setFind] = useState("");
  const [kind, setKind] = useState<StickerKind>("sticker");
  const [narrow, setNarrow] = useState<Narrow>("all");
  const [saved, setSaved] = useState<ShelfSticker[]>([]);
  const [recent, setRecent] = useState<ShelfSticker[]>([]);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHold = useRef(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [eager, setEager] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void stickersService
      .shelf((page) => {
        if (cancelled) return;
        setRows(page);
        setLoading(false);
      })
      .then((shelf) => {
        if (!cancelled) setRows(shelf);
      })
      .catch(() => {
        // A shelf that could not be read is said out loud rather than shown as
        // an empty grid, which reads as a shelf with nothing on it.
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Every sticker on the shelf gets drawn, not only the dozen the eye can reach
  // at once. Measured in the running app on 2026-11-12, with the pictures left
  // to load themselves: of 602 cells, 526 were still empty when the panel
  // opened and **216 were still empty after a scroll to the very end** — a
  // shelf 11,941 pixels tall arriving blank behind the reader. That is what the
  // owner saw and reported: *"Abhi sabhi stickers nahi aa raha hai, please ise
  // fix kijiye jisse sabhi stickers aaye"*.
  //
  // So a beat after the shelf opens — long enough for the first screenful to
  // take the connections — the rest are asked for too. The beat is why this is
  // a timer rather than a plain `true`.
  useEffect(() => {
    if (!open || !rows.length) {
      setEager(false);
      return;
    }
    const soon = setTimeout(() => setEager(true), 350);
    return () => clearTimeout(soon);
  }, [open, rows.length]);

  // The box is emptied each time the shelf is opened, which is what the phone
  // does: a search that survived a close would hide the shelf the next time
  // somebody looked at it.
  useEffect(() => {
    if (open) {
      setSaved(stickersService.saved());
      setRecent(stickersService.recent());
    } else {
      setFind("");
      setNarrow("all");
      setKind("sticker");
    }
  }, [open]);

  // A press anywhere else puts the panel away, the same way the emoji picker
  // does. Taken on `pointerdown` so the panel is gone before the thing that was
  // pressed reacts.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, onClose]);

  const themed = useMemo(() => {
    if (narrow === "saved") return saved;
    if (narrow === "recent") return recent;
    return rows;
  }, [narrow, saved, recent, rows]);
  const halved = useMemo(
    () => themed.filter((row) => row.kind === kind),
    [themed, kind],
  );
  const shown = useMemo(() => siftShelf(halved, find), [halved, find]);
  const empties = halved.length === 0;
  const starred = useMemo(
    () => new Set(saved.map((row) => row.url)),
    [saved],
  );

  function toggleStar(row: ShelfSticker) {
    stickersService.star(row);
    setSaved(stickersService.saved());
  }

  function pressStart(row: ShelfSticker) {
    didHold.current = false;
    hold.current = setTimeout(() => {
      didHold.current = true;
      toggleStar(row);
    }, HOLD_MS);
  }

  function pressEnd() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  }

  return (
    <div
      ref={root}
      className={cn(SHELF, className)}
      role="dialog"
      aria-label="Stickers"
    >
      <div className={SHELF_SEARCH}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dim" />
          <input
            value={find}
            onChange={(event) => setFind(event.target.value)}
            placeholder="Search stickers"
            aria-label="Search stickers"
            className="h-8 w-full rounded-md border border-line bg-card pl-8 pr-8 text-[12px] font-medium text-ink outline-none transition placeholder:text-dim focus:border-accent"
          />
          {find ? (
            <button
              type="button"
              onClick={() => setFind("")}
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-dim transition hover:text-ink"
              aria-label="Clear the search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex h-8 shrink-0 items-center rounded-md border border-line bg-card p-0.5">
          {(["gif", "sticker"] as const).map((half) => (
            <button
              key={half}
              type="button"
              onClick={() => setKind(half)}
              className={cn(
                "flex h-7 items-center rounded px-2 text-[10px] font-bold uppercase tracking-[0.04em] transition",
                kind === half
                  ? "bg-[var(--accent-soft)] text-accent"
                  : "text-dim hover:text-ink",
              )}
              aria-pressed={kind === half}
            >
              {half === "gif" ? "GIF" : "Sticker"}
            </button>
          ))}
        </div>
      </div>

      {/* The row that names what is on the shelf. The emoji picker has one —
          it is where "Smileys & People" is written — and without it the two
          panels were a title row apart, which is what the owner saw.
          Asked for 2026-11-12: *"us panel ka hight aur width exact emoji panel
          ke jitna kijiye"*. */}
      <div className={SHELF_TITLE}>
        <p className={SHELF_TITLE_TEXT}>
          {narrow === "saved"
            ? "Saved"
            : narrow === "recent"
              ? "History"
              : "All stickers"}
        </p>
        {rows.length ? (
          <p className={cn(SHELF_TITLE_TEXT, "shrink-0")}>{shown.length}</p>
        ) : null}
      </div>

      <div className={SHELF_GRID}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : failed ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-dim">
            The stickers did not come down. Try again in a moment.
          </div>
        ) : !rows.length ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-dim">
            No stickers came down.
          </div>
        ) : !shown.length ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-dim">
            {find.trim()
              ? `Nothing for "${find.trim()}"`
              : empties
                ? narrow === "saved"
                  ? "Nothing starred yet. Hold a picture to star it."
                  : narrow === "recent"
                    ? "Nothing sent yet."
                    : `Nothing on the ${kind === "gif" ? "GIF" : "sticker"} shelf.`
                : "Nothing here."}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {shown.map((row) => (
              <button
                key={row.id}
                type="button"
                onPointerDown={() => pressStart(row)}
                onPointerUp={pressEnd}
                onPointerLeave={pressEnd}
                onPointerCancel={pressEnd}
                onContextMenu={(event) => {
                  event.preventDefault();
                  toggleStar(row);
                }}
                onClick={() => {
                  if (didHold.current) {
                    didHold.current = false;
                    return;
                  }
                  stickersService.noteSent(row);
                  setRecent(stickersService.recent());
                  onPick(row);
                }}
                className="relative flex aspect-square items-center justify-center rounded-[10px] p-1.5 transition hover:bg-[var(--accent-soft)] active:scale-95"
                aria-label={row.name || "Sticker"}
                title={row.packName || row.name || undefined}
              >
                <StickerArt url={row.url} eager={eager} />
                {starred.has(row.url) ? (
                  <Star
                    className="absolute right-1 top-1 size-3.5 fill-current text-accent"
                    aria-hidden
                  />
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Always drawn, even for a shelf that has only one pack: a bar that
          comes and goes takes a row's height with it, and a panel that changes
          size with what came back from the network is the whole complaint. */}
      <div className={cn(SHELF_FOOTER, "justify-center")}>
        {(
          [
            ["recent", "History"],
            ["saved", "Saved"],
            ["all", "All"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setNarrow(key)}
            className={cn(
              "flex h-6 shrink-0 items-center rounded-full px-2.5 text-[10px] font-bold transition",
              narrow === key
                ? "bg-[var(--accent-soft)] text-accent ring-1 ring-accent"
                : "text-dim hover:bg-[var(--accent-soft)] hover:text-accent",
            )}
            aria-pressed={narrow === key}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default StickerSheet;
