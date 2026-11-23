import api from "@/config/axios";
import { e2ee, openPage, type Envelope } from "@/crypto/e2ee";
import type {
  Asset,
  Channel,
  ChatGate,
  ConvoCatalog,
  GroupRoom,
  Invite,
  Message,
  MessagePoll,
  Page,
  Roster,
  ThreadCard,
  ThreadDetail,
  UserCard,
  VaultState,
} from "@/types/api";

/**
 * Chat.
 *
 * Every road the convo screens walk: the thread list and one thread, the message
 * cursor, the writes that change a message or a thread, groups, search, the
 * vault, and the one asset upload. One method per road, and each answers with
 * the server's own body — `response.data` and nothing reshaped. That is the rule
 * for every service in this folder: a service decides *where* a request goes and
 * *what shape* goes with it, and never invents a value the server did not send.
 *
 * A cursor is the one thing taken as a path rather than as parts. `messagesAt`
 * is handed the `next` from the page before it, because the URL of the next page
 * is the server's to compose and ours only to follow.
 */

/** What `POST /chat/threads/` answers: the convo it opened, or the gate's own sentence about why it would not. */
export interface ThreadStart {
  thread?: ThreadCard | null;
  gate?: (ChatGate & { reason?: string }) | null;
}

/** The thread list. `unread` is the whole-inbox count the convo menu reads. */
export interface ThreadList {
  threads: ThreadCard[];
  unread?: number;
}

/** One send, in the shape the action dispatcher takes it. */
export interface SendPayload {
  kind?: string;
  body?: string;
  reply_to?: string;
  asset?: string;
  payload?: Record<string, unknown>;
  channel?: string | null;
  audience?: string[];
  /** Reused on a retry, so the server's `(sender, client_id)` dedupe holds. */
  client_id?: string;
}

const SEAL_STORE_KEY = "xelvic.e2ee.seals";
const SEAL_STORE_LIMIT = 200;

const seals = new Map<string, Envelope>();

function storedSeals(): Record<string, Envelope> {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(SEAL_STORE_KEY);
    if (!raw) return {};
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data as Record<string, Envelope>;
  } catch {
    return {};
  }
}

function sealedFor(clientId: string | undefined): Envelope | undefined {
  if (!clientId) return undefined;
  const held = seals.get(clientId);
  if (held) return held;
  const stored = storedSeals()[clientId];
  if (stored) seals.set(clientId, stored);
  return stored;
}

function rememberSeal(clientId: string | undefined, envelope: Envelope): void {
  if (!clientId) return;
  if (seals.size >= SEAL_STORE_LIMIT) {
    const oldest = seals.keys().next().value;
    if (oldest !== undefined) seals.delete(oldest);
  }
  seals.set(clientId, envelope);
  try {
    if (typeof localStorage === "undefined") return;
    const all = storedSeals();
    all[clientId] = envelope;
    const keys = Object.keys(all);
    if (keys.length > SEAL_STORE_LIMIT) {
      for (const key of keys.slice(0, keys.length - SEAL_STORE_LIMIT)) {
        delete all[key];
      }
    }
    localStorage.setItem(SEAL_STORE_KEY, JSON.stringify(all));
  } catch {
    return;
  }
}

/** One name in a message's delivery buckets. */
export interface MessageReceipt {
  user: UserCard;
  at: string | null;
}

/** A thread's own look: which backdrop it stands on and which tint it wears. */
export interface SkinPayload {
  wallpaper?: string;
  wallpaper_asset?: string | null;
  tint?: string;
}

export const chatService = {
  // ---- threads ------------------------------------------------------------

  /** The list as the server has it. `vault` asks for the rows inside the vault. */
  threads: async (options: { vault?: boolean } = {}): Promise<ThreadList> => {
    const response = await api.get<ThreadList>(
      "/chat/threads/",
      options.vault ? { params: { vault: "1" } } : undefined,
    );
    return response.data;
  },

  /** One thread, with the wallpaper/reaction catalog that only this road carries. */
  thread: async (threadId: string): Promise<{ thread: ThreadDetail; catalog?: ConvoCatalog }> => {
    const response = await api.get<{ thread: ThreadDetail; catalog?: ConvoCatalog }>(
      `/chat/threads/${threadId}/`,
    );
    return response.data;
  },

  /** Opens the direct convo with somebody, or hands back the gate that refuses. */
  start: async <T = ThreadStart>(userId: string): Promise<T> => {
    const response = await api.post<T>("/chat/threads/", { user: userId });
    return response.data;
  },

  /** A thread's switches: `pinned`, `muted`, `vaulted`, `invites_on`. */
  flags: async (threadId: string, patch: Record<string, boolean>): Promise<{ thread: ThreadDetail }> => {
    const response = await api.patch<{ thread: ThreadDetail }>(`/chat/threads/${threadId}/flags/`, patch);
    return response.data;
  },

  /** How long this convo keeps its own words. `days` rides along when it is on. */
  vanish: async (
    threadId: string,
    mode: string,
    days?: number,
  ): Promise<{ mode: string; days: number | null }> => {
    const response = await api.patch<{ mode: string; days: number | null }>(
      `/chat/threads/${threadId}/vanish/`,
      days ? { mode, days } : { mode },
    );
    return response.data;
  },

  /** The backdrop and the tint this convo wears. */
  skin: async (
    threadId: string,
    patch: SkinPayload,
  ): Promise<{ wallpaper: string; tint: string; wallpaper_asset?: string | null }> => {
    const response = await api.patch<{ wallpaper: string; tint: string }>(
      `/chat/threads/${threadId}/skin/`,
      patch,
    );
    return response.data;
  },

  /** Empties this account's copy; the thread and the other side stay. */
  clear: async (threadId: string): Promise<void> => {
    await api.post(`/chat/threads/${threadId}/clear/`, {});
  },

  /** Removes the thread outright. */
  removeThread: async (threadId: string): Promise<void> => {
    await api.delete(`/chat/threads/${threadId}/`);
  },

  /** Takes a pile off the list in one ask — all of it, or none of it. */
  removeThreads: async (ids: string[]): Promise<{ deleted: number }> => {
    const response = await api.post<{ deleted: number }>(
      "/chat/threads/bulk-delete/",
      { ids },
    );
    return response.data;
  },

  /** Steps out of a group, leaving it behind for everybody else. */
  leave: async (threadId: string): Promise<void> => {
    await api.post(`/chat/threads/${threadId}/leave/`, {});
  },

  /** Writes every thread read at once — the convo menu's "all caught up". */
  readAll: async (): Promise<void> => {
    await api.post("/chat/threads/read/", {});
  },

  /** Says how far this account has read in one thread. */
  read: async (threadId: string, ordinal?: number): Promise<void> => {
    await api.post(`/chat/threads/${threadId}/read/`, ordinal === undefined ? {} : { ordinal });
  },

  /** A group, made in one step from a name and the people in it. */
  createGroup: async (title: string, members: string[]): Promise<{ thread: ThreadCard }> => {
    const response = await api.post<{ thread: ThreadCard }>("/chat/groups/", { title, members });
    return response.data;
  },

  // ---- a group's own furniture --------------------------------------------

  /** What a group is called. Admins only; the server refuses anybody else. */
  renameGroup: async (threadId: string, title: string): Promise<{ thread: ThreadDetail }> => {
    const response = await api.patch<{ thread: ThreadDetail }>(
      `/chat/threads/${threadId}/group/`,
      { title },
    );
    return response.data;
  },

  /** The group's face. A file, so its own route and its own verb. */
  setGroupAvatar: async (threadId: string, form: FormData): Promise<{ thread: ThreadDetail }> => {
    const response = await api.post<{ thread: ThreadDetail }>(
      `/chat/threads/${threadId}/avatar/`,
      form,
    );
    return response.data;
  },

  clearGroupAvatar: async (threadId: string): Promise<{ thread: ThreadDetail }> => {
    const response = await api.delete<{ thread: ThreadDetail }>(
      `/chat/threads/${threadId}/avatar/`,
    );
    return response.data;
  },

  /**
   * The two switches, and the rooms they belong to.
   *
   * One route for both because they are one question — how this group runs —
   * and a body carries only the switch that moved.
   */
  room: async (
    threadId: string,
    patch: { locked?: boolean; invites_on?: boolean },
  ): Promise<GroupRoom> => {
    const response = await api.patch<GroupRoom>(`/chat/threads/${threadId}/room/`, patch);
    return response.data;
  },

  /** The rooms, and making another one. Anybody in the group may read them. */
  channels: async (threadId: string): Promise<{ channels: Channel[] }> => {
    const response = await api.get<{ channels: Channel[] }>(`/chat/threads/${threadId}/channels/`);
    return response.data;
  },

  createChannel: async (threadId: string, name: string): Promise<{ channel: Channel }> => {
    const response = await api.post<{ channel: Channel }>(
      `/chat/threads/${threadId}/channels/`,
      { name },
    );
    return response.data;
  },

  /** A rename, a rule change, or both — the sheet sends whichever moved. */
  updateChannel: async (
    threadId: string,
    channelId: string,
    patch: { name?: string; post?: string; media?: string },
  ): Promise<{ channel: Channel }> => {
    const response = await api.patch<{ channel: Channel }>(
      `/chat/threads/${threadId}/channels/${channelId}/`,
      patch,
    );
    return response.data;
  },

  removeChannel: async (threadId: string, channelId: string): Promise<{ removed: string }> => {
    const response = await api.delete<{ removed: string }>(
      `/chat/threads/${threadId}/channels/${channelId}/`,
    );
    return response.data;
  },

  /** Every link into a group, live and dead. The list is an admin's to read. */
  invites: async (threadId: string): Promise<{ invites: Invite[] }> => {
    const response = await api.get<{ invites: Invite[] }>(`/chat/threads/${threadId}/invites/`);
    return response.data;
  },

  makeInvite: async (threadId: string): Promise<{ invite: Invite }> => {
    const response = await api.post<{ invite: Invite }>(`/chat/threads/${threadId}/invites/`, {});
    return response.data;
  },

  revokeInvite: async (threadId: string, inviteId: string): Promise<{ invite: Invite }> => {
    const response = await api.delete<{ invite: Invite }>(
      `/chat/threads/${threadId}/invites/${inviteId}/`,
    );
    return response.data;
  },

  /** One page of the roster, searched on the server so the cut cannot hide anybody. */
  members: async (threadId: string, q?: string): Promise<Roster> => {
    const response = await api.get<Roster>(
      `/chat/threads/${threadId}/members/`,
      q ? { params: { q } } : undefined,
    );
    return response.data;
  },

  addMembers: async (threadId: string, members: string[]): Promise<{ thread: ThreadDetail }> => {
    const response = await api.post<{ thread: ThreadDetail }>(
      `/chat/threads/${threadId}/members/`,
      { members },
    );
    return response.data;
  },

  setMemberRole: async (
    threadId: string,
    userId: string,
    role: "member" | "admin",
  ): Promise<{ thread: ThreadDetail }> => {
    const response = await api.patch<{ thread: ThreadDetail }>(
      `/chat/threads/${threadId}/members/${userId}/`,
      { role },
    );
    return response.data;
  },

  removeMember: async (threadId: string, userId: string): Promise<{ thread: ThreadDetail }> => {
    const response = await api.delete<{ thread: ThreadDetail }>(
      `/chat/threads/${threadId}/members/${userId}/`,
    );
    return response.data;
  },

  /** The whole group, gone. 204 and nothing else. */
  deleteGroup: async (threadId: string): Promise<void> => {
    await api.post(`/chat/threads/${threadId}/delete/`, {});
  },

  // ---- messages -----------------------------------------------------------

  /** The newest page of a thread's messages. */
  messages: async (threadId: string): Promise<Page<Message>> => {
    const response = await api.get<Page<Message>>(`/chat/threads/${threadId}/messages/`);
    return openPage(response.data);
  },

  /**
   * The page the previous one named. The caller hands over the `next` it was
   * given — a cursor the server composed — rather than parts to rebuild it.
   */
  messagesAt: async (path: string): Promise<Page<Message>> => {
    const response = await api.get<Page<Message>>(path);
    return openPage(response.data);
  },

  /** Sends one message and answers with the row the server made of it. */
  send: async (threadId: string, payload: SendPayload): Promise<{ message: Message }> => {
    const kind = payload.kind ?? "text";
    const plain = payload.body ?? "";
    let envelope: Envelope | null = null;
    if (
      kind === "text" &&
      plain.length > 0 &&
      !payload.asset &&
      payload.audience !== undefined
    ) {
      void e2ee.prepare().catch(() => undefined);
      envelope = sealedFor(payload.client_id) ?? null;
      if (!envelope) {
        envelope = await e2ee.seal(plain, payload.audience);
        if (envelope) rememberSeal(payload.client_id, envelope);
      }
    }
    const carried: Record<string, unknown> = {
      thread_id: threadId,
      kind,
      body: envelope ? "" : plain,
    };
    if (envelope) carried.enc = envelope;
    if (payload.reply_to) carried.reply_to = payload.reply_to;
    if (payload.asset) carried.asset = payload.asset;
    if (payload.payload) carried.payload = payload.payload;
    if (payload.channel) carried.channel = payload.channel;
    if (payload.client_id) carried.message_client_id = payload.client_id;
    const response = await api.post<{
      replayed: boolean;
      result: { message: Message };
    }>("/chat/actions/", {
      client_id: crypto.randomUUID(),
      action: "message.send",
      payload: carried,
    });
    const result = response.data.result;
    if (result?.message) result.message = await e2ee.absorb(result.message);
    return result;
  },

  /** Rewrites a message's words. */
  edit: async (
    threadId: string,
    messageId: string,
    body: string,
    options: { audience?: string[]; sealed?: boolean } = {},
  ): Promise<void> => {
    if (options.sealed) {
      const envelope = options.audience
        ? await e2ee.seal(body, options.audience)
        : null;
      if (!envelope) {
        throw new Error(
          "That line is sealed, and it could not be sealed again just now. Open the conversation and try once more.",
        );
      }
      await api.patch(`/chat/threads/${threadId}/messages/${messageId}/`, {
        body: "",
        enc: envelope,
      });
      return;
    }
    await api.patch(`/chat/threads/${threadId}/messages/${messageId}/`, {
      body,
    });
  },

  /** Removes it from this copy, or — with `all` — for everybody. */
  removeMessage: async (threadId: string, messageId: string, all = false): Promise<void> => {
    await api.delete(
      `/chat/threads/${threadId}/messages/${messageId}/`,
      all ? { params: { scope: "all" } } : undefined,
    );
  },

  /** Copies a message into the picked threads, and answers with the copies. */
  forward: async (
    threadId: string,
    messageId: string,
    threads: string[],
  ): Promise<{ messages: Message[] }> => {
    const response = await api.post<{ messages: Message[] }>(
      `/chat/threads/${threadId}/messages/${messageId}/forward/`,
      { threads },
    );
    return response.data;
  },

  /** Who has seen, who has it, and who has neither — straight from the server. */
  messageInfo: async (
    threadId: string,
    messageId: string,
  ): Promise<{ seen: MessageReceipt[]; delivered: MessageReceipt[]; not_delivered: MessageReceipt[] }> => {
    const response = await api.get<{
      seen: MessageReceipt[];
      delivered: MessageReceipt[];
      not_delivered: MessageReceipt[];
    }>(`/chat/threads/${threadId}/messages/${messageId}/info/`);
    return response.data;
  },

  /** The same emoji twice takes the reaction back, and `emoji` says so. */
  react: async (
    threadId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ emoji: string | null; reactions: Message["reactions"] }> => {
    const response = await api.post<{ emoji: string | null; reactions: Message["reactions"] }>(
      `/chat/threads/${threadId}/messages/${messageId}/react/`,
      { emoji },
    );
    return response.data;
  },

  /** Answers a poll by the index of the option chosen. */
  vote: async (threadId: string, messageId: string, choice: number): Promise<{ poll: MessagePoll }> => {
    const response = await api.post<{ poll: MessagePoll }>(
      `/chat/threads/${threadId}/messages/${messageId}/vote/`,
      { choice },
    );
    return response.data;
  },

  /** Spends a one-look message, which is what makes the server purge its bytes. */
  openOnce: async (threadId: string, messageId: string): Promise<{ message: Message }> => {
    const response = await api.post<{ message: Message }>(
      `/chat/threads/${threadId}/messages/${messageId}/open-once/`,
      {},
    );
    return response.data;
  },

  /** Everything ever shared in one thread, of the kinds asked for. */
  media: async (
    threadId: string,
    kinds = "image,video,voice,audio,doc",
  ): Promise<{ messages: Message[] }> => {
    const response = await api.get<{ messages: Message[] }>(`/chat/threads/${threadId}/media/`, {
      params: { kinds },
    });
    return response.data;
  },

  // ---- finding ------------------------------------------------------------

  /** The words themselves, across every convo this account can read. */
  search: async (q: string): Promise<{ query: string; messages: Message[] }> => {
    const response = await api.get<{ query: string; messages: Message[] }>("/chat/search/", {
      params: { q },
    });
    const data = response.data;
    if (!data?.messages?.length) return data;
    const messages = await Promise.all(
      data.messages.map((one) => e2ee.absorb(one)),
    );
    return { ...data, messages };
  },

  // ---- the vault ----------------------------------------------------------

  /** The lock's own state: whether a code is set, whether the door is open, and whether it is hidden. */
  vaultState: async (): Promise<VaultState> => {
    const response = await api.get<VaultState>("/chat/vault/");
    return response.data;
  },

  /** Opens the vault for this session. Too many tries answer 429. */
  vaultUnlock: async (code: string): Promise<void> => {
    await api.post("/chat/vault/unlock/", { code });
  },

  /** Closes it again. */
  vaultLock: async (): Promise<void> => {
    await api.delete("/chat/vault/unlock/");
  },

  /** Sets or changes the code; `current` is required once one is already set. */
  vaultSetCode: async (code: string, current?: string): Promise<void> => {
    await api.put("/chat/vault/", current === undefined ? { code } : { code, current });
  },

  /** Takes the code away, which is what unlocks the vault for good. */
  vaultRemoveCode: async (code: string): Promise<void> => {
    await api.delete("/chat/vault/", { data: { code } });
  },

  /** Hides the vault's door — or puts it back in the convo menu. */
  vaultHide: async (hide: boolean): Promise<VaultState> => {
    const response = await api.patch<VaultState>("/chat/vault/", { hide });
    return response.data;
  },

  /** The forgotten-code road: every chat inside the vault is deleted. */
  vaultReset: async (password: string): Promise<void> => {
    await api.post("/chat/vault/reset/", { password });
  },

  // ---- files --------------------------------------------------------------

  /** The upload. The form is the body, whole. */
  uploadAsset: async (form: FormData): Promise<{ asset?: Asset } & Asset> => {
    const response = await api.post<{ asset?: Asset } & Asset>("/chat/assets/", form);
    return response.data;
  },
};

export default chatService;
