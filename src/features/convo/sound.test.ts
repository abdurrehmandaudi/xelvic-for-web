import { describe, expect, it } from "vitest";
import type { Message } from "@/types/api";
import { soundKind } from "./sound";

function line(kind: string, assetKind?: string): Message {
  return {
    kind,
    asset: assetKind ? { kind: assetKind } : null,
  } as unknown as Message;
}

describe("soundKind", () => {
  it("reads a voice note and an audio file off the message itself", () => {
    expect(soundKind(line("voice", "voice"))).toBe("voice");
    expect(soundKind(line("audio", "audio"))).toBe("audio");
  });

  it("still answers when the message says nothing useful", () => {
    expect(soundKind(line("text", "voice"))).toBe("voice");
    expect(soundKind(line("text", "audio"))).toBe("audio");
    expect(soundKind(line("", "voice"))).toBe("voice");
  });

  it("lets the message's own word win, which is the phone's own order", () => {
    expect(soundKind(line("voice", "audio"))).toBe("voice");
    expect(soundKind(line("audio", "voice"))).toBe("audio");
  });

  it("answers nothing for everything else", () => {
    expect(soundKind(line("image", "image"))).toBeNull();
    expect(soundKind(line("doc", "doc"))).toBeNull();
    expect(soundKind(line("text"))).toBeNull();
    expect(soundKind(line("text", "doc"))).toBeNull();
  });
});
