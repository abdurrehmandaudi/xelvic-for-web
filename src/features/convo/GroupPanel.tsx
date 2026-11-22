import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Camera,
  Circle,
  CircleDot,
  Hash,
  Link2Off,
  Link as LinkIcon,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldMinus,
  ShieldPlus,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import {
  ConfirmDialog,
  Modal,
  PromptDialog,
} from "@/components/overlays/Modal";
import { Button, Spinner } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { authService } from "@/services/auth.service";
import { chatService } from "@/services/chat.service";
import { errorMessage } from "@/utils/errors";
import { count } from "@/utils/format";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import type {
  Channel,
  Invite,
  ThreadDetail,
  ThreadMember,
  UserCard,
} from "@/types/api";

const RANK: Record<string, number> = { member: 0, admin: 1, owner: 2 };

function rankOf(role?: string | null): number {
  return RANK[role ?? ""] ?? 0;
}

function roleWord(role?: string | null): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

const POST_WORDS: Record<string, string> = {
  everyone: "Everybody",
  admins: "Admins only",
};

const MEDIA_WORDS: Record<string, string> = {
  any: "Anything",
  photos: "Photos only",
  video: "Video only",
  words: "Words only",
};

const POST_LINES: Record<string, string> = {
  everyone: "Anyone in the group can say something here.",
  admins: "The announcements room. Only admins may post.",
};

const MEDIA_LINES: Record<string, string> = {
  any: "Words, photos, video and files.",
  photos: "A gallery — no words and no video.",
  video: "Clips, and nothing else in it.",
  words: "No attachments of any kind.",
};

function channelLine(channel: Channel): string {
  const said: string[] = [];
  if (channel.post && channel.post !== "everyone") {
    said.push(POST_WORDS[channel.post] ?? channel.post);
  }
  if (channel.media && channel.media !== "any") {
    said.push(MEDIA_WORDS[channel.media] ?? channel.media);
  }
  return said.join(" · ");
}

function usedBy(joined: number | undefined): string {
  const said = count(joined ?? 0);
  return joined === 1 ? `Used by ${said} person.` : `Used by ${said} people.`;
}

function memberName(member: ThreadMember): string {
  const user = member.user;
  return user?.name || user?.username || "They";
}

function GroupRow({
  icon,
  label,
  line,
  right,
  bad,
  disabled,
  onClick,
  control,
}: {
  icon: ReactNode;
  label: string;
  line?: string | null;
  right?: ReactNode;
  bad?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  control?: ReactNode;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          bad
            ? "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-[var(--bad)]"
            : "bg-[var(--accent-soft)] text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        <span
          className={cn(
            "block truncate text-[12.5px] font-bold",
            bad && "text-[var(--bad)]",
          )}
        >
          {label}
        </span>
        {line ? (
          <span className="mt-0.5 block truncate text-[10.5px] text-dim">
            {line}
          </span>
        ) : null}
      </span>
      {right ? (
        <span className="shrink-0 text-[10.5px] font-bold text-dim">
          {right}
        </span>
      ) : null}
      {control}
    </>
  );

  if (!onClick) {
    return (
      <div className="flex w-full items-center gap-3 px-2.5 py-2.5 text-left opacity-45">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors active:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] disabled:pointer-events-none disabled:opacity-45",
        bad
          ? "hover:bg-[color-mix(in_srgb,var(--bad)_7%,transparent)]"
          : "hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
      )}
    >
      {body}
    </button>
  );
}

function GroupHeading({ text, note }: { text: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 px-2 pb-1 pt-2">
      <p className="text-[11px] font-extrabold tracking-[0.02em]">{text}</p>
      {note ? <p className="text-[10.5px] text-dim">{note}</p> : null}
    </div>
  );
}

function SwitchRow({
  icon,
  label,
  line,
  on,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  line: string;
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex w-full items-center gap-3 px-2 py-1.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold">{label}</span>
        <span className="block text-[10.5px] leading-4 text-dim">
          {line}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-45",
          on
            ? "bg-accent"
            : "bg-[color-mix(in_srgb,var(--ink)_18%,transparent)]",
        )}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0.5 my-auto size-4 rounded-full bg-white shadow transition-transform duration-200 ease-out",
            on ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

function ChoiceRow({
  label,
  line,
  on,
  disabled,
  onClick,
}: {
  label: string;
  line: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:pointer-events-none disabled:opacity-45"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[11px]",
          on
            ? "bg-accent text-on-accent"
            : "bg-[var(--accent-soft)] text-accent",
        )}
      >
        {on ? <CircleDot className="size-4" /> : <Circle className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold">{label}</span>
        <span className="mt-0.5 block text-[10.5px] leading-4 text-dim">
          {line}
        </span>
      </span>
    </button>
  );
}

type Confirming =
  | { kind: "deleteGroup" }
  | { kind: "leave" }
  | { kind: "channel"; channel: Channel }
  | { kind: "invite"; invite: Invite }
  | { kind: "member"; member: ThreadMember }
  | null;

type Sheet = "photo" | "channel" | "invite" | "member" | "addPeople" | null;

type Prompt =
  | { kind: "renameGroup" }
  | { kind: "newChannel" }
  | { kind: "renameChannel"; channel: Channel }
  | null;

export function GroupPanel({
  threadId,
  thread: seed,
  onClose,
  onChanged,
  onGone,
}: {
  threadId: string;
  thread: ThreadDetail;
  onClose: () => void;
  onChanged?: () => void;
  onGone?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [wanted, setWanted] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [member, setMember] = useState<ThreadMember | null>(null);
  const [picked, setPicked] = useState<UserCard[]>([]);
  const [peopleQuery, setPeopleQuery] = useState("");
  const deferredPeople = useDeferredValue(peopleQuery.trim());
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setWanted(typed.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [typed]);

  const detail = useQuery({
    queryKey: ["group-thread", threadId],
    queryFn: () => chatService.thread(threadId),
    initialData: { thread: seed },
    staleTime: 5_000,
  });

  const thread = detail.data?.thread ?? seed;
  const role = thread.my_role ?? "member";
  const canRun = rankOf(role) >= RANK.admin;
  const owns = role === "owner";
  const locked = thread.locked === true;
  const invitesOn = thread.invites_on !== false;
  const channels = thread.channels ?? [];
  const title = thread.title || "This group";

  const roster = useQuery({
    queryKey: ["group-roster", threadId, wanted],
    queryFn: () => chatService.members(threadId, wanted || undefined),
  });

  const links = useQuery({
    queryKey: ["group-invites", threadId],
    queryFn: () => chatService.invites(threadId),
    enabled: canRun,
    retry: false,
  });

  const people = useQuery({
    queryKey: ["group-people", deferredPeople],
    queryFn: () => authService.searchUsers(deferredPeople || undefined),
    enabled: sheet === "addPeople",
    staleTime: 10_000,
  });

  const members = roster.data?.members ?? [];
  const invites = links.data?.invites ?? [];
  const shown = roster.data?.shown ?? members.length;
  const total = roster.data?.total ?? members.length;
  const everyone = roster.data?.everyone ?? members.length;
  const capped = roster.data?.capped === true;
  const mine = new Set(
    members.filter((row) => !row.left_at).map((row) => row.user?.id),
  );

  function reload() {
    void detail.refetch();
    void roster.refetch();
    if (canRun) void links.refetch();
    onChanged?.();
  }

  async function run(key: string, call: () => Promise<string>) {
    if (busy) return;
    setBusy(key);
    try {
      toast({ title: await call(), tone: "success" });
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
      reload();
    }
  }

  function above(row: ThreadMember): boolean {
    return rankOf(row.role) < rankOf(role);
  }

  function setRule(room: Channel, patch: { post?: string; media?: string }) {
    const next = { ...room, ...patch };
    void run("rule", async () => {
      await chatService.updateChannel(threadId, room.id, {
        post: next.post ?? "everyone",
        media: next.media ?? "any",
      });
      setChannel(next);
      return `#${room.name} is set.`;
    });
  }

  function rosterNote(): string {
    if (wanted) {
      return capped
        ? `${count(shown)} of ${count(total)} found`
        : `${count(total)} found`;
    }
    return capped ? `${count(shown)} of ${count(everyone)}` : count(everyone);
  }

  async function sendPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "A group photo has to be a picture.", tone: "error" });
      return;
    }
    const form = new FormData();
    form.append("avatar", file);
    await run("photo", async () => {
      await chatService.setGroupAvatar(threadId, form);
      return "Group photo changed.";
    });
  }

  function share(inviteRow: Invite) {
    const url = inviteRow.url ?? "";
    if (!url) return;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => toast({ title: "Link copied.", tone: "success" }))
      .catch(() => toast({ title: url, tone: "info" }));
  }

  const mediaLine =
    thread.member_count === 1
      ? "1 member"
      : `${count(thread.member_count ?? mine.size)} members`;
  const meta = `${mediaLine} · ${count(channels.length)} ${
    channels.length === 1 ? "channel" : "channels"
  } · you are ${roleWord(role).toLowerCase()}`;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-[color-mix(in_srgb,var(--page)_58%,var(--card))] scroll-thin">
      <header
        className="sticky h-[56px] top-0 z-10 flex items-center gap-3 border-b border-line px-2 py-1.5 backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--card)), color-mix(in srgb, var(--card) 92%, transparent) 68%)",
        }}
      >
        <button
          type="button"
          disabled={!canRun || busy !== null}
          onClick={() => setSheet("photo")}
          className="relative flex size-11 shrink-0 items-center justify-center disabled:pointer-events-none"
          aria-label="Group photo"
        >
          <Avatar name={title} src={thread.avatar} size={40} />
          {canRun ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-line bg-card text-dim">
              <Camera className="size-[10px]" />
            </span>
          ) : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold tracking-[-0.25px]">
            {title}
          </p>
          <p className="truncate text-[10.5px] font-medium text-dim">
            {meta}
          </p>
        </div>
        {canRun ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setPrompt({ kind: "renameGroup" })}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink active:scale-95 disabled:opacity-50"
            aria-label="Rename"
          >
            <Pencil className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink active:scale-95"
          aria-label="Close group settings"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="px-1.5 pb-6">
        {canRun ? (
          <>
            <GroupHeading
              text="How the group runs"
              note={roleWord(role).toLowerCase()}
            />
            <SwitchRow
              icon={
                locked ? (
                  <Lock className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )
              }
              label={locked ? "Locked" : "Open"}
              line={
                locked
                  ? "Members cannot send. Admins still can."
                  : "Everybody in the group can send."
              }
              on={locked}
              disabled={busy !== null}
              onChange={(next) =>
                void run("locked", async () => {
                  await chatService.room(threadId, { locked: next });
                  return next
                    ? "Locked. Only admins can send for now."
                    : "Open again. Everybody can send.";
                })
              }
            />
            <SwitchRow
              icon={
                invitesOn ? (
                  <LinkIcon className="size-4" />
                ) : (
                  <Link2Off className="size-4" />
                )
              }
              label={invitesOn ? "Invites are on" : "Invites are off"}
              line={
                invitesOn
                  ? "New people can join by a link or by hand."
                  : "Nobody new can join — links stop working too."
              }
              on={invitesOn}
              disabled={busy !== null}
              onChange={(next) =>
                void run("invites", async () => {
                  await chatService.room(threadId, { invites_on: next });
                  return next
                    ? "Invites are on. Links work again."
                    : "Invites are off. Nobody new can join, links included.";
                })
              }
            />
            <GroupRow
              icon={<Camera className="size-4" />}
              label="Group photo"
              onClick={() => setSheet("photo")}
              disabled={busy !== null}
            />
             <div className="mx-3 my-3 border-t border-line" />
          </>
          
        ) : null}

        <GroupHeading text="Channels" note={count(channels.length)} />
        {channels.map((room) => (
          <GroupRow
            key={room.id}
            icon={<Hash className="size-4" />}
            label={`# ${room.name}`}
            line={
              channelLine(room) ||
              (channels.length === 1
                ? "The only room left, so this one stays."
                : null)
            }
            right={canRun ? "Change" : undefined}
            onClick={() => {
              setChannel(room);
              setSheet("channel");
            }}
            disabled={busy !== null}
          />
        ))}
        {canRun ? (
          <GroupRow
            icon={<Plus className="size-4" />}
            label="New channel"
            onClick={() => setPrompt({ kind: "newChannel" })}
            disabled={busy !== null}
          />
        ) : null}

        <div className="mx-3 my-3 border-t border-line" />

        {canRun ? (
          <>
            <GroupHeading text="Invite links" note={String(invites.length)} />
            {!invitesOn ? (
              <p className="px-3 pb-2 text-[11.5px] leading-5 text-dim">
                Invites are off, so there are no working links right now. Turn
                them back on above.
              </p>
            ) : null}
            {invites.map((row) => {
              const live = row.active === true;
              return (
                <GroupRow
                  key={row.id}
                  icon={
                    live ? (
                      <LinkIcon className="size-4" />
                    ) : (
                      <Link2Off className="size-4" />
                    )
                  }
                  label={row.code ?? "Invite link"}
                  line={live ? usedBy(row.joined_count) : "Turned off."}
                  right={live ? "Share" : "Off"}
                  onClick={
                    live
                      ? () => {
                          setInvite(row);
                          setSheet("invite");
                        }
                      : undefined
                  }
                  disabled={busy !== null}
                />
              );
            })}
            <GroupRow
              icon={<Plus className="size-4" />}
              label="New invite link"
              onClick={() =>
                void run("invite", async () => {
                  const answer = await chatService.makeInvite(threadId);
                  share(answer.invite);
                  return "Link ready.";
                })
              }
              disabled={busy !== null || !invitesOn}
            />
            <div className="mx-3 my-3 border-t border-line" />
          </>
        ) : null}

        <GroupHeading text="Members" note={rosterNote()} />
        {capped ? (
          <div className="px-2 pb-1 pt-1">
            <div className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-accent">
              <Search className="size-[18px] shrink-0 text-dim" />
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="Find a member"
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-dim"
              />
              {roster.isFetching ? (
                <Spinner className="size-3.5" />
              ) : typed ? (
                <button
                  type="button"
                  onClick={() => setTyped("")}
                  aria-label="Clear the search"
                >
                  <X className="size-4 text-dim" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {capped && members.length ? (
          <p className="px-3 pb-1.5 pt-1 text-[11px] leading-4 text-dim">
            A group this size is drawn a page at a time. Everybody is still here
            — search for a name to reach them.
          </p>
        ) : null}
        {members.map((row) => {
          const opens =
            Boolean(row.user) &&
            row.user?.id !== user?.id &&
            row.user?.can_open !== false;
          const face = (
            <>
              <Avatar user={row.user} name={memberName(row)} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold">
                  {memberName(row)}
                </span>
                <span className="block truncate text-[11px] text-dim">
                  @{row.user?.username ?? ""}
                  {row.left_at ? " · left" : ""}
                </span>
              </span>
            </>
          );
          const tail = (
            <>
              {row.role && row.role !== "member" ? (
                <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-dim">
                  {roleWord(row.role)}
                </span>
              ) : null}
              {canRun && above(row) ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setMember(row);
                    setSheet("member");
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94] shrink-0"
                  aria-label="Member controls"
                >
                  <MoreHorizontal className="size-4 text-dim" />
                </button>
              ) : null}
            </>
          );
          const rowClass =
            "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left";
          return opens ? (
            <Link
              key={row.user?.id ?? memberName(row)}
              to={`/profile/${row.user?.username}`}
              className={cn(
                rowClass,
                "transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
              )}
            >
              {face}
              {tail}
            </Link>
          ) : (
            <div key={row.user?.id ?? memberName(row)} className={rowClass}>
              {face}
              {tail}
            </div>
          );
        })}
        {!members.length && wanted ? (
          <p className="px-3 py-2.5 text-[12.5px] leading-5 text-dim">
            Nobody here by that name. The search looks through the whole group,
            not just the page on screen.
          </p>
        ) : null}
        {canRun ? (
          <GroupRow
            icon={<UserPlus className="size-4" />}
            label="Add people"
            onClick={() => {
              setPicked([]);
              setPeopleQuery("");
              setSheet("addPeople");
            }}
            disabled={busy !== null || !invitesOn}
          />
        ) : null}

        <div className="mx-3 my-3 border-t border-line" />

        <GroupRow
          icon={<LogOut className="size-4" />}
          label="Leave group"
          bad
          onClick={() => setConfirming({ kind: "leave" })}
          disabled={busy !== null}
        />
        {owns ? (
          <GroupRow
            icon={<Trash2 className="size-4" />}
            label="Delete group"
            bad
            onClick={() => setConfirming({ kind: "deleteGroup" })}
            disabled={busy !== null}
          />
        ) : null}
      </div>

      <Modal
        open={sheet === "photo"}
        onClose={() => setSheet(null)}
        title={title}
        size="sm"
      >
        <div className="p-2 pb-4">
          <GroupRow
            icon={<Camera className="size-4" />}
            label="Choose a photo"
            onClick={() => {
              setSheet(null);
              libraryInput.current?.click();
            }}
          />
          <GroupRow
            icon={<Camera className="size-4" />}
            label="Take a photo"
            onClick={() => {
              setSheet(null);
              cameraInput.current?.click();
            }}
          />
          {thread.avatar ? (
            <GroupRow
              icon={<Trash2 className="size-4" />}
              label="Remove photo"
              bad
              onClick={() => {
                setSheet(null);
                void run("photo", async () => {
                  await chatService.clearGroupAvatar(threadId);
                  return "Group photo removed.";
                });
              }}
            />
          ) : null}
        </div>
      </Modal>

      <Modal
        open={sheet === "channel" && Boolean(channel)}
        onClose={() => setSheet(null)}
        title={channel ? `# ${channel.name}` : "Channel"}
        size="sm"
      >
        {channel ? (
          <div className="p-2 pb-5">
            <p className="px-3 pb-1 pt-1 text-[11px] font-extrabold">
              Who may post
            </p>
            {["everyone", "admins"].map((key) => (
              <ChoiceRow
                key={key}
                label={POST_WORDS[key]}
                line={POST_LINES[key]}
                on={(channel.post ?? "everyone") === key}
                disabled={!canRun || busy !== null}
                onClick={() => setRule(channel, { post: key })}
              />
            ))}
            <p className="px-3 pb-1 pt-4 text-[11px] font-extrabold">
              What can go in it
            </p>
            {["any", "photos", "video", "words"].map((key) => (
              <ChoiceRow
                key={key}
                label={MEDIA_WORDS[key]}
                line={MEDIA_LINES[key]}
                on={(channel.media ?? "any") === key}
                disabled={!canRun || busy !== null}
                onClick={() => setRule(channel, { media: key })}
              />
            ))}
            {canRun ? (
              <>
                <div className="mx-2 my-2 border-t border-line" />
                <GroupRow
                  icon={<Pencil className="size-4" />}
                  label="Rename channel"
                  onClick={() => {
                    const room = channel;
                    setSheet(null);
                    setPrompt({ kind: "renameChannel", channel: room });
                  }}
                />
                <GroupRow
                  icon={<Trash2 className="size-4" />}
                  label="Delete channel"
                  bad
                  onClick={() => {
                    const room = channel;
                    setSheet(null);
                    setConfirming({ kind: "channel", channel: room });
                  }}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={sheet === "invite" && Boolean(invite)}
        onClose={() => setSheet(null)}
        title={invite?.code ?? "Invite link"}
        description={
          invite
            ? `Used by ${count(invite.joined_count ?? 0)} so far`
            : undefined
        }
        size="sm"
      >
        <div className="p-2 pb-4">
          <GroupRow
            icon={<LinkIcon className="size-4" />}
            label="Share the link"
            onClick={() => {
              const row = invite;
              setSheet(null);
              if (row) share(row);
            }}
          />
          <GroupRow
            icon={<Link2Off className="size-4" />}
            label="Turn it off"
            bad
            onClick={() => {
              const row = invite;
              setSheet(null);
              if (row) setConfirming({ kind: "invite", invite: row });
            }}
          />
        </div>
      </Modal>

      <Modal
        open={sheet === "member" && Boolean(member)}
        onClose={() => setSheet(null)}
        title={member ? memberName(member) : "Member"}
        description={member ? roleWord(member.role) : undefined}
        size="sm"
      >
        <div className="p-2 pb-4">
          <GroupRow
            icon={
              member?.role === "admin" ? (
                <ShieldMinus className="size-4" />
              ) : (
                <ShieldPlus className="size-4" />
              )
            }
            label={
              member?.role === "admin" ? "Remove as admin" : "Make an admin"
            }
            line={
              member?.role === "admin"
                ? "They go back to being a member."
                : "They can lock the group, add a channel and put people in."
            }
            onClick={() => {
              const row = member;
              if (!row) return;
              const next = row.role === "admin" ? "member" : "admin";
              const who = memberName(row);
              setSheet(null);
              void run("role", async () => {
                await chatService.setMemberRole(
                  threadId,
                  row.user?.id ?? "",
                  next,
                );
                return next === "admin"
                  ? `${who} is an admin now.`
                  : `${who} is a member now.`;
              });
            }}
          />
          <GroupRow
            icon={<UserMinus className="size-4" />}
            label="Remove from group"
            bad
            onClick={() => {
              const row = member;
              setSheet(null);
              if (row) setConfirming({ kind: "member", member: row });
            }}
          />
        </div>
      </Modal>

      <Modal
        open={sheet === "addPeople"}
        onClose={() => setSheet(null)}
        title="Add people"
        size="sm"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10.5px] text-dim">
              {picked.length} {picked.length === 1 ? "person" : "people"}
            </span>
            <Button
              size="sm"
              disabled={!picked.length || busy !== null}
              onClick={() => {
                const chosen = picked;
                setSheet(null);
                void run("members", async () => {
                  await chatService.addMembers(
                    threadId,
                    chosen.map((person) => person.id),
                  );
                  const n = chosen.length;
                  return n === 1 ? "1 person added." : `${n} people added.`;
                });
              }}
            >
              Add{picked.length ? ` ${picked.length}` : ""}
            </Button>
          </div>
        }
      >
        <div className="p-3">
          <input
            value={peopleQuery}
            onChange={(event) => setPeopleQuery(event.target.value)}
            placeholder="Search by name or @handle"
            className="w-full min-h-10 rounded-control border border-line bg-card px-4 py-3 text-ink transition-[border-color,box-shadow] duration-[160ms] placeholder:text-dim-80 focus:border-accent focus:shadow-field-focus focus:outline-none"
            autoComplete="off"
          />
          <div className="mt-2">
            {(people.data?.results ?? []).map((person) => {
              const taken = mine.has(person.id);
              const on = picked.some((row) => row.id === person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  disabled={taken}
                  onClick={() =>
                    setPicked((current) =>
                      on
                        ? current.filter((row) => row.id !== person.id)
                        : [...current, person],
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:pointer-events-none disabled:opacity-40",
                    on &&
                      "bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]",
                  )}
                >
                  <Avatar user={person} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold">
                      {person.name || person.username}
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-dim">
                      @{person.username}
                      {taken ? " · already in" : ""}
                    </span>
                  </span>
                  {on ? (
                    <CircleDot className="size-4 shrink-0 text-accent" />
                  ) : null}
                </button>
              );
            })}
            {!people.isFetching && !(people.data?.results ?? []).length ? (
              <p className="px-3 py-2.5 text-[12px] text-dim">
                {peopleQuery.trim()
                  ? "Nobody by that name"
                  : "Nobody left to add"}
              </p>
            ) : null}
          </div>
        </div>
      </Modal>

      <PromptDialog
        open={prompt?.kind === "renameGroup"}
        onClose={() => setPrompt(null)}
        title="Group name"
        label="Group name"
        placeholder="Sunday plan"
        initial={title}
        submitLabel="Save"
        loading={busy === "rename"}
        onSubmit={(value) => {
          setPrompt(null);
          void run("rename", async () => {
            await chatService.renameGroup(threadId, value);
            return `Renamed to ${value}.`;
          });
        }}
      />
      <PromptDialog
        open={prompt?.kind === "newChannel"}
        onClose={() => setPrompt(null)}
        title="New channel"
        label="New channel"
        placeholder="photos"
        note="A room inside this group. Everybody in the group can read it."
        submitLabel="Open"
        maxLength={40}
        loading={busy === "channel"}
        onSubmit={(value) => {
          setPrompt(null);
          void run("channel", async () => {
            await chatService.createChannel(threadId, value);
            return `#${value} is open.`;
          });
        }}
      />
      <PromptDialog
        open={prompt?.kind === "renameChannel"}
        onClose={() => setPrompt(null)}
        title="Rename channel"
        label="Rename channel"
        placeholder={
          prompt?.kind === "renameChannel" ? prompt.channel.name : ""
        }
        initial={prompt?.kind === "renameChannel" ? prompt.channel.name : ""}
        submitLabel="Save"
        maxLength={40}
        loading={busy === "channel"}
        onSubmit={(value) => {
          const room = prompt?.kind === "renameChannel" ? prompt.channel : null;
          setPrompt(null);
          if (!room) return;
          void run("channel", async () => {
            await chatService.updateChannel(threadId, room.id, { name: value });
            return `#${room.name} is now #${value}.`;
          });
        }}
      />

      <ConfirmDialog
        open={confirming?.kind === "leave"}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming?.kind !== "leave") return;
          setConfirming(null);
          void (async () => {
            setBusy("leave");
            try {
              await chatService.leave(threadId);
              queryClient.removeQueries({ queryKey: ["messages", threadId] });
              toast({ title: `You left ${title}.`, tone: "success" });
              onGone?.();
              onClose();
            } catch (error) {
              toast({
                title: "Could not leave the group",
                description: errorMessage(error),
                tone: "error",
              });
            } finally {
              setBusy(null);
            }
          })();
        }}
        title={`Leave ${title}?`}
        body={
          owns
            ? "You run this group, so it passes to whoever is left — an admin if there is one, otherwise the oldest member."
            : "Its convo stops reaching you."
        }
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        loading={busy === "leave"}
      />

      <ConfirmDialog
        open={confirming?.kind === "deleteGroup"}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming?.kind !== "deleteGroup") return;
          setConfirming(null);
          void (async () => {
            setBusy("delete");
            try {
              await chatService.deleteGroup(threadId);
              queryClient.removeQueries({ queryKey: ["messages", threadId] });
              toast({ title: `${title} is gone.`, tone: "success" });
              onGone?.();
              onClose();
            } catch (error) {
              toast({ title: errorMessage(error), tone: "error" });
            } finally {
              setBusy(null);
            }
          })();
        }}
        title={`Delete ${title}?`}
        body="Every channel, everything said in them and everybody's place in the group go with it. Photos and videos sent here stop being reachable."
        note="This cannot be brought back, and nobody else in the group has to agree — you are the only one who can do it."
        confirmLabel="Delete it"
        cancelLabel="Keep it"
        destructive
        loading={busy === "delete"}
      />

      <ConfirmDialog
        open={confirming?.kind === "channel"}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming?.kind !== "channel") return;
          const room = confirming.channel;
          setConfirming(null);
          void run("channel", async () => {
            await chatService.removeChannel(threadId, room.id);
            return `#${room.name} is gone.`;
          });
        }}
        title={
          confirming?.kind === "channel"
            ? `Delete #${confirming.channel.name}?`
            : "Delete this channel?"
        }
        body="Everything said in it goes with it. That cannot be brought back."
        note={
          channels.length === 1
            ? "A group keeps one room at least, so this is the one that stays."
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        loading={busy === "channel"}
      />

      <ConfirmDialog
        open={confirming?.kind === "invite"}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming?.kind !== "invite") return;
          const row = confirming.invite;
          setConfirming(null);
          void run("invite", async () => {
            await chatService.revokeInvite(threadId, row.id);
            return "That link is off.";
          });
        }}
        title="Turn off this link?"
        body="Anybody holding it can no longer come in. A new link is a tap away, and the two are not the same link."
        confirmLabel="Turn it off"
        cancelLabel="Leave it"
        destructive
        loading={busy === "invite"}
      />

      <ConfirmDialog
        open={confirming?.kind === "member"}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming?.kind !== "member") return;
          const row = confirming.member;
          const who = memberName(row);
          setConfirming(null);
          void run("member", async () => {
            await chatService.removeMember(threadId, row.user?.id ?? "");
            return `${who} was removed.`;
          });
        }}
        title={
          confirming?.kind === "member"
            ? `Remove ${memberName(confirming.member)}?`
            : "Remove them?"
        }
        body="They leave the group and stop getting anything from it. They can come back through a link."
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        loading={busy === "member"}
      />

      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void sendPhoto(file);
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture={
          "environment" as InputHTMLAttributes<HTMLInputElement>["capture"]
        }
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void sendPhoto(file);
        }}
      />
    </div>
  );
}
