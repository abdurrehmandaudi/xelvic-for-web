export type DroppedFiles = { threadId: string; files: File[] };

let pending: DroppedFiles | null = null;
const listeners = new Set<(payload: DroppedFiles) => void>();

export function handOffFiles(threadId: string, files: File[]) {
  if (!files.length) return;
  const payload = { threadId, files };
  pending = payload;
  for (const listener of listeners) listener(payload);
}

export function takeDroppedFiles(threadId: string): File[] | null {
  if (!pending || pending.threadId !== threadId) return null;
  const { files } = pending;
  pending = null;
  return files;
}

export function subscribeDroppedFiles(
  listener: (payload: DroppedFiles) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
