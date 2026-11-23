import { Link, Navigate } from "react-router-dom";
import { ArrowRight, MessageCircle, Music2, Play, Radio, Sparkles, Users, Video } from "lucide-react";
import { Wordmark } from "@/components/icons/Brand";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/seo";

/**
 * The front door.
 *
 * The owner, 2026-11-22: *"xelvic.com pe direct QR na khule — intro wala khule,
 * login karne pe khule."* So `/` is an introduction to the product and
 * `/signin` is the QR door; a signed-in visitor skips both and lands in the app.
 *
 * It is deliberately not the marketing site (that lives at `/home/`): this is
 * the product's own front page — the same type, colour and plates as inside the
 * app, so the first screen and the signed-in screen look like one product.
 */

const PILLARS = [
  { icon: Sparkles, title: "Drops", body: "Post a photo, a clip, a sound or a question — and keep the people who matter." },
  { icon: Play, title: "Vibes", body: "Short-form video you can watch, make and edit — clips, words, blur and voiceover." },
  { icon: MessageCircle, title: "Convos", body: "Private messages with voice notes, photos, clips and shared playlists inside the chat." },
  { icon: Music2, title: "Audio", body: "Tracks, playlists and a sound post — with a music picker while you create." },
  { icon: Video, title: "Moments", body: "The day's pictures and clips, plus text and poll moments that disappear." },
  { icon: Users, title: "Groups", body: "Conversations with typed rooms — photos, videos and chat kept apart on purpose." },
  { icon: Radio, title: "Live", body: "Go live from the phone, with live chat and reactions for the people watching." },
];

const STORES = [
  {
    label: "Google Play",
    href: "https://play.google.com/store/apps/details?id=com.xelvic.app",
  },
  {
    label: "App Store",
    href: "https://apps.apple.com/in/app/xelvic/id6823874635",
  },
];

export function LandingPage() {
  const { status } = useAuth();
  usePageMeta({
    title: "Xelvic — a social platform that feels like yours",
    description:
      "Drops, Vibes, Convos, Audio, Moments, Groups and Live — one app for making, talking and discovering. Xelvic for iPhone and Android.",
  });

  if (status === "authenticated") return <Navigate to="/drops" replace />;

  return (
    <div className="min-h-dvh bg-page">
      <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark to="" size={28} />
        <nav className="flex items-center gap-2 sm:gap-3">
          <a
            href="https://xelvic.com/download"
            className="hidden min-h-10 items-center rounded-full px-4 text-[13px] font-bold text-ink hover:bg-ink-5 sm:inline-flex"
          >
            Download
          </a>
          <Link
            to="/signin"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-card px-4 text-[13px] font-bold text-ink transition-colors hover:bg-ink-5"
          >
            Log in <ArrowRight className="size-4" />
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1080px] px-5 pb-16 sm:px-8">
        <section className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-accent">
              One app · your people · your vibe
            </p>
            <h1 className="mt-4 text-[clamp(34px,6vw,58px)] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink">
              A social platform
              <br /> that feels like yours.
            </h1>
            <p className="mt-5 max-w-[52ch] text-[16.5px] leading-7 text-dim">
              Post, watch, listen, talk and go live — with characters and themes that make the app
              yours, and a private assistant that helps when you ask. No noise, no feed you did not
              choose.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/signin"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 text-[14px] font-extrabold text-on-accent transition-[filter,transform] duration-[160ms] active:scale-[0.98] hover:brightness-105"
              >
                Log in with your phone <ArrowRight className="size-4" />
              </Link>
              <a
                href="https://xelvic.com/download"
                className="inline-flex min-h-12 items-center rounded-full border border-line bg-card px-6 text-[14px] font-bold text-ink transition-colors hover:bg-ink-5"
              >
                Get the app
              </a>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-[12.5px] text-dim">
              <span>Also on</span>
              {STORES.map((store) => (
                <a
                  key={store.label}
                  href={store.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-extrabold text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
                >
                  {store.label}
                </a>
              ))}
              <span aria-hidden>·</span>
              <span>Windows and macOS coming soon</span>
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-card p-5 shadow-[0_20px_50px_rgb(19_19_26_/_0.06)] sm:p-6">
            <div className="flex items-center justify-between">
              <Wordmark to="" size={22} />
              <span className="rounded-full bg-page px-3 py-1 text-[11px] font-extrabold text-dim">
                Preview
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Your character, your theme", "Pick a face and a look; the whole app changes with it."],
                ["Convos that stay private", "Voice notes, clips and photos inside the chat — with a locked vault."],
                ["A feed you asked for", "Vibes and Drops ordered by what you actually watch."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl bg-page p-4">
                  <p className="text-[13.5px] font-extrabold text-ink">{title}</p>
                  <p className="mt-1 text-[12.5px] leading-5 text-dim">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-6">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-dim">
            What is inside
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-card p-4">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-page text-ink">
                  <Icon className="size-4" />
                </span>
                <p className="mt-3 text-[14px] font-extrabold text-ink">{title}</p>
                <p className="mt-1 text-[12.5px] leading-5 text-dim">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[24px] bg-ink px-6 py-8 text-white sm:px-10">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/60">
            Already have an account?
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-[28ch] text-[clamp(22px,4vw,32px)] font-extrabold leading-tight tracking-[-0.02em]">
              Scan once from the Xelvic app and this browser becomes a linked device.
            </h2>
            <Link
              to="/signin"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-extrabold text-ink transition-transform active:scale-[0.98]"
            >
              Log in <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-dim">
          <span>© Gaongram Tech Private Limited</span>
          <span className="flex flex-wrap gap-4">
            <a href="https://xelvic.com/home/" className="hover:underline">
              About Xelvic
            </a>
            <a href="https://xelvic.com/download" className="hover:underline">
              Download
            </a>
            <Link to="/signin" className="hover:underline">
              Log in
            </Link>
          </span>
        </footer>
      </main>
    </div>
  );
}
