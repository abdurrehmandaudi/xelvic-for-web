import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BellOff,
  EllipsisVertical,
  EyeOff,
  Flag,
  ThumbsDown,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useVibeEnd } from "@/hooks/useVibeEnd";
import { dropsVibesQuery } from "@/features/drops/feedQueries";
import { EditDrop } from "@/features/drops/EditDrop";
import { StatsSheet } from "@/features/drops/StatsSheet";
import { FLOAT, VibeSlide } from "@/features/drops/VibeSlide";
import { reportVibesShown } from "@/features/drops/reco";
import { ReportSheet } from "@/features/report/ReportSheet";
import { dropsService } from "@/services/drops.service";
import { dropBase } from "@/features/drops/model";
import { useToast } from "@/hooks/useToast";
import { errorMessage } from "@/utils/errors";
import type { Drop } from "@/types/api";

export function VibesPanel({ onClose }: { onClose: () => void }) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(dropsVibesQuery);
  const [at, setAt] = useState(0);
  const [muted, setMuted] = useState(true);
  // The same three the walk hoists out of its slides, for the same reason: the
  // menu and its two sheets are about the clip in front, and one drawn inside a
  // snapped page would scroll away with it.
  const [menuOpen, setMenuOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Which clip has its player panel open, if any. Held here rather than in the
  // slide because a panel over a clip is a thumb off the list, and the list has
  // to stop answering swipes while it is up.
  const [playerFor, setPlayerFor] = useState<string | null>(null);
  // The one-off line telling a first reader that this answers a swipe, said once
  // per opening and never again — it is an instruction, not a label.
  const [hint, setHint] = useState(true);
  const [ends, setEnds] = useVibeEnd();
  const scroller = useRef<HTMLDivElement | null>(null);
  const settle = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const refreshVibes = () =>
    void queryClient.invalidateQueries({ queryKey: ["drops", "vibes"] });
  const trouble = (error: unknown) =>
    toast({
      title: "That did not work",
      description: errorMessage(error),
      tone: "error",
    });
  const hide = useMutation({
    mutationFn: (vibe: Drop) => dropsService.hide(dropBase(vibe), vibe.id, true),
    onSuccess: () => {
      setMenuOpen(false);
      refreshVibes();
      toast({ title: "You will not be shown that again.", tone: "success" });
    },
    onError: trouble,
  });
  const less = useMutation({
    mutationFn: (vibe: Drop) => dropsService.muteFormat(vibe.format ?? ""),
    onSuccess: () => {
      setMenuOpen(false);
      refreshVibes();
      toast({ title: "Fewer of these from now on.", tone: "success" });
    },
    onError: trouble,
  });
  const mute = useMutation({
    mutationFn: (vibe: Drop) => dropsService.muteAuthor(vibe.author.id),
    onSuccess: () => {
      setMenuOpen(false);
      refreshVibes();
      toast({ title: "Nothing more from them.", tone: "success" });
    },
    onError: trouble,
  });

  const vibes = useMemo(() => {
    // A hand dealt twice is one clip, not two. The server deals the shelf the
    // first time and hands more after that, so a clip can arrive in two of them
    // — the Drops page and the app's own `_fillMore` drop the second copy for
    // the same reason, and a page list without this draws it twice.
    const seen = new Set<string>();
    return (data?.pages ?? [])
      .flatMap((page) => page.results)
      .filter((vibe) => {
        if (seen.has(vibe.id)) return false;
        seen.add(vibe.id);
        return true;
      });
  }, [data]);

  const current: Drop | undefined = vibes[at];

  // Keep the page under the thumb when the list it is a page of changes — a
  // filter that shortened the shelf must not leave the walk standing past its
  // end.
  useEffect(() => {
    if (!vibes.length) return;
    if (at > vibes.length - 1) setAt(vibes.length - 1);
  }, [at, vibes.length]);

  // The invite to swipe goes after a moment and never comes back.
  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  // What this panel drew is a signal of its own — `Reco.served(vibes, surface:
  // 'vibes')` — because "impressions" counts times drawn rather than times
  // watched, and a clip swiped past still reached somebody. Once per opening,
  // as the walk sends it once per hand it is dealt.
  const served = useRef(false);
  useEffect(() => {
    if (served.current || !vibes.length) return;
    served.current = true;
    reportVibesShown(vibes);
  }, [vibes]);

  // The next hand is asked for while the thumb is still two pages short of the
  // end, so the walk does not run out under it — `Drops.vibeBatch` ahead, in
  // the app.
  useEffect(() => {
    if (!vibes.length || !hasNextPage || isFetchingNextPage) return;
    if (at + 2 >= vibes.length) void fetchNextPage();
  }, [at, vibes.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  /** Where a rest left the list, which is the page the walk is on. */
  const turned = useCallback(() => {
    const node = scroller.current;
    if (!node || !node.clientHeight) return;
    const page = Math.max(
      0,
      Math.min(vibes.length - 1, Math.round(node.scrollTop / node.clientHeight)),
    );
    setAt(page);
    setHint(false);
    // A player belongs to the clip it was opened on.
    setPlayerFor(null);
  }, [vibes.length]);

  /** Turn to the clip after this one, and answer whether there was one. */
  const nextPage = useCallback(() => {
    const node = scroller.current;
    if (!node || at + 1 >= vibes.length) return false;
    node.scrollTo({ top: (at + 1) * node.clientHeight, behavior: "smooth" });
    return true;
  }, [at, vibes.length]);

  /** Put the walk on a page — the arrow keys, and the two ends of a turn. */
  const goTo = useCallback(
    (page: number) => {
      const node = scroller.current;
      if (!node) return;
      const to = Math.max(0, Math.min(vibes.length - 1, page));
      node.scrollTo({ top: to * node.clientHeight, behavior: "smooth" });
    },
    [vibes.length],
  );

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-black text-white">
      {vibes.length ? (
        <div
          ref={scroller}
          tabIndex={0}
          role="region"
          aria-label="Vibes"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
              return;
            }
            if (playerFor) return;
            if (event.key === "ArrowDown" || event.key === "ArrowRight") {
              event.preventDefault();
              goTo(at + 1);
            }
            if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
              event.preventDefault();
              goTo(at - 1);
            }
          }}
          onScroll={() => {
            if (settle.current) window.clearTimeout(settle.current);
            settle.current = window.setTimeout(turned, 90);
          }}
          className={cn(
            "no-scrollbar h-full snap-y snap-mandatory overscroll-contain outline-none",
            playerFor ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {vibes.map((vibe, page) => (
            <VibeSlide
              key={String(vibe.id)}
              vibe={vibe}
              active={page === at}
              near={Math.abs(page - at) <= 2}
              muted={muted}
              onToggleMute={() => setMuted((value) => !value)}
              playerOpen={playerFor === String(vibe.id)}
              onPlayer={(open) => setPlayerFor(open ? String(vibe.id) : null)}
              ends={ends}
              onEnds={setEnds}
              onNext={nextPage}
              showHint={hint && page === at && page < vibes.length - 1}
              progressBottom
            />
          ))}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-1 px-1.5 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Vibes"
          className={cn(
            "pointer-events-auto flex size-9 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-95",
            FLOAT,
          )}
        >
          <X className="size-[19px]" strokeWidth={2.2} aria-hidden />
        </button>
        <div className="pointer-events-none min-w-0 flex-1 ps-1">
          <p className={cn("truncate text-[16px] font-extrabold tracking-[-0.15px]", FLOAT)}>
            Vibes
          </p>
        </div>
        {current ? (
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="More"
            title="More"
            aria-expanded={menuOpen}
            className={cn(
              "pointer-events-auto flex size-9 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-95",
              menuOpen && "bg-white/12",
              FLOAT,
            )}
          >
            <EllipsisVertical className="size-[19px]" strokeWidth={2.2} aria-hidden />
          </button>
        ) : null}
        {current && menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Close the menu"
              onClick={() => setMenuOpen(false)}
              className="pointer-events-auto fixed inset-0 z-40 cursor-default"
            />
            <div className="pointer-events-auto absolute left-1/2 top-full z-50 w-[212px] -translate-x-1/2 overflow-hidden rounded-[10px] border border-line bg-card p-1 text-ink shadow-[0_14px_36px_rgba(8,8,12,0.4)]">
              <MenuRow
                icon={<EyeOff className="size-[17px]" />}
                label="Not interested"
                onClick={() => hide.mutate(current)}
              />
              {current.format && current.format_label ? (
                <MenuRow
                  icon={<ThumbsDown className="size-[17px]" />}
                  label={`Less ${current.format_label}`}
                  onClick={() => less.mutate(current)}
                />
              ) : null}
              <MenuRow
                icon={<BellOff className="size-[17px]" />}
                label="Mute"
                onClick={() => mute.mutate(current)}
              />
              <MenuRow
                icon={<Flag className="size-[17px]" />}
                label="Report"
                onClick={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
              />
            </div>
          </>
        ) : null}
      </div>

      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-6 text-white" />
        </div>
      ) : isError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-[12.5px] font-bold text-white">Could not load Vibes.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-full bg-white px-4 py-1.5 text-[11px] font-bold text-black"
          >
            Try again
          </button>
        </div>
      ) : !vibes.length ? (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[12px] text-white/70">
          No Vibes yet.
        </div>
      ) : null}

      {/* The menu and the two sheets it can open belong to the panel rather than
          to a page: the clip in front is the one they are about. */}
      {current ? (
        <>
          <StatsSheet drop={current} open={statsOpen} onClose={() => setStatsOpen(false)} />
          <ReportSheet
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            kind="vibe"
            id={current.id}
            who={current.author.name || current.author.username}
            handle={current.author.username}
            avatar={current.author.avatar}
            preview={current.body}
          />
          <EditDrop
            drop={current}
            open={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["drops"] })}
          />
        </>
      ) : null}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold text-ink transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
    >
      <span className="shrink-0 text-dim">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
