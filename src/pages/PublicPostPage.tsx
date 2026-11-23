import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import publicService from "@/services/public.service";
import { ApiError } from "@/utils/errors";
import { usePageMeta } from "@/seo";
import { metaForDrop, metaForGate, PUBLIC_ROUTES } from "@/seo";
import type { Drop } from "@/types/api";
import { ErrorState } from "@/components/ui/States";
import { PublicGate, PublicLoading, PublicShell } from "@/features/public/PublicShell";
import { PublicPostView } from "@/features/public/PublicPostView";

function statusOf(error: unknown): number {
  return error instanceof ApiError ? error.status : 0;
}

/**
 * A shared drop or vibe, opened without an account.
 *
 * One component answers both doors because the read is the same; only the API
 * base, the canonical address and the structured-data type differ. A signed-in
 * reader opening a drop is sent into the app, where the like and comment roads
 * already exist; a vibe has no single app route yet, so it is drawn here with
 * its actions pointed at the app. A stranger gets the same post, read-only, and
 * every write leads to `/signin` with this address as `next`.
 */
function PublicPostRoute({ kind }: { kind: "drop" | "vibe" }) {
  const params = useParams();
  const id = (kind === "vibe" ? params.vibeId : params.dropId) ?? "";
  const { status } = useAuth();
  const location = useLocation();
  const path = kind === "vibe" ? PUBLIC_ROUTES.vibe(id) : PUBLIC_ROUTES.drop(id);
  const next = location.pathname + location.search;
  const authed = status === "authenticated";

  const query = useQuery<Drop>({
    queryKey: ["public-post", kind, id],
    // The open web's own door: it answers without a session and carries no
    // reader answers, so a signed-in reader and a stranger read the same post.
    // A drop for a signed-in reader is sent into the app below; a Vibe has no
    // single app route yet, so it is drawn here for everybody.
    queryFn: async () =>
      kind === "vibe" ? publicService.vibe(id) : publicService.drop(id),
    enabled: Boolean(id) && (!authed || kind === "vibe"),
    retry: false,
  });

  usePageMeta(
    query.data
      ? metaForDrop(query.data, path, kind)
      : metaForGate(kind, id, path),
  );

  if (status === "loading") return <PublicLoading next={next} />;
  if (authed && kind === "drop") {
    return <Navigate to={`/drops/${encodeURIComponent(id)}`} replace />;
  }
  if (query.isLoading) return <PublicLoading next={next} />;

  if (query.isError) {
    const code = statusOf(query.error);
    if (code === 401 || code === 403) {
      return (
        <PublicGate
          title={kind === "vibe" ? "This vibe is on Xelvic" : "This drop is on Xelvic"}
          description="Sign in to see this post and join the conversation."
          next={next}
        />
      );
    }
    if (code === 404 || code === 410) {
      return (
        <PublicGate
          title="This post is not here"
          description="The address may be old, or the post may have been removed."
          next={next}
        />
      );
    }
    return (
      <PublicShell next={next}>
        <div className="rounded-[20px] border border-line bg-card">
          <ErrorState
            error={query.error instanceof Error ? query.error : new Error("This post could not be opened.")}
            onRetry={() => void query.refetch()}
          />
        </div>
      </PublicShell>
    );
  }

  if (!query.data) {
    return (
      <PublicGate
        title={kind === "vibe" ? "This vibe is on Xelvic" : "This drop is on Xelvic"}
        description="Sign in to see this post and join the conversation."
        next={next}
      />
    );
  }

  return (
    <PublicShell next={next}>
      <PublicPostView drop={query.data} kind={kind} authed={authed} />
    </PublicShell>
  );
}

export function PublicDropPage() {
  return <PublicPostRoute kind="drop" />;
}

export function PublicVibePage() {
  return <PublicPostRoute kind="vibe" />;
}
