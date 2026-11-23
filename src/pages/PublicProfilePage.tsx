import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import publicService from "@/services/public.service";
import { ApiError } from "@/utils/errors";
import { usePageMeta } from "@/seo";
import {
  metaForGate,
  metaForPrivateProfile,
  metaForProfile,
  PUBLIC_ROUTES,
} from "@/seo";
import { PublicProfileView } from "@/features/public/PublicProfileView";
import { PublicGate, PublicLoading, PublicShell, signInHref } from "@/features/public/PublicShell";
import { ErrorState } from "@/components/ui/States";

function statusOf(error: unknown): number {
  return error instanceof ApiError ? error.status : 0;
}

/**
 * `/u/:username` — somebody's page for a visitor without an account.
 *
 * The signed-in app's own profile lives at `/profile`, which redirects here when it is
 * opened without a session. This page draws what a stranger is allowed to see:
 * the name and picture, the public shelf, and one door to sign in. A private
 * account keeps its name — Instagram-style — and draws a lock instead of the
 * shelf. The server decides all of that; this page never guesses `can_view`.
 */
export function PublicProfilePage() {
  const { username = "" } = useParams();
  const { status } = useAuth();
  const location = useLocation();
  const path = PUBLIC_ROUTES.profile(username);
  const next = location.pathname + location.search;
  const authed = status === "authenticated";

  // One anonymous read answers the whole page — the person and the posts they
  // have left open — which is what `/public/profile/` exists for. The old pair
  // of signed-in routes (`/auth/users/`, `/drops/users/`) answered 401 to a
  // stranger, which is why the page used to fall through to "sign in".
  const profileQuery = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => publicService.profile(username),
    enabled: !authed && Boolean(username),
    retry: false,
  });

  const profile = profileQuery.data?.profile;
  const privateAccount =
    profile !== undefined && (profile.is_private === true || profile.can_view === false);

  // The shelf rides in the same answer; see the query above.
  const posts = privateAccount ? [] : (profileQuery.data?.posts ?? []);

  usePageMeta(
    profile
      ? privateAccount
        ? metaForPrivateProfile(profile, path)
        : metaForProfile(profile, path)
      : metaForGate("profile", username, path),
  );

  if (status === "loading") return <PublicLoading next={next} />;
  if (authed) return <Navigate to={`/profile/${encodeURIComponent(username)}`} replace />;
  if (profileQuery.isLoading) return <PublicLoading next={next} />;

  if (profileQuery.isError) {
    const code = statusOf(profileQuery.error);
    if (code === 401 || code === 403) {
      return (
        <PublicGate
          title={`@${username} on Xelvic`}
          description="Sign in to see this profile and what they share."
          next={next}
        />
      );
    }
    if (code === 404 || code === 410) {
      return <PublicGate title="This profile is not here" description="The address may be old, or the account may be closed." next={next} />;
    }
    return (
      <PublicShell next={next}>
        <div className="rounded-[20px] border border-line bg-card">
          <ErrorState
            error={profileQuery.error instanceof Error ? profileQuery.error : new Error("This profile could not be opened.")}
            onRetry={() => void profileQuery.refetch()}
          />
        </div>
      </PublicShell>
    );
  }

  if (!profile) {
    return (
      <PublicGate
        title={`@${username} on Xelvic`}
        description="Sign in to see this profile and what they share."
        next={next}
      />
    );
  }

  return (
    <PublicShell next={next}>
      <PublicProfileView
        profile={profile}
        posts={posts}
        authed={false}
      />
      {/* The whole page answers in one anonymous read now, so a shelf that
          could not be loaded is the same failure as a profile that could not —
          the gate above has already said it. */}
      {!privateAccount && posts.length === 0 && !profileQuery.isLoading ? (
        <p className="mt-4 text-center text-xs text-dim">
          <a href={signInHref(next)} className="font-bold text-accent hover:underline">
            Sign in
          </a>{" "}
          to see everything this person shares.
        </p>
      ) : null}
    </PublicShell>
  );
}
