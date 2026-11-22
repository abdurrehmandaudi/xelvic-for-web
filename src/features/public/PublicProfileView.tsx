import { Link } from "react-router-dom";
import { Lock, MapPin } from "lucide-react";
import { absoluteImage, PUBLIC_ROUTES } from "@/seo";
import type { Drop, Profile } from "@/types/api";
import { count } from "@/utils/format";
import { PublicAvatar, signInHref } from "./PublicShell";
import { PublicDropTile } from "./PublicPostView";

/**
 * A public profile: the person, what they have said about themselves, and the
 * things they have left open. A private account keeps its name and picture —
 * those are how it is found — but its shelf is not drawn at all.
 */
export function PublicProfileView({
  profile,
  posts,
  authed,
}: {
  profile: Profile;
  posts: Drop[];
  authed: boolean;
}) {
  const name = profile.name || profile.username;
  const path = PUBLIC_ROUTES.profile(profile.username);
  const cover = absoluteImage(profile.cover);
  const privateAccount = profile.is_private === true || profile.can_view === false;

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <section className="overflow-hidden rounded-[24px] border border-line bg-card shadow-[0_8px_24px_rgb(19_19_26_/_0.04)]">
        <div className="relative h-36 bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] sm:h-44">
          {cover ? <img src={cover} alt="" className="size-full object-cover" loading="lazy" /> : null}
        </div>
        <div className="px-5 pb-5 sm:px-7 sm:pb-6">
          <div className="-mt-10 flex items-end gap-4">
            <span className="rounded-full ring-4 ring-card">
              <PublicAvatar src={absoluteImage(profile.avatar)} name={name} size={84} />
            </span>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{name}</h1>
              <p className="truncate text-sm text-dim">@{profile.username}</p>
            </div>
            <div className="ml-auto hidden pb-1 sm:block">
              {authed ? (
                <Link
                  to={`/app/u/${encodeURIComponent(profile.username)}`}
                  className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold text-ink transition-colors hover:bg-ink-6"
                >
                  Open in Xelvic
                </Link>
              ) : (
                <Link
                  to={signInHref(path)}
                  className="inline-flex min-h-10 items-center rounded-full bg-accent px-5 text-[13px] font-bold text-on-accent transition-[filter,transform] duration-[160ms] active:scale-[0.98] hover:brightness-105"
                >
                  Follow on Xelvic
                </Link>
              )}
            </div>
          </div>

          {profile.bio ? (
            <p className="mt-4 max-w-[560px] whitespace-pre-wrap text-sm leading-6">{profile.bio}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-dim">
            {typeof profile.posts_count === "number" ? (
              <span>
                <strong className="font-extrabold text-ink">{count(profile.posts_count)}</strong> drops
              </span>
            ) : null}
            {typeof profile.followers_count === "number" ? (
              <span>
                <strong className="font-extrabold text-ink">{count(profile.followers_count)}</strong>{" "}
                followers
              </span>
            ) : null}
            {typeof profile.following_count === "number" ? (
              <span>
                <strong className="font-extrabold text-ink">{count(profile.following_count)}</strong>{" "}
                following
              </span>
            ) : null}
            {profile.professional && typeof profile.professional.location === "string" ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {profile.professional.location}
              </span>
            ) : null}
          </div>

          <div className="mt-4 sm:hidden">
            {authed ? (
              <Link
                to={`/app/u/${encodeURIComponent(profile.username)}`}
                className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[13px] font-bold text-ink"
              >
                Open in Xelvic
              </Link>
            ) : (
              <Link
                to={signInHref(path)}
                className="inline-flex min-h-10 items-center rounded-full bg-accent px-5 text-[13px] font-bold text-on-accent"
              >
                Follow on Xelvic
              </Link>
            )}
          </div>
        </div>
      </section>

      {privateAccount ? (
        <section className="mt-6 rounded-[22px] border border-line bg-card px-6 py-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] text-accent">
            <Lock className="size-5" />
          </span>
          <h2 className="mt-4 text-xl font-extrabold tracking-[-0.02em]">This account is private</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-dim">
            Follow @{profile.username} on Xelvic to see their drops, vibes and moments.
          </p>
          <Link
            to={signInHref(path)}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-[1.1rem] text-sm font-bold text-on-accent"
          >
            Sign in to follow
          </Link>
        </section>
      ) : (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold tracking-[-0.2px]">Public drops</h2>
            {authed ? (
              <Link to={`/app/u/${encodeURIComponent(profile.username)}`} className="text-[13px] font-bold text-accent hover:underline">
                See all
              </Link>
            ) : null}
          </div>
          {posts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {posts.map((drop) => (
                <PublicDropTile key={drop.id} drop={drop} />
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-line bg-card px-6 py-10 text-center text-sm text-dim">
              No public drops yet.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
