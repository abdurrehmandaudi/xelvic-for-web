import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Heart, RefreshCw, Send, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { lockScroll } from "@/utils/scrollLock";
import { useSocket, useSocketEvent } from "@/hooks/useSocket";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { liveService, type LiveRow } from "@/services/live.service";
import { fromFrame, optimistic, settle, type Felt } from "@/features/live/felt";
import { playWhep, type WhepSession } from "@/features/live/whep";

interface ChatLine {
  id: string;
  user: string;
  name: string;
  text: string;
  at: string;
}

interface Bubble {
  id: string;
  emoji: string;
  drift: number;
}

const QUICK = ["🔥", "👏", "😂", "❤️", "💯"];

function clientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ownerName(live: LiveRow) {
  return live.owner?.name || live.owner?.username || "Live";
}

function LivePill() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-black tracking-[0.6px] text-on-accent">
      <span className="size-1.5 rounded-full bg-[var(--on-accent)] motion-safe:animate-pulse-live" />
      LIVE
    </span>
  );
}

function Glass({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 px-2.5 py-1 text-on-accent backdrop-blur", className)}>
      {children}
    </span>
  );
}

function RisingBubble({ emoji, drift }: { emoji: string; drift: number }) {
  const [risen, setRisen] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const first = window.requestAnimationFrame(() => setRisen(true));
    const second = window.setTimeout(() => setGone(true), 1300);
    return () => {
      window.cancelAnimationFrame(first);
      window.clearTimeout(second);
    };
  }, []);
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-32 left-1/2 transition-transform duration-[2400ms] ease-out-soft",
        risen ? "-translate-y-40" : "translate-y-0",
      )}
      style={{ marginLeft: drift }}
    >
      <span
        className={cn(
          "block text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] transition-opacity duration-500",
          risen && !gone ? "opacity-100" : "opacity-0",
        )}
      >
        {emoji}
      </span>
    </span>
  );
}

export function LiveWatch() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status, send } = useSocket();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const meId = user?.id ?? "";

  const liveQuery = useQuery({
    queryKey: ["live", id],
    queryFn: () => liveService.detail(id),
    enabled: Boolean(id),
    refetchInterval: 20_000,
    retry: false,
  });
  const live = liveQuery.data;
  const state = live?.state;
  const playbackUrl = live?.playback_url;
  const ended = state === "ended";
  const playable = state === "live" && Boolean(playbackUrl);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<WhepSession | null>(null);
  const soundRef = useRef(false);
  const seenId = useRef<string | null>(null);

  const [felt, setFelt] = useState<Felt>({ likes: 0, liked: false });
  const [sound, setSound] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => lockScroll(), []);

  useEffect(() => {
    soundRef.current = sound;
    const video = videoRef.current;
    if (video) video.muted = !sound;
  }, [sound]);

  useEffect(() => {
    if (live && seenId.current !== live.id) {
      seenId.current = live.id;
      setFelt({ likes: live.likes ?? 0, liked: Boolean(live.liked) });
    }
  }, [live]);

  useEffect(() => {
    setChat([]);
    setBubbles([]);
    setDraft("");
  }, [id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playable || !playbackUrl) return;
    let cancelled = false;
    sessionRef.current?.close();
    sessionRef.current = null;
    setProblem(null);
    playWhep(playbackUrl, video)
      .then((session) => {
        if (cancelled) {
          session.close();
          return;
        }
        sessionRef.current = session;
        video.muted = !soundRef.current;
        void video.play().catch(() => undefined);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProblem(error instanceof Error ? error.message : "This broadcast could not be played here.");
      });
    return () => {
      cancelled = true;
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, [playable, playbackUrl]);

  useEffect(() => {
    if (status !== "live" || !id) return;
    send({ action: "room.watch", room: id });
    return () => {
      send({ action: "room.watch", room: null });
    };
  }, [status, id, send]);

  const throwReaction = useCallback((emoji: string) => {
    const bubbleId = clientId();
    const drift = Math.round(Math.random() * 60 - 30);
    setBubbles((current) => [...current.slice(-8), { id: bubbleId, emoji, drift }]);
    window.setTimeout(() => {
      setBubbles((current) => current.filter((item) => item.id !== bubbleId));
    }, 2600);
  }, []);

  useSocketEvent(["room.say"], (frame) => {
    const data = frame.data as { id?: string; user?: string; name?: string; text?: string; at?: string } | undefined;
    if (!data?.text) return;
    setChat((current) => [
      ...current.slice(-60),
      {
        id: data.id || clientId(),
        user: data.user || "",
        name: data.name || "Someone",
        text: data.text as string,
        at: data.at || new Date().toISOString(),
      },
    ]);
  });

  useSocketEvent(["room.react"], (frame) => {
    const data = frame.data as { emoji?: string } | undefined;
    if (!data?.emoji) return;
    throwReaction(data.emoji);
  });

  useSocketEvent(["live.felt"], (frame) => {
    const data = frame.data as { likes?: number; liked?: boolean; user?: string } | undefined;
    if (!data) return;
    setFelt((current) => fromFrame(current, data, meId));
  });

  useSocketEvent(["room.update"], (frame) => {
    const data = frame.data as { room?: string; state?: string } | undefined;
    if (data?.room && data.room !== id) return;
    void queryClient.invalidateQueries({ queryKey: ["live", id] });
  });

  async function tapFelt() {
    const before = felt;
    const on = !felt.liked;
    setFelt(optimistic(felt, on));
    try {
      const answer = await liveService.felt(id, on);
      setFelt((current) => settle(current, answer));
    } catch {
      setFelt(before);
      toast({ title: "That did not go through", tone: "error" });
    }
  }

  function say() {
    const text = draft.trim();
    if (!text) return;
    if (!send({ action: "room.say", room: id, text, id: clientId() })) {
      toast({ title: "You are not connected to the broadcast yet", tone: "error" });
      return;
    }
    setDraft("");
  }

  function react(emoji: string) {
    if (!send({ action: "room.react", room: id, emoji })) {
      toast({ title: "You are not connected to the broadcast yet", tone: "error" });
    }
  }

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/videos");
  };

  if (liveQuery.isLoading && !live) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
        <button type="button" onClick={back} className="absolute left-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 text-on-accent backdrop-blur" aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex flex-col items-center gap-3">
          <LivePill />
          <Spinner className="size-6 text-on-accent" />
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-on-accent">
        <button type="button" onClick={back} className="absolute left-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 text-on-accent backdrop-blur" aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-[15px] font-bold">
          {liveQuery.error instanceof Error ? liveQuery.error.message : "This broadcast is not here."}
        </p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void liveQuery.refetch()} className="inline-flex items-center gap-1.5 rounded-full bg-on-accent/12 px-3 py-1.5 text-[13px] font-bold text-on-accent">
            <RefreshCw className="size-3.5" /> Try again
          </button>
          <button type="button" onClick={() => navigate("/videos")} className="rounded-full bg-on-accent/12 px-3 py-1.5 text-[13px] font-bold text-on-accent">
            Back to Live
          </button>
        </div>
      </div>
    );
  }

  const owner = live.owner;
  const lines = chat.slice(-3);
  const viewers = live.viewers ?? 0;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black text-on-accent">
      {playable ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          autoPlay
          muted
        />
      ) : null}

      <button type="button" onClick={() => setChrome((open) => !open)} className="absolute inset-0 z-10 cursor-default" aria-label="Show or hide the controls" />

      {!playable ? (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--solid)_94%,black)] px-8 text-center">
          <Avatar user={owner} size={64} />
          <p className="text-[15px] font-extrabold">{ownerName(live)}</p>
          <p className="text-[12.5px] text-on-accent/70">
            {ended ? "This broadcast has ended." : "This broadcast is not on right now."}
          </p>
        </div>
      ) : null}

      {problem ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-8 text-center">
          <p className="rounded-[14px] bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/55 px-4 py-3 text-[13px] font-semibold text-on-accent backdrop-blur">{problem}</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-20">
        {bubbles.map((bubble) => (
          <RisingBubble key={bubble.id} emoji={bubble.emoji} drift={bubble.drift} />
        ))}
      </div>

      <div className={cn("absolute inset-x-0 top-0 z-20 flex items-center gap-2 p-3 transition-opacity duration-200", chrome ? "opacity-100" : "pointer-events-none opacity-0")}>
        <button type="button" onClick={back} className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 text-on-accent backdrop-blur" aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 py-1 pl-1 pr-3 backdrop-blur">
          <Avatar user={owner} size={30} />
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-extrabold">{ownerName(live)}</p>
            <p className="truncate text-[10.5px] font-semibold text-on-accent/70">
              {owner?.username ? `@${owner.username}` : "Broadcasting"}
            </p>
          </div>
        </div>
        <span className="ml-auto flex flex-none items-center gap-1.5">
          {ended ? <Glass className="text-[10px] font-extrabold">Ended</Glass> : <LivePill />}
          <Glass className="text-[10.5px] font-bold">
            <Eye className="size-3.5" />
            {count(viewers)}
          </Glass>
          <button type="button" onClick={() => setSound((on) => !on)} className="inline-flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 text-on-accent backdrop-blur" aria-label={sound ? "Mute" : "Unmute"}>
            {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </span>
      </div>

      <div className={cn("absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 transition-opacity duration-200", chrome ? "opacity-100" : "pointer-events-none opacity-0")}>
        {lines.map((line) => (
          <p key={line.id} className="max-w-full truncate text-[12.5px] leading-5 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            <span className="font-extrabold">{line.name}</span> <span className="text-on-accent/90">{line.text}</span>
          </p>
        ))}
        <h1 className="text-[19px] font-extrabold leading-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
          {live.title || "Live"}
        </h1>

        {ended ? (
          <p className="text-[12.5px] font-semibold text-on-accent/75">This broadcast has ended. The conversation is closed.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void tapFelt()} className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 px-3 py-2 text-[12.5px] font-extrabold backdrop-blur">
                <Heart className={cn("size-4", felt.liked ? "fill-accent text-accent" : "text-on-accent")} />
                {count(felt.likes)}
              </button>
              <div className="flex items-center gap-1">
                {QUICK.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => react(emoji)} className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 text-base backdrop-blur transition hover:scale-110" aria-label={`React ${emoji}`}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                say();
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={300}
                placeholder="Say something to the broadcast"
                className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-[color-mix(in_srgb,var(--solid)_25%,transparent)]/45 px-4 text-[13px] text-on-accent placeholder:text-on-accent/45 backdrop-blur focus:border-accent focus:outline-none"
              />
              <button type="submit" disabled={!draft.trim()} className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-50" aria-label="Send">
                <Send className="size-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default LiveWatch;
