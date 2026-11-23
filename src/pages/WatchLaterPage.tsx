import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, X } from "lucide-react";
import { AuthedImage } from "@/components/media/Media";
import { PageHeader } from "@/components/layout/Page";
import { Blank } from "@/components/ui/Blank";
import { Spinner } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { videosService } from "@/services/videos.service";
import { useToast } from "@/hooks/useToast";
import { ago, duration } from "@/utils/format";
import type { Drop } from "@/types/api";

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

export function WatchLaterPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [removing, setRemoving] = useState<string | null>(null);

  const queue = useQuery({
    queryKey: ["videos", "later"],
    queryFn: () => videosService.later(),
    staleTime: 15_000,
  });

  const rows = useMemo(
    () =>
      (queue.data?.items ?? []).flatMap((item) =>
        item.kind === "drop" && item.drop ? [{ drop: item.drop, at: item.at }] : [],
      ),
    [queue.data],
  );

  async function remove(drop: Drop) {
    setRemoving(String(drop.id));
    try {
      await videosService.setLater({ kind: "drop", id: drop.id, on: false });
      await queryClient.invalidateQueries({ queryKey: ["videos", "later"] });
    } catch (error) {
      toast({
        title: "Could not take that off",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] text-ink md:pb-16">
      <PageHeader title="Watch later" back />

      <main className="mx-auto w-full max-w-[680px] px-2">
        {queue.isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : queue.isError ? (
          <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
        ) : !rows.length ? (
          <Blank
            icon={<Clock className="size-[46px]" />}
            title="Nothing waiting"
            line="Clips you put in Watch later show up here, in the order you queued them."
          />
        ) : (
          <>
            <p className="px-2 pb-1 pt-2 text-[11.5px] font-semibold text-dim">
              {rows.length === 1 ? "1 clip waiting" : `${rows.length} clips waiting`}
            </p>
            {rows.map(({ drop, at }) => {
              const title = titleOf(drop);
              const length = lengthOf(drop);
              const poster = posterOf(drop);
              const author = drop.author.name || drop.author.username;
              const meta = [author, at ? `Saved ${ago(at)}` : ""].filter(Boolean).join(" · ");
              return (
                <div
                  key={String(drop.id)}
                  className="flex items-start gap-2 rounded-[14px] py-[9px] pl-3.5 pr-1.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
                >
                  <Link
                    to={`/app/drops/${encodeURIComponent(drop.id)}`}
                    className="flex min-w-0 flex-1 items-start gap-3"
                    aria-label={title}
                  >
                    <div className="relative h-[70px] w-[124px] shrink-0 overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_6%,var(--card))]">
                      {poster ? (
                        <AuthedImage src={poster} alt="" className="size-full object-cover" quiet />
                      ) : null}
                      {length ? (
                        <span className="absolute bottom-[5px] right-[5px] rounded-[3px] bg-[color-mix(in_srgb,var(--solid)_72%,transparent)] px-1 py-px text-[10.5px] font-bold text-on-accent">
                          {length}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="line-clamp-2 text-[14px] font-bold leading-snug">{title}</p>
                      <p className="mt-1 truncate text-[12px] text-dim">{meta}</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(drop)}
                    disabled={removing === String(drop.id)}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-ink-6 hover:text-ink disabled:opacity-50"
                    aria-label={`Remove ${title} from Watch later`}
                  >
                    <X className="size-[18px]" />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}

export default WatchLaterPage;