import type { Message } from "@/types/api";

export type SoundKind = "audio" | "voice";

export function soundKind(message: Message): SoundKind | null {
  if (message.kind === "voice" || message.kind === "audio") return message.kind;
  const kind = message.asset?.kind;
  return kind === "voice" || kind === "audio" ? kind : null;
}
