import { useState, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/utils/cn";
import { initialsOf } from "@/utils/format";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import type { UserCard } from "@/types/api";

interface AvatarProps {
  user?: Pick<UserCard, "name" | "username" | "avatar" | "deleted"> | null;
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  ring?: boolean;
  muted?: boolean;
  deleted?: boolean;
  badge?: ReactNode;
}

export function Avatar({
  user,
  src,
  name,
  size = 44,
  className,
  ring,
  muted,
  deleted,
  badge,
}: AvatarProps) {
  const displayName = name || user?.name || user?.username || "";
  const gone = deleted === true || user?.deleted === true;
  const blank = displayName.trim() === "";
  const initial = initialsOf(displayName, "");
  const media = useMediaUrl(src ?? user?.avatar);
  const [broken, setBroken] = useState(false);
  const image = media.src && !media.failed && !broken && !gone && !blank;

  return (
    <span
      className={cn("relative flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]",
          ring && "shadow-[inset_0_0_0_2px_var(--accent)]",
          muted && "opacity-60",
        )}
      >
        {image ? (
          <img
            src={media.src ?? undefined}
            alt={displayName}
            className="block h-full w-full object-cover object-center"
            onError={() => setBroken(true)}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : gone || blank ? (
          <UserRound
            className="text-accent opacity-70"
            style={{ width: Math.max(12, size * 0.52), height: Math.max(12, size * 0.52) }}
            strokeWidth={2.4}
            aria-hidden
          />
        ) : (
          <span
            className="font-extrabold tracking-tight text-accent"
            style={{ fontSize: Math.max(11, size * 0.32) }}
            aria-hidden
          >
            {initial}
          </span>
        )}
      </span>
      {badge ? <span className="absolute -right-1 -top-1">{badge}</span> : null}
    </span>
  );
}

export function AvatarStack({ users, size = 26 }: { users: Pick<UserCard, "id" | "name" | "username" | "avatar" | "deleted">[]; size?: number }) {
  const shown = users.slice(0, 3);
  return (
    <span className="flex -space-x-2">
      {shown.map((user) => (
        <span key={user.id} className="flex rounded-full border-2 border-[var(--card)]">
          <Avatar user={user} size={size} />
        </span>
      ))}
      {users.length > shown.length ? (
        <span
          className="inline-flex items-center justify-center rounded-full border-2 border-[var(--card)] bg-[color-mix(in_srgb,var(--ink)_8%,var(--card))] text-[10px] font-bold text-dim"
          style={{ width: size, height: size }}
        >
          +{users.length - shown.length}
        </span>
      ) : null}
    </span>
  );
}
