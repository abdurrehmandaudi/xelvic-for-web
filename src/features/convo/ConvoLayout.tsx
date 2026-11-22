import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircleMore, Search } from "lucide-react";
import { cn } from "@/utils/cn";
import { ConvoPage, NewConvoPanel } from "@/pages/ConvoPage";
import { SparkSheet } from "@/features/sparks/SparkSheet";
import { threadFace, threadTitle } from "@/features/convo/model";
import type { Spark, ThreadCard } from "@/types/api";

type SidePanel =
  | { kind: "compose" }
  | {
      kind: "spark";
      thread: ThreadCard;
      spark: Spark | null;
      balance?: number;
    };

const SIDEBAR_WIDTH_KEY = "xelvic:convo-list-width";
const SIDEBAR_MIN = 272;
const SIDEBAR_MAX = 480;

function maxSidebarWidth() {
  if (typeof window === "undefined") return SIDEBAR_MAX;
  return Math.max(
    SIDEBAR_MIN + 24,
    Math.min(SIDEBAR_MAX, Math.round(window.innerWidth * 0.45)),
  );
}

function clampSidebarWidth(width: number) {
  return Math.min(
    maxSidebarWidth(),
    Math.max(SIDEBAR_MIN, Math.round(width)),
  );
}

function readSavedSidebarWidth(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : null;
  } catch {
    return null;
  }
}

function saveSidebarWidth(width: number | null) {
  try {
    if (width == null) window.localStorage.removeItem(SIDEBAR_WIDTH_KEY);
    else window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch {
    return;
  }
}

function EmptyChatPane() {
  return (
    <div className="relative flex h-full min-h-[520px] flex-col items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--page)_94%,var(--card))] px-6 text-center sm:px-10">
      <div
        className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-24 h-64 w-[560px] rounded-[50%] opacity-50 blur-2xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        aria-hidden
      />

      <div className="relative flex w-full max-w-[520px] flex-col items-center">
        <div className="relative h-[190px] w-[230px]">
          <span className="absolute left-1 top-[92px] size-3 rounded-full bg-[color-mix(in_srgb,var(--accent)_35%,var(--card))]" aria-hidden />
          <span className="absolute left-[48px] top-1 size-2.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,var(--card))]" aria-hidden />
          <span className="absolute right-[42px] top-3 size-3 rounded-full bg-[color-mix(in_srgb,var(--accent)_24%,var(--card))]" aria-hidden />
          <span className="absolute right-1 top-[118px] size-3 rounded-full bg-[color-mix(in_srgb,var(--accent)_48%,var(--card))]" aria-hidden />
          <span className="absolute right-0 bottom-5 text-[23px] text-accent/70" aria-hidden>✦</span>
          <span className="absolute left-0 top-0 text-[22px] text-accent/70" aria-hidden>✦</span>

          <div className="absolute left-7 top-6 flex size-[146px] items-center justify-center rounded-[48%] bg-[color-mix(in_srgb,var(--accent-soft)_72%,var(--card))] text-accent shadow-[0_14px_35px_color-mix(in_srgb,var(--accent)_12%,transparent)]">
            <MessageCircleMore className="size-[128px]" strokeWidth={1.4} aria-hidden />
          </div>
          <div className="absolute bottom-0 right-1 flex size-[98px] items-center justify-center rounded-[45%] bg-[color-mix(in_srgb,var(--accent)_18%,var(--card))] text-accent shadow-[0_12px_28px_color-mix(in_srgb,var(--accent)_18%,transparent)]">
            <MessageCircleMore className="size-[84px] -scale-x-100" strokeWidth={1.5} aria-hidden />
          </div>
        </div>
        <h2 className="mt-7 text-[24px] font-extrabold tracking-[-0.035em] sm:text-[27px]">
          Pick a convo
        </h2>
        <p className="mx-auto mt-4 max-w-[390px] text-[14px] leading-7 text-dim sm:text-[15px]">
          Choose someone from your list, or start a fresh conversation. Your messages stay between you and them.
        </p>
        <Link to="/search" className="inline-flex min-h-11 select-none items-center justify-center font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-transparent bg-accent text-on-accent hover:[&:not(:disabled)]:brightness-105 mt-8 h-12 gap-2 rounded-full px-7 shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_22%,transparent)]">
          <Search className="size-4" aria-hidden />
          Find people
        </Link>
        <p className="mt-4 text-[10.5px] font-semibold text-dim">
          Select a conversation from the left to open it here.
        </p>
      </div>
    </div>
  );
}

export function ConvoLayout() {
  const { threadId } = useParams();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<SidePanel | null>(null);
  const [shownPanel, setShownPanel] = useState<SidePanel | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(
    readSavedSidebarWidth,
  );
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);
  const widthRef = useRef<number | null>(sidebarWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const chatOpen = Boolean(threadId);
  const composeOpen = panel?.kind === "compose";

  useEffect(() => {
    function onResize() {
      const current = widthRef.current;
      if (current == null) return;
      const next = clampSidebarWidth(current);
      if (next === current) return;
      widthRef.current = next;
      setSidebarWidth(next);
      saveSidebarWidth(next);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!resizingSidebar) return;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [resizingSidebar]);

  function applySidebarWidth(width: number, persist: boolean) {
    const next = clampSidebarWidth(width);
    widthRef.current = next;
    setSidebarWidth(next);
    if (persist) saveSidebarWidth(next);
  }

  function beginSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const pane = asideRef.current;
    if (!pane) return;
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startWidth: pane.getBoundingClientRect().width,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizingSidebar(true);
  }

  function moveSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    applySidebarWidth(
      drag.startWidth + event.clientX - drag.startX,
      false,
    );
  }

  function endSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setResizingSidebar(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (widthRef.current != null) saveSidebarWidth(widthRef.current);
  }

  function resetSidebarWidth() {
    widthRef.current = null;
    setSidebarWidth(null);
    saveSidebarWidth(null);
  }

  function resizeSidebarWithKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current =
      widthRef.current ??
      asideRef.current?.getBoundingClientRect().width ??
      360;
    applySidebarWidth(
      current + (event.key === "ArrowRight" ? 24 : -24),
      true,
    );
  }

  useEffect(() => {
    if (threadId) setPanel(null);
  }, [threadId]);

  useEffect(() => {
    if (panel) {
      setShownPanel(panel);
      setPanelVisible(true);
      return;
    }
    setPanelVisible(false);
    const timer = window.setTimeout(() => setShownPanel(null), 320);
    return () => window.clearTimeout(timer);
  }, [panel]);

  function toggleCompose() {
    setPanel((current) =>
      current?.kind === "compose" ? null : { kind: "compose" },
    );
  }

  function openSpark(
    thread: ThreadCard,
    spark: Spark | null,
    balance?: number,
  ) {
    setPanel({ kind: "spark", thread, spark, balance });
  }

  /**
   * The sheet changed something the rest of the page is showing.
   *
   * The row behind it, so a hide or a restore lands at once — and the two
   * moment lists, because the other thing this sheet can do is put a card of the
   * run on a day, and a moment that only appeared after a reload would be a
   * moment the person is not sure went up. See `MomentsPage.refreshMoments`,
   * which invalidates exactly these two for the same reason.
   */
  function refreshAfterSpark() {
    void queryClient.invalidateQueries({ queryKey: ["sparks"] });
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
    void queryClient.invalidateQueries({ queryKey: ["moments-tray"] });
    void queryClient.invalidateQueries({ queryKey: ["moments-mine"] });
  }

  return (
    <div className="relative isolate flex h-[calc(100dvh-57px)] w-full overflow-hidden md:h-dvh">
      <aside
        ref={asideRef}
        className={cn(
          "relative min-h-0 w-full shrink-0 flex-col border-line bg-[var(--pane)] md:flex md:w-[var(--convo-list-width,320px)] md:border-r lg:w-[var(--convo-list-width,360px)] xl:w-[var(--convo-list-width,390px)]",
          chatOpen ? "hidden" : "flex",
        )}
        style={
          sidebarWidth != null
            ? ({
                "--convo-list-width": `${sidebarWidth}px`,
              } as CSSProperties)
            : undefined
        }
        aria-label="Convos"
      >
        <ConvoPage
          embedded
          activeThreadId={threadId}
          composeOpen={composeOpen}
          onToggleCompose={toggleCompose}
          onOpenSpark={openSpark}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize conversation list"
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={sidebarWidth ?? undefined}
          title="Drag to resize"
          tabIndex={0}
          onPointerDown={beginSidebarResize}
          onPointerMove={moveSidebarResize}
          onPointerUp={endSidebarResize}
          onPointerCancel={endSidebarResize}
          onLostPointerCapture={endSidebarResize}
          onKeyDown={resizeSidebarWithKeyboard}
          onDoubleClick={resetSidebarWidth}
          className={cn(
            "group absolute inset-y-0 -right-[8px] z-40 hidden w-[8px] cursor-col-resize touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            panelVisible ? "lg:block" : "md:block",
          )}
        >
          <span
            className={cn(
              "pointer-events-none absolute left-[-2px] top-1/2 h-9 w-[3px] -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--ink)_16%,transparent)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
              resizingSidebar && "bg-accent opacity-100",
            )}
            aria-hidden
          />
        </div>
      </aside>
      <aside
        className={cn(
          "absolute inset-0 z-20 flex w-full flex-col overflow-hidden border-line bg-card transition-all duration-300 ease-out motion-reduce:transition-none lg:relative lg:inset-auto lg:z-auto lg:shrink-0 lg:border-r",
          panelVisible
            ? "translate-x-0 opacity-100 lg:w-[350px]"
            : "-translate-x-full opacity-0 lg:w-0 lg:translate-x-0",
          !panelVisible && "pointer-events-none",
        )}
        aria-hidden={!panelVisible}
        aria-label={shownPanel?.kind === "spark" ? "Spark" : "New convo"}
      >
        {shownPanel ? (
          <div className="h-full w-full shrink-0 lg:w-[350px]">
            {shownPanel.kind === "spark" ? (
              <SparkSheet
                open
                variant="panel"
                threadId={String(shownPanel.thread.id)}
                title={threadTitle(shownPanel.thread)}
                spark={shownPanel.spark}
                balance={shownPanel.balance}
                // The card a run can be made into is about two people, and this
                // is the one of them the row behind the sheet knows.
                face={threadFace(shownPanel.thread)}
                onClose={() => setPanel(null)}
                onChanged={refreshAfterSpark}
              />
            ) : (
              <NewConvoPanel onClose={() => setPanel(null)} />
            )}
          </div>
        ) : null}
      </aside>
      <section
        className={cn(
          "relative min-h-0 min-w-0 flex-1 flex-col bg-[color-mix(in_srgb,var(--page)_82%,transparent)]",
          chatOpen ? "flex" : "hidden md:flex",
        )}
      >
        {chatOpen ? <Outlet /> : <EmptyChatPane />}
      </section>
    </div>
  );
}
