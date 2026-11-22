import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { socialService } from "@/services/social.service";
import type { UserCard } from "@/types/api";

/** What `/social/users/{id}/follow/` answers: the gate, and what it offers now. */
interface PeopleState {
  relation?: { following?: boolean; requested?: boolean; blocked?: boolean } | null;
  cta?: string | null;
  action?: string | null;
}

export function KeepButton({
  author,
  known,
  kept,
  className,
}: {
  author: UserCard;
  /** The page already said this person is not kept, so nothing needs asking. */
  known?: boolean;
  /** The page already said this person *is* kept, so nothing needs asking. */
  kept?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [gate, setGate] = useState<PeopleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [followed, setFollowed] = useState<boolean | null>(
    known ? false : kept ? true : null,
  );
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (known || kept) return;
    let live = true;
    void socialService
      .user<{ gate?: PeopleState | null }>(author.username)
      .then((profile) => {
        if (!live) return;
        const answer = profile.gate ?? null;
        setGate(answer);
        setFollowed(answer?.relation?.following === true);
        setRequested(
          answer?.action === "withdraw" || answer?.relation?.requested === true,
        );
      })
      .catch(() => {
        if (live) setFollowed(null);
      });
    return () => {
      live = false;
    };
  }, [known, kept, author.username]);

  if (followed === null) return null;

  const on = followed || requested;

  async function tap() {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        const answer = followed
          ? await socialService.unfollow<PeopleState>(author.id)
          : await socialService.withdraw<PeopleState>(author.id);
        setFollowed(answer.relation?.following === true);
        setRequested(answer.relation?.requested === true);
        void queryClient.invalidateQueries({ queryKey: ["drops"] });
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
        void queryClient.invalidateQueries({
          queryKey: ["profile", author.username],
        });
        return;
      }
      if (gate?.action === "unblock") {
        await socialService.unblock<PeopleState>(author.id);
        setFollowed(null);
        return;
      }
      const answer = await socialService.follow<PeopleState>(author.id);
      const following = answer.relation?.following === true;
      const asked = answer.relation?.requested === true;
      setFollowed(following);
      setRequested(asked && !following);
      if (following) {
        void queryClient.invalidateQueries({ queryKey: ["drops"] });
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
        void queryClient.invalidateQueries({
          queryKey: ["profile", author.username],
        });
      } else if (asked) {
        toast({
          title: "Asked.",
          description: "They will see it when they look.",
          tone: "success",
        });
      }
    } catch (error) {
      toast({
        title: "That did not work",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void tap()}
      disabled={busy}
      onDoubleClick={(event) => {
        event.stopPropagation();
        navigate(`/profile/${author.username}`);
      }}
      className={cn(
        "flex min-h-7 shrink-0 items-center rounded-full px-[12px] text-[12px] font-extrabold transition active:scale-[.97] disabled:opacity-60",
        on
          ? "border border-[color-mix(in_srgb,var(--accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent"
          : "bg-accent text-on-accent",
        className,
      )}
    >
      {busy ? "..." : requested ? "Requested" : followed ? "Keeping" : "Keep"}
    </button>
  );
}
