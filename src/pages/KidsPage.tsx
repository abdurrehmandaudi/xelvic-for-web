import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { CloudOff, Search, Smile, X } from "lucide-react";
import { Blank } from "@/components/ui/Blank";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/Page";
import {
  KidsChips,
  KidsGamesPanel,
  KidsGrid,
  KidsSkeleton,
} from "@/features/kids/parts";
import { kidsCursor, kidsShelf, mergeNewest, type KidsShelfKey } from "@/features/kids/model";
import { kidsService } from "@/services/kids.service";
import { errorMessage } from "@/utils/errors";

export function KidsPage() {
  const [shelf, setShelf] = useState<KidsShelfKey>("all");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const clean = draft.trim();
    if (!clean) {
      setSearch("");
      return;
    }
    const timer = window.setTimeout(() => setSearch(clean), 320);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const games = shelf === "games";
  const selected = kidsShelf(shelf);
  const filter = selected.api;

  const drops = useInfiniteQuery({
    queryKey: ["kids", "drops", shelf, search],
    queryFn: ({ pageParam }) =>
      kidsService.shelf({
        shelf: filter,
        q: search || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => kidsCursor(last.next),
    enabled: !games,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const vibes = useInfiniteQuery({
    queryKey: ["kids", "vibes", shelf, search],
    queryFn: ({ pageParam }) =>
      kidsService.vibes({
        shelf: filter,
        q: search || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => kidsCursor(last.next),
    enabled: !games,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const rows = useMemo(
    () =>
      mergeNewest(
        (drops.data?.pages ?? []).flatMap((page) => page.results ?? []),
        (vibes.data?.pages ?? []).flatMap((page) => page.results ?? []),
      ),
    [drops.data, vibes.data],
  );

  const foot = useRef<HTMLDivElement>(null);
  const hasNext = drops.hasNextPage || vibes.hasNextPage;
  const fetchingNext = drops.isFetchingNextPage || vibes.isFetchingNextPage;
  const dropsNext = drops.hasNextPage;
  const vibesNext = vibes.hasNextPage;
  const fetchDropsNext = drops.fetchNextPage;
  const fetchVibesNext = vibes.fetchNextPage;

  useEffect(() => {
    const node = foot.current;
    if (games || !node || !hasNext || fetchingNext) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (dropsNext) void fetchDropsNext();
        if (vibesNext) void fetchVibesNext();
      },
      { rootMargin: "1400px 0px" },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [games, hasNext, fetchingNext, dropsNext, vibesNext, fetchDropsNext, fetchVibesNext, rows.length]);

  const busy = drops.isLoading || vibes.isLoading;
  const asked = !busy && !games;
  const failed = asked && !rows.length && (drops.isError || vibes.isError);
  const empty = asked && !rows.length && !drops.isError && !vibes.isError;
  const partial = rows.length > 0 && (drops.isError || vibes.isError);

  function retry() {
    void drops.refetch();
    void vibes.refetch();
  }

  const emptyTitle = search
    ? `No matches for “${search}”`
    : shelf === "all"
      ? "Nothing here yet"
      : `${selected.label} is empty right now`;
  const emptyLine = search
    ? "Try another word, or pick a different shelf."
    : shelf === "all"
      ? "When a picture, story or clip is made for kids, it shows up here."
      : "There is nothing on this shelf yet.";

  return (
    <div className="min-h-dvh pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-20">
      <PageHeader title="Kids" subtitle="Pictures, stories and clips for young eyes" back />

      <main className="mx-auto w-full max-w-[1240px] px-4 pt-3 md:px-7">
        <KidsChips value={shelf} onChange={setShelf} />

        {games ? (
          <div className="pt-5">
            <KidsGamesPanel />
          </div>
        ) : (
          <>
            <form
              className="mt-4 flex items-center gap-2 rounded-[18px] border border-line bg-card px-4 focus-within:border-accent/50"
              onSubmit={(event) => event.preventDefault()}
            >
              <Search className="size-5 shrink-0 text-dim" aria-hidden />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Search this shelf"
                aria-label="Search this shelf"
                className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-dim"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              {draft ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft("");
                    setSearch("");
                  }}
                  aria-label="Clear search"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-ink-6 hover:text-ink"
                >
                  <X className="size-5" aria-hidden />
                </button>
              ) : null}
            </form>

            <div className="pt-5">
              {busy && !rows.length ? (
                <KidsSkeleton />
              ) : failed ? (
                <Blank
                  top=""
                  icon={<CloudOff className="size-[46px]" />}
                  title="Could not load Kids"
                  line={errorMessage(drops.error ?? vibes.error)}
                  action={
                    <Button variant="secondary" size="md" className="mt-4" onClick={retry}>
                      Try again
                    </Button>
                  }
                />
              ) : empty ? (
                <Blank
                  top=""
                  icon={<Smile className="size-[46px]" />}
                  title={emptyTitle}
                  line={emptyLine}
                  action={
                    <Button variant="secondary" size="md" className="mt-4" onClick={retry}>
                      Look again
                    </Button>
                  }
                />
              ) : (
                <>
                  <KidsGrid rows={rows} />
                  {fetchingNext ? (
                    <div className="flex justify-center py-7">
                      <span className="size-6 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
                    </div>
                  ) : null}
                  {partial ? (
                    <div className="mt-6 flex flex-col items-center gap-3 rounded-[20px] border border-line bg-card px-5 py-6 text-center">
                      <CloudOff className="size-7 text-dim" aria-hidden />
                      <p className="text-[13.5px] font-semibold text-dim">
                        Part of this shelf could not load.
                      </p>
                      <Button variant="secondary" size="md" onClick={retry}>
                        Try again
                      </Button>
                    </div>
                  ) : !hasNext ? (
                    <p className="py-8 text-center text-[13px] font-semibold text-dim">
                      That is everything on this shelf.
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <div ref={foot} className="h-px" />
          </>
        )}
      </main>
    </div>
  );
}

export default KidsPage;