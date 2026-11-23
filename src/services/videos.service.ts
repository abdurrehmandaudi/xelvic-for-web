import api from "@/config/axios";
import type { Drop, ID, Page, SavedShelf } from "@/types/api";

export interface VideoCategory {
  id: string;
  name: string;
  count: number;
}

export interface VideoCategories {
  categories: VideoCategory[];
}

export interface VideoWatchReport {
  drop: ID;
  seconds: number;
  duration: number;
  completed?: boolean;
}

export interface VideoWatched {
  watched: boolean;
  seconds: number;
  completed: boolean;
}

export interface LaterWrite {
  kind: "drop";
  id: ID;
  on: boolean;
}

export interface LaterWriteResult {
  saved: boolean;
  kind: string;
  id: string;
  collection: string;
}

export const videosService = {
  feed: async (params?: { category?: string; cursor?: string }): Promise<Page<Drop>> => {
    const response = await api.get<Page<Drop>>("/drops/", {
      params: {
        kind: "video",
        seen: "strict",
        limit: 12,
        ...(params?.category ? { category: params.category } : {}),
        ...(params?.cursor ? { cursor: params.cursor } : {}),
      },
    });
    return response.data;
  },

  categories: async (): Promise<VideoCategories> => {
    const response = await api.get<VideoCategories>("/drops/videos/categories/");
    return response.data;
  },

  watched: async ({ drop, seconds, duration, completed }: VideoWatchReport): Promise<VideoWatched> => {
    const response = await api.post<VideoWatched>("/drops/videos/watched/", {
      drop,
      seconds,
      duration,
      ...(completed === undefined ? {} : { completed }),
    });
    return response.data;
  },

  later: async (): Promise<SavedShelf> => {
    const response = await api.get<SavedShelf>("/saved/later/");
    return response.data;
  },

  setLater: async ({ kind, id, on }: LaterWrite): Promise<LaterWriteResult> => {
    const response = await api.post<LaterWriteResult>("/saved/later/", { kind, id, on });
    return response.data;
  },
};

export default videosService;