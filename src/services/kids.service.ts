import api from "@/config/axios";
import type { Drop } from "@/types/api";

export interface KidsPage {
  results: Drop[];
  next: string | null;
  previous?: string | null;
}

export interface KidsQuery {
  shelf?: string;
  q?: string;
  cursor?: string | null;
  limit?: number;
}

export const KIDS_SHELF_PATH = "/drops/kids/";
export const KIDS_VIBES_PATH = "/drops/kids/vibes/";

function params(query: KidsQuery) {
  return {
    ...(query.shelf ? { shelf: query.shelf } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
    limit: query.limit ?? 20,
  };
}

export const kidsService = {
  shelf: async (query: KidsQuery = {}): Promise<KidsPage> => {
    const response = await api.get<KidsPage>(KIDS_SHELF_PATH, { params: params(query) });
    return response.data;
  },

  vibes: async (query: KidsQuery = {}): Promise<KidsPage> => {
    const response = await api.get<KidsPage>(KIDS_VIBES_PATH, { params: params(query) });
    return response.data;
  },
};

export default kidsService;