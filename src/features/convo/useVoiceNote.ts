/**
 * The composer's voice note, in the browser.
 *
 * The phone's own voice note is a *hold*: `chat.dart`'s `_holdStart`/`_holdEnd`
 * and `recording_controller.dart`. A mouse and a keyboard do not hold well, so
 * the web's mic is a *tap*: the first press opens the microphone and leaves it
 * recording, the next press stops it and sends what it heard, and the strip's
 * bin throws it away. The rules that survive from the phone — the shortest note
 * worth sending and the longest one allowed — live in `voicehold.ts`.
 *
 * Three things about the browser shaped this:
 *
 * - **The start is asynchronous.** Asking for the microphone takes a moment,
 *   and the permission prompt can be answered after the strip has already
 *   appeared. So the session outlives the press and the recorder follows
 *   through when it is ready, rather than the tap having to remain held.
 * - **The loudness bars are measured, not invented.** An analyser reading the
 *   same stream the recorder is writing gives the 0–100 samples the phone
 *   keeps, and they travel with the note so the phone's bubble can draw them.
 *   The picture in the strip while recording is those same readings.
 * - **The container is the browser's own guess at what the device can play.**
 *   MP4/AAC first, because that is what an iPhone will play back, and WebM/Opus
 *   — which is what a desktop Chrome is usually left with — after it. See
 *   `XELVIC_MOBILE_FEATURE_INVENTORY.md` for what that costs on the other side.
 */
import { useEffect, useRef, useState } from "react";
import {
  amplitudeBar,
  MAX_VOICE_BYTES,
  MAX_VOICE_MS,
  MIN_VOICE_MS,
  WAVEFORM_SAMPLE_MS,
  withReading,
} from "./voicehold";

/** One finished note, ready to be uploaded and sent. */
export interface VoiceNote {
  file: File;
  durationMs: number;
  waveform: number[];
}

export interface VoiceHold {
  /** What the mic is doing: nothing, or recording without a finger on it. */
  phase: "idle" | "recording";
  /** Seconds since the recording started. */
  seconds: number;
  /** The loudness readings so far, oldest first, 0–100 each. */
  levels: number[];
  /** Open the microphone and keep recording until `send` or `discard`. */
  start: () => void;
  /** Stop the recorder and send what it holds, if it is worth sending. */
  send: () => void;
  /** Stop the recorder and drop what it holds. */
  discard: () => void;
}

/** What the browser will record in, most widely playable first. */
const CONTAINERS = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

function pickContainer(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return CONTAINERS.find((one) => MediaRecorder.isTypeSupported(one));
}

function extensionFor(mime: string): string {
  const base = mime.split(";")[0]?.trim();
  if (base === "audio/mp4") return "m4a";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/webm") return "webm";
  return "audio";
}

/** What the person asked for, kept until there is a recorder to answer it. */
type Wanted = "none" | "send" | "discard";

interface Session {
  wanted: Wanted;
  /** The recorder is running; there is something to stop. */
  armed: boolean;
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  buffer: Uint8Array<ArrayBuffer> | null;
  sampler: number | null;
  clock: number | null;
  chunks: Blob[];
  bytes: number;
  bars: number[];
  startedAt: number;
}

function newSession(): Session {
  return {
    wanted: "none",
    armed: false,
    recorder: null,
    stream: null,
    context: null,
    analyser: null,
    buffer: null,
    sampler: null,
    clock: null,
    chunks: [],
    bytes: 0,
    bars: [],
    startedAt: 0,
  };
}

export function useVoiceNote({
  onSend,
  onSay,
}: {
  onSend: (note: VoiceNote) => void;
  /** A sentence for the person, when something needs saying. */
  onSay: (message: string) => void;
}): VoiceHold {
  const [phase, setPhase] = useState<VoiceHold["phase"]>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  const live = useRef<Session | null>(null);
  const alive = useRef(true);
  // The two answers, held in refs so the recorder's own callbacks — which are
  // made once and outlive the render that made them — never call a stale one.
  const sayRef = useRef(onSay);
  const sendRef = useRef(onSend);
  sayRef.current = onSay;
  sendRef.current = onSend;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const session = live.current;
      if (session) {
        session.wanted = "discard";
        stopEverything(session, { silent: true });
      }
      live.current = null;
    };
  }, []);

  /** Let the microphone, the analyser and the clocks go. */
  function stopEverything(session: Session, options: { silent?: boolean } = {}) {
    if (session.sampler !== null) window.clearInterval(session.sampler);
    if (session.clock !== null) window.clearInterval(session.clock);
    session.sampler = null;
    session.clock = null;
    session.stream?.getTracks().forEach((track) => track.stop());
    session.stream = null;
    void session.context?.close().catch(() => undefined);
    session.context = null;
    session.analyser = null;
    session.recorder = null;
    session.armed = false;
    if (!options.silent && alive.current) {
      setPhase("idle");
      setSeconds(0);
      setLevels([]);
    }
  }

  /** Stop the recorder and drop what it holds — the bin. */
  function throwAway(session: Session) {
    const recorder = session.recorder;
    if (recorder && recorder.state !== "inactive") {
      // Nobody is listening for this one: a thrown-away note is not a note.
      recorder.onstop = null;
      recorder.ondataavailable = null;
      try {
        recorder.stop();
      } catch {
        /* already stopping */
      }
    }
    stopEverything(session);
    if (live.current === session) live.current = null;
  }

  /** Stop the recorder and send what it holds, if it is worth sending. */
  function commit(session: Session) {
    const recorder = session.recorder;
    if (!recorder || !session.armed || recorder.state === "inactive") {
      throwAway(session);
      return;
    }
    const elapsed = Math.round(performance.now() - session.startedAt);
    const bars = session.bars;
    recorder.onstop = () => {
      const type = recorder.mimeType || "audio/webm";
      const blob = new Blob(session.chunks, { type });
      stopEverything(session);
      if (live.current === session) live.current = null;
      if (!blob.size || elapsed < MIN_VOICE_MS) {
        // A tap on the stop square before anybody spoke is not a voice note.
        sayRef.current("That voice note was too short to send.");
        return;
      }
      sendRef.current({
        file: new File([blob], `voice-${Date.now()}.${extensionFor(type)}`, { type }),
        durationMs: elapsed,
        waveform: bars,
      });
    };
    recorder.stop();
  }

  /** Do what the person asked for, now that there is something to do it to. */
  function resolve(session: Session) {
    if (!session.armed || live.current !== session) return;
    if (session.wanted === "discard") throwAway(session);
    else if (session.wanted === "send") commit(session);
  }

  /** Ask for the microphone, start the recorder, and follow through. */
  async function arm(session: Session) {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      live.current = null;
      if (alive.current) setPhase("idle");
      sayRef.current("This browser cannot record a voice note.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      live.current = null;
      if (alive.current) setPhase("idle");
      sayRef.current("Allow the microphone to record a voice note.");
      return;
    }
    // The bin may have been pressed while the permission prompt was up.
    if (live.current !== session) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    session.stream = stream;

    const container = pickContainer();
    let recorder: MediaRecorder;
    try {
      recorder = container ? new MediaRecorder(stream, { mimeType: container }) : new MediaRecorder(stream);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stopEverything(session);
        if (alive.current) setPhase("idle");
        sayRef.current("This browser cannot record a voice note.");
        return;
      }
    }

    session.recorder = recorder;
    session.chunks = [];
    session.bytes = 0;
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      session.chunks.push(event.data);
      session.bytes += event.data.size;
    };
    try {
      // A second at a time, so the size ceiling is a real number while the
      // note is still being recorded rather than a surprise at the end.
      recorder.start(1000);
    } catch {
      stopEverything(session);
      if (alive.current) setPhase("idle");
      sayRef.current("This browser cannot record a voice note.");
      return;
    }
    session.armed = true;
    session.startedAt = performance.now();

    // The loudness meter. Feeding a silent gain node is what makes the
    // analyser run at all: a node nothing pulls on is never processed, and
    // the meter would read silence however loud the room was.
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        const context = new Ctor();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        const quiet = context.createGain();
        quiet.gain.value = 0;
        source.connect(analyser);
        analyser.connect(quiet);
        quiet.connect(context.destination);
        session.context = context;
        session.analyser = analyser;
        session.buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      }
    } catch {
      // A note without a picture of its own sound is still a note.
    }

    session.sampler = window.setInterval(() => {
      const analyser = session.analyser;
      const buffer = session.buffer;
      let bar = 0;
      if (analyser && buffer) {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const one of buffer) {
          const value = (one - 128) / 128;
          sum += value * value;
        }
        bar = amplitudeBar(Math.sqrt(sum / buffer.length));
      }
      session.bars = withReading(session.bars, bar);
      if (alive.current) setLevels(session.bars);

      const elapsed = performance.now() - session.startedAt;
      if (elapsed >= MAX_VOICE_MS || session.bytes >= MAX_VOICE_BYTES) {
        sayRef.current(
          elapsed >= MAX_VOICE_MS
            ? "That is the longest voice note there is — sending it as it stands."
            : "That voice note is as big as one can be — sending it as it stands.",
        );
        session.wanted = "send";
        resolve(session);
      }
    }, WAVEFORM_SAMPLE_MS);

    session.clock = window.setInterval(() => {
      if (alive.current) setSeconds((performance.now() - session.startedAt) / 1000);
    }, 200);

    if (session.wanted !== "none") resolve(session);
  }

  const start = () => {
    if (live.current) return;
    const session = newSession();
    live.current = session;
    setPhase("recording");
    setSeconds(0);
    setLevels([]);
    void arm(session);
  };

  const discard = () => {
    const session = live.current;
    if (!session) return;
    session.wanted = "discard";
    if (!session.armed) {
      // The microphone may still be waiting on permission. Let go of the
      // session now so the stream, when it arrives, is stopped rather than
      // recorded into a strip the person has already put away.
      live.current = null;
      stopEverything(session);
      return;
    }
    resolve(session);
  };

  const send = () => {
    const session = live.current;
    if (!session) return;
    session.wanted = "send";
    resolve(session);
  };

  return { phase, seconds, levels, start, send, discard };
}
