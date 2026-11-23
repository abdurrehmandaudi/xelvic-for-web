export interface Felt {
  likes: number;
  liked: boolean;
}

export interface FeltAnswer {
  likes?: number;
  liked?: boolean;
}

export interface FeltFrame {
  likes?: number;
  liked?: boolean;
  user?: string;
}

export function optimistic(current: Felt, on: boolean): Felt {
  const delta = on === current.liked ? 0 : on ? 1 : -1;
  return { likes: Math.max(0, current.likes + delta), liked: on };
}

export function settle(current: Felt, answer: FeltAnswer): Felt {
  return {
    likes: typeof answer.likes === "number" ? answer.likes : current.likes,
    liked: typeof answer.liked === "boolean" ? answer.liked : current.liked,
  };
}

export function fromFrame(current: Felt, frame: FeltFrame, meId: string): Felt {
  const likes = typeof frame.likes === "number" ? frame.likes : current.likes;
  const mine = Boolean(meId) && frame.user === meId;
  return {
    likes,
    liked: mine && typeof frame.liked === "boolean" ? frame.liked : current.liked,
  };
}
