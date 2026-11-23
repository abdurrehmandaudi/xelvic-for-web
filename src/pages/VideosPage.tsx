import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Clapperboard, Clock, Play, Radio } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Blank } from "@/components/ui/Blank";
import { Button } from "@/components/ui/Button";
import { AuthedImage } from "@/components/media/Media";
import { Modal } from "@/components/overlays/Modal";
import { ErrorState } from "@/components/ui/States";
import { apiPathFrom } from "@/config/urls";
import { videosService } from "@/services/videos.service";
import { liveService } from "@/services/live.service";
import { useAuth } from "@/hooks/useAuth";
import { ago, count, duration } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Drop } from "@/types/api";

const CHIPS_SHOWN = 5;

interface Chip {
  id: string;
  name: string;
  count?: number;
}

const ALL: Chip = { id: "", name: "All" };

function cursorFrom(next: string | null | undefined): string | null {
  const path = apiPathFrom(next);
  if (!path) return null;
  const query = path.split("?")[1];
  if (!query) return null;
  return new URLSearchParams(query).get("cursor");
}

function titleOf(drop: Drop): string {
  return drop.title?.trim() || drop.body.trim() || "A clip";
}

function lengthOf(drop: Drop): string {
  const ms = drop.asset?.duration_ms;
  return typeof ms === "number" && ms > 0 ? duration(ms / 1000) : "";
}

function posterOf(drop: Drop): string | null {
  return drop.asset?.thumbnail_url || drop.asset?.content_url || null;
}

function VideoRow({ drop }: { drop: Drop }) {
  const title = titleOf(drop);
  const length = lengthOf(drop);
  const poster = posterOf(drop);
  const author = drop.author.name || drop.author.username;
  const views =
    typeof drop.views === "number"
      ? `${count(drop.views)} ${drop.views === 1 ? "view" : "views"}`
      : "";
  const meta = [author, views, ago(drop.created_at)].filter(Boolean).join(" · ");

  return (
    <article className="pb-6">
      <Link
        to={`/drops/${encodeURIComponent(drop.id)}`}
        className="group block"
        aria-label={title}
      >
        <div className="relative aspect-video overflow-hidden rounded-[16px] bg-[color-mix(in_srgb,var(--ink)_6%,var(--card))]">
          {poster ? (
            <AuthedImage
              src={poster}
              alt=""
              className="size-full object-cover transition duration-300 group-hover:scale-[1.01]"
              quiet
            />
          ) : null}
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_52%,transparent)] text-on-accent backdrop-blur-sm transition group-hover:bg-[color-mix(in_srgb,var(--solid)_68%,transparent)]">
              <Play className="ml-0.5 size-5 fill-current" aria-hidden />
            </span>
          </span>
          {length ? (
            <span className="absolute bottom-2 right-2 rounded-[4px] bg-[color-mix(in_srgb,var(--solid)_72%,transparent)] px-[5px] py-0.5 text-[11.5px] font-bold text-on-accent">
              {length}
            </span>
          ) : null}
        </div>
        <div className="flex items-start gap-3 pt-2.5">
          <Avatar name={author} src={drop.author.avatar} size={36} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15px] font-semibold leading-[1.25]">{title}</p>
            <p className="mt-1 truncate text-[12.5px] text-dim">{meta}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}

function VideoSkeleton() {
  return (
    <div className="pb-6" aria-hidden>
      <div className="relative aspect-video overflow-hidden rounded-[16px] bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
      <div className="flex items-start gap-3 pt-2.5">
        <div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="relative h-3 w-4/5 overflow-hidden rounded-full bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
          <div className="relative h-2.5 w-2/5 overflow-hidden rounded-full bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
        </div>
      </div>
    </div>
  );
}

export function VideosPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const catalogue = useQuery({
    queryKey: ["videos", "categories"],
    queryFn: () => videosService.categories(),
    staleTime: 300_000,
    retry: false,
  });

  const entries = useMemo<Chip[]>(
    () => [
      ALL,
      ...(catalogue.data?.categories ?? []).map((one) => ({
        id: one.id,
        name: one.name,
        count: one.count,
      })),
    ],
    [catalogue.data],
  );

  const { shown, rest } = useMemo(() => {
    if (entries.length <= CHIPS_SHOWN) return { shown: entries, rest: [] as Chip[] };
    const row = entries.slice(0, CHIPS_SHOWN);
    const chosenAt = entries.findIndex((entry) => entry.id === category);
    if (chosenAt >= CHIPS_SHOWN) row[CHIPS_SHOWN - 1] = entries[chosenAt];
    const picked = new Set(row.map((entry) => entry.id));
    return { shown: row, rest: entries.filter((entry) => !picked.has(entry.id)) };
  }, [entries, category]);

  const feed = useInfiniteQuery({
    queryKey: ["videos", "feed", category],
    queryFn: ({ pageParam }) =>
      videosService.feed({ category: category || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => cursorFrom(last.next),
    staleTime: 60_000,
  });

  const posts = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages ?? []).flatMap((page) => page.results ?? []).filter((drop) => {
      if (seen.has(String(drop.id))) return false;
      seen.add(String(drop.id));
      return true;
    });
  }, [feed.data]);

  const foot = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const node = foot.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        void fetchNextPage();
      },
      { rootMargin: "1400px 0px" },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, posts.length]);

  return (
    <div className="min-h-dvh text-ink">
      <header className="sticky top-0 z-30 bg-[color-mix(in_srgb,var(--page)_90%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[760px] items-center gap-3 px-4 pb-1.5 pt-2.5 md:px-6">
          <Link to={user ? `/profile/${user.username}` : "/drops"} aria-label="Your profile">
            <Avatar user={user} name={user?.name} size={40} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-extrabold leading-6 tracking-[-0.4px]">Videos</h1>
            <p className="truncate text-[12px] text-dim">Latest clips · Ranked for you</p>
          </div>
          <Link
            to="/videos/watch-later"
            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94] -mr-1"
            aria-label="Watch later"
          >
            <Clock className="size-[19px]" />
          </Link>
        </div>
      </header>

      <LiveStrip />

      <main className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
        {entries.length > 1 ? (
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 py-2.5 md:px-6">
            {shown.map((entry) => {
              const active = entry.id === category;
              return (
                <button
                  key={entry.id || "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(entry.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition",
                    active
                      ? "border-accent/40 bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] text-accent"
                      : "border-line bg-card text-ink hover:border-accent/35",
                  )}
                >
                  {entry.name}
                </button>
              );
            })}
            {rest.length ? (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="shrink-0 rounded-full border border-line bg-card px-3.5 py-1.5 text-[12.5px] font-bold text-dim transition hover:border-accent/35 hover:text-ink"
              >
                More
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="px-4 pt-1 md:px-6">
          {feed.isLoading ? (
            <>
              <VideoSkeleton />
              <VideoSkeleton />
              <VideoSkeleton />
            </>
          ) : feed.isError ? (
            <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
          ) : !posts.length ? (
            <Blank
              icon={<Clapperboard className="size-[46px]" />}
              title={feed.data?.pages?.[0]?.caught_up ? "You have watched everything" : "No clips yet"}
              line={
                feed.data?.pages?.[0]?.caught_up
                  ? "New clips turn up here as people post them."
                  : "When somebody posts a clip, it shows up here."
              }
              action={
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => void feed.refetch()}>
                  Look again
                </Button>
              }
            />
          ) : (
            posts.map((drop) => <VideoRow key={String(drop.id)} drop={drop} />)
          )}

          {feed.isFetchingNextPage ? (
            <div className="flex justify-center py-4">
              <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : null}
        </div>

        <div ref={foot} className="h-px" />
      </main>

      <Modal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Topics"
        description="Every shelf with enough clips to be a page."
      >
        <div className="p-2 pb-3">
          {rest.map((entry) => (
            <button
              key={entry.id || "all"}
              type="button"
              onClick={() => {
                setCategory(entry.id);
                setMoreOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            >
              <span className="text-[13.5px] font-bold">{entry.name}</span>
              {typeof entry.count === "number" ? (
                <span className="text-[11.5px] text-dim">
                  {entry.count} {entry.count === 1 ? "clip" : "clips"}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default VideosPage;
function LiveStrip() {
  const lives = useQuery({
    queryKey: ["live", "now"],
    queryFn: () => liveService.shelf(),
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const rows = lives.data?.lives ?? [];
  if (!rows.length) return null;
  return (
    <section className="mx-auto w-full max-w-[760px] px-4 pt-3 md:px-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-ink">
          <Radio className="size-3.5 text-accent" />
          Live now
        </p>
        <Link to="/videos" className="text-[11.5px] font-bold text-accent">
          See all
        </Link>
      </div>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
        {rows.map((row) => (
          <Link
            key={row.id}
            to={`/videos/${row.id}`}
            className="flex w-[190px] shrink-0 items-center gap-2.5 rounded-[16px] border border-line bg-card px-3 py-2.5 transition hover:border-accent/40"
          >
            {row.owner ? (
              <Avatar
                user={{
                  name: row.owner.name,
                  username: row.owner.username,
                  avatar: row.owner.avatar,
                }}
                size={34}
              />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-bold">
                {row.title || row.owner?.name || "Live"}
              </span>
              <span className="block truncate text-[10.5px] text-dim">
                {count(row.viewers)} watching
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
