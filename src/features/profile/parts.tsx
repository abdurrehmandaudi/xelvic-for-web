import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AuthedImage } from "@/components/media/Media";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { socialService } from "@/services/social.service";
import { toneNamed } from "@/theme/shelf";
import type { UserCard } from "@/types/api";

/**
 * The pieces both profiles are made of.
 *
 * `profile.dart` and `person.dart` draw one person twice — my own page and
 * somebody else's — and the two screens share a head, a row of numbers, a
 * floating disc and a column of sheet rows. The app keeps a private copy of each
 * of these in each file; the web keeps one of each here, because the two copies
 * in the app have already drifted once (the trade moved above the name on one
 * page and not the other) and the fix was to make the two pages say the same
 * thing in the same words for the same person.
 *
 * Nothing here asks the server a question of its own except the mutuals list,
 * which is a door rather than a drawing: a strip whose count comes off the
 * profile payload and whose faces come off `/mutuals/` only when it is opened.
 */

export const PROFILE_MAX = "mx-auto w-full max-w-[1240px]";

export const PROFILE_GUTTER = "px-4 sm:px-6 lg:px-7";

export const PROFILE_CARD =
  "rounded-[16px] border border-[color-mix(in_srgb,var(--accent)_14%,transparent)] bg-card shadow-[0_1px_2px_color-mix(in_srgb,var(--ink)_5%,transparent)]";

export const PROFILE_SECTION = "mt-4 sm:mt-5";

export const PROFILE_HEAD =
  "lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-6";

export const PROFILE_FACE = "relative z-10 -mt-[80px] w-fit border-[2px] border-card bg-card rounded-full shadow-[0_10px_18px_-22px_color-mix(in_srgb,var(--ink)_82%,transparent)]";

export const PROFILE_HEAD_TEXT = "mt-3.5 min-w-0 max-w-[760px] lg:mt-2";

export const PROFILE_PHOTO = { narrow: 148, wide: 196 };

export function ProfileCover({
  url,
  art,
  children,
}: {
  url?: string | null;
  art?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="relative h-[208px] overflow-hidden rounded-b-[72px]">
      {url ? (
        <>
          <AuthedImage
            src={url}
            alt=""
            className="h-full w-full"
            imgClassName="h-full w-full"
          />
          <span className="absolute inset-0 bg-[color-mix(in_srgb,#13131A_18%,transparent)]" />
        </>
      ) : art ? (
        <img src={art} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_24%,var(--page)),color-mix(in_srgb,var(--tone-violet)_18%,var(--page)))]">
          <span className="absolute -right-6 -top-10 size-44 rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] blur-2xl" />
          <span className="absolute -bottom-16 left-24 size-52 rounded-full bg-[color-mix(in_srgb,var(--tone-violet)_14%,transparent)] blur-2xl" />
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--ink)_28%,transparent)] via-transparent to-transparent" />
      {children ? (
        <div
          className={cn(
            PROFILE_MAX,
            PROFILE_GUTTER,
            "absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 py-3",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function BirthdayPill({ name }: { name: string }) {
  const { t } = usePreferences();
  return (
    <span className="mt-2.5 flex max-w-full items-center gap-2 rounded-[8px] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-3 py-1.5">
      <BirthdayCake />
      <span className="min-w-0 truncate text-[12px] font-semibold text-accent">
        {t(`${name}'s birthday is today`)}
      </span>
    </span>
  );
}

function BirthdayCake() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      aria-hidden
      className="shrink-0 text-accent"
    >
      <path
        d="M7 1.1c.7.9 1.1 1.5 1.1 2a1.1 1.1 0 1 1-2.2 0c0-.5.4-1.1 1.1-2Z"
        fill="currentColor"
      />
      <path
        d="M2.4 6.2h9.2v1.1c0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1V6.2Z"
        fill="currentColor"
        opacity="0.45"
      />
      <rect
        x="2.4"
        y="9.2"
        width="9.2"
        height="3.4"
        rx="1"
        fill="currentColor"
      />
    </svg>
  );
}

export function ProfileCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(PROFILE_CARD, "overflow-hidden", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <h2 className="min-w-0 truncate text-[15px] font-semibold">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export interface ProfileStat {
  key: string;
  label: string;
  value?: number | null;
  icon: LucideIcon;
  tone: string;
  faded?: boolean;
  onTap?: () => void;
}

const STAT_COLUMNS: Record<number, { narrow: string; wide: string }> = {
  1: { narrow: "grid-cols-1", wide: "sm:grid-cols-1" },
  2: { narrow: "grid-cols-2", wide: "sm:grid-cols-2" },
  3: { narrow: "grid-cols-3", wide: "sm:grid-cols-3" },
  4: { narrow: "grid-cols-2", wide: "sm:grid-cols-4" },
};

export function ProfileStats({
  items,
  className,
}: {
  items: ProfileStat[];
  className?: string;
}) {
  const total = items.length;
  if (!total) return null;
  const columns = STAT_COLUMNS[Math.min(total, 4)];
  const stack = Math.min(total, 3);

  return (
    <div
      className={cn(
        PROFILE_CARD,
        "grid overflow-hidden",
        columns.narrow,
        columns.wide,
        className,
      )}
    >
      {items.map(({ key, label, value, icon: Icon, tone, faded, onTap }, index) => {
        const cell = (
          <>
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-[9px] sm:size-9"
              style={{
                backgroundColor: `color-mix(in srgb, ${tone} 15%, transparent)`,
                color: tone,
              }}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-[18px] font-bold leading-none tabular-nums sm:text-[21px]",
                  faded && "text-dim",
                )}
              >
                {typeof value === "number" ? count(value) : "—"}
              </span>
              <span className="mt-1 block truncate text-[11.5px] font-medium text-dim">
                {label}
              </span>
            </span>
          </>
        );
        const skin = cn(
          "flex min-w-0 items-center gap-2 px-3 py-3 text-left sm:gap-3 sm:px-4 sm:py-3.5",
          index % stack !== 0 && "border-l border-line",
          index >= stack && "border-t border-line sm:border-t-0",
          index > 0 && "sm:border-l sm:border-line",
        );
        return onTap ? (
          <button
            key={key}
            type="button"
            onClick={onTap}
            className={cn(
              skin,
              "transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]",
            )}
          >
            {cell}
          </button>
        ) : (
          <div key={key} className={skin}>
            {cell}
          </div>
        );
      })}
    </div>
  );
}

export function Chip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const shell =
    "inline-flex max-w-full items-center gap-2 rounded-[8px] border border-line bg-[color-mix(in_srgb,var(--ink)_4%,var(--card))] px-3 py-1.5 text-[12.5px] font-medium text-[color-mix(in_srgb,var(--ink)_78%,transparent)]";
  const body = (
    <>
      <span className="flex shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </>
  );
  if (!onClick) return <span className={shell}>{body}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        shell,
        "transition hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] hover:text-ink active:scale-[0.98]",
      )}
    >
      {body}
    </button>
  );
}

export const ASK_PILL =
  "inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-[10px] px-5 text-[13.5px] font-semibold tracking-[-0.01em] transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55";

export const SOLID_PILL = `${ASK_PILL} border border-transparent bg-[linear-gradient(135deg,var(--accent),var(--accent-pill))] text-on-accent shadow-[0_12px_26px_-14px_color-mix(in_srgb,var(--accent)_90%,transparent)] hover:brightness-105`;

export const QUIET_PILL = `${ASK_PILL} border border-line bg-card text-ink hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]`;

export const ROUND_CONTROL =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] active:scale-[0.97]";

export const TILE_CONTROL =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-card text-ink transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] active:scale-[0.97]";

export const COVER_CONTROL =
  "inline-flex size-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--card)_70%,transparent)] bg-[color-mix(in_srgb,var(--card)_90%,transparent)] text-ink shadow-[0_10px_26px_-14px_color-mix(in_srgb,var(--ink)_70%,transparent)] backdrop-blur-md transition-colors duration-150 hover:bg-card active:scale-[0.96]";

/**
 * The three flat colours the ask travels between, and their readings.
 *
 * Pink first, because it is the app's own colour and the one this disc's
 * hairline already wore, then violet and teal — three of `XTones`' eight, named
 * rather than invented. They are chosen for the *path* between them: on the
 * wheel pink, violet and teal are neighbours, so the journey never crosses the
 * dead grey between two opposite hues, and because it returns the way it came
 * the disc only ever moves between colours that are next to each other.
 *
 * The reading is the same pair `XThemes.darkOf` swaps: `tone.on` on a light page
 * and `tone.pill` on a dark one, because a colour dark enough to read on white
 * is a smudge laid on a dark card.
 */
const ASK_TONES = ["Pink", "Violet", "Teal"];

function askStops(dark: boolean): [string, string, string] {
  const picked = ASK_TONES.map((name) => {
    const tone = toneNamed(name);
    if (!tone) return null;
    return dark ? tone.pill : tone.on;
  }).filter((hex): hex is string => Boolean(hex));
  // A build whose palette has lost one of the three still travels: the stops it
  // does have stand in for the missing one rather than the disc going blank.
  const first = picked[0] ?? "#E31B66";
  return [first, picked[1] ?? first, picked[2] ?? first];
}

export function askPulse(dark: boolean): CSSProperties {
  const stops = askStops(dark);
  return {
    animation:
      "xelvic-ask-breath 2s ease-in-out infinite, xelvic-ask-hue 6s ease-in-out infinite",
    "--ask-a": stops[0],
    "--ask-b": stops[1],
    "--ask-c": stops[2],
  } as CSSProperties;
}

/**
 * A button that floats on the page: a disc with a hairline, so it reads over
 * whatever is behind it.
 *
 * [pulse] is the owner's ask of 2026-10-28: on a page where nothing has been
 * added yet, the control that adds them should breathe so it is the thing the
 * eye lands on; once they are added, the way into the convo takes the breath
 * instead — a loop, not a single blink, corrected by the owner the next day, and
 * with the colour travelling alongside the size.
 *
 * Three things it must not do, and does not: **move the row** (the scale is a
 * paint-time transform, so the other discs keep their places), **draw a
 * gradient** (the disc is washed with one flat hue at a time), and **ignore the
 * phone's setting** (the global `prefers-reduced-motion` rule stops both
 * animations dead, and the disc then wears the first stop — a still frame rather
 * than a blank one).
 *
 * A dimmed control does not beat: [onTap] is null while a write is in the air,
 * and an action that breathes while it cannot be pressed is an action somebody
 * presses again.
 */
export function Floating({
  icon,
  label,
  onTap,
  pulse = false,
}: {
  icon: ReactNode;
  label: string;
  /** Null while a request from this page is in the air. Drawn dim, not removed. */
  onTap?: (() => void) | null;
  /** Whether this is the one control the page is asking somebody to press. */
  pulse?: boolean;
}) {
  const { palette } = useTheme();
  const live = Boolean(onTap);
  const asking = pulse && live;
  const [a, b, c] = askStops(palette.isDark);

  const style = asking
    ? ({
        animation: "xelvic-ask-breath 2s ease-in-out infinite, xelvic-ask-ring 6s ease-in-out infinite",
        "--ask-a": a,
        "--ask-b": b,
        "--ask-c": c,
      } as CSSProperties)
    : undefined;

  return (
    <button
      type="button"
      disabled={!live}
      onClick={onTap ?? undefined}
      title={label}
      aria-label={label}
      style={style}
      className={cn(
        "relative flex size-[38px] items-center justify-center rounded-full border backdrop-blur-sm transition active:scale-[.95]",
        asking
          ? "bg-card"
          : "border-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)]",
        !live && "opacity-45",
      )}
    >
      {/* The wash, and the second half of the breath. Two animations on one
          element because they touch two different properties: the hue travels
          over six seconds while the wash deepens and lightens over two. */}
      {asking ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            animation:
              "xelvic-ask-hue 6s ease-in-out infinite, xelvic-ask-wash 2s ease-in-out infinite",
          }}
        />
      ) : null}
      <span className="relative">{icon}</span>
    </button>
  );
}

/** One row of a profile's ⋮ sheet: a mark, a word and what it is for. */
export function SheetRow({
  icon,
  label,
  line,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  line?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
    >
      <span className="text-dim">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        {line ? <span className="mt-0.5 block text-[12px] text-dim">{line}</span> : null}
      </span>
    </button>
  );
}

/** How long a press has to be held before it counts as a hold rather than a tap. */
const HOLD_MS = 480;

/**
 * The face at the head of a profile — which is also its biggest button.
 *
 * The app draws this in two places with two behaviours: `profile.dart` shows my
 * own photo large when it is tapped, and `person.dart` gives somebody else's
 * face a *long press* for the same thing while a tap is spent on their day when
 * they have one live.
 *
 * A hold is 480ms, a little under half a second, because the web's press is a
 * mouse click or a thumb and the app's own is Flutter's 500ms: anything longer
 * reads as a press that did not register, and anything shorter fires while a
 * thumb is still on its way to a scroll. The click that follows a hold is
 * swallowed, so holding never also opens the day behind the photo.
 */
export function FaceButton({
  user,
  size,
  ring,
  label,
  title,
  onTap,
  onHold,
}: {
  user?: Pick<UserCard, "name" | "username" | "avatar"> | null;
  size: number;
  ring?: "new" | "seen" | null;
  label: string;
  /** The line a mouse reads on hover — on the web it is the only way to learn
   *  that the face answers a hold. */
  title?: string;
  onTap: () => void;
  onHold?: () => void;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  const stop = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      className={cn(
        "block shrink-0 touch-manipulation select-none rounded-full shadow-[0_8px_22px_color-mix(in_srgb,#13131A_18%,transparent)] transition-transform duration-150 active:scale-[.98]",
        ring === "new" && "border-[2.5px] border-[var(--accent)] p-[2.5px]",
        ring === "seen" &&
          "border-[2.5px] border-[color-mix(in_srgb,var(--ink)_16%,transparent)] p-[2.5px]",
      )}
      onContextMenu={onHold ? (event) => event.preventDefault() : undefined}
      onPointerDown={
        onHold
          ? () => {
              held.current = false;
              stop();
              timer.current = window.setTimeout(() => {
                held.current = true;
                onHold();
              }, HOLD_MS);
            }
          : undefined
      }
      onPointerUp={onHold ? stop : undefined}
      onPointerLeave={onHold ? stop : undefined}
      onPointerCancel={onHold ? stop : undefined}
      onClick={() => {
        // The press that became a hold has already done its work; this click is
        // the browser finishing the same gesture, not a second one.
        if (held.current) {
          held.current = false;
          return;
        }
        onTap();
      }}
    >
      <Avatar user={user} size={ring ? size - 10 : size} />
    </button>
  );
}

/**
 * The face as large as it goes, opened from a tap or a hold.
 *
 * Ported from `showFace` in `app/lib/screens/widgets.dart` and `_showPhoto` in
 * `profile.dart`, which are the same dialog twice: a 240 square with rounded
 * corners over a scrim, their name under it in white, and a tap anywhere taking
 * it away. The app lays the square out as a real photograph — cover-cropped —
 * and keeps the initials circle for an account with no picture, because a 240px
 * empty frame would be a bigger version of nothing.
 */
export function FaceDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user?: Pick<UserCard, "name" | "username" | "avatar"> | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const name = user?.name || user?.username || "";
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#07070b]/70 px-5 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
    >
      <div className="flex max-h-full flex-col items-center">
        <div className="aspect-square w-[min(240px,70vw)] overflow-hidden rounded-[22px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]">
          <AuthedImage
            src={user?.avatar}
            alt={name}
            className="h-full w-full"
            imgClassName="h-full w-full"
            loading="eager"
            fallback={<Avatar name={name} size={240} />}
          />
        </div>
        <p className="mt-3 max-w-full truncate text-[16px] font-bold text-white">{name}</p>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The friends two accounts share, as a strip under a profile's numbers.
 *
 * Ported from `MutualStrip` in `app/lib/screens/mutuals.dart`. A mutual is
 * common ground — only the accounts I already keep that this person also keeps
 * — so it runs into none of the crew rules: every face here is one I put on my
 * own following list.
 *
 * Draws nothing at all when there is nothing to share, so a stranger with none
 * in common costs the page no room rather than a line saying zero.
 */
export function MutualStrip({
  count: total,
  faces,
  onOpen,
}: {
  count?: number | null;
  faces?: UserCard[];
  onOpen: () => void;
}) {
  const { t } = usePreferences();
  const n = total ?? 0;
  if (n <= 0) return null;
  const shown = (faces ?? []).slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-auto flex max-w-full items-center gap-2 rounded-[10px] px-2 py-1.5 transition-[transform] duration-150 active:scale-[.98]"
    >
      {shown.length > 0 ? (
        <span
          className="relative block h-[22px] shrink-0"
          // Each face is 22 wide and overlaps the one before by 8, so the stack
          // is 22 + 14·(n-1) across.
          style={{ width: 22 + 14 * (shown.length - 1) }}
        >
          {shown.map((person, index) => (
            // The stack overlaps towards the reading end, so on a right-to-left
            // page the first face is on the right. A ring the colour of the page
            // ground makes the faces read as a stack rather than a smear where
            // they meet — the app's `X.ink`, which is the page's own ground and
            // not the colour its words are written in.
            <span
              key={person.id ?? index}
              className="absolute top-0 flex rounded-full bg-[var(--page)] p-[1.5px]"
              style={{ insetInlineStart: index * 14 }}
            >
              <Avatar user={person} size={19} />
            </span>
          ))}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-[12.5px] font-medium text-dim">
        {t(
          n === 1
            ? `${count(n)} mutual friend`
            : `${count(n)} mutual friends`,
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-dim" aria-hidden />
    </button>
  );
}

/**
 * The full list of shared friends, opened from the strip.
 *
 * One endpoint, one shape — the same `UserCard` rows a crew list draws, so a
 * mutual reads as the person a crew row reads as. The server holds the whole
 * answer; this asks and draws what comes back, including nothing.
 */
export function MutualsModal({
  open,
  onClose,
  personId,
  personName,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
  onPick: (person: UserCard) => void;
}) {
  const { t } = usePreferences();
  const answer = useQuery({
    queryKey: ["mutuals", personId],
    queryFn: () => socialService.mutuals(personId),
    enabled: open && Boolean(personId),
  });
  const people = answer.data?.people ?? [];
  const total = answer.data?.count ?? people.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={total > 0 ? t(`Mutual · ${count(total)}`) : t("Mutual friends")}
    >
      <div className="px-4 py-3">
        {answer.isLoading ? (
          <div className="flex justify-center py-10">
            <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : people.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim">
              <Users className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-[13px] font-semibold">{t("No friends in common")}</p>
            <p className="mt-1 text-[12px] text-dim">
              {personName
                ? t(`Nobody you and ${personName} both keep yet.`)
                : t("Nobody you both keep yet.")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onPick(person)}
                className="flex w-full items-center gap-3 rounded-[12px] border border-line bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
              >
                <Avatar user={person} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">
                    {person.name || person.username}
                  </span>
                  <span className="block truncate text-[12px] text-dim">@{person.username}</span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-dim" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
