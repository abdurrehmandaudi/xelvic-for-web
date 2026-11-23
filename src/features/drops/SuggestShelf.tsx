import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { socialService, type Suggestion } from "@/services/social.service";
import { fetchSuggestions, SUGGEST_WORDS, type SuggestKind } from "./suggest";

export function SuggestShelf({
  kind,
  moments = false,
  onShown,
  onClose,
  onCut,
  onEmpty,
  className,
}: {
  kind: SuggestKind;
  moments?: boolean;
  onShown?: (kind: SuggestKind) => void;
  onClose?: () => void;
  onCut?: () => void;
  onEmpty?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [people, setPeople] = useState<Suggestion[] | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const saidShown = useRef(false);
  const saidEmpty = useRef(false);
  const told = useRef({ onShown, onEmpty });
  told.current = { onShown, onEmpty };

  useEffect(() => {
    let live = true;
    void fetchSuggestions(kind).then((rows) => {
      if (!live) return;
      setPeople(rows);
      if (!rows.length) {
        if (!saidEmpty.current) {
          saidEmpty.current = true;
          told.current.onEmpty?.();
        }
        return;
      }
      if (!saidShown.current) {
        saidShown.current = true;
        told.current.onShown?.(kind);
      }
    });
    return () => {
      live = false;
    };
  }, [kind]);

  const word = useMemo(() => SUGGEST_WORDS[kind], [kind]);

  async function keep(person: Suggestion) {
    const id = String(person.id);
    if (busy.has(id) || person.following || kept.has(id) || requested.has(id)) {
      return;
    }
    setBusy((current) => new Set(current).add(id));
    try {
      const answer = await socialService.follow<{
        relation?: { following?: boolean; requested?: boolean } | null;
      }>(id);
      const following = answer.relation?.following === true;
      const asked = answer.relation?.requested === true;
      setKept((current) => (following ? new Set(current).add(id) : current));
      setRequested((current) => (asked && !following ? new Set(current).add(id) : current));
      if (following) {
        void queryClient.invalidateQueries({ queryKey: ["drops"] });
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
        void queryClient.invalidateQueries({ queryKey: ["profile", person.username] });
      }
    } catch (error) {
      toast({ title: "That did not work", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  if (people !== null && people.length === 0) return null;
  if (people === null) {
    return (
      <section
        className={cn(
          "rounded-[20px] border border-line bg-card p-4 shadow-[0_8px_24px_rgb(19_19_26_/_0.04)]",
          className,
        )}
        aria-hidden
      >
        <div className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-3 w-40 rounded-full" />
        <div className="mt-3 flex gap-2.5">
          {[0, 1, 2, 3].map((at) => (
            <div key={at} className="w-[104px] shrink-0 space-y-2">
              <div className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] mx-auto size-14 rounded-full" />
              <div className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-2.5 w-16 rounded-full" />
              <div className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-[20px] border border-line bg-card px-4 pb-4 pt-3.5 shadow-[0_8px_24px_rgb(19_19_26_/_0.04)]",
        className,
      )}
      aria-label="People you may know"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold tracking-[-0.2px]">People you may know</h2>
        {moments ? (
          <button
            type="button"
            onClick={onCut}
            className="flex size-9 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink"
            aria-label="Cut this section"
          >
            <X className="size-[18px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink"
            aria-label="Close"
          >
            <X className="size-[18px]" />
          </button>
        )}
      </div>
      <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {people.map((person) => {
          const id = String(person.id);
          const name = person.name.trim() || person.username;
          const isKept = person.following === true || kept.has(id);
          const isRequested = requested.has(id);
          const isBusy = busy.has(id);
          const done = isKept || isRequested;
          return (
            <div key={id} className="w-[104px] shrink-0">
              <button
                type="button"
                onClick={() => navigate(`/app/u/${encodeURIComponent(person.username)}`)}
                className="block w-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="mx-auto block w-fit">
                  <Avatar user={person} name={name} size={56} />
                </span>
                <span className="mt-1.5 block truncate text-[13px] font-bold tracking-[-0.1px] text-ink">
                  {name}
                </span>
                <span className="block truncate text-[11px] font-medium text-dim">
                  @{person.username}
                </span>
              </button>
              <p className="mt-1 truncate text-center text-[10.5px] font-semibold text-dim">
                {word}
              </p>
              <button
                type="button"
                onClick={() => void keep(person)}
                disabled={done || isBusy}
                aria-pressed={done}
                className={cn(
                  "mx-auto mt-1.5 flex h-[26px] min-w-[64px] items-center justify-center gap-1 rounded-full border px-3 text-[11.5px] font-bold tracking-[-0.1px] transition disabled:cursor-default",
                  done
                    ? "border-line bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim"
                    : "border-[color-mix(in_srgb,var(--accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] text-accent hover:brightness-105",
                )}
              >
                {isKept ? <CheckCircle2 className="size-3" aria-hidden /> : null}
                {isBusy ? "..." : isKept ? "Kept" : isRequested ? "Requested" : "Keep"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default SuggestShelf;
