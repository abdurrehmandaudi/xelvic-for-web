import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  MapPin,
  MessageCircle,
  Share2,
} from "lucide-react";
import { absoluteImage, PUBLIC_ROUTES } from "@/seo";
import type { Drop } from "@/types/api";
import { mountedPath } from "@/utils/asset";
import { count } from "@/utils/format";
import { PublicAvatar, signInHref } from "./PublicShell";

/**
 * One post, read by somebody who is not signed in.
 *
 * The same facts the feed draws are here — the person, the words, the picture
 * or clip, the place, the counts — but nothing that writes. Like, comment and
 * follow lead to the sign-in door with this address as `next`, so the visitor
 * lands back on the post they were reading.
 */

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PublicMedia({ drop }: { drop: Drop }) {
  const [failed, setFailed] = useState(false);
  const asset = drop.asset;
  if (!asset) return null;

  const source = absoluteImage(asset.content_url);
  const poster = absoluteImage(asset.thumbnail_url) ?? undefined;
  const label = drop.body.trim().slice(0, 120) || "A post on Xelvic";

  if (failed) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[16px] bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] text-center text-xs text-dim">
        This file could not be shown.
      </div>
    );
  }

  if (drop.kind === "video" || drop.kind === "vibe") {
    return source ? (
      <video
        controls
        playsInline
        preload="metadata"
        poster={poster}
        className="max-h-[70vh] w-full rounded-[16px] bg-black object-contain"
        onError={() => setFailed(true)}
      >
        <source src={source} />
      </video>
    ) : (
      poster ? (
        <img src={poster} alt={label} className="w-full rounded-[16px] object-cover" />
      ) : null
    );
  }

  if (drop.kind === "audio" || asset.kind === "audio" || asset.kind === "voice") {
    return source ? (
      <audio controls src={source} className="w-full" onError={() => setFailed(true)} />
    ) : null;
  }

  if (drop.kind === "image" || asset.kind === "image") {
    const images = [asset, ...(drop.gallery ?? [])].filter(
      (item, index, all) => all.findIndex((other) => other.id === item.id) === index,
    );
    return (
      <div className={images.length > 1 ? "grid grid-cols-2 gap-1.5" : ""}>
        {images.slice(0, 4).map((image) => {
          const src = absoluteImage(image.content_url) ?? absoluteImage(image.thumbnail_url);
          if (!src) return null;
          return (
            <img
              key={image.id}
              src={src}
              alt={label}
              loading="lazy"
              className="max-h-[70vh] w-full rounded-[16px] object-cover"
              onError={() => setFailed(true)}
            />
          );
        })}
      </div>
    );
  }

  return null;
}

function PublicPoll({ drop }: { drop: Drop }) {
  const poll = drop.poll;
  if (!poll?.options?.length) return null;
  return (
    <ul className="space-y-2">
      {poll.options.map((option) => (
        <li key={option.id}>
          <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-card px-3.5 py-2.5 text-sm">
            <span className="min-w-0 truncate">{option.text}</span>
            {typeof option.votes === "number" ? (
              <span className="text-xs text-dim">{count(option.votes)}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${mountedPath(path)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Xelvic", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // A refused share sheet is not an error worth shouting about.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-dim transition-colors hover:bg-ink-6 hover:text-ink"
    >
      <Share2 className="size-[18px]" aria-hidden />
      <span>{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}

export function PublicPostView({
  drop,
  kind,
  authed,
}: {
  drop: Drop;
  kind: "drop" | "vibe";
  authed: boolean;
}) {
  const path = kind === "vibe" ? PUBLIC_ROUTES.vibe(drop.id) : PUBLIC_ROUTES.drop(drop.id);
  const next = path;
  const author = drop.author;
  const authorName = author.name || author.username;

  return (
    <article className="mx-auto w-full max-w-[680px] overflow-hidden rounded-[22px] border border-line bg-card shadow-[0_8px_24px_rgb(19_19_26_/_0.04)]">
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <Link to={PUBLIC_ROUTES.profile(author.username)} aria-label={`Open ${authorName}'s profile`}>
          <PublicAvatar src={absoluteImage(author.avatar)} name={authorName} size={44} />
        </Link>
        <div className="min-w-0">
          <Link
            to={PUBLIC_ROUTES.profile(author.username)}
            className="block truncate text-sm font-extrabold tracking-[-0.01em] hover:underline"
          >
            {authorName}
          </Link>
          <p className="truncate text-xs text-dim">@{author.username}</p>
        </div>
        {author.is_private ? (
          <span className="ml-auto rounded-full bg-ink-6 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-dim">
            Private
          </span>
        ) : null}
      </div>

      {drop.body.trim() ? (
        <p className="whitespace-pre-wrap px-4 pb-3 text-[15px] leading-7 sm:px-5">{drop.body}</p>
      ) : null}

      <div className="px-2 sm:px-3">
        <PublicMedia drop={drop} />
        {drop.poll ? (
          <div className="px-2 pb-2">
            <PublicPoll drop={drop} />
          </div>
        ) : null}
      </div>

      {drop.place || drop.created_at ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 text-xs text-dim sm:px-5">
          {drop.place ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {drop.place}
            </span>
          ) : null}
          {drop.created_at ? <time dateTime={drop.created_at}>{when(drop.created_at)}</time> : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-1 px-4 pb-3 sm:px-5">
        {authed ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-semibold text-dim">
            <Heart className="size-[18px]" aria-hidden /> {count(drop.likes ?? 0)}
          </span>
        ) : (
          <Link
            to={signInHref(next)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-dim transition-colors hover:bg-ink-6 hover:text-ink"
          >
            <Heart className="size-[18px]" aria-hidden /> {count(drop.likes ?? 0)}
          </Link>
        )}
        {authed ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-semibold text-dim">
            <MessageCircle className="size-[18px]" aria-hidden /> {count(drop.comments ?? 0)}
          </span>
        ) : (
          <Link
            to={signInHref(next)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-dim transition-colors hover:bg-ink-6 hover:text-ink"
          >
            <MessageCircle className="size-[18px]" aria-hidden /> {count(drop.comments ?? 0)}
          </Link>
        )}
        <ShareButton path={path} />
      </div>

      {authed ? (
        <div className="border-t border-line px-4 py-3 text-center text-xs text-dim sm:px-5">
          Open Xelvic to like, comment and follow.
        </div>
      ) : (
        <div className="border-t border-line bg-[color-mix(in_srgb,var(--accent)_6%,var(--card))] px-4 py-3 text-center text-xs leading-5 text-dim sm:px-5">
          <Link to={signInHref(next)} className="font-bold text-accent hover:underline">
            Sign in to Xelvic
          </Link>{" "}
          to like, comment and follow.
        </div>
      )}
    </article>
  );
}

/** One square in a public profile's shelf. */
export function PublicDropTile({ drop }: { drop: Drop }) {
  const isVibe = drop.kind === "vibe";
  const path = isVibe ? PUBLIC_ROUTES.vibe(drop.id) : PUBLIC_ROUTES.drop(drop.id);
  const image =
    absoluteImage(drop.asset?.thumbnail_url) ??
    absoluteImage(drop.asset?.content_url) ??
    absoluteImage(drop.gallery?.[0]?.thumbnail_url) ??
    absoluteImage(drop.gallery?.[0]?.content_url);
  const text = drop.body.trim().split(/\r?\n/)[0] ?? "";

  return (
    <Link
      to={path}
      className="group relative block aspect-square overflow-hidden rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))]"
    >
      {image ? (
        <img
          src={image}
          alt={text || "A post on Xelvic"}
          loading="lazy"
          className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
      ) : (
        <span className="flex size-full items-center justify-center px-3 text-center text-[13px] font-semibold leading-5 text-dim">
          {text || (isVibe ? "A vibe" : "A drop")}
        </span>
      )}
      {isVibe ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
          Vibe
        </span>
      ) : null}
    </Link>
  );
}
