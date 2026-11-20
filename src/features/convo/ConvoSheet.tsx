import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Bell,
  BellOff,
  Check,
  ChevronLeft,
  Clock3,
  Eraser,
  IdCard,
  Image,
  Lock,
  LockOpen,
  LogOut,
  Palette,
  Pin,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  ConfirmDialog,
  Modal,
  PromptDialog,
} from "@/components/overlays/Modal";
import { Spinner } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { chatService } from "@/services/chat.service";
import { socialService } from "@/services/social.service";
import type { ThreadCard, ThreadDetail } from "@/types/api";
import {
  PIN_MAX,
  VANISH_DAYS,
  VANISH_DEFAULT_DAYS,
  catalogTints,
  catalogWalls,
  tintHex,
  vanishLabel,
  wallUrl,
  TINT_HEX,
} from "./skin";
import { threadFace, threadTitle } from "./model";
import { aliasOf, rememberName, useNames } from "./names";
import {
  OWN_WALL_OPACITY,
  clearOwnWall,
  ownWallOf,
  readWallImage,
  setOwnWall,
  setOwnWallOpacity,
  useOwnWall,
} from "./look";

type View = "main" | "vanish" | "walls" | "tints";
type Confirming = "clear" | "trash" | "leave" | "block" | null;

function ActionRow({
  icon,
  label,
  line,
  right,
  danger,
  disabled,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  line?: string;
  right?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors active:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] disabled:pointer-events-none disabled:opacity-45",
        danger
          ? "text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_7%,transparent)]"
          : "hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
        active &&
          !danger &&
          "bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          danger
            ? "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-[var(--bad)]"
            : active
              ? "bg-accent text-on-accent shadow-[0_4px_12px_color-mix(in_srgb,var(--accent)_24%,transparent)]"
              : "bg-[var(--accent-soft)] text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block truncate text-[12.5px] font-bold">{label}</span>
        {line ? (
          <span className="block truncate text-[10.5px] leading-4 text-dim">
            {line}
          </span>
        ) : null}
      </span>
      {right ? (
        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-bold text-dim transition-colors group-hover:text-ink">
          {right}
        </span>
      ) : null}
    </button>
  );
}

function SheetHead({
  thread,
  onClose,
}: {
  thread: ThreadCard;
  onClose: () => void;
}) {
  const title = threadTitle(thread);
  const face = threadFace(thread);
  const under =
    thread.kind === "group"
      ? thread.member_count === 1
        ? "1 member"
        : `${thread.member_count ?? 0} members`
      : face
        ? `@${face.username}`
        : "Direct convo";
  return (
    <div
      className="sticky h-[56px] top-0 z-10 flex items-center gap-3 border-b border-line px-3.5 py-[8px] backdrop-blur-xl"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--card)), color-mix(in srgb, var(--card) 92%, transparent) 68%)",
      }}
    >
      <Avatar user={face} name={title} src={thread.avatar} size={42} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold tracking-[-0.25px]">
          {title}
        </p>
        <p className="truncate text-[10.5px] font-medium text-dim">
          {under}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink active:scale-95"
        aria-label="Close convo options"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

export function ConvoSheet({
  open,
  onClose,
  thread,
  kind,
  pinnedCount,
  onChanged,
  onSkin,
  onGone,
  onGroupSettings,
  onMedia,
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  thread: ThreadCard | null;
  kind: "list" | "convo";
  pinnedCount?: number;
  onChanged?: () => void;
  onSkin?: (patch: { wallpaper?: string; tint?: string }) => void;
  onGone?: () => void;
  onGroupSettings?: (thread: ThreadDetail) => void;
  onMedia?: () => void;
  /** `panel` fills the caller's column instead of opening a dialog. */
  variant?: "modal" | "panel";
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useNames();
  const [view, setView] = useState<View>("main");
  const [overrides, setOverrides] = useState<Partial<ThreadDetail>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [prompting, setPrompting] = useState<"alias" | null>(null);
  const [pins, setPins] = useState(pinnedCount ?? 0);

  const detail = useQuery({
    queryKey: ["thread", thread?.id],
    queryFn: () => chatService.thread(thread!.id),
    enabled: open && kind === "convo" && Boolean(thread?.id),
    staleTime: 8_000,
  });

  const threadList = useQuery({
    queryKey: ["threads"],
    queryFn: () => chatService.threads(),
    enabled: open && pinnedCount == null,
    staleTime: 15_000,
  });

  const totalPins =
    pinnedCount ??
    threadList.data?.threads.filter((row) => row.pinned).length ??
    0;

  const row: ThreadDetail | null = thread
    ? ({
        ...thread,
        ...(detail.data?.thread ?? {}),
        ...overrides,
      } as ThreadDetail)
    : null;
  // Every write below is about the thread this sheet was opened on, and the
  // service methods take a plain id rather than the row.
  const threadId = row?.id ?? "";
  const catalog = detail.data?.catalog;
  const own = useOwnWall(threadId);

  useEffect(() => {
    if (!open) {
      setView("main");
      setOverrides({});
      setBusy(null);
      setConfirming(null);
      setPrompting(null);
    }
    setPins(totalPins);
  }, [open, thread?.id, totalPins]);

  if (!row) return null;

  const group = row.kind === "group";
  const self = row.self === true;
  const first = threadTitle(row).split(/\s+/)[0] || "them";
  const gate = (row.gate ?? null) as {
    mode?: string;
    blocked_by_me?: boolean;
  } | null;
  const blocked = String(gate?.mode ?? "") === "blocked";
  const blockedByMe = gate?.blocked_by_me === true;
  const hiddenBlock = blocked && !blockedByMe;
  const other = row.other ?? null;
  const mine = other ? aliasOf(other.id, other.username) : null;
  const realName = other?.name || other?.username || "them";
  const vanish = row.vanish_mode ?? "off";
  const days = row.vanish_days ?? VANISH_DEFAULT_DAYS;

  function changed() {
    onChanged?.();
  }

  async function flags(
    patch: Record<string, boolean>,
    key: string,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(key);
    try {
      const response = await chatService.flags(threadId, patch);
      setOverrides((current) => ({ ...current, ...response.thread }));
      changed();
      return true;
    } catch (error) {
      toast({
        title:
          key === "pinned" ? "That pin did not take" : "That did not change",
        description: errorMessage(error),
        tone: "error",
      });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function togglePin() {
    const on = !row?.pinned;
    if (on && pins >= PIN_MAX) {
      toast({
        title: `You can pin only ${PIN_MAX} convos`,
        description: "Unpin one of the others first.",
        tone: "info",
      });
      return;
    }
    if (await flags({ pinned: Boolean(on) }, "pinned")) {
      setPins((current) => Math.max(0, current + (on ? 1 : -1)));
      toast({
        title: on ? "Pinned to the top." : "Unpinned.",
        tone: "success",
      });
    }
  }

  async function toggleMute() {
    const on = !row?.muted;
    if (await flags({ muted: Boolean(on) }, "muted")) {
      toast({
        title: on ? "Muted." : "Notifications are back on.",
        tone: "success",
      });
    }
  }

  async function toggleVault() {
    const on = !row?.vaulted;
    const wasPinned = Boolean(row?.pinned);
    if (await flags({ vaulted: Boolean(on) }, "vaulted")) {
      if (on && wasPinned) setPins((current) => Math.max(0, current - 1));
      toast({
        title: on ? "Moved to the vault." : "Back in the convo list.",
        tone: "success",
      });
    }
  }

  async function setVanish(mode: string, length?: number) {
    if (busy) return;
    setBusy("vanish");
    try {
      const response = await chatService.vanish(threadId, mode, length);
      setOverrides((current) => ({
        ...current,
        vanish_mode: response.mode,
        vanish_days: response.days ?? length ?? VANISH_DEFAULT_DAYS,
      }));
      setView("main");
      changed();
      toast({
        title:
          response.mode === "off"
            ? "This convo stays."
            : `Disappearing convo · ${vanishLabel(response.mode, response.days ?? length)}`,
        tone: "success",
      });
    } catch (error) {
      toast({
        title: "Could not change that",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function setSkin(
    patch: { wallpaper?: string; tint?: string },
    key: string,
  ) {
    if (busy) return;
    const before = {
      wallpaper: row?.wallpaper ?? "default",
      tint: row?.tint ?? "default",
    };
    const photo = patch.wallpaper === undefined ? null : ownWallOf(threadId);
    setBusy(key);
    setOverrides((current) => ({ ...current, ...patch }));
    onSkin?.(patch);
    if (patch.wallpaper !== undefined) clearOwnWall(threadId);
    try {
      const response = await chatService.skin(threadId, patch);
      setOverrides((current) => ({ ...current, ...response }));
      onSkin?.(response);
      changed();
      toast({
        title:
          key === "wallpaper" ? "Wallpaper changed." : "Convo theme changed.",
        tone: "success",
      });
    } catch (error) {
      setOverrides((current) => ({ ...current, ...before }));
      onSkin?.(before);
      if (photo) setOwnWall(threadId, photo.src, photo.opacity);
      toast({
        title: "Could not change that",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function setCustomWallpaper(file: File) {
    if (busy) return;
    setBusy("wallpaper");
    try {
      const src = await readWallImage(file);
      const kept = setOwnWall(threadId, src, OWN_WALL_OPACITY);
      setOverrides((current) => ({ ...current, wallpaper: "default" }));
      onSkin?.({ wallpaper: "default" });
      setView("main");
      toast({
        title: kept
          ? "Wallpaper set to your photo."
          : "Wallpaper set for this session.",
        description: kept
          ? undefined
          : "This browser would not keep the photo, so it goes when the page reloads.",
        tone: kept ? "success" : "info",
      });
      void chatService
        .skin(threadId, { wallpaper: "default" })
        .then((response) => {
          setOverrides((current) => ({ ...current, ...response }));
          onSkin?.(response);
          changed();
        })
        .catch(() => undefined);
    } catch (error) {
      toast({
        title: "Could not set photo",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  function removeCustomWallpaper() {
    if (busy) return;
    clearOwnWall(threadId);
    setView("main");
    toast({ title: "Wallpaper: None", tone: "success" });
    void chatService
      .skin(threadId, { wallpaper: "default" })
      .then((response) => {
        setOverrides((current) => ({ ...current, ...response }));
        onSkin?.(response);
        changed();
      })
      .catch(() => undefined);
  }

  function setCustomWallpaperOpacity(opacity: number) {
    setOwnWallOpacity(threadId, opacity);
  }

  async function toggleBlock() {
    const person = row?.other;
    if (!person) {
      toast({ title: "There is nobody here to block.", tone: "info" });
      return;
    }
    if (blockedByMe) {
      setBusy("block");
      try {
        await socialService.unblock(person.id);
        setOverrides((current) => ({ ...current, gate: { mode: "open" } }));
        changed();
        toast({ title: `${first} is unblocked.`, tone: "success" });
      } catch (error) {
        toast({
          title: "Could not unblock",
          description: errorMessage(error),
          tone: "error",
        });
      } finally {
        setBusy(null);
      }
      return;
    }
    setConfirming("block");
  }

  async function confirmBlock() {
    const person = row?.other;
    if (!person) return;
    setBusy("block");
    try {
      await socialService.block(person.id);
      setOverrides((current) => ({ ...current, gate: { mode: "blocked" } }));
      setConfirming(null);
      changed();
      toast({ title: `${first} is blocked.`, tone: "success" });
    } catch (error) {
      toast({
        title: "Could not block",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function confirmClear() {
    setBusy("clear");
    try {
      await chatService.clear(threadId);
      queryClient.removeQueries({ queryKey: ["messages", row?.id] });
      setConfirming(null);
      changed();
      onClose();
      toast({ title: "Convo cleared.", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not clear this convo",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function confirmTrash() {
    setBusy("trash");
    try {
      await chatService.removeThread(threadId);
      queryClient.removeQueries({ queryKey: ["messages", row?.id] });
      setConfirming(null);
      onGone?.();
      onClose();
      toast({ title: "Convo trashed.", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not trash this convo",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function confirmLeave() {
    setBusy("leave");
    try {
      await chatService.leave(threadId);
      queryClient.removeQueries({ queryKey: ["messages", row?.id] });
      setConfirming(null);
      onGone?.();
      onClose();
      toast({
        title: `You left ${row ? threadTitle(row) : "the group"}.`,
        tone: "success",
      });
    } catch (error) {
      toast({
        title: "Could not leave the group",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  function openGroup() {
    if (!row) return;
    onClose();
    onGroupSettings?.(detail.data?.thread ?? row);
  }

  function saveAlias(name: string) {
    if (!other) return;
    rememberName(other.id, other.username, name);
    setPrompting(null);
    changed();
    toast({ title: "Saved on this device.", tone: "success" });
  }

  function forgetAlias() {
    if (!other) return;
    rememberName(other.id, other.username, "");
    setPrompting(null);
    changed();
    toast({ title: "Back to their own name.", tone: "success" });
  }

  const walls = catalogWalls(catalog);
  const tints = catalogTints(catalog);

  const content = (
    <>
      {view === "main" ? (
        <>
          <SheetHead thread={row} onClose={onClose} />
          <div className="px-1 pb-5">
            <p className="px-3 pb-1.5 pt-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">
              This convo
            </p>
            {group && onGroupSettings ? (
              <ActionRow
                icon={<Users className="size-4" />}
                label="Group settings"
                line="Channels, admins, the lock, and the invite link."
                right="Open"
                onClick={openGroup}
                disabled={busy !== null || detail.isLoading}
              />
            ) : null}
            {!group && !self && other?.id ? (
              <ActionRow
                icon={<IdCard className="size-4" />}
                label={
                  mine
                    ? "Change the name on this device"
                    : "Rename on this device"
                }
                line="Only you see it, and their @handle stays as it is."
                disabled={busy !== null}
                onClick={() => setPrompting("alias")}
              />
            ) : null}
            <ActionRow
              icon={<Pin className="size-4" />}
              label={row.pinned ? "Unpin" : "Pin to top"}
              line={
                row.pinned ? undefined : "It stays above the rest of the list."
              }
              right={`${pins}/${PIN_MAX}`}
              active={Boolean(row.pinned)}
              disabled={busy !== null}
              onClick={() => void togglePin()}
            />
            {!self ? (
              <ActionRow
                icon={
                  row.muted ? (
                    <Bell className="size-4" />
                  ) : (
                    <BellOff className="size-4" />
                  )
                }
                label={row.muted ? "Unmute" : "Mute"}
                line={
                  row.muted
                    ? undefined
                    : "No sound, no badge. It still arrives."
                }
                active={Boolean(row.muted)}
                disabled={busy !== null}
                onClick={() => void toggleMute()}
              />
            ) : null}
            <ActionRow
              icon={
                row.vaulted ? (
                  <LockOpen className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )
              }
              label={
                row.vaulted ? "Take out of the vault" : "Move to the vault"
              }
              line={
                row.vaulted
                  ? undefined
                  : "Out of the convo list, behind your code."
              }
              active={Boolean(row.vaulted)}
              disabled={busy !== null}
              onClick={() => void toggleVault()}
            />
            {kind === "convo" && onMedia ? (
              <ActionRow
                icon={<Image className="size-4" />}
                label="Media and files"
                line="Everything shared in this convo."
                right="Open"
                onClick={onMedia}
              />
            ) : null}

            {kind === "convo" ? (
              <>
                <p className="mt-0.5 border-t border-line px-3 pb-1.5 pt-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">
                  Look & feel
                </p>
                <ActionRow
                  icon={<Image className="size-4" />}
                  label="Wallpaper"
                  line="Behind this convo, on your side only."
                  right={
                    own
                      ? "Your photo"
                      : (walls.find(
                          (wall) =>
                            wall.key === (row.wallpaper ?? "default"),
                        )?.name ?? "Default")
                  }
                  disabled={busy !== null}
                  onClick={() => setView("walls")}
                />
                <ActionRow
                  icon={<Palette className="size-4" />}
                  label="Convo theme"
                  line="Its accent, on your side only."
                  right={
                    tints.find((tint) => tint.key === (row.tint ?? "default"))
                      ?.name ?? "Default"
                  }
                  disabled={busy !== null}
                  onClick={() => setView("tints")}
                />
                <ActionRow
                  icon={<Clock3 className="size-4" />}
                  label="Disappearing convo"
                  line="Agreed for the whole convo, not one side."
                  right={vanishLabel(vanish, days)}
                  disabled={busy !== null}
                  onClick={() => setView("vanish")}
                />
                {!group && !self && !hiddenBlock ? (
                  <ActionRow
                    icon={<Ban className="size-4" />}
                    label={blockedByMe ? `Unblock ${first}` : `Block ${first}`}
                    danger={!blockedByMe}
                    disabled={
                      busy !== null || (detail.isLoading && !detail.data)
                    }
                    onClick={() => void toggleBlock()}
                  />
                ) : null}
              </>
            ) : null}

            <p className="mt-1.5 border-t border-line px-3 pb-1.5 pt-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-dim">
              Careful
            </p>
            <ActionRow
              icon={<Eraser className="size-4" />}
              label="Clear convo"
              line="Empty it, keep it."
              danger
              disabled={busy !== null}
              onClick={() => setConfirming("clear")}
            />
            {group ? (
              <ActionRow
                icon={<LogOut className="size-4" />}
                label="Leave group"
                line="Its convo stops reaching you."
                danger
                disabled={busy !== null}
                onClick={() => setConfirming("leave")}
              />
            ) : !self ? (
              <ActionRow
                icon={<Trash2 className="size-4" />}
                label="Trash convo"
                line="It leaves your list."
                danger
                disabled={busy !== null}
                onClick={() => setConfirming("trash")}
              />
            ) : null}
          </div>
        </>
      ) : view === "vanish" ? (
        <>
          <SubHead
            title="Disappearing convo"
            line="Agreed for the whole convo."
            onBack={() => setView("main")}
          />
          <div className="pb-3">
            <ActionRow
              icon={<Clock3 className="size-4" />}
              label="Off"
              line="Messages stay."
              active={vanish === "off"}
              right={
                vanish === "off" ? (
                  <Check className="size-4 text-accent" />
                ) : undefined
              }
              disabled={busy !== null}
              onClick={() => void setVanish("off")}
            />
            <ActionRow
              icon={<Clock3 className="size-4" />}
              label="Instant"
              line="Gone as soon as it is read and closed."
              active={vanish === "instant"}
              right={
                vanish === "instant" ? (
                  <Check className="size-4 text-accent" />
                ) : undefined
              }
              disabled={busy !== null}
              onClick={() => void setVanish("instant")}
            />
            <div className="mx-5 my-2 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-dim">
                After a while
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>
            {VANISH_DAYS.map((length) => (
              <ActionRow
                key={length}
                icon={<Clock3 className="size-4" />}
                label={`${length} ${length === 1 ? "day" : "days"}`}
                active={vanish === "timed" && days === length}
                right={
                  vanish === "timed" && days === length ? (
                    <Check className="size-4 text-accent" />
                  ) : undefined
                }
                disabled={busy !== null}
                onClick={() => void setVanish("timed", length)}
              />
            ))}
          </div>
        </>
      ) : view === "walls" ? (
        <>
          <SubHead
            title="Wallpaper"
            line="Behind this convo only. The other side keeps theirs."
            onBack={() => setView("main")}
          />
          {own ? (
            <div className="p-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-extrabold">Your photo</span>
                  <span className="text-[12px] text-accent font-bold">
                    {Math.round(own.opacity * 100)}%
                  </span>
                </div>
                <div className="relative aspect-[0.72] overflow-hidden rounded-[13px] border border-accent ring-2 ring-accent/25">
                  <img
                    src={own.src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div
                    className="absolute inset-0 bg-[var(--page)]"
                    style={{ opacity: 1 - own.opacity }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="size-5 shrink-0 text-[10.5px] font-bold text-dim">How much shows</span>
                  <label className="flex items-center gap-2 ">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(own.opacity * 100)}
                      onChange={(e) =>
                        setCustomWallpaperOpacity(Number(e.target.value) / 100)
                      }
                      className="flex-1 h-1.5 appearance-none bg-[var(--line)] rounded-full accent-accent"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={removeCustomWallpaper}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--bad)_30%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-[13px] font-bold text-[var(--bad)] transition hover:brightness-95 disabled:opacity-50"
                >
                  <Eraser className="size-4" />
                  Remove
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2.5 p-3">
            <button
              type="button"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.style.display = "none";
                document.body.append(input);
                const done = () => input.remove();
                input.addEventListener("change", () => {
                  const file = input.files?.[0];
                  done();
                  if (file) void setCustomWallpaper(file);
                });
                input.addEventListener("cancel", done);
                input.click();
              }}
              disabled={busy !== null}
              className={cn(
                "relative aspect-[0.75] overflow-hidden rounded-lg border bg-card transition",
                own
                  ? "border-accent ring-2 ring-accent/25"
                  : "border-line hover:border-accent/40",
              )}
            >
              <span className="flex h-full w-full items-center justify-center flex-col gap-2 bg-[color-mix(in_srgb,var(--page)_88%,var(--card))] text-[10px] font-bold text-dim">
                <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                  <Image className="size-5" />
                </span>
                <span>Your photo</span>
              </span>
              {own ? (
                <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Check className="size-3" />
                </span>
              ) : null}
            </button>
            {walls.map((wall) => {
              const picked = !own && (row.wallpaper ?? "default") === wall.key;
              const url = wallUrl(wall.key);
              return (
                <button
                  key={wall.key}
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void setSkin({ wallpaper: wall.key }, "wallpaper")
                  }
                  className={cn(
                    "relative aspect-[0.75] overflow-hidden rounded-lg border bg-card text-left transition",
                    picked
                      ? "border-accent ring-2 ring-accent/25"
                      : "border-line hover:border-accent/40",
                  )}
                >
                  {url ? (
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--page)_88%,var(--card))] text-[10px] font-bold text-dim">
                      Default
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-[rgb(0_0_0_/_0.45)] px-1.5 py-1 text-[9px] font-bold text-white">
                    {wall.name}
                  </span>
                  {picked ? (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <SubHead
            title="Convo theme"
            line="The accent in this convo only. The other side keeps theirs."
            onBack={() => setView("main")}
          />
          <div className="grid grid-cols-3 gap-3 p-4">
            {tints.map((tint) => {
              const color =
                tintHex(tint.key) ??
                tint.hex ??
                TINT_HEX[tint.key] ??
                "#7c5cff";
              const picked = (row.tint ?? "default") === tint.key;
              return (
                <button
                  key={tint.key}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void setSkin({ tint: tint.key }, "tint")}
                  className={cn(
                    "rounded-lg border p-3 transition",
                    picked
                      ? "border-accent bg-[var(--accent-soft)]"
                      : "border-line hover:border-accent/40",
                  )}
                >
                  <span
                    className="mx-auto flex size-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: color }}
                  >
                    {picked ? <Check className="size-4 text-white" /> : null}
                  </span>
                  <span className="mt-2 block text-[10.5px] font-bold">
                    {tint.name}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {busy && view === "main" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
          <Spinner className="size-4" />
        </div>
      ) : null}
    </>
  );

  return (
    <>
      {variant === "panel" ? (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-[color-mix(in_srgb,var(--page)_58%,var(--card))] scroll-thin">
          {content}
        </div>
      ) : (
        <Modal open={open} onClose={onClose} size="sm">
          {content}
        </Modal>
      )}

      <ConfirmDialog
        open={confirming === "block"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmBlock()}
        title={`Block ${first}?`}
        body="They cannot reach you, and neither of you sees the other online. The convo stays where it is."
        note="You can undo this from the same sheet."
        confirmLabel="Block"
        destructive
        loading={busy === "block"}
      />
      <ConfirmDialog
        open={confirming === "clear"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmClear()}
        title="Clear this convo?"
        body={`Everything in it goes from your side. ${group ? "Everybody else" : first} keeps their own copy.`}
        note="The convo itself stays open."
        confirmLabel="Clear"
        destructive
        loading={busy === "clear"}
      />
      <ConfirmDialog
        open={confirming === "trash"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmTrash()}
        title="Trash this convo?"
        body={`It leaves your list with everything in it. Anything new from ${first} brings it back.`}
        note="Nothing goes from their side."
        confirmLabel="Trash"
        destructive
        loading={busy === "trash"}
      />
      <ConfirmDialog
        open={confirming === "leave"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmLeave()}
        title={`Leave ${threadTitle(row)}?`}
        body="Nothing sent in it reaches you any more, and the group is told you left."
        confirmLabel="Leave"
        destructive
        loading={busy === "leave"}
      />
      <PromptDialog
        open={prompting === "alias"}
        onClose={() => setPrompting(null)}
        onSubmit={saveAlias}
        onReset={mine ? forgetAlias : undefined}
        title={`What do you call ${mine ?? realName}?`}
        label="A name only you see"
        placeholder={realName}
        note="Leave it empty to go back to their own name."
        initial={mine ?? realName}
        submitLabel="Save"
        maxLength={40}
      />
    </>
  );
}

function SubHead({
  title,
  line,
  onBack,
}: {
  title: string;
  line: string;
  onBack: () => void;
}) {
  return (
    <header className="flex items-start h-[57px] gap-1 border-b border-line px-3 py-1.5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-accent/10 hover:text-ink active:scale-[0.94] -ml-2 shrink-0"
        aria-label="Back"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="text-[16px] font-extrabold tracking-[-0.2px]">
          {title}
        </h2>
        <p className="text-[10.5px] leading-4 text-dim">{line}</p>
      </div>
    </header>
  );
}
