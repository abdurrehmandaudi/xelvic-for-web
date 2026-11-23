import { API_ORIGIN } from "@/config/env";
import { callsService } from "@/services/calls.service";

export type PublishPhase = "idle" | "preparing" | "ready" | "publishing" | "live" | "failed";

export interface PublishState {
  phase: PublishPhase;
  error: string | null;
  mic: boolean;
  camera: boolean;
  front: boolean;
}

const START: PublishState = { phase: "idle", error: null, mic: true, camera: true, front: true };

export function publishSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection === "function" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function cameraRefusal(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "You turned the camera or microphone off for this site. Allow them and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera or microphone was found on this device.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "Something else on this device is already using the camera or microphone.";
  }
  return error instanceof Error && error.message ? error.message : "The camera and microphone could not be opened.";
}

function quietly(run: () => void) {
  try {
    run();
  } catch {
    return;
  }
}

function absolute(url: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

function gather(pc: RTCPeerConnection, waitMs = 4000) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let timer = 0;
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", change);
      pc.removeEventListener("icecandidate", candidate);
      window.clearTimeout(timer);
      resolve();
    };
    const change = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const candidate = (event: RTCPeerConnectionIceEvent) => {
      if (!event.candidate) done();
    };
    timer = window.setTimeout(done, waitMs);
    pc.addEventListener("icegatheringstatechange", change);
    pc.addEventListener("icecandidate", candidate);
  });
}

async function iceServers(): Promise<RTCIceServer[]> {
  try {
    const servers = await callsService.ice();
    if (servers.length) return servers;
  } catch {
    return [{ urls: "stun:stun.cloudflare.com:3478" }];
  }
  return [{ urls: "stun:stun.cloudflare.com:3478" }];
}

function sendRefusal(error: unknown) {
  if (error instanceof TypeError) {
    return "The broadcast address refused this browser. Publishing from the web may not be allowed by the server yet.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "The broadcast could not be started.";
}

export class LivePublisher {
  private state: PublishState = START;
  private stream: MediaStream | null = null;
  private peer: RTCPeerConnection | null = null;
  private opening: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private mic = true;
  private camera = true;
  private front = true;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = () => this.state;

  get media() {
    return this.stream;
  }

  private set(patch: Partial<PublishState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private apply() {
    const stream = this.stream;
    if (!stream) return;
    for (const track of stream.getTracks()) {
      if (track.kind === "audio") track.enabled = this.mic;
      if (track.kind === "video") track.enabled = this.camera;
    }
  }

  open(front = true) {
    this.front = front;
    if (this.stream) {
      this.set({ phase: "ready", error: null, front });
      return Promise.resolve();
    }
    if (this.opening) return this.opening;
    const started = this.begin(front);
    this.opening = started;
    return started.finally(() => {
      if (this.opening === started) this.opening = null;
    });
  }

  private async begin(front: boolean) {
    this.set({ phase: "preparing", error: null, front });
    if (!publishSupported()) {
      this.set({ phase: "failed", error: "This browser cannot send a live broadcast." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: {
          facingMode: front ? "user" : "environment",
          width: { ideal: 720 },
          height: { ideal: 1280 },
          frameRate: { ideal: 30 },
        },
      });
      this.stream = stream;
      this.mic = true;
      this.camera = true;
      this.apply();
      this.set({ phase: "ready", error: null, mic: true, camera: true });
    } catch (error) {
      this.stream = null;
      this.set({ phase: "failed", error: cameraRefusal(error) });
    }
  }

  setMic(on: boolean) {
    this.mic = on;
    this.apply();
    this.set({ mic: on });
  }

  setCamera(on: boolean) {
    this.camera = on;
    this.apply();
    this.set({ camera: on });
  }

  async flip() {
    const stream = this.stream;
    const current = stream?.getVideoTracks()[0];
    if (!stream || !current || !publishSupported()) return;
    const front = !this.front;
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: front ? "user" : "environment",
          width: { ideal: 720 },
          height: { ideal: 1280 },
          frameRate: { ideal: 30 },
        },
      });
      const track = next.getVideoTracks()[0];
      if (!track) return;
      track.enabled = this.camera;
      const sender = this.peer?.getSenders().find((one) => one.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
      stream.removeTrack(current);
      stream.addTrack(track);
      current.stop();
      this.front = front;
      this.set({ front });
    } catch {
      return;
    }
  }

  async publish(whipUrl: string) {
    const stream = this.stream;
    if (!stream || !whipUrl) {
      this.set({ phase: "failed", error: "The camera is not open, so there is nothing to send." });
      return;
    }
    this.set({ phase: "publishing", error: null });
    try {
      const peer = new RTCPeerConnection({ iceServers: await iceServers() });
      this.peer = peer;
      for (const track of stream.getTracks()) peer.addTrack(track, stream);
      await peer.setLocalDescription(await peer.createOffer());
      await gather(peer);
      const response = await fetch(absolute(whipUrl), {
        method: "POST",
        headers: { "Content-Type": "application/sdp", Accept: "application/sdp" },
        body: peer.localDescription?.sdp ?? "",
      });
      if (!response.ok) throw new Error(`The broadcast was refused (${response.status}).`);
      const answer = await response.text();
      if (!answer) throw new Error("The broadcast server answered with nothing.");
      await peer.setRemoteDescription({ type: "answer", sdp: answer });
      this.set({ phase: "live", error: null });
    } catch (error) {
      this.drop();
      this.set({ phase: "failed", error: sendRefusal(error) });
    }
  }

  stop() {
    this.drop();
    const stream = this.stream;
    this.stream = null;
    if (stream) {
      for (const track of stream.getTracks()) quietly(() => track.stop());
    }
    this.mic = true;
    this.camera = true;
    this.front = true;
    this.set({ ...START });
  }

  private drop() {
    const peer = this.peer;
    this.peer = null;
    if (!peer) return;
    quietly(() => peer.close());
  }
}
