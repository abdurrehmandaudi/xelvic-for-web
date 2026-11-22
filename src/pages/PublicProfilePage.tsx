import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profile.service";
import { dropsService } from "@/services/drops.service";
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
 * The app's own profile lives behind `/app`, which redirects here when it is
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

  const profileQuery = useQuery({
    queryKey: ["public-profile", username],
    // A public read is anonymous by design: no token, and no refresh attempt
    // on a 401. The gate is the answer to "not signed in", not a dead session.
    queryFn: () => profileService.byUsername(username, { skipAuth: true }),
    enabled: !authed && Boolean(username),
    retry: false,
  });

  const profile = profileQuery.data;
  const privateAccount =
    profile !== undefined && (profile.is_private === true || profile.can_view === false);

  const shelfQuery = useQuery({
    queryKey: ["public-profile-shelf", username],
    queryFn: () => dropsService.userShelf(username, undefined, { skipAuth: true }),
    enabled: !authed && Boolean(profile) && !privateAccount,
    retry: false,
  });

  usePageMeta(
    profile
      ? privateAccount
        ? metaForPrivateProfile(profile, path)
        : metaForProfile(profile, path)
      : metaForGate("profile", username, path),
  );

  if (status === "loading") return <PublicLoading next={next} />;
  if (authed) return <Navigate to={`/app/u/${encodeURIComponent(username)}`} replace />;
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
        posts={privateAccount ? [] : shelfQuery.data?.results ?? []}
        authed={false}
      />
      {!privateAccount && shelfQuery.isError && statusOf(shelfQuery.error) !== 401 ? (
        <p className="mt-4 text-center text-xs text-dim">
          The shelf could not be loaded.{" "}
          <button
            type="button"
            onClick={() => void shelfQuery.refetch()}
            className="font-bold text-accent hover:underline"
          >
            Try again
          </button>
        </p>
      ) : null}
      {!privateAccount && shelfQuery.isError && statusOf(shelfQuery.error) === 401 ? (
        <p className="mt-4 text-center text-xs text-dim">
          <a href={signInHref(next)} className="font-bold text-accent hover:underline">
            Sign in
          </a>{" "}
          to see every drop.
        </p>
      ) : null}
    </PublicShell>
  );
}
