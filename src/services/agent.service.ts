import { api } from "@/config/axios";
import type { ThreadCard } from "@/types/api";

export interface AgentHome {
  thread: ThreadCard;
  note: string;
}

export const agentService = {
  home: async (): Promise<AgentHome> => {
    const response = await api.get<AgentHome>("/agent/");
    return response.data;
  },

  open: async (version?: number): Promise<AgentHome> => {
    const response = await api.post<AgentHome>(
      "/agent/open/",
      version ? { version } : {},
    );
    return response.data;
  },
};
