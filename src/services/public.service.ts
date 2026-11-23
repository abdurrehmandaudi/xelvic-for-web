import api from "@/config/axios";
import type { Drop, Profile } from "@/types/api";

/**
 * The open web's read-only doors.
 *
 * `/public/profile/<handle>/`, `/public/drop/<id>/` and `/public/vibe/<id>/`
 * answer without a session — they are the server half of the pages a search
 * result lands on. The payloads carry no reader answers (`liked`, `mine`,
 * `can_view` for me): a public page is the same for everybody.
 *
 * Never send a token here. A signed-in reader belongs on the app's own page,
 * where the relation, the gate and the actions already exist.
 */
export const publicService = {
  profile: async (
    username: string,
  ): Promise<{ profile: Profile; posts: Drop[] }> => {
    const response = await api.get<{ profile: Profile; posts: Drop[] }>(
      `/public/profile/${encodeURIComponent(username)}/`,
      { skipAuth: true },
    );
    return response.data;
  },

  drop: async (id: string): Promise<Drop> => {
    const response = await api.get<{ drop: Drop }>(
      `/public/drop/${encodeURIComponent(id)}/`,
      { skipAuth: true },
    );
    return response.data.drop;
  },

  vibe: async (id: string): Promise<Drop> => {
    const response = await api.get<{ vibe: Drop }>(
      `/public/vibe/${encodeURIComponent(id)}/`,
      { skipAuth: true },
    );
    return response.data.vibe;
  },
};

export default publicService;
