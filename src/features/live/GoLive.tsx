import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Mic, MicOff, SwitchCamera, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { lockScroll } from "@/utils/scrollLock";
import { liveService } from "@/services/live.service";
import { publishSupported, type LivePublisher } from "./publish";

export interface GoLiveInfo {
  id: string;
  title: string;
  startedAt: string | null;
}

const VISIBILITY: { key: string; label: string; body: string }[] = [
  { key: "public", label: "Public", body: "Anyone can find it on the Live shelf." },
  { key: "followers", label: "Your crew", body: "Only the people who follow you can find it." },
];

export function GoLive({
  publisher,
  onClose,
  onLive,
}: {
  publisher: LivePublisher;
  onClose: () => void;
  onLive: (live: GoLiveInfo) => void;
}) {
  const state = useSyncExternalStore(publisher.subscribe, publisher.snapshot);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState("");

  useEffect(() => lockScroll(), []);

  useEffect(() => {
    void publisher.open(true);
  }, [publisher]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = publisher.media;
    if (video && stream) video.srcObject = stream;
  }, [publisher, state.phase]);

  const ready = state.phase === "ready" || state.phase === "live";
  const canGo = !busy && ready && title.trim().length > 0;
  const supported = publishSupported();

  async function goLive() {
    const name = title.trim();
    if (!name || busy || !canGo) return;
    setBusy(true);
    setTrouble("");
    try {
      const created = await liveService.create({ title: name, visibility });
      if (!created.whip_url) {
        await liveService.endQuietly(created.id);
        setTrouble("The server did not hand this web app a broadcast address, so it cannot go live from a browser.");
        setBusy(false);
        return;
      }
      const started = await liveService.start(created.id);
      await publisher.publish(created.whip_url);
      if (publisher.snapshot().phase !== "live") {
        await liveService.endQuietly(created.id);
        setTrouble(publisher.snapshot().error ?? "The broadcast could not be started.");
        setBusy(false);
        return;
      }
      onLive({
        id: started.id || created.id,
        title: started.title || created.title || name,
        startedAt: started.started_at ?? new Date().toISOString(),
      });
    } catch (error) {
      setTrouble(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-solid text-on-accent">
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_25%,transparent)] text-on-accent backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-[17px] font-extrabold tracking-tight">Go live</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="mx-auto w-full max-w-[560px] px-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-[16px] bg-solid">
            <video
              ref={videoRef}
              className={cn("h-full w-full object-cover", state.front && "-scale-x-100")}
              playsInline
              autoPlay
              muted
            />
            {(state.phase === "idle" || state.phase === "preparing") ? (
              <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-on-accent/80">
                Turning the camera on...
              </div>
            ) : null}
            {state.phase === "failed" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--solid)_78%,transparent)] px-6 text-center">
                <p className="text-[13px] font-bold text-on-accent">{state.error}</p>
                {supported ? (
                  <button
                    type="button"
                    onClick={() => void publisher.open(state.front)}
                    className="rounded-full px-3 py-1.5 text-[13px] font-extrabold text-on-accent underline"
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_35%,transparent)] text-on-accent backdrop-blur">
                <button type="button" onClick={() => void publisher.flip()} aria-label="Switch camera">
                  <SwitchCamera className="size-5" />
                </button>
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_35%,transparent)] text-on-accent backdrop-blur">
                <button
                  type="button"
                  onClick={() => publisher.setMic(!state.mic)}
                  aria-label={state.mic ? "Turn the microphone off" : "Turn the microphone on"}
                >
                  {state.mic ? <Mic className="size-5" /> : <MicOff className="size-5" />}
                </button>
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--solid)_35%,transparent)] text-on-accent backdrop-blur">
                <button
                  type="button"
                  onClick={() => publisher.setCamera(!state.camera)}
                  aria-label={state.camera ? "Turn the camera off" : "Turn the camera on"}
                >
                  {state.camera ? <Video className="size-5" /> : <VideoOff className="size-5" />}
                </button>
              </div>
            </div>
          </div>

          {!supported ? (
            <p className="mt-3 rounded-control border border-line bg-card px-4 py-3 text-[12.5px] leading-5 text-ink">
              This browser cannot send a live broadcast. A browser with WebRTC is needed to go live from the web.
            </p>
          ) : null}

          <div className="mt-3 rounded-[18px] border border-line bg-card p-4 text-ink">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-extrabold tracking-[0.4px] text-dim">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                placeholder="What is this broadcast?"
                className="w-full rounded-control border border-line bg-card px-4 py-3 text-ink transition-[border-color,box-shadow] duration-[160ms] placeholder:text-dim-80 focus:border-accent focus:shadow-field-focus focus:outline-none"
              />
            </label>

            <div className="mt-4">
              <span className="mb-1.5 block text-[11px] font-extrabold tracking-[0.4px] text-dim">Who can watch</span>
              <div className="flex gap-2">
                {VISIBILITY.map((option) => {
                  const on = visibility === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setVisibility(option.key)}
                      disabled={busy}
                      className={cn(
                        "flex-1 rounded-full border px-3 py-2 text-[13px] transition disabled:opacity-60",
                        on ? "border-accent bg-accent font-bold text-on-accent" : "border-line bg-card font-semibold text-ink hover:border-accent/40",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] leading-[1.45] text-dim">
                {(VISIBILITY.find((option) => option.key === visibility) ?? VISIBILITY[0]).body}
              </p>
            </div>

            <Button className="mt-4" full onClick={() => void goLive()} loading={busy} disabled={!canGo}>
              {busy ? "Going live..." : "Go live"}
            </Button>

            {trouble ? <p className="mt-3 text-[12.5px] leading-5 text-[var(--bad)]">{trouble}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GoLive;
