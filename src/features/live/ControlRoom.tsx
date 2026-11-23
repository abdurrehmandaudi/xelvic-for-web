import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Heart } from "lucide-react";
import { ConfirmDialog } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { lockScroll } from "@/utils/scrollLock";
import { useSocket, useSocketEvent } from "@/hooks/useSocket";
import { useToast } from "@/hooks/useToast";
import { liveService } from "@/services/live.service";
import type { LivePublisher } from "./publish";
import type { GoLiveInfo } from "./GoLive";

function elapsed(fromISO: string | null, at: number) {
  if (!fromISO) return "00:00";
  const start = Date.parse(fromISO);
  if (Number.isNaN(start)) return "00:00";
  let total = Math.floor((at - start) / 1000);
  if (total < 0) total = 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

function Glass({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)] px-2.5 py-1 text-[11px] font-bold text-on-accent backdrop-blur">
      {children}
    </span>
  );
}

export function ControlRoom({
  live,
  publisher,
  onFinished,
}: {
  live: GoLiveInfo;
  publisher: LivePublisher;
  onFinished: () => void;
}) {
  const state = useSyncExternalStore(publisher.subscribe, publisher.snapshot);
  const videoRef = useRef<HTMLVideoElement>(null);
  const queryClient = useQueryClient();
  const { status, send } = useSocket();
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [askFinish, setAskFinish] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => lockScroll(), []);

  const row = useQuery({
    queryKey: ["live", live.id],
    queryFn: () => liveService.detail(live.id),
    refetchInterval: 20_000,
    retry: false,
  });

  useSocketEvent(["room.update", "room.gone"], (frame) => {
    const data = frame.data as { room?: string } | undefined;
    if (data?.room && data.room !== live.id) return;
    void queryClient.invalidateQueries({ queryKey: ["live", live.id] });
  });

  useEffect(() => {
    if (status !== "live") return;
    send({ action: "room.watch", room: live.id });
    return () => {
      send({ action: "room.watch", room: null });
    };
  }, [status, live.id, send]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const beat = window.setInterval(() => {
      void liveService.alive(live.id).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(beat);
  }, [live.id]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = publisher.media;
    if (video && stream) video.srcObject = stream;
  }, [publisher, state.phase]);

  async function finish() {
    if (ending) return;
    setAskFinish(false);
    setEnding(true);
    try {
      await liveService.end(live.id);
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    }
    publisher.stop();
    onFinished();
  }

  const viewers = row.data?.viewers ?? 0;
  const likes = row.data?.likes ?? 0;

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-solid text-on-accent">
      <video
        ref={videoRef}
        className={cn("absolute inset-0 h-full w-full object-cover", state.front && "-scale-x-100")}
        playsInline
        autoPlay
        muted
      />

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3">
        <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-black tracking-[0.6px] text-on-accent">
          <span className="size-1.5 rounded-full bg-[var(--on-accent)] motion-safe:animate-pulse-live" />
          LIVE
        </span>
        <Glass>
          <span className="num">{elapsed(live.startedAt, now)}</span>
        </Glass>
        <span className="ml-auto flex items-center gap-1.5">
          <Glass>
            <Eye className="size-3.5" />
            {count(viewers)}
          </Glass>
          <Glass>
            <Heart className="size-3.5" />
            {count(likes)}
          </Glass>
        </span>
      </div>

      {state.phase === "failed" ? (
        <div className="absolute inset-x-0 top-16 flex justify-center px-4">
          <span className="rounded-full bg-[color-mix(in_srgb,var(--solid)_70%,transparent)] px-3 py-1.5 text-[11.5px] font-bold text-on-accent backdrop-blur">
            {state.error ?? "The broadcast connection dropped."}
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
        {live.title ? (
          <span className="max-w-full truncate self-start rounded-full bg-[color-mix(in_srgb,var(--solid)_45%,transparent)] px-3 py-1.5 text-[14px] font-extrabold text-on-accent backdrop-blur">
            {live.title}
          </span>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => publisher.setCamera(!state.camera)}
            className="rounded-full bg-[color-mix(in_srgb,var(--solid)_35%,transparent)] px-4 py-2.5 text-[12.5px] font-bold text-on-accent backdrop-blur"
          >
            {state.camera ? "Camera off" : "Camera on"}
          </button>
          <button
            type="button"
            onClick={() => publisher.setMic(!state.mic)}
            className="rounded-full bg-[color-mix(in_srgb,var(--solid)_35%,transparent)] px-4 py-2.5 text-[12.5px] font-bold text-on-accent backdrop-blur"
          >
            {state.mic ? "Mute" : "Unmute"}
          </button>
          <button
            type="button"
            onClick={() => void publisher.flip()}
            className="rounded-full bg-[color-mix(in_srgb,var(--solid)_35%,transparent)] px-4 py-2.5 text-[12.5px] font-bold text-on-accent backdrop-blur"
          >
            Flip
          </button>
          <button
            type="button"
            onClick={() => setAskFinish(true)}
            disabled={ending}
            className="ml-auto rounded-full bg-bad px-6 py-2.5 text-[13px] font-black tracking-[0.4px] text-on-accent transition active:scale-[0.98] disabled:opacity-60"
          >
            FINISH
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={askFinish}
        onClose={() => setAskFinish(false)}
        onConfirm={() => void finish()}
        title="End the broadcast?"
        body="The broadcast stops right away and the picture comes down for everybody watching."
        note="A live is not recorded, so it cannot be brought back."
        confirmLabel="End it"
        cancelLabel="Keep going"
        destructive
        loading={ending}
      />
    </div>
  );
}

export default ControlRoom;
