import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, WifiOff } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Blank } from "@/components/ui/Blank";
import { PageHeader } from "@/components/layout/Page";
import { VerifiedTick } from "@/components/icons/Tick";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { dropsService } from "@/services/drops.service";
import type { UserCard } from "@/types/api";

function nameOf(person: UserCard): string {
  return (person.name || person.username || "").trim();
}

export function MutedPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [lifting, setLifting] = useState<string | null>(null);

  const muted = useQuery({
    queryKey: ["drops", "muted"],
    queryFn: () => dropsService.mutedAuthors(),
  });

  const rows = muted.data ?? [];

  async function unmute(person: UserCard) {
    const id = String(person.id);
    if (lifting !== null) return;
    setLifting(id);
    try {
      await dropsService.muteAuthor(id, false);
      queryClient.setQueryData<UserCard[]>(["drops", "muted"], (current) =>
        (current ?? []).filter((row) => String(row.id) !== id),
      );
      void queryClient.invalidateQueries({ queryKey: ["drops"] });
      toast({ title: `You will see ${nameOf(person)} again.`, tone: "success" });
    } catch (error) {
      toast({ title: "That did not work", description: errorMessage(error), tone: "error" });
    } finally {
      setLifting(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <PageHeader title="Muted accounts" back />

      {muted.isLoading ? (
        <div className="flex justify-center py-16">
          <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : muted.isError ? (
        <Blank
          top="pt-20"
          icon={<WifiOff className="size-[46px]" />}
          title="No answer from the server"
          line={errorMessage(muted.error)}
          action={
            <button
              type="button"
              className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control border border-line bg-card px-[1.1rem] font-bold tracking-[-0.01em] text-ink transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft hover:border-accent-30 hover:bg-accent-5 active:scale-[0.98] mt-4"
              onClick={() => void muted.refetch()}
            >
              Try again
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <Blank
          icon={<BellOff className="size-[46px]" />}
          title="Nobody is muted"
          line="Anyone you mute turns up here, so you can unmute them later."
        />
      ) : (
        <div className="space-y-2 px-4 pb-[30px] pt-2">
          {rows.map((person) => {
            const name = nameOf(person);
            const id = String(person.id);
            const busy = lifting === id;
            return (
              <div
                key={id}
                className="flex items-center rounded-[16px] border border-line bg-card px-3 py-2.5"
              >
                <Link
                  to={`/app/u/${person.username}`}
                  className="flex min-w-0 flex-1 items-center"
                >
                  <Avatar name={name} src={person.avatar} size={44} />
                  <span className="ml-3 min-w-0 flex-1">
                    <span className="flex items-center">
                      <span className="truncate text-[15px] font-bold">{name}</span>
                      {person.verified ? (
                        <span className="ml-1 flex shrink-0">
                          <VerifiedTick size={14} />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center text-[12.5px] text-dim">
                      @{person.username ?? ""}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={lifting !== null}
                  onClick={() => void unmute(person)}
                  aria-label={`Unmute ${name}`}
                  title={`Unmute ${name}`}
                  className="ml-2 inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-3 py-2 text-[13px] font-bold text-accent transition hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {busy ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  ) : (
                    "Unmute"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}