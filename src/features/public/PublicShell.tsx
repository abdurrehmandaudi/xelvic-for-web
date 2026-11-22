import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { BrandMark } from "@/components/icons/Brand";

/**
 * The frame around everything a signed-out visitor may read.
 *
 * The app's own shell is a signed-in workspace; this one is a shop window. It
 * keeps the same mark and the same type, offers one way in, and never pretends
 * the signed-in navigation is available.
 */

export function signInHref(next: string): string {
  return `/signin?next=${encodeURIComponent(next)}`;
}

export function PublicShell({ children, next }: { children: ReactNode; next: string }) {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[920px] items-center gap-3 px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="Xelvic">
            <BrandMark size={30} />
            <span className="text-[15px] font-extrabold tracking-[-0.04em]">Xelvic</span>
          </Link>
          <Link
            to={signInHref(next)}
            className="ml-auto inline-flex min-h-10 items-center justify-center rounded-full bg-accent px-4 text-[13px] font-bold text-on-accent transition-[filter,transform] duration-[160ms] active:scale-[0.98] hover:brightness-105"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[920px] px-4 py-6 pb-16 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-[920px] px-4 pb-8 text-center text-[11px] leading-5 text-dim sm:px-6">
        Xelvic — phone is the primary key. Accounts are created in the Xelvic mobile app.
      </footer>
    </div>
  );
}

export function PublicGate({
  title,
  description,
  next,
}: {
  title: string;
  description: string;
  next: string;
}) {
  return (
    <PublicShell next={next}>
      <section className="mx-auto mt-4 max-w-[520px] rounded-[24px] border border-line bg-card px-6 py-10 text-center shadow-[0_8px_24px_rgb(19_19_26_/_0.04)] sm:px-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] text-accent">
          <Lock className="size-6" />
        </span>
        <h1 className="mt-5 text-balance text-3xl font-extrabold tracking-[-0.04em]">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-dim">{description}</p>
        <Link
          to={signInHref(next)}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-[1.1rem] text-sm font-bold text-on-accent transition-[filter,transform] duration-[160ms] active:scale-[0.98] hover:brightness-105"
        >
          Sign in to Xelvic
        </Link>
        <p className="mt-4 text-xs leading-5 text-dim">
          No password is typed here: the Xelvic app on your phone approves the computer.
        </p>
      </section>
    </PublicShell>
  );
}

export function PublicLoading({ next }: { next: string }) {
  return (
    <PublicShell next={next}>
      <div className="mx-auto max-w-[680px] space-y-4" aria-hidden>
        <div className="relative h-40 overflow-hidden rounded-[24px] bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
        <div className="relative h-72 overflow-hidden rounded-[20px] bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
      </div>
    </PublicShell>
  );
}

export function PublicAvatar({
  src,
  name,
  size = 52,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  if (!src || failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[13px] font-extrabold text-accent"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {initials || "?"}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={`${name}'s profile picture`}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
