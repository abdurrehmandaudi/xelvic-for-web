import { Link } from "react-router-dom";
import {
  BookOpen,
  Gamepad2,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Play,
  Puzzle,
  Tv,
  Zap,
} from "lucide-react";
import { AuthedImage } from "@/components/media/Media";
import { cn } from "@/utils/cn";
import type { Drop } from "@/types/api";
import {
  KIDS_SHELVES,
  kidsDoor,
  kidsIsClip,
  kidsLength,
  kidsName,
  kidsPoster,
  type KidsShelfKey,
} from "./model";

const MARKS = {
  all: LayoutGrid,
  shorts: Zap,
  long: Tv,
  cartoons: Palette,
  stories: BookOpen,
  games: Puzzle,
} as const;

export function KidsChips({
  value,
  onChange,
}: {
  value: KidsShelfKey;
  onChange: (key: KidsShelfKey) => void;
}) {
  return (
    <div
      className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 pt-1 md:mx-0 md:flex-wrap md:px-0"
      role="group"
      aria-label="Kids shelves"
    >
      {KIDS_SHELVES.map((shelf) => {
        const Mark = MARKS[shelf.key];
        const active = shelf.key === value;
        return (
          <button
            key={shelf.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(shelf.key)}
            className={cn(
              "inline-flex min-h-[54px] shrink-0 items-center gap-2 rounded-[18px] border px-5 text-[14px] font-extrabold transition-[background-color,border-color,color,transform] duration-[160ms] active:scale-[0.97]",
              active
                ? "border-accent bg-accent text-on-accent"
                : "border-line bg-card text-ink hover:border-accent/35",
            )}
          >
            <Mark className="size-[19px]" aria-hidden />
            {shelf.label}
          </button>
        );
      })}
    </div>
  );
}

export function KidsTile({ drop }: { drop: Drop }) {
  const name = kidsName(drop);
  const author = drop.author?.name || drop.author?.username || "";
  const poster = kidsPoster(drop);
  const clip = kidsIsClip(drop);
  const length = kidsLength(drop);
  const label = [name, author].filter(Boolean).join(", ") || "A kids post";

  return (
    <Link
      to={kidsDoor(drop)}
      aria-label={label}
      className="group block overflow-hidden rounded-[20px] border border-line bg-card transition-[transform,border-color,box-shadow] duration-[160ms] active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))]">
        {poster ? (
          <AuthedImage
            src={poster}
            alt=""
            className="size-full"
            imgClassName="size-full transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-[color-mix(in_srgb,var(--ink)_30%,transparent)]">
            {clip ? (
              <Play className="size-9" aria-hidden />
            ) : (
              <ImageIcon className="size-9" aria-hidden />
            )}
          </span>
        )}
        {clip ? (
          <span className="absolute inset-0 grid place-items-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_52%,transparent)] text-on-accent backdrop-blur-sm">
              <Play className="ml-0.5 size-5 fill-current" aria-hidden />
            </span>
          </span>
        ) : null}
        {clip && length ? (
          <span className="absolute bottom-2 right-2 rounded-[7px] bg-[color-mix(in_srgb,var(--solid)_72%,transparent)] px-2 py-0.5 text-[11.5px] font-bold text-on-accent">
            {length}
          </span>
        ) : null}
      </div>
      <div className="px-3.5 pb-3.5 pt-3">
        {name ? (
          <p className="line-clamp-2 text-[14.5px] font-extrabold leading-[1.3]">{name}</p>
        ) : null}
        {author ? (
          <p className={cn("truncate text-[12px] font-semibold text-dim", name && "mt-1")}>{author}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function KidsGrid({ rows }: { rows: Drop[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {rows.map((drop) => (
        <KidsTile key={String(drop.id)} drop={drop} />
      ))}
    </div>
  );
}

export function KidsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[20px] border border-line bg-card">
          <div className="relative aspect-[4/3] overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
          <div className="space-y-2 px-3.5 pb-3.5 pt-3">
            <div className="relative h-3 w-4/5 overflow-hidden rounded-full bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
            <div className="relative h-2.5 w-2/5 overflow-hidden rounded-full bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-['']" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KidsGamesPanel() {
  return (
    <div className="rounded-[24px] border border-line bg-card px-6 py-10 text-center md:py-14">
      <span className="mx-auto flex size-20 items-center justify-center rounded-[26px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] text-accent">
        <Gamepad2 className="size-10" aria-hidden />
      </span>
      <h2 className="mt-5 text-balance text-[21px] font-extrabold tracking-tight">
        Games live in the phone app
      </h2>
      <p className="mx-auto mt-2 max-w-md text-pretty text-[15px] leading-7 text-dim">
        The twelve games and their hundred levels are built into Xelvic for Android and iOS.
        They are not on the web yet.
      </p>
    </div>
  );
}