import { useSyncExternalStore } from "react";

export interface OwnWall {
  src: string;
  opacity: number;
}

export const OWN_WALL_OPACITY = 1;

const WALL_EDGE = 1600;
const KEEP_PNG_BYTES = 1_500_000;

const keyOf = (threadId: string) => `convo_wallpaper_${threadId}`;
const walls = new Map<string, OwnWall | null>();
const listeners = new Set<() => void>();
let pending: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return OWN_WALL_OPACITY;
  return Math.min(1, Math.max(0, value));
}

function load(threadId: string): OwnWall | null {
  if (walls.has(threadId)) return walls.get(threadId) ?? null;
  let wall: OwnWall | null = null;
  try {
    const raw = localStorage.getItem(keyOf(threadId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const row =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    const src =
      typeof row?.src === "string"
        ? row.src
        : typeof row?.preview === "string"
          ? row.preview
          : "";
    if (src.startsWith("data:")) {
      wall = { src, opacity: clamp(Number(row?.opacity)) };
    }
  } catch {
    wall = null;
  }
  walls.set(threadId, wall);
  return wall;
}

function store(threadId: string, wall: OwnWall | null): boolean {
  walls.set(threadId, wall);
  for (const listener of listeners) listener();
  try {
    if (wall) localStorage.setItem(keyOf(threadId), JSON.stringify(wall));
    else localStorage.removeItem(keyOf(threadId));
    return true;
  } catch {
    return false;
  }
}

function storeLater(threadId: string) {
  pending = threadId;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const id = pending;
    pending = null;
    if (id) store(id, load(id));
  }, 150);
}

export function ownWallOf(threadId: string): OwnWall | null {
  return threadId ? load(threadId) : null;
}

export function setOwnWall(
  threadId: string,
  src: string,
  opacity = OWN_WALL_OPACITY,
): boolean {
  if (!threadId) return false;
  return store(threadId, { src, opacity: clamp(opacity) });
}

export function setOwnWallOpacity(threadId: string, opacity: number): void {
  const wall = load(threadId);
  if (!wall) return;
  walls.set(threadId, { ...wall, opacity: clamp(opacity) });
  for (const listener of listeners) listener();
  storeLater(threadId);
}

export function clearOwnWall(threadId: string): void {
  if (!threadId) return;
  store(threadId, null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOwnWall(threadId: string): OwnWall | null {
  return useSyncExternalStore(
    subscribe,
    () => ownWallOf(threadId),
    () => null,
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("That photo could not be read."));
    };
    reader.onerror = () => reject(new Error("That photo could not be read."));
    reader.readAsDataURL(file);
  });
}

function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("That file is not a photo this browser can open."));
    image.src = url;
  });
}

export async function readWallImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Pick a photo.");
  }
  if (file.type === "image/png" && file.size <= KEEP_PNG_BYTES) {
    return readFile(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await decode(url);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error("That photo is empty.");
    const scale = Math.min(1, WALL_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot resize that photo.");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}