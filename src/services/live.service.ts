import api from "@/config/axios";
import { API_BASE } from "@/config/env";
import { session } from "@/store/session";
import type { ID } from "@/types/api";

export interface LivePerson {
  user: string;
  name: string;
  username: string;
  avatar: string | null;
}

export interface LiveRow {
  id: string;
  title: string;
  state: string;
  visibility?: string;
  category?: string | null;
  owner?: LivePerson | null;
  viewers: number;
  likes: number;
  liked: boolean;
  started_at?: string | null;
  ended_at?: string | null;
  pinned?: string | null;
  thumbnail?: string | null;
  playback_url?: string;
}

export interface LiveShelf {
  lives: LiveRow[];
}

export interface LiveFeltAnswer {
  likes: number;
  liked: boolean;
}

export interface LiveCreateInput {
  title: string;
  visibility?: string;
}

export interface LiveCreated {
  id: string;
  title: string;
  state: string;
  whip_url?: string;
  playback_url?: string;
}

export interface LiveAliveAnswer {
  ok?: boolean;
  viewers?: number;
}

export const liveService = {
  shelf: async (): Promise<LiveShelf> => {
    const response = await api.get<LiveShelf>("/live/");
    return response.data;
  },

  detail: async (id: ID): Promise<LiveRow> => {
    const response = await api.get<LiveRow>(`/live/${encodeURIComponent(id)}/`);
    return response.data;
  },

  felt: async (id: ID, on: boolean): Promise<LiveFeltAnswer> => {
    const response = await api.post<LiveFeltAnswer>(
      `/live/${encodeURIComponent(id)}/felt/`,
      { on },
    );
    return response.data;
  },

  create: async (input: LiveCreateInput): Promise<LiveCreated> => {
    const response = await api.post<LiveCreated>("/live/", {
      title: input.title,
      visibility: input.visibility ?? "public",
    });
    return response.data;
  },

  start: async (id: ID): Promise<LiveRow> => {
    const response = await api.post<LiveRow>(
      `/live/${encodeURIComponent(id)}/start/`,
      {},
    );
    return response.data;
  },

  alive: async (id: ID): Promise<LiveAliveAnswer> => {
    const response = await api.post<LiveAliveAnswer>(
      `/live/${encodeURIComponent(id)}/alive/`,
      {},
    );
    return response.data;
  },

  end: async (id: ID): Promise<LiveRow> => {
    const response = await api.post<LiveRow>(
      `/live/${encodeURIComponent(id)}/end/`,
      {},
    );
    return response.data;
  },

  endQuietly: async (id: ID): Promise<void> => {
    try {
      await api.post(`/live/${encodeURIComponent(id)}/end/`, {});
    } catch {
      return;
    }
  },

  endOnLeave: (id: ID): void => {
    try {
      const token = session.access();
      void fetch(`${API_BASE}/live/${encodeURIComponent(id)}/end/`, {
        method: "POST",
        keepalive: true,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: "{}",
      }).catch(() => undefined);
    } catch {
      return;
    }
  },
};

export default liveService;
