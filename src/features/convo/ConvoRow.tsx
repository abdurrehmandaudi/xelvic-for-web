import {
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { BellOff, Cake, Check, Pin, Sparkles, Timer, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { isBirthdayTodayIn } from "@/features/profile/birthday";
import { AMBER, isCold, showsSpark, wornOf } from "@/features/sparks/model";
import type { Spark, ThreadCard } from "@/types/api";
import {
  lineTone,
  listLine,
  stamp,
  threadFace,
  threadGone,
  threadTitle,
  threadUnread,
} from "./model";

const HOT_FILL = "color-mix(in srgb, var(--accent) 15%, var(--page))";
const HOT_EDGE = "color-mix(in srgb, var(--accent) 15%, transparent)";
const ACTIVE_FILL = "color-mix(in srgb, var(--accent) 10%, var(--page))";
const ACTIVE_EDGE = "color-mix(in srgb, var(--accent) 5%, transparent)";

function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  };

  return {
    fired,
    clear,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        fired.current = false;
        origin.current = { x: event.clientX, y: event.clientY };
        clear();
        timer.current = window.setTimeout(() => {
          timer.current = null;
          fired.current = true;
          onLongPress();
        }, 520);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const start = origin.current;
        if (!start) return;
        if (
          Math.abs(event.clientX - start.x) > 10 ||
          Math.abs(event.clientY - start.y) > 10
        ) {
          clear();
        }
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
    },
  };
}

function SparkChip({ spark, onOpen }: { spark: Spark; onOpen: () => void }) {
  const worn = wornOf(spark);
  const cold = isCold(spark);
  const urgent = Boolean(spark.alive && spark.at_risk);
  const names = worn.map((award) => award.name).join(" + ");
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      title={names || "Spark"}
      aria-label={`Open the Spark${names ? ` — ${names}` : ""}`}
      className="flex h-[24px] shrink-0 items-center justify-end transition hover:scale-105"
    >
      {worn.map((award, index) => (
        <award.Icon
          key={award.key}
          className={cn("size-[21px]", index > 0 && "ml-0.5")}
          aria-hidden
          style={{
            color: urgent
              ? AMBER
              : cold
                ? fade(award.colour, 0.4)
                : award.colour,
          }}
        />
      ))}
    </button>
  );
}

function UnreadPlate({ waiting }: { waiting: number }) {
  return (
    <span
      className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10.5px] font-extrabold leading-[1.1] tabular-nums text-on-accent"
      aria-label={`${waiting} unread`}
    >
      {count(waiting)}
    </span>
  );
}

export function ConvoRow({
  thread,
  active,
  spark,
  moment,
  picking,
  picked,
  onOpen,
  onToggle,
  onActions,
  onOpenMoment,
  onOpenSpark,
  onFiles,
}: {
  thread: ThreadCard;
  active?: boolean;
  spark?: Spark | null;
  moment?: { seen?: boolean; author?: string } | null;
  picking?: boolean;
  picked?: boolean;
  onOpen: () => void;
  onToggle?: () => void;
  onActions: () => void;
  onOpenMoment?: (username: string) => void;
  onOpenSpark?: () => void;
  onFiles?: (files: File[]) => void;
}) {
  const title = threadTitle(thread);
  const face = threadFace(thread);
  const gone = threadGone(thread);
  const unread = threadUnread(thread);
  const hot = unread > 0;
  const marked = hot || active;
  const line = listLine(thread, unread);
  const tone = lineTone(line, unread);
  const group = thread.kind === "group";
  const username = face?.username;
  const ring = Boolean(username && moment && onOpenMoment && !gone && !picking);
  const longPress = useLongPress(picking ? () => undefined : onActions);
  const [fileOver, setFileOver] = useState(false);
  const fileDepth = useRef(0);

  const hasFiles = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!onFiles || !hasFiles(event)) return;
    event.preventDefault();
    fileDepth.current += 1;
    setFileOver(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!onFiles || !hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = () => {
    if (!onFiles) return;
    fileDepth.current = Math.max(0, fileDepth.current - 1);
    if (fileDepth.current === 0) setFileOver(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!onFiles) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    fileDepth.current = 0;
    setFileOver(false);
    onFiles(files);
  };

  const style = hot
    ? { background: HOT_FILL, borderColor: HOT_EDGE }
    : active
      ? { background: ACTIVE_FILL, borderColor: ACTIVE_EDGE }
      : undefined;

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (picking) onToggle?.();
      else onOpen();
    }
    if (
      !picking &&
      (event.key === "ContextMenu" ||
        (event.shiftKey && event.key === "F10"))
    ) {
      event.preventDefault();
      onActions();
    }
  };

  return (
    <div
      role={picking ? "checkbox" : "link"}
      tabIndex={0}
      aria-checked={picking ? Boolean(picked) : undefined}
      aria-current={active && !picking ? "page" : undefined}
      aria-label={`${title}${unread ? `, ${unread} unread` : ""}`}
      onClick={(event) => {
        if (longPress.fired.current) {
          longPress.fired.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (picking) onToggle?.();
        else onOpen();
      }}
      onKeyDown={onKey}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!picking) onActions();
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      {...longPress.handlers}
      className={cn(
        "group relative flex min-h-[64px] cursor-pointer items-center gap-2 overflow-hidden px-1.5 pl-2 pr-2.5 outline-none transition-colors hover:bg-accent/5",
        "border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/50",
        marked && !picking && "border",
        fileOver && "bg-accent/10 ring-2 ring-inset ring-accent",
      )}
      style={picking ? undefined : style}
    >
      {picking ? (
        <span
          className={cn(
            "flex size-[22px] shrink-0 items-center justify-center rounded-full border transition",
            picked
              ? "border-accent bg-accent text-on-accent"
              : "border-[color-mix(in_srgb,var(--ink)_35%,transparent)] text-transparent",
          )}
          aria-hidden
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : null}
      <span className="relative flex size-[46px] shrink-0 items-center justify-center">
        {ring ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              if (username) onOpenMoment?.(username);
            }}
            className={cn(
              "relative flex size-[46px] shrink-0 items-center justify-center rounded-full border-2 p-0 transition-transform hover:scale-[1.02]",
              moment?.seen
                ? "border-[color-mix(in_srgb,var(--ink)_16%,transparent)]"
                : "border-accent",
            )}
            aria-label={`Open ${title}'s moments`}
            title="Moments"
          >
            <Avatar
              user={face}
              name={title}
              src={thread.avatar}
              size={42}
              deleted={gone}
            />
          </button>
        ) : (
          <Avatar
            user={face}
            name={title}
            src={thread.avatar}
            size={44}
            deleted={gone}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold tracking-[-0.15px]">
            {title}
          </span>
          {group ? (
            <Users
              className="size-3.5 shrink-0 text-dim"
              strokeWidth={2.2}
              aria-label="Group"
            />
          ) : null}
          {thread.kind === "agent" ? (
            <Sparkles
              className="size-3.5 shrink-0 text-accent"
              strokeWidth={2.2}
              aria-label="Xelvic Agent"
            />
          ) : null}
          {/* The count, at the end of the name and never on the far right of the
              row: a number that has to be found across the width of a row is a
              number read against the wrong name. Groups only — see UnreadPlate. */}
          {group && unread > 0 ? <UnreadPlate waiting={unread} /> : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[13.5px] leading-[1.3]",
              tone.className,
            )}
          >
            {line}
          </p>
        </div>
        {thread.muted ? (
          <span className="mt-1 inline-flex h-[21px] items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] px-2 text-[10.5px] font-semibold text-dim">
            <BellOff className="size-3" aria-hidden /> Muted
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center">
        {thread.pinned ? <PinMark hot={hot} /> : null}
        {!gone && isBirthdayTodayIn(thread.other) ? <CakeMark /> : null}
        {/* The small timer mark: this run's clock is nearly out. It is a glyph
            and not a figure — the hours live on the sheet — and it comes out for
            one of two reasons that say the same thing: my own silence, or the
            run being close to breaking. */}
        {spark &&
        showsSpark(spark) &&
        (spark.timer_mine || (spark.alive && spark.at_risk)) ? (
          <Timer
            className="mr-[3px] size-[14px] shrink-0"
            strokeWidth={2.4}
            style={{ color: AMBER }}
            aria-label="This clock is running out"
          />
        ) : null}
        {spark && showsSpark(spark) && onOpenSpark ? (
          <span className="mr-[7px] flex">
            <SparkChip spark={spark} onOpen={onOpenSpark} />
          </span>
        ) : null}
        <span
          className={cn(
            "text-[12px] font-medium tabular-nums",
            hot ? "text-accent" : "text-dim",
          )}
        >
          {stamp(thread.last_message_at ?? thread.preview?.at)}
        </span>
      </div>
    </div>
  );
}

function PinMark({ hot }: { hot: boolean }) {
  return (
    <span
      className="mr-1.5 grid size-4 shrink-0 place-items-center rounded-full"
      style={{
        background: hot
          ? "color-mix(in srgb, var(--accent) 22%, transparent)"
          : "color-mix(in srgb, var(--ink) 6.5%, transparent)",
      }}
      title="Pinned"
    >
      <Pin
        className="size-[9px]"
        strokeWidth={2.6}
        style={{ color: hot ? "var(--accent)" : "var(--dim)" }}
        aria-hidden
      />
    </span>
  );
}

function CakeMark() {
  return (
    <Cake
      className="mr-1.5 size-[15px] shrink-0 text-accent"
      strokeWidth={2.2}
      aria-label="Birthday today"
    />
  );
}

/** A colour at a fraction of its own strength — the phone's `X.fade`. */
function fade(colour: string, amount: number): string {
  return `color-mix(in srgb, ${colour} ${Math.round(amount * 100)}%, transparent)`;
}
