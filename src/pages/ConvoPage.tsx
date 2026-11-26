import {
  Fragment,
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  Eraser,
  Lock,
  LogOut,
  MessageCircle,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Search,
  Settings,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { MdKeyboardArrowRight } from "react-icons/md";
import { FaUserPlus } from "react-icons/fa6";
import { Avatar } from "@/components/ui/Avatar";
import { Button, Spinner } from "@/components/ui/Button";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { personLabel } from "@/utils/format";
import { AlertsManageModal } from "@/features/alerts/AlertsManageModal";
import { AlertsRow } from "@/features/alerts/AlertsRow";
import { alertWhen } from "@/features/alerts/model";
import { useAlerts } from "@/hooks/useAlerts";
import { ConvoRow } from "@/features/convo/ConvoRow";
import { handOffFiles } from "@/features/convo/dropHandoff";
import { ConvoSheet } from "@/features/convo/ConvoSheet";
import {
  PICK_LIMIT,
  pickNext,
  pileHolds,
  pileTake,
} from "@/features/convo/pile";
import { VaultModal } from "@/features/convo/VaultModal";
import { inUnreadLane, stamp, threadTitle, threadUnread } from "@/features/convo/model";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { authService } from "@/services/auth.service";
import { callsService } from "@/services/calls.service";
import { chatService } from "@/services/chat.service";
import { momentsService } from "@/services/moments.service";
import { socialService } from "@/services/social.service";
import { sparksService } from "@/services/sparks.service";
import { readCallsSeen, writeCallsSeen } from "@/store/callsSeen";
import { useAuth } from "@/hooks/useAuth";
import { useCallEngine } from "@/hooks/useCall";
import { useSocket, useSocketEvent } from "@/hooks/useSocket";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
// The camera's own code, fetched while this list is being read. See
// `features/camera/warm.ts` — this downloads a module and nothing else.
import { warmCamera, warmCameraWhenIdle } from "@/features/camera/warm";
import type {
  ChatRequest,
  Message,
  Relationship,
  Spark,
  ThreadCard,
  TrayMoment,
  UserCard,
} from "@/types/api";

const CameraCapture = lazy(() =>
  import("@/features/camera/CameraCapture").then((module) => ({
    default: module.CameraCapture,
  })),
);

type Lane = "all" | "unread" | "groups" | "requested" | "calls";

function alertSeat(rows: ThreadCard[], pinned: boolean, at: string | null) {
  const mine = at ? Date.parse(at) : Number.NaN;
  let seat = 0;
  for (; seat < rows.length; seat++) {
    const row = rows[seat];
    const rowPinned = row.pinned === true;
    if (pinned !== rowPinned) {
      if (pinned) return seat;
      continue;
    }
    if (Number.isNaN(mine)) continue;
    const there = row.last_message_at
      ? Date.parse(row.last_message_at)
      : Number.NaN;
    if (Number.isNaN(there) || there < mine) return seat;
  }
  return seat;
}

function sortThreads(rows: ThreadCard[]) {
  return [...rows].sort((a, b) => {
    const ap = a.pinned === true;
    const bp = b.pinned === true;
    if (ap !== bp) return ap ? -1 : 1;
    const at = Date.parse(b.last_message_at ?? b.preview?.at ?? "");
    const bt = Date.parse(a.last_message_at ?? a.preview?.at ?? "");
    return (Number.isNaN(at) ? 0 : at) - (Number.isNaN(bt) ? 0 : bt);
  });
}

interface CallPerson {
  user?: string;
  name?: string;
  username?: string;
  avatar?: string | null;
}

interface CallLog {
  id: string;
  kind?: string;
  at?: string | null;
  outgoing?: boolean;
  outcome?: string;
  seconds?: number;
  mine?: string;
  thread?: string | null;
  others?: CallPerson[];
}

function callLength(seconds: number) {
  const safe = Math.max(0, Math.min(86_399, Math.trunc(seconds)));
  const minutes = Math.floor(safe / 60);
  const tail = String(safe % 60).padStart(2, "0");
  if (minutes < 60) return `${String(minutes).padStart(2, "0")}:${tail}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${tail}`;
}

function callWho(log: CallLog) {
  const names = (log.others ?? [])
    .map((one) => personLabel(one))
    .filter(Boolean);
  return names.length ? names.join(", ") : "Call";
}

function callLine(log: CallLog) {
  const outgoing = log.outgoing === true;
  if (log.mine === "declined") return "You declined";
  if (log.mine === "joined" || log.mine === "left") {
    const way = outgoing ? "Outgoing" : "Incoming";
    return log.seconds ? `${way} · ${callLength(log.seconds)}` : way;
  }
  if (log.outcome === "declined") return outgoing ? "Declined" : "Missed";
  return outgoing ? "No answer" : "Missed";
}

function callDay(at: string | null | undefined) {
  if (!at) return { key: "older", label: "Earlier" };
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return { key: "older", label: "Earlier" };
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (one: Date, two: Date) =>
    one.getFullYear() === two.getFullYear() &&
    one.getMonth() === two.getMonth() &&
    one.getDate() === two.getDate();
  if (same(date, today)) return { key: "today", label: "Today" };
  if (same(date, yesterday)) return { key: "yesterday", label: "Yesterday" };
  return {
    key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    label: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(date.getFullYear() !== today.getFullYear()
        ? { year: "numeric" }
        : {}),
    }),
  };
}

function callStamp(at: string | null | undefined) {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${callDay(at).label}, ${time}`;
}

function CallHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const callEngine = useCallEngine();
  const calls = useQuery({
    queryKey: ["call-history"],
    queryFn: () => callsService.history(),
    staleTime: 15_000,
  });

  // Calling somebody back from the log they are in. The row already knows who
  // it was with and what kind of call it was, so the button is the same call
  // placed again — and a refusal is shown as it came, not swallowed.
  function callBack(userId: string | undefined, kind: string | undefined) {
    if (!userId) return;
    void callEngine.ring(userId, kind === "video" ? "video" : "audio").catch((error: unknown) => {
      toast({
        title: "That call did not go through.",
        description: errorMessage(error),
        tone: "error",
      });
    });
  }

  if (calls.isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner />
      </div>
    );
  }
  if (calls.isError) {
    return (
      <ErrorState error={calls.error} onRetry={() => void calls.refetch()} />
    );
  }
  const rows = calls.data?.results ?? [];
  if (!rows.length) {
    return (
      <div className="px-2.5 pt-2">
        <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
          <EmptyState
            icon={<Phone className="size-6" />}
            title="No calls yet"
            body="Calls you make and calls you miss are kept here."
            className="py-12"
          />
        </div>
      </div>
    );
  }

  const groups = new Map<string, { label: string; rows: CallLog[] }>();
  for (const log of rows) {
    const day = callDay(log.at);
    const bucket = groups.get(day.key);
    if (bucket) bucket.rows.push(log);
    else groups.set(day.key, { label: day.label, rows: [log] });
  }

  return (
    <div className="">
      {Array.from(groups.entries()).map(([key, group]) => (
        <section key={key}>
          <div className="">
            {group.rows.map((log) => {
              const declined =
                log.mine === "declined" || log.outcome === "declined";
              const dead = log.mine !== "joined" && log.mine !== "left";
              const answered = (log.seconds ?? 0) > 0;
              const only = (log.others ?? []).length === 1;
              const Icon = declined
                ? PhoneOff
                : dead
                  ? PhoneMissed
                  : log.outgoing
                    ? PhoneOutgoing
                    : PhoneIncoming;
              const other = log.others?.[0];
              return (
                <div
                  key={log.id}
                  className="group relative overflow-hidden border border-line/90 bg-card px-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_5%,var(--card))]"
                >
                  <div className="flex min-h-[52px] items-center gap-2 pl-1.5">
                    <button
                      type="button"
                      disabled={!log.thread}
                      onClick={() =>
                        log.thread && navigate(`/convo/${log.thread}`)
                      }
                      className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-[14px] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-default"
                    >
                      <span className="relative flex shrink-0 items-center self-center">
                        <Avatar
                          src={other?.avatar}
                          name={callWho(log)}
                          size={40}
                        />
                      </span>
                      <span className="min-w-0 flex-1 self-center py-1">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="min-w-0 truncate text-[14px] font-extrabold tracking-[-0.15px]">
                            {callWho(log)}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-dim">
                            {callStamp(log.at)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-0 flex min-w-0 items-center gap-1.5 text-[11.5px] leading-4",
                            dead
                              ? "font-semibold text-[var(--bad)]"
                              : "font-medium text-dim",
                          )}
                        >
                          <span
                            className={cn(
                              "flex shrink-0 items-center justify-center",
                              answered
                                ? "text-[var(--good)]"
                                : "text-[var(--bad)]",
                            )}
                          >
                            <Icon
                              className="size-2.5"
                              strokeWidth={2.6}
                              aria-hidden
                            />
                          </span>
                          <span className="truncate">{callLine(log)}</span>
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center">
                      {only ? (
                        <button
                          type="button"
                          onClick={() => callBack(other?.user, log.kind)}
                          className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent ring-1 ring-inset ring-[color-mix(in_srgb,var(--accent)_18%,transparent)] transition duration-200 hover:scale-105 hover:bg-accent hover:text-on-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                          aria-label={
                            log.kind === "video"
                              ? "Video call back"
                              : "Call back"
                          }
                        >
                          {log.kind === "video" ? (
                            <Video className="size-[17px]" />
                          ) : (
                            <Phone className="size-[15px]" />
                          )}
                        </button>
                      ) : (
                        <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-dim/70">
                          <Users className="size-[15px]" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function requestLine(request: Relationship | ChatRequest) {
  const raw = "message" in request ? request.message : null;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && "text" in raw) {
    const text = (raw as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }
  return "";
}

function RequestsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const requests = useQuery({
    queryKey: ["social-requests"],
    queryFn: () => socialService.requests(),
  });
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["social-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["requests-count"] });
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
  }

  async function answer(userId: string, yes: boolean) {
    setBusy(userId);
    try {
      await socialService.answerRequest(userId, yes);
      toast({
        title: yes ? "Accepted — the convo is open." : "Declined.",
        tone: "success",
      });
      refresh();
    } catch (error) {
      toast({
        title: "That request did not change",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  if (requests.isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner />
      </div>
    );
  }
  if (requests.isError) {
    return (
      <ErrorState
        error={requests.error}
        onRetry={() => void requests.refetch()}
      />
    );
  }

  const chat = requests.data?.incoming_chat ?? [];
  const follow = requests.data?.incoming_follow ?? [];
  if (!chat.length && !follow.length) {
    return (
      <div className="px-2.5 pt-2">
        <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
          <EmptyState
            icon={<UserPlus className="size-6" />}
            title="Nothing waiting"
            body="First lines and Keep requests land here."
            className="py-12"
          />
        </div>
      </div>
    );
  }

  function card(
    request: (typeof chat)[number] | (typeof follow)[number],
    withMessage: boolean,
  ) {
    const person = request.user;
    const name = personLabel(person);
    const message = withMessage ? requestLine(request) : "";
    return (
      <div
        key={request.id}
        className="rounded-[20px] border border-line bg-card p-3.5 shadow-[0_1px_2px_rgba(17,17,26,0.04)]"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 5%, var(--card)), var(--card) 60%)",
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar user={person} name={name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-extrabold tracking-[-0.1px]">
              {name}
            </p>
            <p className="truncate text-[11px] text-dim">@{person.username}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-dim">
            {stamp(request.chat_at ?? request.follow_at ?? request.created_at)}
          </span>
        </div>
        {message ? (
          <div className="mt-3 rounded-[14px] border border-[color-mix(in_srgb,var(--accent)_10%,var(--line))] bg-[var(--accent-soft)] px-3.5 py-2.5 text-[13px] leading-[1.45]">
            {message}
          </div>
        ) : null}
        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            disabled={busy === person.id}
            onClick={() => void answer(person.id, false)}
            className="h-[42px] flex-1 rounded-[13px] border border-line bg-card text-[12.5px] font-bold text-dim transition hover:border-[color-mix(in_srgb,var(--ink)_18%,var(--line))] hover:text-ink disabled:opacity-55"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={busy === person.id}
            onClick={() => void answer(person.id, true)}
            className="h-[42px] flex-1 rounded-[13px] bg-accent text-[12.5px] font-bold text-on-accent shadow-[0_4px_12px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition hover:brightness-105 disabled:opacity-55"
          >
            {busy === person.id ? "Working…" : "Accept"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {chat.length ? (
        <>
          <h2 className="px-1 pt-2 text-[11px] font-extrabold uppercase tracking-[1.1px] text-dim">
            Waiting to talk
          </h2>
          {chat.map((request) => card(request, true))}
        </>
      ) : null}
      {follow.length ? (
        <>
          <h2 className="px-1 pt-2 text-[11px] font-extrabold uppercase tracking-[1.1px] text-dim">
            Keep requests
          </h2>
          {follow.map((request) => card(request, false))}
        </>
      ) : null}
    </div>
  );
}

export function NewConvoPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const deferred = useDeferredValue(query.trim());
  const navigate = useNavigate();
  const { toast } = useToast();
  const tried = useRef("");
  const people = useQuery({
    queryKey: ["people-search", deferred],
    queryFn: () => authService.searchUsers(deferred),
    staleTime: 10_000,
  });
  const vault = useQuery({
    queryKey: ["vault"],
    queryFn: () => chatService.vaultState(),
    retry: false,
    staleTime: 20_000,
  });

  useEffect(() => {
    if (!vault.data?.hidden) {
      tried.current = "";
      return;
    }
    const code = query.trim();
    if (code.length !== (vault.data.length || 4)) {
      tried.current = "";
      return;
    }
    if (!/^\d+$/.test(code) || tried.current === code) return;
    tried.current = code;
    void chatService
      .vaultUnlock(code)
      .then(() => {
        tried.current = "";
        setQuery("");
        setVaultOpen(true);
      })
      .catch(() => undefined);
  }, [query, vault.data]);

  async function start(person: UserCard) {
    setBusy(person.id);
    try {
      const response = await chatService.start<{
        thread: ThreadCard | null;
        gate?: { reason?: string };
      }>(person.id);
      if (!response.thread) {
        toast({
          title: "This convo is not open yet",
          description:
            response.gate?.reason ||
            "They have not accepted a conversation with you.",
          tone: "info",
        });
        navigate(`/profile/${person.username}`);
        onClose();
        return;
      }
      onClose();
      navigate(`/convo/${response.thread.id}`);
    } catch (error) {
      toast({
        title: "Could not start that convo",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3.5 py-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
          <UserPlus className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-extrabold tracking-[-0.02em]">
            New convo
          </h2>
          <p className="truncate text-[10.5px] text-dim">
            Find someone by name or @handle.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink active:scale-95"
          aria-label="Close new convo"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="px-1.5 pt-1.5 flex shrink-0 flex-col gap-2.5">
        <label className="flex min-h-10 items-center gap-2.5 rounded-lg border border-line bg-paper px-3 shadow-[inset_0_1px_2px_rgba(17,17,26,0.03)] transition focus-within:border-accent focus-within:bg-card focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent)]">
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder="Search people"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
          />
        </label>

        <button
          type="button"
          onClick={() => setGroupOpen(true)}
          className="flex w-full shrink-0 items-center gap-3 rounded-lg border px-2 py-1.5 text-left transition hover:brightness-[1.01]"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--card)), var(--card) 75%)",
            borderColor: "color-mix(in srgb, var(--accent) 18%, var(--line))",
          }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent">
            <Users className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-extrabold">
              Start a group
            </span>
            <span className="block truncate text-[10px] text-dim">
              Name it and bring people in.
            </span>
          </span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-accent shadow-sm">
            <ArrowRight className="size-4" />
          </span>
        </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {people.isLoading ? (
            <div className="flex h-full min-h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : people.isError ? (
            <ErrorState
              error={people.error}
              onRetry={() => void people.refetch()}
              compact
            />
          ) : !people.data?.results?.length ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                <Search className="size-4" />
              </span>
              <p className="mt-3 text-[12px] font-bold">
                {deferred ? "Nobody matched" : "No accounts to show"}
              </p>
              <p className="mt-1 text-[10.5px] text-dim">
                {deferred
                  ? `Nothing found for \u201c${deferred}\u201d.`
                  : "Try a name or an @handle."}
              </p>
            </div>
          ) : (
            <>
              <p className="px-3 pb-1.5 pt-1 text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-dim">
                {deferred ? "Results" : "People you may know"}
              </p>
              <div className="px-1">
                {people.data.results.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => void start(person)}
                    disabled={Boolean(busy)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-1 py-1.5 text-left transition hover:border-line hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))] disabled:opacity-55"
                  >
                    <Avatar user={person} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-extrabold">
                        {personLabel(person)}
                      </span>
                      <span className="block truncate text-[10.5px] text-dim">
                        @{person.username}
                      </span>
                    </span>
                    {busy === person.id ? (
                      <Spinner className="size-4" />
                    ) : (
                      <span className="flex size-8 items-center justify-center text-dim">
                        <MdKeyboardArrowRight className="size-5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <NewGroupModal
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        onCreated={onClose}
      />

      <VaultModal
        open={vaultOpen}
        onClose={() => {
          setVaultOpen(false);
          onClose();
        }}
        onOpenThread={(thread) => {
          setVaultOpen(false);
          onClose();
          navigate(`/convo/${thread.id}`);
        }}
      />
    </div>
  );
}

function NewGroupModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<UserCard[]>([]);
  const [busy, setBusy] = useState(false);
  const deferred = useDeferredValue(query.trim());
  const navigate = useNavigate();
  const { toast } = useToast();
  const people = useQuery({
    queryKey: ["group-people", deferred],
    queryFn: () => authService.searchUsers(deferred),
    enabled: open,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!open) {
      setTitle("");
      setQuery("");
      setMembers([]);
    }
  }, [open]);

  function toggle(person: UserCard) {
    setMembers((current) =>
      current.some((row) => row.id === person.id)
        ? current.filter((row) => row.id !== person.id)
        : [...current, person],
    );
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      toast({ title: "Give the group a name", tone: "info" });
      return;
    }
    if (!members.length) {
      toast({ title: "Bring at least one person in", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      const response = await chatService.createGroup(
        title.trim(),
        members.map((person) => person.id),
      );
      toast({ title: "Group made", tone: "success" });
      onClose();
      onCreated?.();
      navigate(`/convo/${response.thread.id}`);
    } catch (error) {
      toast({
        title: "The group was not made",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New group"
      description="Every group starts with a name and the people in it."
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-dim">
            {members.length} {members.length === 1 ? "person" : "people"}
          </span>
          <Button
            type="submit"
            form="new-group"
            loading={busy}
            icon={<Users className="size-4" />}
          >
            Make group
          </Button>
        </div>
      }
    >
      <form
        id="new-group"
        onSubmit={(event) => void create(event)}
        className="space-y-3 p-4"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={140}
          autoFocus
          placeholder="Group name"
          className="min-h-12 w-full rounded-[15px] border border-line bg-paper px-3.5 text-sm font-semibold outline-none transition focus:border-accent focus:bg-card focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent)]"
        />
        {members.length ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {members.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => toggle(person)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_16%,var(--line))] bg-[var(--accent-soft)] py-1 pl-1 pr-2 text-[10.5px] font-bold text-accent transition hover:brightness-95"
              >
                <Avatar user={person} size={24} />
                {person.name || person.username}
                <X className="size-3" />
              </button>
            ))}
          </div>
        ) : null}
        <label className="flex min-h-12 items-center gap-2.5 rounded-[15px] border border-line bg-paper px-3.5 transition focus-within:border-accent focus-within:bg-card">
          <Search className="size-4 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find people to add"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
          />
        </label>
        <div className="flex items-center justify-between px-1 pt-1">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-dim">
            {members.length ? "In this group" : "Add people"}
          </p>
          {members.length ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9.5px] font-extrabold text-accent">
              {members.length} selected
            </span>
          ) : null}
        </div>
        {people.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : !people.data?.results?.length ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
              <UserPlus className="size-4" />
            </span>
            <p className="mt-3 text-[12px] font-bold">
              {deferred ? "Nobody matched" : "Search for the first person"}
            </p>
            <p className="mt-1 text-[10.5px] text-dim">
              {deferred
                ? `Nothing found for \u201c${deferred}\u201d.`
                : "They will be added when you make the group."}
            </p>
          </div>
        ) : (
          <div className="max-h-[34dvh] space-y-1 overflow-y-auto">
            {people.data.results.map((person) => {
              const selected = members.some((row) => row.id === person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => toggle(person)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[14px] border px-2.5 py-2.5 text-left transition",
                    selected
                      ? "border-[color-mix(in_srgb,var(--accent)_22%,var(--line))] bg-[var(--accent-soft)]"
                      : "border-transparent hover:border-line hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))]",
                  )}
                >
                  <Avatar user={person} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-extrabold">
                      {person.name || person.username}
                    </span>
                    <span className="block truncate text-[10.5px] text-dim">
                      @{person.username}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border transition",
                      selected
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line bg-card",
                    )}
                  >
                    {selected ? <Check className="size-3" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </form>
    </Modal>
  );
}

function PickAction({
  icon,
  label,
  enabled,
  onClick,
  bad,
}: {
  icon: ReactNode;
  label: string;
  enabled: boolean;
  onClick: () => void;
  bad?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-3 transition",
        !enabled
          ? "cursor-default text-[color-mix(in_srgb,var(--ink)_32%,transparent)]"
          : bad
            ? "text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
            : "text-ink hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
      )}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

function MenuRow({
  icon,
  title,
  body,
  right,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  right?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:opacity-45",
        danger && "text-[var(--bad)]",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[13px]",
          danger
            ? "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]"
            : "bg-[var(--accent-soft)] text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-extrabold">{title}</span>
        <span className="block truncate text-[10.5px] leading-4 text-dim">
          {body}
        </span>
      </span>
      {right ? (
        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-bold text-dim">
          {right}
        </span>
      ) : null}
    </button>
  );
}

export function ConvoPage({
  embedded = false,
  activeThreadId,
  composeOpen = false,
  onToggleCompose,
  onOpenSpark,
}: {
  embedded?: boolean;
  activeThreadId?: string;
  composeOpen?: boolean;
  onToggleCompose?: () => void;
  onOpenSpark?: (
    thread: ThreadCard,
    spark: Spark | null,
    balance?: number,
  ) => void;
}) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("lane") ?? params.get("tab");
  const lane: Lane =
    raw === "unread"
      ? "unread"
      : raw === "groups"
        ? "groups"
        : raw === "requested" || raw === "requests"
          ? "requested"
          : raw === "calls"
            ? "calls"
            : "all";
  const [newGroup, setNewGroup] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  // The camera's code is fetched while this list is being read, so that tapping
  // the camera is not also the tap that begins a download. See
  // `features/camera/warm.ts` — it asks for no camera and no microphone.
  useEffect(() => warmCameraWhenIdle(), []);
  // Opening the menu is itself intent, and the beat between that and a tap on
  // its camera row is enough to fetch the chunk the tap would have started.
  useEffect(() => {
    if (menuOpen) warmCamera();
  }, [menuOpen]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [selected, setSelected] = useState<ThreadCard | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const dragPull = useRef(0);
  const dragFrame = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [callsSeenAt, setCallsSeenAt] = useState(() =>
    readCallsSeen(user?.id),
  );
  const { status: socketStatus } = useSocket();
  const { design } = useTheme();

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 140);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  useEffect(() => {
    setCallsSeenAt(readCallsSeen(user?.id));
  }, [user?.id]);

  useEffect(
    () => () => {
      if (dragFrame.current !== null) {
        window.cancelAnimationFrame(dragFrame.current);
      }
    },
    [],
  );

  function dragHalt() {
    dragPull.current = 0;
    if (dragFrame.current !== null) {
      window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
    }
  }

  function dragScroll() {
    if (dragFrame.current !== null) return;
    const tick = () => {
      const node = listRef.current;
      if (!node || dragPull.current === 0) {
        dragFrame.current = null;
        return;
      }
      node.scrollTop += dragPull.current;
      dragFrame.current = window.requestAnimationFrame(tick);
    };
    dragFrame.current = window.requestAnimationFrame(tick);
  }

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => chatService.threads(),
  });
  const vault = useQuery({
    queryKey: ["vault"],
    queryFn: () => chatService.vaultState(),
    retry: false,
    staleTime: 20_000,
  });
  const deferredSearch = useDeferredValue(listSearch.trim());
  // Cross-conversation message search, straight from the server. The local
  // filter below only narrows the list of convos; this finds the words
  // themselves, including in threads the filter would never surface.
  const messageSearch = useQuery({
    queryKey: ["chat-search", deferredSearch],
    queryFn: () => chatService.search(deferredSearch),
    enabled: searchOpen && deferredSearch.length >= 2,
    staleTime: 20_000,
  });
  const alerts = useAlerts();
  const sparks = useQuery({
    queryKey: ["sparks"],
    queryFn: () => sparksService.list(),
    staleTime: 60_000,
  });
  const moments = useQuery({
    queryKey: ["moments-tray"],
    queryFn: () => momentsService.tray(),
    staleTime: 30_000,
  });
  const requests = useQuery({
    queryKey: ["social-requests"],
    queryFn: () => socialService.requests(),
    staleTime: 15_000,
  });
  const callHistory = useQuery({
    queryKey: ["call-history"],
    queryFn: () => callsService.history(),
    staleTime: 15_000,
  });
  useEffect(() => {
    if (lane !== "calls" || !callHistory.data || !user?.id) return;
    let latest = 0;
    for (const call of callHistory.data.results) {
      const at = call.at ? Date.parse(call.at) : Number.NaN;
      if (Number.isFinite(at) && at > latest) latest = at;
    }
    if (!latest || latest <= callsSeenAt) return;
    writeCallsSeen(user.id, latest);
    setCallsSeenAt(latest);
  }, [lane, callHistory.data, callsSeenAt, user?.id]);
  useSocketEvent(
    [
      "message.new",
      "thread.update",
      "request.count",
      "request.new",
      "call.ended",
      "call.update",
    ],
    (frame) => {
      const data = (frame.data ?? {}) as Record<string, unknown>;
      // `thread.update` is the server's own answer for this seat: its unread
      // count, the row's preview (when this bubble is the one the row is
      // about), and when. Patch the card in place instead of refetching the
      // whole inbox for every message that lands anywhere.
      if (frame.event === "thread.update") {
        const threadId = String(data.thread_id ?? "");
        if (!threadId) return;
        const preview = (data.preview ?? undefined) as
          | ThreadCard["preview"]
          | undefined;
        const at = typeof data.at === "string" ? data.at : undefined;
        let found = false;
        queryClient.setQueryData<{ threads: ThreadCard[]; unread: number }>(
          ["threads"],
          (current) => {
            if (!current?.threads) return current;
            let delta = 0;
            const rows = current.threads.map((row) => {
              if (row.id !== threadId) return row;
              found = true;
              const before = threadUnread(row);
              const after =
                typeof data.unread === "number" ? data.unread : before;
              delta = after - before;
              return {
                ...row,
                unread_count: after,
                unread_other_count:
                  typeof data.unread_other_count === "number"
                    ? data.unread_other_count
                    : row.unread_other_count,
                last_message_at: at ?? row.last_message_at,
                // The frame leaves `preview` out when this bubble is not the
                // line the row describes (a cleared row, for instance); in
                // that case the honest thing is to keep what we hold.
                preview: preview
                  ? { ...preview, at: preview.at ?? at }
                  : row.preview,
              };
            });
            return {
              threads: sortThreads(rows),
              unread: Math.max(0, (current.unread ?? 0) + delta),
            };
          },
        );
        if (!found) {
          // A thread this list does not know yet (a first message, a new
          // group, a request leaving the gate): let the server answer.
          void queryClient.invalidateQueries({ queryKey: ["threads"] });
        }
      } else if (frame.event === "message.new") {
        // Every `message.new` that should move a row is paired with a
        // `thread.update`; this is only a safety net for threads the frame
        // did not describe.
        void queryClient.invalidateQueries({ queryKey: ["requests-count"] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["threads"] });
        void queryClient.invalidateQueries({ queryKey: ["requests-count"] });
        void queryClient.invalidateQueries({ queryKey: ["social-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["call-history"] });
      }
    },
  );

  const rows = useMemo(() => threads.data?.threads ?? [], [threads.data]);
  const threadById = useMemo(
    () => new Map(rows.map((row) => [String(row.id), row])),
    [rows],
  );
  const unreadRows = useMemo(
    () =>
      // The lane, not the count: a convo whose only waiting line is a Spark is
      // unread by the number and has nothing on it to read. See `inUnreadLane`.
      rows.filter((thread) => inUnreadLane(thread)),
    [rows],
  );
  const pinnedCount = useMemo(
    () =>
      rows.filter((thread) => thread.pinned).length +
      (alerts.data?.pinned ? 1 : 0),
    [rows, alerts.data?.pinned],
  );
  const sparkByThread = useMemo(
    () =>
      new Map(
        (sparks.data?.sparks ?? []).map(
          (spark) =>
            [String(spark.thread_id ?? spark.thread ?? ""), spark] as const,
        ),
      ),
    [sparks.data],
  );
  const momentByAuthor = useMemo(() => {
    const found = new Map<string, TrayMoment>();
    for (const row of [
      ...(moments.data?.unseen ?? []),
      ...(moments.data?.seen ?? []),
    ]) {
      if (row.author?.id && !found.has(row.author.id))
        found.set(row.author.id, row);
    }
    return found;
  }, [moments.data]);
  const requestCount =
    (requests.data?.incoming_chat?.length ?? 0) +
    (requests.data?.incoming_follow?.length ?? 0);
  const missedCallCount = useMemo(() => {
    const calls = callHistory.data?.results ?? [];
    return calls.filter((call) => {
      if (call.mine !== "missed") return false;
      if (!callsSeenAt) return true;
      const at = call.at ? Date.parse(call.at) : Number.NaN;
      return !Number.isFinite(at) || at > callsSeenAt;
    }).length;
  }, [callHistory.data, callsSeenAt]);
  const filteredRows = useMemo(() => {
    const query = listSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((thread) => {
      const person = thread.other ?? thread.member ?? thread.members?.[0]?.user;
      return [
        thread.title,
        person?.name,
        person?.username,
        thread.preview?.text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [listSearch, rows]);

  function openSearchResult(message: Message) {
    setSearchOpen(false);
    setListSearch("");
    navigate(`/convo/${message.thread}`);
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
    void queryClient.invalidateQueries({ queryKey: ["vault"] });
    void queryClient.invalidateQueries({ queryKey: ["vault-rows"] });
    void queryClient.invalidateQueries({ queryKey: ["sparks"] });
    void queryClient.invalidateQueries({ queryKey: ["moments-tray"] });
  }

  function setLane(next: Lane) {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        copy.delete("tab");
        if (next === "all") copy.delete("lane");
        else copy.set("lane", next);
        return copy;
      },
      { replace: true },
    );
  }

  function toggleSearch() {
    if (searchOpen) {
      setListSearch("");
      setSearchOpen(false);
      searchInputRef.current?.blur();
    } else {
      setSearchOpen(true);
    }
  }

  function startPick(id: string) {
    setSheetOpen(false);
    setSelected(null);
    setPicking(true);
    setPicked([id]);
  }

  function endPick() {
    setPicking(false);
    setPicked([]);
  }

  function togglePick(id: string) {
    const step = pickNext(picked, id);
    if (step.full) {
      toast({ title: `You can pick up to ${PICK_LIMIT}.`, tone: "info" });
      return;
    }
    setPicked(step.picked);
    if (step.empty) setPicking(false);
  }

  function pickAll() {
    const rows = displayRows.map((row) => row.id);
    if (pileHolds(rows, picked)) {
      setPicked([]);
      setPicking(false);
      return;
    }
    setPicked(pileTake(rows));
  }

  function settlePicked(rows: string[], failed: string[], said: string) {
    setPicked(failed);
    if (!failed.length) setPicking(false);
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
    const done = rows.length - failed.length;
    if (!failed.length) {
      toast({ title: `${said} ${rows.length} of them.`, tone: "success" });
    } else if (done === 0) {
      toast({ title: "Nothing took. Try again.", tone: "error" });
    } else {
      toast({
        title: `${said} ${done} of ${rows.length}. The rest are still picked.`,
        tone: "error",
      });
    }
  }

  async function lockPicked() {
    const rows = picked;
    if (!rows.length) return;
    setBulkBusy(true);
    const failed: string[] = [];
    for (const id of rows) {
      try {
        await chatService.flags(id, { vaulted: true });
      } catch {
        failed.push(id);
      }
    }
    setBulkBusy(false);
    settlePicked(rows, failed, "Moved to the vault.");
  }

  async function clearPicked() {
    const rows = picked;
    if (!rows.length) return;
    setBulkBusy(true);
    const failed: string[] = [];
    for (const id of rows) {
      try {
        await chatService.clear(id);
        queryClient.removeQueries({ queryKey: ["messages", id] });
      } catch {
        failed.push(id);
      }
    }
    setBulkBusy(false);
    settlePicked(rows, failed, "Cleared from your side.");
  }

  async function trashPicked() {
    const ids = picked;
    if (!ids.length) return;
    setTrashOpen(false);
    setLeaving(ids);
    setPicked([]);
    setPicking(false);
    setBulkBusy(true);
    try {
      await chatService.removeThreads(ids);
      for (const id of ids) {
        queryClient.removeQueries({ queryKey: ["messages", id] });
      }
      toast({
        title:
          ids.length === 1
            ? "Convo trashed."
            : `${ids.length} convos trashed.`,
        tone: "success",
      });
    } catch (error) {
      setPicked(ids);
      setPicking(true);
      toast({
        title: "Nothing took. Try again.",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      setLeaving([]);
      setBulkBusy(false);
    }
  }

  async function readAll() {
    if (!unreadRows.length) {
      toast({ title: "Nothing is waiting to be read.", tone: "info" });
      return;
    }
    setMenuOpen(false);
    try {
      await chatService.readAll();
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      await queryClient.invalidateQueries({ queryKey: ["requests-count"] });
      toast({ title: "All caught up.", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not mark them read",
        description: errorMessage(error),
        tone: "error",
      });
    }
  }

  const lanes: { key: Lane; label: string; count?: number }[] = [
    { key: "all", label: "All", count: filteredRows.length },
    {
      key: "unread",
      label: "Unread",
      count: filteredRows.filter((thread) => inUnreadLane(thread)).length,
    },
    {
      key: "groups",
      label: "Groups",
      count: filteredRows.filter((thread) => thread.kind === "group").length,
    },
    { key: "requested", label: "Requests", count: requestCount },
    {
      key: "calls",
      label: "Calls",
      count: missedCallCount,
    },
  ];

  const tabLanes = lanes.filter(
    (item) => item.key !== "requested" || user?.is_company === true,
  );
  const hasActiveTab = tabLanes.some((item) => item.key === lane);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const list = tabListRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>(
        '[role="tab"][aria-selected="true"]',
      );
      if (active) {
        setUnderline({ left: active.offsetLeft, width: active.offsetWidth });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [lane, tabLanes.length, user?.is_company]);

  const displayRows =
    lane === "unread"
      ? filteredRows.filter((thread) => inUnreadLane(thread))
      : lane === "groups"
        ? filteredRows.filter((thread) => thread.kind === "group")
        : filteredRows;
  const showAlerts = lane === "all";
  const newestAlert = alerts.data?.results?.[0];
  const alertAt = newestAlert ? alertWhen(newestAlert) : null;
  const alertRowSeat = showAlerts
    ? alertSeat(
        displayRows,
        alerts.data?.pinned === true,
        alertAt ? alertAt.toISOString() : null,
      )
    : -1;
  const alertRow = showAlerts ? (
    <AlertsRow
      data={alerts.data}
      onOpen={() => navigate("/alerts")}
      onManage={() => setAlertsOpen(true)}
    />
  ) : null;

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden bg-page",
        embedded
          ? "h-full"
          : "min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24",
      )}
    >
      <header
        className={cn(
          "z-30 w-full shrink-0 border-b border-line/70 bg-[color-mix(in_srgb,var(--page)_90%,transparent)] backdrop-blur-xl",
          !embedded && "sticky top-0 safe-top",
        )}
      >
        <div className="relative mx-auto flex h-[56px] w-full max-w-[760px] items-center justify-between px-3">
          {picking ? (
            <>
              <button
                type="button"
                onClick={endPick}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition duration-200 hover:bg-surface-2 active:scale-95"
                aria-label="Stop picking"
                title="Done"
              >
                <X className="size-[22px]" strokeWidth={2.4} />
              </button>
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <h1 className="select-none text-[16px] font-extrabold leading-none tracking-[-0.02em] text-ink tabular-nums">
                  {picked.length}/{PICK_LIMIT} picked
                </h1>
              </div>
              <button
                type="button"
                onClick={pickAll}
                disabled={bulkBusy}
                className="rounded-full px-2.5 py-1.5 text-[14px] font-bold text-accent transition hover:bg-[var(--accent-soft)] disabled:opacity-50"
              >
                {pileHolds(
                  displayRows.map((row) => row.id),
                  picked,
                )
                  ? "None"
                  : "All"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="group flex size-11 shrink-0 items-center justify-center rounded-full transition duration-200 active:scale-95"
                  aria-label="Convo list menu"
                  aria-haspopup="dialog"
                  aria-expanded={menuOpen}
                  title="Convo list menu"
                >
                  <span className="flex size-10 items-center justify-center rounded-full border border-line/80 transition-colors duration-200 group-hover:border-accent/40 group-active:border-accent/60">
                    <Avatar user={user} name={user?.name} size={36} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleSearch}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition duration-200",
                    searchOpen
                      ? "bg-[var(--accent-soft)] text-accent hover:bg-[var(--accent-soft)] hover:text-accent"
                      : "hover:bg-surface-2 hover:text-accent",
                  )}
                  aria-label={
                    searchOpen
                      ? "Hide conversation search"
                      : "Search conversations"
                  }
                  aria-expanded={searchOpen}
                  title={searchOpen ? "Hide search" : "Search conversations"}
                >
                  <Search className="size-[23px]" strokeWidth={2.1} />
                </button>
              </div>

              <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
                <h1 className="select-none text-[22px] font-extrabold leading-none tracking-[-0.04em] text-ink">
                  Convo
                </h1>
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full transition-all duration-300",
                    socketStatus === "live" &&
                      "shadow-[0_0_0_3px_color-mix(in_srgb,var(--good)_12%,transparent)]",
                  )}
                  style={{
                    backgroundColor:
                      socketStatus === "live"
                        ? "var(--good)"
                        : "color-mix(in srgb, var(--ink) 22%, transparent)",
                  }}
                  aria-label={socketStatus === "live" ? "Live" : "Offline"}
                  title={socketStatus === "live" ? "Live" : "Offline"}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleCompose}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition duration-200 active:scale-95",
                    composeOpen
                      ? "bg-[var(--accent-soft)] text-accent hover:bg-[var(--accent-soft)] hover:text-accent"
                      : "hover:bg-surface-2 hover:text-accent",
                  )}
                  aria-label={composeOpen ? "Close new convo" : "New convo"}
                  aria-pressed={composeOpen}
                  title={composeOpen ? "Close new convo" : "New convo"}
                >
                  <FaUserPlus className="ml-0.5 size-[23px]" />
                </button>

                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  // A hover or a finger on the button is the beat before the tap,
                  // and that beat is enough to fetch the camera's chunk.
                  onMouseEnter={warmCamera}
                  onFocus={warmCamera}
                  onTouchStart={warmCamera}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition duration-200 hover:bg-surface-2 hover:text-accent active:scale-95"
                  aria-label="Camera"
                  title="Camera"
                >
                  <Camera className="size-[24px]" />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[760px] flex-1 flex-col">
        <div
          className={cn(
            "grid transition-all duration-200 ease-out motion-reduce:transition-none",
            searchOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!searchOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-2 py-1.5">
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-line/80 bg-[color-mix(in_srgb,var(--card)_76%,transparent)] px-3 shadow-[0_2px_10px_rgba(17,17,26,0.03)] backdrop-blur focus-within:border-accent">
                <Search className="size-4 shrink-0 text-dim" aria-hidden />
                <input
                  ref={searchInputRef}
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") toggleSearch();
                  }}
                  tabIndex={searchOpen ? 0 : -1}
                  placeholder="Search your conversations"
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none placeholder:text-dim"
                  aria-label="Search conversations"
                />
                {listSearch ? (
                  <button
                    type="button"
                    onClick={() => setListSearch("")}
                    className="text-dim transition hover:text-ink"
                    aria-label="Clear conversation search"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </label>
              {searchOpen && deferredSearch.length >= 2 ? (
                <div className="mt-1.5 rounded-[12px] border border-line bg-card p-1.5 shadow-[0_6px_18px_rgba(17,17,26,0.05)]">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-dim">
                      In messages
                    </span>
                    {messageSearch.isFetching ? (
                      <Spinner className="size-3" />
                    ) : (
                      <span className="text-[9px] font-semibold tabular-nums text-dim">
                        {messageSearch.data?.messages.length ?? 0}
                      </span>
                    )}
                  </div>
                  {messageSearch.isLoading ? (
                    <div className="space-y-1 px-1 pb-1" aria-hidden>
                      {[0, 1, 2].map((row) => (
                        <div
                          key={row}
                          className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-11 rounded-[10px]"
                        />
                      ))}
                    </div>
                  ) : messageSearch.isError ? (
                    <p className="px-2 py-2 text-[10.5px] leading-4 text-dim">
                      {errorMessage(messageSearch.error)}{" "}
                      <button
                        type="button"
                        onClick={() => void messageSearch.refetch()}
                        className="font-bold text-accent hover:underline"
                      >
                        Try again
                      </button>
                    </p>
                  ) : !messageSearch.data?.messages.length ? (
                    <p className="px-2 py-2 text-[10.5px] leading-4 text-dim">
                      No messages match “{deferredSearch}”.
                    </p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto">
                      {messageSearch.data.messages.map((message) => {
                        const seat = threadById.get(String(message.thread));
                        return (
                          <button
                            key={message.id}
                            type="button"
                            onClick={() => openSearchResult(message)}
                            className="flex w-full items-start gap-2.5 rounded-[10px] px-2 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
                          >
                            <Avatar user={message.sender} size={30} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-1.5">
                                <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold">
                                  {seat
                                    ? threadTitle(seat)
                                    : personLabel(
                                        message.sender,
                                        "Conversation",
                                      )}
                                </span>
                                <span className="shrink-0 text-[9px] tabular-nums text-dim">
                                  {stamp(message.created_at)}
                                </span>
                              </span>
                              <span className="mt-0.5 block line-clamp-2 text-[10.5px] leading-4 text-dim">
                                {message.body ||
                                  message.asset?.original_name ||
                                  `${message.kind} message`}
                              </span>
                              <span className="mt-0.5 block text-[9px] font-semibold text-accent">
                                {message.sender?.name ||
                                  message.sender?.username}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {picking ? (
          <div
            className="mx-auto flex w-full max-w-[760px] shrink-0 items-stretch border-b border-line"
            role="group"
            aria-label="What to do with the pile"
          >
            <PickAction
              icon={<Lock className="size-[22px]" />}
              label="Lock"
              enabled={picked.length > 0 && !bulkBusy}
              onClick={() => void lockPicked()}
            />
            <PickAction
              icon={<Eraser className="size-[22px]" />}
              label="Clear"
              enabled={picked.length > 0 && !bulkBusy}
              onClick={clearPicked}
            />
            <PickAction
              icon={<Trash2 className="size-[22px]" />}
              label="Trash"
              bad
              enabled={picked.length > 0 && !bulkBusy}
              onClick={() => setTrashOpen(true)}
            />
          </div>
        ) : (
          <div
            ref={tabListRef}
            className="relative mx-auto flex w-full max-w-[760px] shrink-0 items-stretch gap-1 border-b-2"
            role="tablist"
            aria-label="Convo lanes"
          >
            {tabLanes.map((item) => {
              const on = lane === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setLane(item.key)}
                  className={cn(
                    "relative flex h-[32px] min-w-0 grow basis-auto items-center justify-center gap-1 px-1 text-[14px] transition-colors",
                    on
                      ? "font-extrabold text-accent"
                      : "font-semibold text-dim hover:text-ink",
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 text-center tabular-nums">
                    {item.count ?? ""}
                  </span>
                </button>
              );
            })}
            {hasActiveTab ? (
              <span
                className="pointer-events-none absolute bottom-0 h-[2.5px] bg-accent transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
                style={{
                  left: `${underline.left}px`,
                  width: `${underline.width}px`,
                }}
                aria-hidden
              />
            ) : null}
          </div>
        )}

        <main
          ref={listRef}
          className={cn(
            "scroll-thin min-h-0 flex-1 overflow-y-auto",
            embedded &&
              "pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-4",
          )}
          onDragOver={(event) => {
            if (!Array.from(event.dataTransfer.types).includes("Files")) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            const box = event.currentTarget.getBoundingClientRect();
            const edge = Math.min(96, Math.max(48, box.height / 4));
            const down = event.clientY - (box.bottom - edge);
            const up = box.top + edge - event.clientY;
            dragPull.current =
              down > 0
                ? Math.min(18, 3 + (down / edge) * 15)
                : up > 0
                  ? -Math.min(18, 3 + (up / edge) * 15)
                  : 0;
            if (dragPull.current === 0) dragHalt();
            else dragScroll();
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              dragHalt();
            }
          }}
          onDropCapture={dragHalt}
          onDrop={(event) => {
            if (Array.from(event.dataTransfer.types).includes("Files")) {
              event.preventDefault();
            }
          }}
        >
          {lane === "requested" ? (
            <RequestsPanel />
          ) : lane === "calls" ? (
            <CallHistory />
          ) : threads.isLoading ? (
            <div className="pb-4" aria-hidden>
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="flex min-h-[64px] items-center gap-2 border-b border-line/70 py-2 pl-2 pr-2.5"
                >
                  <div className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] size-[52px] shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-3 w-36 rounded-full" />
                    <div className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-2.5 w-52 max-w-full rounded-full" />
                  </div>
                  <div className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-2.5 w-8 rounded-full" />
                </div>
              ))}
            </div>
          ) : threads.isError ? (
            <div className="px-2.5 pt-2">
              <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
                <ErrorState
                  error={threads.error}
                  onRetry={() => void threads.refetch()}
                />
              </div>
            </div>
          ) : !displayRows.length && lane !== "all" ? (
            <div className="px-2.5 pt-2">
              <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
                {lane === "unread" ? (
                  <EmptyState
                    icon={<CheckCheck className="size-6" />}
                    title="All caught up"
                    body="Nothing is waiting to be read."
                    className="py-12"
                  />
                ) : lane === "groups" ? (
                  <EmptyState
                    icon={<Users className="size-6" />}
                    title="No groups yet"
                    body="A group comes from a convo with more than two people."
                    action={
                      <Button onClick={() => setNewGroup(true)}>
                        Start a group
                      </Button>
                    }
                    className="py-12"
                  />
                ) : (
                  <EmptyState
                    icon={<MessageCircle className="size-6" />}
                    title="No convos yet"
                    body="Find someone, Keep them, and start the first convo."
                    action={
                      <Button onClick={() => navigate("/search")}>
                        Find people
                      </Button>
                    }
                    className="py-12"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="pb-3">
              {displayRows
                .filter((row) => !leaving.includes(row.id))
                .map((thread, index) => {
                  const face =
                    thread.other ?? thread.member ?? thread.members?.[0]?.user;
                  const moment =
                    thread.kind === "group" || !face?.id
                      ? undefined
                      : momentByAuthor.get(face.id);
                  return (
                    <Fragment key={thread.id}>
                      {alertRowSeat === index ? alertRow : null}
                      <ConvoRow
                        thread={thread}
                        active={activeThreadId === thread.id}
                        spark={sparkByThread.get(thread.id)}
                        moment={
                          moment
                            ? {
                                seen: moment.seen,
                                author: moment.author?.username,
                              }
                            : null
                        }
                        picking={picking}
                        picked={picked.includes(thread.id)}
                        onOpen={() => navigate(`/convo/${thread.id}`)}
                        onToggle={() => togglePick(thread.id)}
                        onActions={() => {
                          setSelected(thread);
                          setSheetOpen(true);
                        }}
                        onOpenMoment={(username) =>
                          navigate(
                            `/moments?user=${encodeURIComponent(username)}`,
                          )
                        }
                        onOpenSpark={() =>
                          onOpenSpark?.(
                            thread,
                            sparkByThread.get(thread.id) ?? null,
                            sparks.data?.wallet.balance,
                          )
                        }
                        onFiles={(files) => {
                          handOffFiles(thread.id, files);
                          navigate(`/convo/${thread.id}`);
                        }}
                      />
                    </Fragment>
                  );
                })}
              {alertRowSeat === displayRows.length ? alertRow : null}
              {!displayRows.length ? (
                <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
                  <EmptyState
                    icon={<MessageCircle className="size-6" />}
                    title="No convos yet"
                    body="Find people, and start the first convo."
                    action={
                      <Button onClick={() => navigate("/search")}>
                        Find people
                      </Button>
                    }
                    className="py-12"
                  />
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>

      <NewGroupModal open={newGroup} onClose={() => setNewGroup(false)} />

      <ConvoSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        thread={selected}
        kind="list"
        pinnedCount={pinnedCount}
        onChanged={refresh}
        onGone={() => {
          refresh();
          if (selected?.id && activeThreadId === selected.id)
            navigate("/convo");
        }}
        onGroupSettings={(thread) => navigate(`/convo/${thread.id}?info=1`)}
        onSelectMore={() => {
          if (selected) startPick(selected.id);
        }}
      />

      <ConfirmDialog
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        onConfirm={() => void trashPicked()}
        title={
          picked.length === 1
            ? "Trash this convo?"
            : `Trash these ${picked.length} convos?`
        }
        body="They leave your list with everything in them. Anything new from them brings them back."
        note="Nothing goes from their side."
        confirmLabel="Trash"
        destructive
        loading={bulkBusy}
      />

      <AlertsManageModal
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        data={alerts.data}
        pins={pinnedCount}
      />

      <VaultModal
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onChanged={refresh}
        onOpenThread={(thread) => navigate(`/convo/${thread.id}`)}
      />

      {cameraOpen ? (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[90] grid place-items-center bg-black text-white">
              <Spinner className="size-7 text-white" />
            </div>
          }
        >
          <CameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onPosted={() => {
              void queryClient.invalidateQueries({ queryKey: ["threads"] });
              void queryClient.invalidateQueries({
                queryKey: ["moments-tray"],
              });
              void queryClient.invalidateQueries({ queryKey: ["moments"] });
            }}
            fromChat={true}
          />
        </Suspense>
      ) : null}

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Convos"
        description="The whole list"
        size="sm"
      >
        <div className="space-y-0.5 p-2 pb-3">
          <MenuRow
            icon={<CheckCheck className="size-4" />}
            title="Mark all read"
            body={
              unreadRows.length === 0
                ? "Nothing is waiting."
                : unreadRows.length === 1
                  ? "One convo is waiting."
                  : `${unreadRows.length} convos are waiting.`
            }
            disabled={!unreadRows.length}
            onClick={() => void readAll()}
          />
          <MenuRow
            icon={<Camera className="size-4" />}
            title="Camera"
            body="Right now, with the camera."
            onClick={() => {
              setMenuOpen(false);
              setCameraOpen(true);
            }}
          />
          <MenuRow
            icon={<MessageCircle className="size-4" />}
            title="Requests"
            body={
              requestCount
                ? `${requestCount} waiting for an answer.`
                : "Chat requests waiting for you."
            }
            right={requestCount ? String(requestCount) : undefined}
            onClick={() => {
              setMenuOpen(false);
              setLane("requested");
            }}
          />
          {vault.data && !vault.data.hidden ? (
            <MenuRow
              icon={<Lock className="size-4" />}
              title="Vault"
              body={
                vault.data.code_set
                  ? "Behind your code."
                  : "Convos kept out of this list."
              }
              right={
                vault.data.count == null ? undefined : String(vault.data.count)
              }
              onClick={() => {
                setMenuOpen(false);
                setVaultOpen(true);
              }}
            />
          ) : null}
          <MenuRow
            icon={<Sparkles className="size-4" />}
            title="Reward"
            body="Themes to wear, and the sparks they cost."
            right={design.name}
            onClick={() => {
              setMenuOpen(false);
              navigate("/sparks");
            }}
          />
          <MenuRow
            icon={<Settings className="size-4" />}
            title="Settings"
            body="Account, privacy, and appearance."
            onClick={() => {
              setMenuOpen(false);
              navigate("/settings");
            }}
          />
          <div className="mx-3 my-1.5 h-px bg-line" />
          <MenuRow
            icon={<LogOut className="size-4" />}
            title="Sign out"
            body="You will need your password again."
            danger
            onClick={() => {
              setMenuOpen(false);
              setSignOutOpen(true);
            }}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false);
          void logout();
        }}
        title="Sign out?"
        body="You will need your password or a QR from the Android app to come back."
        confirmLabel="Sign out"
        destructive
      />
    </div>
  );
}
