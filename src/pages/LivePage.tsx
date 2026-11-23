import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Radio } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/States";
import { count, relativeTime } from "@/utils/format";
import { useSocketEvent } from "@/hooks/useSocket";
import { liveService, type LiveRow } from "@/services/live.service";
import { ApiError } from "@/utils/errors";
import { LivePublisher } from "@/features/live/publish";
import { GoLive, type GoLiveInfo } from "@/features/live/GoLive";
import { ControlRoom } from "@/features/live/ControlRoom";

interface Broadcast {
  publisher: LivePublisher;
  live: GoLiveInfo | null;
}

function LiveCard({ live }: { live: LiveRow }) {
  const owner = live.owner;
  const name = owner?.name || owner?.username || "Somebody";
  const viewers = live.viewers ?? 0;

  return (
    <Link
      to={`/app/live/${live.id}`}
      className="group overflow-hidden rounded-[20px] border border-line bg-card transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]"
    >
      <div className="relative flex h-28 items-center justify-center bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))]">
        <Avatar user={owner} size={56} />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-black tracking-[0.6px] text-on-accent">
          <span className="size-1.5 rounded-full bg-[var(--on-accent)] motion-safe:animate-pulse-live" />
          LIVE
        </span>
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)] px-2 py-0.5 text-[10px] font-bold text-on-accent backdrop-blur">
          <Eye className="size-3" /> {count(viewers)}
        </span>
      </div>
      <div className="p-3.5">
        <h3 className="truncate text-[15px] font-extrabold tracking-tight">{live.title || "Live"}</h3>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-dim">{name}</p>
        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-accent">
          <span>Watch</span>
          {live.started_at ? <span className="text-dim">· started {relativeTime(live.started_at)}</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function LivePage() {
  const queryClient = useQueryClient();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const broadcastRef = useRef<Broadcast | null>(null);

  useEffect(() => {
    broadcastRef.current = broadcast;
  }, [broadcast]);

  useEffect(() => {
    const beacon = () => {
      const id = broadcastRef.current?.live?.id;
      if (id) liveService.endOnLeave(id);
    };
    window.addEventListener("pagehide", beacon);
    return () => {
      window.removeEventListener("pagehide", beacon);
      const current = broadcastRef.current;
      current?.publisher.stop();
      const id = current?.live?.id;
      if (id) void liveService.endQuietly(id);
    };
  }, []);

  const lives = useQuery({
    queryKey: ["live", "now"],
    queryFn: () => liveService.shelf(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  useSocketEvent(["room.update", "room.gone"], () => {
    void queryClient.invalidateQueries({ queryKey: ["live", "now"] });
  });

  function openSetup() {
    setBroadcast({ publisher: new LivePublisher(), live: null });
  }

  function closeSetup() {
    setBroadcast((current) => {
      current?.publisher.stop();
      return null;
    });
  }

  function wentLive(live: GoLiveInfo) {
    setBroadcast((current) => (current ? { ...current, live } : current));
    void queryClient.invalidateQueries({ queryKey: ["live", "now"] });
  }

  function finished() {
    setBroadcast((current) => {
      current?.publisher.stop();
      return null;
    });
    void queryClient.invalidateQueries({ queryKey: ["live", "now"] });
  }

  const offline =
    lives.error instanceof ApiError &&
    (lives.error.status === 404 || lives.error.code === "not_found");
  const rows = lives.data?.lives ?? [];

  return (
    <div className="pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
      <PageHeader
        title="Live"
        subtitle="Broadcasts that are on right now"
        actions={
          <button
            type="button"
            onClick={openSetup}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[13px] font-bold text-on-accent transition hover:brightness-105 active:scale-[0.98]"
          >
            <Radio className="size-4" />
            Go live
          </button>
        }
      />

      <div className="mx-auto w-full max-w-[1240px] px-4 py-5 md:px-7">
        {lives.isLoading ? (
          <PageSkeleton rows={3} />
        ) : lives.isError && offline ? (
          <div className="rounded-control border border-line bg-card">
            <EmptyState
              icon={<Radio className="size-6" />}
              title="Broadcasts are not on this server"
              body="The live API is not deployed here yet, so there is nothing to watch."
            />
          </div>
        ) : lives.isError ? (
          <div className="rounded-control border border-line bg-card">
            <ErrorState error={lives.error} onRetry={() => void lives.refetch()} />
          </div>
        ) : !rows.length ? (
          <div className="rounded-control border border-line bg-card">
            <EmptyState
              icon={<Radio className="size-6" />}
              title="Nobody is live right now"
              body="When somebody goes live, their broadcast shows up here."
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((live) => (
              <LiveCard key={live.id} live={live} />
            ))}
          </div>
        )}
      </div>

      {broadcast && !broadcast.live ? (
        <GoLive publisher={broadcast.publisher} onClose={closeSetup} onLive={wentLive} />
      ) : null}
      {broadcast && broadcast.live ? (
        <ControlRoom live={broadcast.live} publisher={broadcast.publisher} onFinished={finished} />
      ) : null}
    </div>
  );
}

export default LivePage;
