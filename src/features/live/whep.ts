import { callsService } from "@/services/calls.service";

export interface WhepSession {
  close: () => void;
}

export class WhepUnsupported extends Error {}

export class WhepRefused extends Error {}

function quietly(run: () => void) {
  try {
    run();
  } catch {
    return;
  }
}

async function iceServers(): Promise<RTCIceServer[]> {
  try {
    return await callsService.ice();
  } catch {
    return [];
  }
}

function gatheringComplete(pc: RTCPeerConnection, waitMs = 3000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      pc.removeEventListener("icecandidate", onCandidate);
      window.clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const onCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (!event.candidate) done();
    };
    const timer = window.setTimeout(done, waitMs);
    pc.addEventListener("icegatheringstatechange", onChange);
    pc.addEventListener("icecandidate", onCandidate);
  });
}

export async function playWhep(
  url: string,
  video: HTMLVideoElement,
  onTrack?: (stream: MediaStream) => void,
): Promise<WhepSession> {
  if (typeof window === "undefined" || typeof window.RTCPeerConnection !== "function") {
    throw new WhepUnsupported("This browser cannot play a live broadcast.");
  }

  const pc = new RTCPeerConnection({ iceServers: await iceServers() });
  const stream = new MediaStream();
  pc.ontrack = (event) => {
    stream.addTrack(event.track);
    video.srcObject = stream;
    onTrack?.(stream);
  };
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  await pc.setLocalDescription(await pc.createOffer());
  await gatheringComplete(pc);

  let answer: string;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/sdp", Accept: "application/sdp" },
      body: pc.localDescription?.sdp ?? "",
    });
    if (!response.ok) throw new WhepRefused("This broadcast could not be played here.");
    answer = await response.text();
  } catch (error) {
    quietly(() => pc.close());
    if (error instanceof WhepRefused) throw error;
    throw new WhepRefused("This broadcast could not be played in this browser.");
  }

  try {
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
  } catch {
    quietly(() => pc.close());
    throw new WhepRefused("This broadcast could not be played in this browser.");
  }

  return {
    close: () => {
      quietly(() => pc.close());
      video.srcObject = null;
    },
  };
}
