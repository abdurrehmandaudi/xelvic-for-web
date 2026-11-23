import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Blank } from "@/components/ui/Blank";
import { VerifiedTick } from "@/components/icons/Tick";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { socialService } from "@/services/social.service";
import { errorMessage } from "@/utils/errors";
import type { UserCard } from "@/types/api";

function nameOf(person: UserCard): string {
  return (person.name || person.username || "").trim();
}

export function BlockedView() {
  const { t } = usePreferences();
  const { toast } = useToast();
  const client = useQueryClient();
  const [lifting, setLifting] = useState<string | null>(null);

  const people = useQuery({
    queryKey: ["settings-blocked"],
    queryFn: () => socialService.blocked(),
  });

  const rows = people.data ?? [];

  async function unblock(person: UserCard) {
    const id = String(person.id);
    if (lifting !== null) return;
    setLifting(id);
    try {
      await socialService.unblock(id);
      client.setQueryData<UserCard[]>(["settings-blocked"], (current) =>
        (current ?? []).filter((row) => String(row.id) !== id),
      );
      toast({ title: t(`${nameOf(person)} is unblocked.`), tone: "success" });
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setLifting(null);
    }
  }

  if (people.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (people.isError) {
    return (
      <Blank
        top="pt-20"
        icon={<WifiOff className="size-[46px]" />}
        title={t("No answer from the server")}
        line={people.error instanceof Error ? people.error.message : ""}
        action={
          <button
            type="button"
            className="inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-[1.1rem] font-bold tracking-[-0.01em] transition-[transform,background-color,color,border-color,opacity] duration-[160ms] ease-out-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 border border-line bg-card text-ink hover:[&:not(:disabled)]:border-accent-30 hover:[&:not(:disabled)]:bg-accent-5 mt-4"
            onClick={() => void people.refetch()}
          >
            {t("Try again")}
          </button>
        }
      />
    );
  }

  if (rows.length === 0) {
    return (
      <Blank
        icon={<Ban className="size-[46px]" />}
        title={t("Nobody is blocked")}
        line={t("Anyone you block turns up here, so you can undo it later.")}
      />
    );
  }

  return (
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
              onClick={() => void unblock(person)}
              aria-label={t(`Unblock ${name}`)}
              title={t(`Unblock ${name}`)}
              className="ml-2 inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-3 py-2 text-[13px] font-bold text-accent transition hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? (
                <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : (
                t("Unblock")
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}