import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  AtSign,
  BadgeCheck,
  CameraOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  Copy,
  Download,
  EyeOff,
  Forward,
  Heart,
  Image as ImageIcon,
  ImageOff,
  Info,
  ListChecks,
  Lock,
  MapPin,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Music2,
  Pause,
  Pencil,
  Phone,
  PhoneMissed,
  Play,
  Plus,
  Reply,
  RotateCcw,
  Smile,
  Sparkles,
  Square,
  Sticker,
  Tag,
  Trash2,
  User,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";
import { FaRegCommentDots } from "react-icons/fa6";
import { FiShare2 } from "react-icons/fi";
import { FaFileLines } from "react-icons/fa6";
import { Avatar } from "@/components/ui/Avatar";
import { Backdrop } from "@/components/layout/Backdrop";
import { DocumentGlyph } from "@/components/icons/DocumentGlyph";
import { Button, Spinner } from "@/components/ui/Button";
import { VerifiedTick } from "@/components/icons/Tick";
import { AuthedImage, AuthedVideo } from "@/components/media/Media";
import { Modal } from "@/components/overlays/Modal";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Arrivals } from "@/features/convo/arrivals";
import { ConvoSheet } from "@/features/convo/ConvoSheet";
import { GroupPanel } from "@/features/convo/GroupPanel";
import { threadTitle } from "@/features/convo/model";
import { useNames } from "@/features/convo/names";
import { VibesPanel } from "@/features/convo/VibesPanel";
import {
  LocationSheet,
  type SharablePlace,
} from "@/features/convo/LocationSheet";
import { MapPreview } from "@/features/convo/MapPreview";
import { StickerSheet } from "@/features/convo/StickerSheet";
import { TypingPeek, PEEK_CLEAR } from "@/features/convo/TypingPeek";
import { VoiceBubble } from "@/features/convo/VoiceBubble";
import { soundKind } from "@/features/convo/sound";
import { VoiceStrip } from "@/features/convo/VoiceStrip";
import {
  SHELF,
  SHELF_FOOTER,
  SHELF_GRID,
  SHELF_SEARCH,
  SHELF_TITLE,
} from "@/components/ui/shelf";
import { useVoiceNote } from "@/features/convo/useVoiceNote";
import {
  chosenTint,
  convoColors,
  nameTint,
  vanishLabel,
  wallUrl,
  wallpaperOpacity,
} from "@/features/convo/skin";
import { useOwnWall } from "@/features/convo/look";
import { convoPalette, rgbChannels } from "@/providers/ThemeProvider";
import {
  coverTone,
  CoverArt,
  seedOf,
  trackIsPodcast,
  trackUnder,
} from "@/features/audio/parts";
import { LikeButton } from "@/features/audio/rows";
import { CommentsModal } from "@/features/drops/CommentsModal";
import { ShareSheet } from "@/features/drops/ShareSheet";
import { memoryAsMoment } from "@/features/moments/memory";
import { SensitiveVeil } from "@/features/drops/SensitiveVeil";
import { PollBlock } from "@/features/drops/PollBlock";
import {
  dropBase,
  dropIsPoll,
  dropIsSound,
  dropIsVibe,
  dropPictures,
  dropStill,
} from "@/features/drops/model";
import { apiPathFrom, apiUrl } from "@/config/urls";
import { chatService } from "@/services/chat.service";
import { cachedThread } from "@/store/seed";
import { dropsService } from "@/services/drops.service";
import { momentsService } from "@/services/moments.service";
import {
  stickersService,
  type ShelfSticker,
} from "@/services/stickers.service";
import { cn } from "@/utils/cn";
import { clock, count, duration, mediaSize } from "@/utils/format";
import { ApiError, errorMessage } from "@/utils/errors";
import { claimEar, releaseEar } from "@/utils/playback";
import { mediaBlob, warmMedia } from "@/utils/mediaCache";
import { lockScroll } from "@/utils/scrollLock";
import { useLooking } from "@/hooks/useLooking";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { usePlayer } from "@/hooks/usePlayer";
import { kindOf, uploadAsset } from "@/utils/upload";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useSocket, useSocketEvent } from "@/hooks/useSocket";
import { useToast } from "@/hooks/useToast";
import { useCallEngine } from "@/hooks/useCall";
// The camera's own code, fetched while the thread is being read. See
// `features/camera/warm.ts` — this downloads a module and nothing else.
import { warmCamera, warmCameraWhenIdle } from "@/features/camera/warm";
import { EmojiText } from "@/features/emoji/EmojiText";
import { EmojiRow } from "@/features/emoji/EmojiRow";
import { onlyEmojiCount } from "@/features/emoji/text";
import type {
  Asset,
  Drop,
  Message,
  MessagePoll,
  Moment,
  Page,
  Poll,
  Track,
  Playlist,
  ThreadDetail,
  UserCard,
} from "@/types/api";

const REACTIONS = ["❤️", "😂", "🔥", "👍", "😮", "😢"];

// The same camera the convo list uses, so a Spark is taken, edited and sent
// from the app's own editor rather than from a bare file input.
const CameraCapture = lazy(() =>
  import("@/features/camera/CameraCapture").then((module) => ({
    default: module.CameraCapture,
  })),
);

// A story card opens the story it carries, and the walk that shows one is the
// viewer every other screen already uses. Asked for lazily because it brings the
// picture editor behind it, and a thread that carries no story card should not
// pay for one.
const MomentViewer = lazy(() =>
  import("@/features/moments/MomentViewer").then((module) => ({
    default: module.MomentViewer,
  })),
);

const EmojiPicker = lazy(() =>
  import("@/features/emoji/EmojiPicker").then((module) => ({
    default: module.EmojiPicker,
  })),
);

function draftKey(threadId: string) {
  return `xelvic:convo-draft:${threadId}`;
}

function readDraft(threadId: string) {
  try {
    return localStorage.getItem(draftKey(threadId)) ?? "";
  } catch {
    // Private mode or blocked storage: drafts are a convenience, not state.
    return "";
  }
}

function writeDraft(threadId: string, text: string) {
  try {
    if (text.trim()) localStorage.setItem(draftKey(threadId), text);
    else localStorage.removeItem(draftKey(threadId));
  } catch {
    // Ignore: the convo itself is unaffected.
  }
}

type MessageData = InfiniteData<Page<Message>, string | null>;

function updateMessageList(
  data: MessageData | undefined,
  update: (rows: Message[]) => Message[],
): MessageData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      results: update(page.results),
    })),
  };
}

function useMessageCache(threadId: string) {
  const queryClient = useQueryClient();
  const key = ["messages", threadId] as const;
  /** Which messages have only just landed, so their emoji can say so once. */
  const arrivals = useRef(new Arrivals());

  /**
   * Insert or replace one message.
   *
   * A message from the socket can arrive before the HTTP response that
   * created it, and an optimistic row is already on screen by then. Both
   * carry the same `client_id`, so the local row is replaced rather than
   * followed by a second copy. Ids still win over client ids: the same
   * canonical message may arrive twice (HTTP + socket), and the second is a
   * merge, not a new bubble.
   */
  function insert(message: Message) {
    queryClient.setQueryData<MessageData>(key, (data) => {
      if (!data?.pages.length) return data;
      const matches = (row: Message) =>
        row.id === message.id ||
        Boolean(message.client_id && row.client_id === message.client_id);
      const exists = data.pages.some((page) => page.results.some(matches));
      if (exists) {
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            results: page.results.map((row) => {
              if (!matches(row)) return row;
              const fresh =
                row.asset && !assetSrc(message.asset)
                  ? { ...message, asset: row.asset }
                  : message;
              return {
                ...row,
                ...fresh,
                mine: message.mine ?? row.mine,
                pending: false,
                failed: false,
              };
            }),
          })),
        };
      }
      const pages = [...data.pages];
      pages[0] = { ...pages[0], results: [message, ...pages[0].results] };
      return { ...data, pages };
    });
  }

  function insertLocal(message: Message) {
    queryClient.setQueryData<MessageData>(key, (data) => {
      if (!data?.pages.length) {
        // The history is still loading. Seed a page so the optimistic row is
        // visible immediately; the in-flight fetch replaces it with the
        // server's copy, which already includes the message once it lands.
        return {
          pages: [{ results: [message], next: null, previous: null }],
          pageParams: [null],
        } as MessageData;
      }
      const exists = data.pages.some((page) =>
        page.results.some((row) => row.id === message.id),
      );
      if (exists) return data;
      const pages = [...data.pages];
      pages[0] = { ...pages[0], results: [message, ...pages[0].results] };
      return { ...data, pages };
    });
  }

  /**
   * Insert a message that has just arrived.
   *
   * The difference between this and `insert` is a celebration: an emoji in a
   * message that has just landed plays once, and an edit of yesterday's message
   * is not an arrival however it reaches the list.
   */
  function arrive(message: Message) {
    arrivals.current.mark(message);
    insert(message);
  }

  /** When this message arrived, if it is still new. */
  function arrivalOf(message: Message) {
    return arrivals.current.of(message);
  }

  function markFailed(id: string, failure?: string) {
    queryClient.setQueryData<MessageData>(key, (data) =>
      updateMessageList(data, (rows) =>
        rows.map((row) =>
          row.id === id
            ? { ...row, pending: false, failed: true, failure }
            : row,
        ),
      ),
    );
  }

  function patch(messageId: string, patch: Partial<Message>) {
    queryClient.setQueryData<MessageData>(key, (data) =>
      updateMessageList(data, (rows) =>
        rows.map((row) => (row.id === messageId ? { ...row, ...patch } : row)),
      ),
    );
  }

  function remove(ids: string[]) {
    queryClient.setQueryData<MessageData>(key, (data) =>
      updateMessageList(data, (rows) =>
        rows.filter((row) => !ids.includes(row.id)),
      ),
    );
  }

  return { insert, arrive, arrivalOf, insertLocal, markFailed, patch, remove };
}

function fileDetails(asset?: Asset | null): string {
  const kind = String(asset?.kind ?? "");
  const words: Record<string, string> = {
    image: "Image",
    video: "Video",
    doc: "Document",
    audio: "Audio",
    voice: "Audio",
  };
  // The ending rather than the mime: `application/vnd.openxmlformats-officedocument…`
  // is a true name for a Word file and an unreadable one on a row 230 pixels
  // wide. "DOCX · 24 KB" is the same fact said the way the phone says it.
  const parts = String(asset?.original_name ?? "").split(".");
  const ending = parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : "";
  const type = /^[a-z0-9]{1,5}$/.test(ending)
    ? ending.toUpperCase()
    : words[kind] || "File";
  const secs = asset?.duration_ms ? asset.duration_ms / 1000 : 0;
  const spoken =
    (kind === "audio" || kind === "voice") && secs > 0
      ? ` · ${duration(secs)}`
      : "";
  return `${type} · ${mediaSize(asset?.size)}${spoken}`;
}

function ChatDocument({
  src,
  name,
  asset,
  kind = "doc",
}: {
  src: string | null | undefined;
  name?: string;
  asset?: Asset | null;
  kind?: "doc" | "audio";
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"view" | "save" | null>(null);
  /** The bytes, once they have crossed: View and Save as share one read. */
  const bytes = useRef<Blob | null>(null);
  if (!src) return null;
  const title = name || (kind === "audio" ? "An audio file" : "A document");
  const type = (asset?.mime || "").toLowerCase();
  const shownInTab = /^(application\/pdf|text\/|image\/|video\/|audio\/)/.test(
    type,
  );
  const fileName = name || asset?.original_name || "download";

  async function bytesFor() {
    if (bytes.current) return bytes.current;
    const blob = await mediaBlob(src!);
    // Re-made under the file's own type: a `.pdf` handed over as
    // `application/octet-stream` is one the reader's own viewer will not open,
    // however right the bytes are.
    const named = new Blob([blob], {
      type: blob.type || type || "application/octet-stream",
    });
    bytes.current = named;
    return named;
  }

  /**
   * Open the file, or save it when nothing on the other end could draw it.
   *
   * The phone's own pair of answers: a PDF is *viewed* — a tab with the
   * browser's reader, unchanged and not saved — and a zip is *downloaded*,
   * because there is nothing a browser could show. Which of the two a tap gets
   * is the type's answer, not the person's to guess.
   */
  async function view() {
    if (busy) return;
    if (!shownInTab) {
      await save();
      return;
    }
    // Opened while the click still counts as the person's own act: a tab
    // opened after the bytes arrive has been waited for, and browsers refuse
    // those as pop-ups.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setBusy("view");
    try {
      const url = URL.createObjectURL(await bytesFor());
      if (!tab) {
        // The tab was refused, so the file comes down rather than the tap
        // doing nothing at all.
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return;
      }
      tab.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (error) {
      tab?.close();
      toast({
        title: "Could not open that file.",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (busy) return;
    setBusy("save");
    try {
      const url = URL.createObjectURL(await bytesFor());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Could not save that file.",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-[238px] overflow-hidden rounded-[8px] border border-line bg-card">
      <button
        type="button"
        onClick={() => void view()}
        disabled={Boolean(busy)}
        title={shownInTab ? "View" : "Download"}
        className="flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] disabled:opacity-70"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--accent-soft)] text-accent">
          <DocumentGlyph mime={asset?.mime} name={title} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-[17px] text-ink">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] font-medium text-dim">
            {busy === "save"
              ? "Saving…"
              : busy === "view"
                ? "Opening…"
                : fileDetails(asset)}
          </span>
        </span>
      </button>
      {/* The two answers under the file, told apart by what the file is: a PDF
          can be read where it is, a zip cannot and only comes down. */}
      <div className="flex items-stretch border-t border-line">
        {shownInTab ? (
          <>
            <DocAction
              label="View"
              onClick={() => void view()}
              disabled={Boolean(busy)}
            />
            <span className="w-px shrink-0 bg-line" aria-hidden />
            <DocAction
              label="Save as…"
              onClick={() => void save()}
              disabled={Boolean(busy)}
            />
          </>
        ) : (
          <DocAction
            label="Download"
            onClick={() => void save()}
            disabled={Boolean(busy)}
          />
        )}
      </div>
    </div>
  );
}

/** One answer under a file: the word, and nothing that has to be read twice. */
function DocAction({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-1 items-center justify-center py-2 text-[12px] font-bold text-accent transition hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function sharedDrop(message: Message) {
  const payload = message.payload ?? {};
  const rawDrop = payload.drop ?? payload.post;
  if (typeof rawDrop === "string" && rawDrop) return { id: rawDrop } as Drop;
  const drop = rawDrop as Drop | undefined;
  if (drop?.id) return drop;
  const rawVibe = payload.vibe;
  if (typeof rawVibe === "string" && rawVibe) return { id: rawVibe } as Drop;
  const vibe = rawVibe as Drop | undefined;
  if (vibe?.id) return vibe;
  const id = payload.drop_id ?? payload.post_id ?? payload.vibe_id;
  if (typeof id === "string" && id) return { id } as Drop;
  return null;
}

function isSharedMessage(message: Message) {
  return (
    Boolean(sharedDrop(message)) ||
    Boolean(sharedTrack(message)) ||
    Boolean(sharedPerson(message)) ||
    Boolean(sharedStory(message)) ||
    Boolean(sharedSticker(message)) ||
    Boolean(message.payload?.playlist) ||
    Boolean(message.payload?.room) ||
    message.kind === "drop" ||
    message.kind === "vibe" ||
    message.kind === "live"
  );
}

function sharedTrack(
  message: Message,
): { track: Track; fromDrop: boolean } | null {
  const share = (message.payload ?? {}).track;
  if (!share || typeof share !== "object") return null;
  const raw = share as Record<string, unknown>;
  const id = raw.id == null ? "" : String(raw.id);
  if (!id) return null;
  const fromDrop = raw.source === "drop";
  return {
    fromDrop,
    track: {
      id,
      kind: typeof raw.kind === "string" ? raw.kind : undefined,
      title: typeof raw.title === "string" ? raw.title : "",
      artist: typeof raw.artist === "string" ? raw.artist : "",
      series: typeof raw.series === "string" ? raw.series : null,
      episode: typeof raw.episode === "number" ? raw.episode : null,
      seconds: typeof raw.seconds === "number" ? raw.seconds : undefined,
      seed: (raw.seed as number | string | undefined) ?? undefined,
      stream: fromDrop
        ? `/drops/drops/${id}/content/`
        : `/audio/tracks/${id}/stream/`,
    },
  };
}

function sharedPerson(message: Message) {
  const share = (message.payload ?? {}).profile;
  if (!share || typeof share !== "object") return null;
  const raw = share as Record<string, unknown>;
  const username = typeof raw.username === "string" ? raw.username : "";
  const id = raw.id == null ? "" : String(raw.id);
  if (!username && !id) return null;
  return {
    id,
    username,
    name: typeof raw.name === "string" ? raw.name : "",
    avatar: typeof raw.avatar === "string" ? raw.avatar : "",
    verified: raw.verified === true,
    isPrivate: raw.is_private === true,
  };
}

function sharedStory(message: Message) {
  const payload = message.payload ?? {};
  const retracted = payload.retracted;
  const down = retracted && typeof retracted === "object";
  const card = (down ? retracted : payload) as Record<string, unknown>;
  const author = card.story;
  if (typeof author !== "string" || !author) return null;
  return {
    author,
    moment: typeof card.moment === "string" ? card.moment : "",
    memory: typeof card.memory === "string" ? card.memory : "",
    /** Whether this is somebody putting *me* in their day, rather than passing one along. */
    mention: card.mention === true,
    /** Who named me, for the line the card carries over it. Empty when nobody did. */
    by: typeof payload.by === "string" ? payload.by : "",
    /** The author took the moment down: the card keeps its frame and opens nothing. */
    gone: Boolean(down),
  };
}

function momentRef(message: Message) {
  const ref = (message.payload ?? {}).moment_ref;
  if (!ref || typeof ref !== "object") return null;
  const raw = ref as Record<string, unknown>;
  return {
    id: raw.id == null ? "" : String(raw.id),
    kind: typeof raw.kind === "string" ? raw.kind : "image",
    text: typeof raw.text === "string" ? raw.text.trim() : "",
  };
}

function sharedSticker(message: Message) {
  const raw = (message.payload ?? {}).sticker;
  if (!raw || typeof raw !== "object") return null;
  const sticker = raw as Record<string, unknown>;
  const url = typeof sticker.url === "string" ? sticker.url.trim() : "";
  if (!url) return null;
  return {
    id: sticker.id == null ? "" : String(sticker.id),
    name: typeof sticker.name === "string" ? sticker.name.trim() : "",
    url,
  };
}

function isSparkMessage(message: Message) {
  return message.payload?.view_once === true;
}

function isLocalMessage(message: Message) {
  return (
    Boolean(message.pending) ||
    Boolean(message.failed) ||
    String(message.id).startsWith("local-")
  );
}

/** The name a line keeps while a pile is being picked. */
function pickKey(message: Message) {
  return message.client_id || String(message.id);
}

const SHARE_WINDOW_MS = 4_000;

function isFrameMedia(message: Message) {
  return (
    !message.deleted_for_all &&
    (message.kind === "image" || message.kind === "video") &&
    !isSparkMessage(message)
  );
}

const WARM_MEDIA_BYTES = 16 * 1024 * 1024;

function assetSrc(asset?: Asset | null) {
  if (!asset) return null;
  if (asset.content_url) return asset.content_url;
  if (!asset.id || asset.purged_at || asset.available === false) return null;
  return apiUrl(`/chat/assets/${asset.id}/content/`);
}

function messageMedia(message: Message): (string | null)[] {
  const asset = message.asset;
  if (!asset || asset.purged_at || asset.available === false) return [];
  const kind = (asset.kind || "").toLowerCase();
  const heavy = kind === "video" || (asset.size ?? 0) > WARM_MEDIA_BYTES;
  return [asset.thumbnail_url ?? null, heavy ? null : asset.content_url];
}

/** The pick a message came from, when the sender's app said so. */
function shareIdOf(message: Message) {
  const group = message.payload?.group;
  return typeof group === "string" && group ? group : null;
}

/** Whether [next] is the next line of the same share as [at]. */
function joinsShare(at: Message, next: Message) {
  if (!isFrameMedia(next) || !isFrameMedia(at)) return false;
  if ((at.sender?.id ?? "") !== (next.sender?.id ?? "")) return false;
  const mine = shareIdOf(at);
  const theirs = shareIdOf(next);
  // An id is a promise: two pictures that both name a share are in it together
  // or they are not, and no clock gets a say.
  if (mine != null || theirs != null) return theirs === mine;
  return (
    Math.abs(Date.parse(next.created_at) - Date.parse(at.created_at)) <=
    SHARE_WINDOW_MS
  );
}

function frameAt(messages: Message[], index: number): Message[] | null {
  if (!isFrameMedia(messages[index])) return [messages[index]];
  let start = index;
  let end = index;
  while (start > 0 && joinsShare(messages[start - 1], messages[start])) {
    start -= 1;
  }
  while (
    end < messages.length - 1 &&
    joinsShare(messages[end], messages[end + 1])
  ) {
    end += 1;
  }
  if (index !== end) return null;
  return messages.slice(start, end + 1);
}

function frameShape(frame: Message[]) {
  let total = 0;
  let counted = 0;
  for (const row of frame) {
    const width = row.asset?.width ?? 0;
    const height = row.asset?.height ?? 0;
    if (!width || !height || width >= height) continue;
    total += Math.min(0.8, Math.max(0.45, width / height));
    counted += 1;
  }
  return counted ? total / counted : 2 / 3;
}
function sparkState(message: Message, mine: boolean) {
  const payload = message.payload ?? {};
  // The server's own mark, and nothing this browser remembered: a look spent on
  // another device has to read the same here as it does there.
  const opened = payload.opened_at != null;
  const url = message.asset?.content_url;
  return {
    opened,
    shotAt: typeof payload.shot_at === "string" ? payload.shot_at : null,
    canOpen: !mine && !opened && Boolean(url),
  };
}

function sparkShotLine(message: Message, mine: boolean) {
  if (!isSparkMessage(message) || !message.payload?.shot_at) return null;
  return (
    <div className="mt-1.5 flex items-center justify-center gap-[6px] px-2 pb-[2px]">
      <CameraOff className="size-[13px] shrink-0 text-dim" aria-hidden />
      <span className="text-center text-[11.5px] font-semibold text-dim">
        {mine
          ? "They took a screenshot of your Spark."
          : "You took a screenshot of this Spark."}
      </span>
    </div>
  );
}

function SparkCard({
  message,
  mine,
  onOpen,
}: {
  message: Message;
  mine: boolean;
  onOpen: () => void;
}) {
  const state = sparkState(message, mine);
  const tail = (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 14"
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute -bottom-[1px] h-[12px] w-[8px]",
        mine ? "-right-[8px]" : "-left-[8px] -scale-x-100",
      )}
      style={{
        color: state.canOpen
          ? "color-mix(in srgb, var(--accent) 10%, var(--card))"
          : "var(--card)",
      }}
    >
      <path
        d="M0 0C0.4 5.4 2.8 9.3 7.6 11.6C9.3 12 9.8 12 9.8 12.2A1.8 1.8 0 0 1 8 14L0 14Z"
        fill="currentColor"
      />
      <path
        d="M0.4 0C0.4 5.4 2.8 9.3 7.6 11.6C9.3 12 9.8 12 9.8 12.2A1.8 1.8 0 0 1 8 14"
        fill="none"
        strokeWidth="1"
        stroke={
          state.canOpen
            ? "color-mix(in srgb, var(--accent) 42%, transparent)"
            : "var(--line)"
        }
      />
      <path
        d="M0 13.5H9.2"
        fill="none"
        strokeWidth="1"
        stroke={
          state.canOpen
            ? "color-mix(in srgb, var(--accent) 42%, transparent)"
            : "var(--line)"
        }
      />
    </svg>
  );

  if (state.canOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        style={{
          borderRadius: mine ? "10px 10px 0 10px" : "10px 10px 10px 0",
        }}
        className="relative flex max-w-[78vw] items-center gap-2 border border-[color-mix(in_srgb,var(--accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] py-1.5 px-2 text-left transition active:scale-[0.99]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent">
          <Sparkles className="size-[19px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-ink">
            A Spark for you
          </span>
          <span className="block text-[12.5px] text-dim">
            Tap to open · once only
          </span>
        </span>
        {tail}
      </button>
    );
  }

  const label = mine
    ? state.opened
      ? "Spark · opened"
      : "Spark · sent"
    : state.opened
      ? "Spark · opened"
      : "Spark · gone";
  return (
    <span
      style={{
        borderRadius: mine ? "10px 10px 0 10px" : "10px 10px 10px 0",
      }}
      className="relative inline-flex items-center gap-2 border border-line bg-card px-[14px] py-[10px] text-[14px] text-dim"
    >
      {state.opened ? (
        <EyeOff className="size-[18px]" />
      ) : (
        <Sparkles className="size-[18px]" />
      )}
      {label}
      {tail}
    </span>
  );
}

function mentionLine(message: Message, isVibe: boolean): string {
  const payload = message.payload ?? {};
  const named =
    (typeof payload.by === "string" && payload.by) ||
    (typeof payload.from === "string" ? payload.from : "");
  const what = isVibe ? "vibe" : "drop";
  if (payload.tag === true) {
    return named
      ? `${named} tagged you in this ${what}`
      : `You were tagged in this ${what}`;
  }
  return named
    ? `${named} mentioned you in a respond on this ${what}`
    : `You were mentioned in a respond on this ${what}`;
}

function dropTrouble(error: unknown, isVibe: boolean): string {
  if (error instanceof ApiError && error.code === "not_found") {
    return isVibe
      ? "This vibe is no longer there."
      : "This drop is no longer there.";
  }
  return errorMessage(error);
}

function ChatSoundCard({ drop, onOpen }: { drop: Drop; onOpen: () => void }) {
  const cover = dropStill(drop);
  const state = useMediaUrl(drop.asset?.content_url);
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const total = (drop.asset?.duration_ms ?? 0) / 1000;
  const bars = useMemo(() => waveBars(seedOf(drop.id), 30), [drop.id]);
  const progress = total > 0 ? Math.min(1, at / total) : 0;

  useEffect(() => {
    const element = player.current;
    return () => {
      if (element) releaseEar(element);
    };
  }, []);

  function toggle() {
    const element = player.current;
    if (!element) return;
    if (element.paused) {
      claimEar(element);
      void element.play().catch(() => undefined);
    } else {
      releaseEar(element);
      element.pause();
    }
  }

  function seek(event: React.MouseEvent<HTMLButtonElement>) {
    const element = player.current;
    if (!element || total <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)),
    );
    element.currentTime = next * total;
    setAt(next * total);
  }

  return (
    <div className="relative overflow-hidden text-left">
      <div className="relative">
        <div className="group relative h-[158px] w-full overflow-hidden bg-[#08080c]">
          {cover?.content_url ? (
            <AuthedImage
              src={cover.content_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <span
              className="absolute inset-0 flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: coverTone(seedOf(drop.id)) }}
            >
              <span className="absolute -right-8 -top-10 size-36 rounded-full border border-white/20" />
              <span className="absolute -bottom-16 -left-10 size-44 rounded-full border border-white/10" />
              <Music2 className="size-12 text-white/90" />
            </span>
          )}
          <button
            type="button"
            onClick={onOpen}
            aria-label="Open this sound"
            className="absolute inset-0 z-[1]"
          />
          <span className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
          <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col justify-between p-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-[4px] text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-on-accent shadow-[0_4px_12px_color-mix(in_srgb,var(--accent)_40%,transparent)]">
                {playing ? (
                  <span className="flex items-end gap-[1px]" aria-hidden>
                    {[0, 1, 2].map((bar) => (
                      <span
                        key={bar}
                        className="voice-wave-bar w-[1.5px] rounded-full bg-on-accent"
                        style={{
                          height: 3 + bar * 2,
                          transformOrigin: "center",
                          animation: `voice-dance ${650 + bar * 100}ms ease-in-out ${-bar * 80}ms infinite`,
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  <Volume2 className="size-2.5" aria-hidden />
                )}
                {playing ? "Playing" : "Audio"}
              </span>
              <span className="num rounded-full border border-white/15 bg-black/35 px-2 py-[4px] text-[9px] font-bold text-white/85 backdrop-blur-md">
                {total ? duration(total) : "Audio"}
              </span>
            </div>
            <div className="pr-14">
              <p className="line-clamp-2 text-[18px] font-extrabold leading-[1.12] tracking-[-0.35px] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
                {drop.title?.trim() || "Untitled audio"}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-white/80">
                <Avatar
                  user={drop.author}
                  size={18}
                  className="rounded-full ring-1 ring-white/40"
                />
                <span className="truncate">
                  {drop.author?.name || drop.author?.username}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={!state.src}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute bottom-3 right-3 z-[3] flex size-11 items-center justify-center rounded-full border-2 border-white/30 bg-accent text-on-accent shadow-[0_10px_24px_rgba(0,0,0,0.3)] transition hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {playing ? (
              <Pause className="size-[17px] fill-current" />
            ) : (
              <Play className="ml-0.5 size-[17px] fill-current" />
            )}
          </button>
        </div>

        <div className="relative p-2">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={seek}
              aria-label="Seek audio"
              className="flex h-9 min-w-0 flex-1 items-center gap-[2px]"
            >
              {bars.map((tall, index) => {
                const played = (index + 1) / bars.length <= progress;
                return (
                  <span
                    key={index}
                    className={cn(
                      "voice-wave-bar min-h-[3px] flex-1 rounded-full transition-colors duration-150",
                      played
                        ? "bg-accent"
                        : "bg-[color-mix(in_srgb,var(--ink)_14%,transparent)]",
                    )}
                    style={{
                      height: `${Math.max(14, Math.round(tall * 100))}%`,
                      transformOrigin: "center",
                      ...(playing
                        ? {
                            animation: `voice-dance ${760 + (index % 5) * 90}ms ease-in-out ${-((index % 10) * 70)}ms infinite`,
                          }
                        : null),
                    }}
                  />
                );
              })}
            </button>
            <span className="num shrink-0 text-[9.5px] font-bold text-dim">
              {duration(at)} / {total ? duration(total) : "—"}
            </span>
          </div>

          {drop.body?.trim() ? (
            <p className="mt-2 line-clamp-2 text-[12px] leading-[1.45] text-dim">
              {drop.body}
            </p>
          ) : null}
        </div>
      </div>

      <audio
        ref={player}
        src={state.src ?? undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
        onTimeUpdate={(event) => setAt(event.currentTarget.currentTime)}
      />
    </div>
  );
}

function ChatDropByline({
  drop,
  compact,
  onMedia,
}: {
  drop: Drop;
  compact?: boolean;
  onMedia?: boolean;
}) {
  const collab = drop.collab?.count ?? 0;
  return (
    <span className="flex w-full min-w-0 items-center gap-2">
      <Avatar
        user={drop.author}
        size={compact ? 30 : 32}
        className={onMedia ? "rounded-full ring-1 ring-white/35" : undefined}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "truncate text-[12px] font-bold leading-4",
              onMedia ? "text-white" : "text-ink",
            )}
          >
            {drop.author?.name || drop.author?.username}
          </span>
          {drop.author?.verified ? <VerifiedTick size={12} /> : null}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 truncate text-[10.5px] leading-4",
            onMedia ? "text-white/65" : "text-dim",
          )}
        >
          <span className="truncate">@{drop.author?.username}</span>
          {collab > 1 ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Users className="size-3" aria-hidden />
              {count(collab)}
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

function ChatPhotoCard({
  drop,
  source,
  pictures,
  shape,
  onOpen,
}: {
  drop: Drop;
  source: string;
  pictures: Asset[];
  shape: number;
  onOpen: () => void;
}) {
  return (
    <div>
      <SensitiveVeil
        sensitive={drop.sensitive}
        openable={drop.openable}
        cover={dropStill(drop)}
        hideable
        note={drop.mine ? "Yours. Everybody else sees it covered." : null}
        aspect={shape}
      >
        <button
          type="button"
          onClick={onOpen}
          className="group relative block w-full overflow-hidden bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
          style={{ aspectRatio: `1 / ${shape}` }}
          aria-label="Open this drop"
        >
          <AuthedImage
            src={source}
            alt={drop.asset?.original_name || ""}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
          {drop.tag ? (
            <span className="absolute left-2.5 top-2.5 inline-flex max-w-[58%] items-center gap-1 rounded-full bg-[rgb(8_8_12_/_0.55)] px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              <Tag className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{drop.tag}</span>
            </span>
          ) : null}
          {pictures.length > 1 ? (
            <span className="num absolute right-2.5 top-2.5 rounded-full bg-[rgb(8_8_12_/_0.55)] px-2 py-[3px] text-[10px] font-bold text-white backdrop-blur-sm">
              1/{pictures.length}
            </span>
          ) : null}
          {pictures.length > 1 && pictures.length <= 6 ? (
            <span className="pointer-events-none absolute right-2.5 top-10 flex justify-end">
              <span className="flex items-center gap-1.5 rounded-full bg-[rgb(8_8_12_/_0.38)] px-2 py-1.5 backdrop-blur-sm">
                {pictures.map((picture, index) => (
                  <span
                    key={`${picture.content_url}:${index}`}
                    className={cn(
                      "size-1.5 rounded-full bg-white transition",
                      index === 0 ? "opacity-100" : "opacity-45",
                    )}
                  />
                ))}
              </span>
            </span>
          ) : null}
          <span className="absolute inset-x-0 bottom-0 flex flex-col px-3 pb-2.5 pt-10">
            <ChatDropByline drop={drop} compact onMedia />
            {drop.body?.trim() ? (
              <span className="mt-0.5 line-clamp-2 w-full text-left text-[12.5px] leading-[1.35] text-white/85">
                {drop.body}
              </span>
            ) : null}
          </span>
        </button>
      </SensitiveVeil>
    </div>
  );
}

function ChatClipCard({
  drop,
  source,
  poster,
  shape,
  onOpen,
}: {
  drop: Drop;
  source: string;
  poster: string | null;
  shape: number;
  onOpen: () => void;
}) {
  const total = (drop.asset?.duration_ms ?? 0) / 1000;
  return (
    <div>
      <SensitiveVeil
        sensitive={drop.sensitive}
        openable={drop.openable}
        cover={dropStill(drop)}
        hideable
        note={drop.mine ? "Yours. Everybody else sees it covered." : null}
        aspect={shape}
      >
        <button
          type="button"
          onClick={onOpen}
          className="group relative block w-full overflow-hidden bg-[#08080c]"
          style={{ aspectRatio: `1 / ${shape}` }}
          aria-label="Open this clip"
        >
          {poster ? (
            <AuthedImage
              src={poster}
              alt=""
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <AuthedVideo src={source} className="h-full w-full object-cover" />
          )}
          <span className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/85" />
          <span className="absolute right-2.5 top-2.5 flex max-w-[60%] flex-col items-end gap-1.5">
            {drop.tag ? (
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[rgb(8_8_12_/_0.55)] px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                <Tag className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{drop.tag}</span>
              </span>
            ) : null}
            {total ? (
              <span className="num shrink-0 rounded-full bg-[rgb(8_8_12_/_0.55)] px-2 py-[3px] text-[10px] font-bold text-white backdrop-blur-sm">
                {duration(total)}
              </span>
            ) : null}
          </span>
          <span className="absolute inset-0 flex -translate-y-6 items-center justify-center">
            <span className="relative flex size-[58px] items-center justify-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-accent/40 blur-md transition duration-300 group-hover:scale-110"
              />
              <span className="relative flex size-[54px] items-center justify-center rounded-full bg-white/85 text-[#0b0b10] transition duration-200">
                <Play className="ml-0.5 size-[22px] fill-current" />
              </span>
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 flex flex-col px-3 pb-1.5 pt-10">
            <ChatDropByline drop={drop} compact onMedia />
            {drop.body?.trim() ? (
              <span className="mt-0.5 line-clamp-2 w-full text-left text-[12.5px] leading-[1.35] text-white/85">
                {drop.body}
              </span>
            ) : null}
          </span>
        </button>
      </SensitiveVeil>
    </div>
  );
}

function ChatDropHead({ drop }: { drop: Drop }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar user={drop.author} size={36} ring />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-bold leading-4 text-ink">
            {drop.author?.name || drop.author?.username}
          </span>
          {drop.author?.verified ? <VerifiedTick size={12} /> : null}
          {drop.tag ? (
            <span className="ml-auto inline-flex min-w-0 max-w-[42%] items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--accent)_18%,var(--line))] bg-[color-mix(in_srgb,var(--card)_70%,transparent)] px-2 py-[3px] text-[9.5px] font-bold text-accent">
              <Tag className="size-2.5 shrink-0" aria-hidden />
              <span className="truncate">{drop.tag}</span>
            </span>
          ) : null}
        </div>
        {drop.author?.username ? (
          <p className="mt-0.5 truncate text-[10.5px] font-semibold leading-4 text-dim">
            @{drop.author.username}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** How many words a note has to be hiding before it offers the rest. */
const MORE_WORDS = 10;
const MORE_SUFFIX = " …";

function ChatNoteCard({ drop, onOpen }: { drop: Drop; onOpen: () => void }) {
  const bodyRef = useRef<HTMLSpanElement | null>(null);
  const full = drop.body?.trim() || "A note";
  const [shown, setShown] = useState(full);
  const [tight, setTight] = useState(false);

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    let width = 0;

    const fit = (forced = false) => {
      if (!element.clientWidth || (!forced && element.clientWidth === width)) {
        return;
      }
      width = element.clientWidth;
      const style = getComputedStyle(element);
      const cap = Number.parseFloat(style.maxHeight);
      if (!Number.isFinite(cap)) return;

      const probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;display:block;width:${width}px;white-space:${style.whiteSpace};word-break:${style.wordBreak};overflow-wrap:${style.overflowWrap};font-family:${style.fontFamily};font-size:${style.fontSize};font-weight:${style.fontWeight};letter-spacing:${style.letterSpacing};line-height:${style.lineHeight};`;
      document.body.append(probe);

      const words = full.split(/\s+/);
      const fits = (count: number) => {
        probe.textContent = `${words.slice(0, count).join(" ")}${MORE_SUFFIX} More`;
        return probe.offsetHeight <= cap + 0.5;
      };
      let keep = words.length;
      if (!fits(keep)) {
        let low = 0;
        let high = words.length - 1;
        keep = 0;
        while (low <= high) {
          const middle = (low + high) >> 1;
          if (fits(middle)) {
            keep = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }
      }
      probe.remove();

      if (words.length - keep >= MORE_WORDS) {
        setShown(words.slice(0, keep).join(" "));
        setTight(true);
      } else {
        setShown(full);
        setTight(false);
      }
    };

    fit(true);
    const observer = new ResizeObserver(() => fit());
    observer.observe(element);
    void document.fonts?.ready.then(() => fit(true)).catch(() => undefined);
    return () => observer.disconnect();
  }, [full]);

  return (
    <div className="relative overflow-hidden pt-2">
      <div className="relative px-2">
        <ChatDropHead drop={drop} />
      </div>
      <div className="relative mt-1.5 w-full px-1 text-left">
        <div className="relative overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))] px-2 pb-1.5 pt-0.5 transition">
          <div className="relative">
            <div
              role="button"
              tabIndex={0}
              onClick={onOpen}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen();
                }
              }}
              className="relative block w-full cursor-pointer text-left"
              aria-label="Open this note"
            >
              {drop.title?.trim() ? (
                <span className="relative line-clamp-2 pe-5 text-[15.5px] font-extrabold leading-[1.3] tracking-[-0.15px] text-ink">
                  {drop.title}
                </span>
              ) : null}
              <span className="relative mt-1 block">
                <span
                  ref={bodyRef}
                  className={cn(
                    "block overflow-hidden whitespace-pre-wrap break-words text-ink",
                    drop.title?.trim()
                      ? "mt-1 max-h-[142px] text-[13.5px] leading-[1.5]"
                      : "max-h-[198px] text-[14.5px] font-semibold leading-[1.5]",
                  )}
                >
                  {shown}
                  {tight ? (
                    <>
                      {MORE_SUFFIX}{" "}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen();
                        }}
                        className="inline-flex items-center px-1.5 text-[11.5px] font-extrabold leading-[1.45] text-accent transition"
                        aria-label="Open the full note"
                      >
                        More
                      </button>
                    </>
                  ) : null}
                </span>
              </span>
            </div>
          </div>
          {drop.place ? (
            <span className="relative mt-2.5 flex items-center gap-1 border-t border-[color-mix(in_srgb,var(--accent)_14%,transparent)] pt-2 text-[11px] font-semibold text-dim">
              <MapPin className="size-3 shrink-0 text-accent" aria-hidden />
              <span className="truncate">{drop.place}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChatPollCard({
  drop,
  poll,
  onPoll,
}: {
  drop: Drop;
  poll: Poll;
  onPoll: (next: Poll) => void;
}) {
  return (
    <div className="relative overflow-hidden pt-2">
      <div className="relative px-2">
        <ChatDropHead drop={drop} />
        {drop.body?.trim() ? (
          <p className="mt-3 line-clamp-3 text-[15.5px] font-extrabold leading-[1.3] tracking-[-0.15px] text-ink">
            {drop.body}
          </p>
        ) : null}
      </div>
      <div className="relative mt-3">
        <PollBlock drop={drop} poll={poll} onPoll={onPoll} />
      </div>
    </div>
  );
}

function ChatDropCard({
  message,
  mine,
  onReply,
}: {
  message: Message;

  mine: boolean;
  onReply: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const seed = sharedDrop(message);
  const payload = message.payload ?? {};
  const isVibe =
    Boolean(payload.vibe) || Boolean(payload.vibe_id) || seed?.kind === "vibe";
  const id = seed?.id;
  // The snapshot the sender's app wrote into the payload — the app's
  // `share.preview`. It is a head start for a name and a picture, and it is
  // only ever used when it actually holds something: a payload that carries
  // nothing but an id is not a card, and drawing it as one is what an empty
  // card with a question mark for a face was.
  const snapshot = (payload.card ?? null) as Drop | null;
  const initial = snapshot?.id
    ? snapshot
    : seed && (seed as Drop).kind
      ? (seed as Drop)
      : null;
  const query = useQuery<{ drop: Drop }>({
    queryKey: ["chat-drop", id, isVibe],
    queryFn: async () => {
      try {
        const row = await dropsService.detail("drops", id!);
        const drop = row.drop ?? row.vibe;
        if (!drop) throw new Error("That share is not available.");
        return { drop };
      } catch (error) {
        if (!isVibe) throw error;
        const row = await dropsService.detail("drops/vibes", id!);
        const drop = row.drop ?? row.vibe;
        if (!drop) throw error;
        return { drop };
      }
    },
    enabled: Boolean(id),
    initialData: initial ? { drop: initial } : undefined,
    // The snapshot is a head start and never the answer — the counts and the
    // heart are about *me*, and only the drop knows them. A snapshot that was
    // treated as fresh data held the card at the snapshot for the whole of
    // `staleTime`, so a share with no snapshot at all (an id and nothing else)
    // drew an empty card and never asked for the drop behind it.
    initialDataUpdatedAt: 0,
    staleTime: 20_000,
  });
  const drop = query.data?.drop ?? initial;
  const [liked, setLiked] = useState(Boolean(drop?.liked));
  const [likes, setLikes] = useState(drop?.likes ?? 0);
  const [comments, setComments] = useState(drop?.comments ?? 0);
  const [poll, setPoll] = useState<Poll | null>(drop?.poll ?? null);
  const [busy, setBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!drop) return;
    setLiked(Boolean(drop.liked));
    setLikes(drop.likes ?? 0);
    setComments(drop.comments ?? 0);
    setPoll(drop.poll ?? null);
  }, [drop]);

  // Nothing yet and nothing to go on. A message that carries only an id is waiting
  // on the drop, and the app draws the shape of one so the thread does not jump when
  // the real thing lands — flat rather than a wheel, because a convo is a column and
  // a spinner at the top of it every time somebody scrolls past is noise. It used to
  // draw nothing at all here, which meant a share that failed to resolve left a hole
  // in the thread where somebody's post had been.
  if (!drop?.id || !(drop as Drop).kind) {
    // A card with nothing behind it is not drawn: the shape of a card says
    // what is coming, and a face with no name on it says the share is broken.
    const waiting =
      Boolean(id) && (query.isFetching || query.status === "pending");
    return (
      <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
        <div className="w-[268px] max-w-[76vw] rounded-[20px] border border-line bg-card p-3 text-left shadow-[0_8px_28px_rgba(17,17,26,0.07)]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-accent">
              {waiting ? (
                <Spinner className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-bold">
                {typeof payload.from === "string" && payload.from
                  ? `@${payload.from}`
                  : "This drop"}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-4 text-dim">
                {waiting
                  ? "Opening the drop..."
                  : query.error
                    ? dropTrouble(query.error, isVibe)
                    : "That share is not available."}
              </span>
            </span>
          </div>
          {waiting ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
              <span className="block h-full w-1/2 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]" />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const dropId = drop.id;
  // A shared Vibe is a row in the other table, and every call about it is the
  // same call under another prefix — `Drops._path` in the app. The card used to
  // read and then like `/drops/{id}/` for both kinds, which is why a clip that
  // had been sent in a convo failed to feel.
  const base = dropBase(drop);
  const open = () =>
    navigate(
      dropIsVibe(drop)
        ? `/app/drops?vibe=${encodeURIComponent(drop.id)}`
        : `/app/drops/${drop.id}`,
    );
  const clip = Object.values(drop.clip_urls ?? {})[0];
  const source = clip?.content_url ?? drop.asset?.content_url ?? null;
  const poster = clip?.thumbnail_url ?? drop.asset?.thumbnail_url ?? null;
  const isSound = dropIsSound(drop);
  const isClip =
    Boolean(source) &&
    (drop.kind === "video" || drop.kind === "vibe" || isVibe);
  const isPhoto = Boolean(source) && !isSound && !isClip;
  const isPoll =
    dropIsPoll(drop) && Boolean((poll ?? drop.poll)?.options?.length);
  const pictures = dropPictures(drop);
  const shape = Math.min(1.32, Math.max(0.66, drop.ratio || 1.25));
  const byLine = mentionLine(message, isVibe);

  async function toggleLike() {
    if (busy) return;
    const next = !liked;
    setLiked(next);
    setLikes((value) => Math.max(0, value + (next ? 1 : -1)));
    setBusy(true);
    try {
      const response = await dropsService.like(base, dropId, next);
      setLiked(response.liked);
      setLikes(response.likes);
    } catch (error) {
      setLiked(!next);
      setLikes((value) => Math.max(0, value + (next ? -1 : 1)));
      toast({
        title: "That like did not stick",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  function openShare() {
    setShareOpen(true);
  }

  const act =
    "flex items-center gap-[5px] rounded-full px-2 py-1.5 text-[11.5px] font-bold text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink disabled:opacity-60";

  return (
    <>
      <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
        {/* The line over the card, drawn for the reader it names and never on the
            sender's own copy. Six points under it, which is the app's gap. */}
        {payload.mention === true && !mine ? (
          <div className="flex max-w-full items-center gap-[5px] px-[2px] pb-1.5">
            <AtSign className="size-3.5 shrink-0 text-dim" aria-hidden />
            <span className="line-clamp-2 text-[12px] font-semibold text-dim">
              {byLine}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "w-[260px] max-w-[76vw] overflow-hidden border text-left transition-shadow duration-200",
            isSound
              ? "rounded-[10px] w-[230px] border-[color-mix(in_srgb,var(--accent)_26%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))] shadow-sm"
              : isClip
                ? "rounded-[10px] border-[color-mix(in_srgb,var(--ink)_16%,var(--line))] bg-card shadow-sm"
                : isPhoto
                  ? "rounded-[10px] border-[color-mix(in_srgb,var(--ink)_10%,var(--line))] bg-card shadow-sm"
                  : "rounded-[10px] border-[color-mix(in_srgb,var(--accent)_22%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))] shadow-[0_10px_26px_color-mix(in_srgb,var(--accent)_8%,transparent)]",
          )}
        >
          {isSound ? (
            <ChatSoundCard drop={drop} onOpen={open} />
          ) : isClip ? (
            <ChatClipCard
              drop={drop}
              source={source!}
              poster={poster}
              shape={shape}
              onOpen={open}
            />
          ) : isPhoto ? (
            <ChatPhotoCard
              drop={drop}
              source={source!}
              pictures={pictures}
              shape={shape}
              onOpen={open}
            />
          ) : isPoll ? (
            <ChatPollCard
              drop={drop}
              poll={(poll ?? drop.poll)!}
              onPoll={setPoll}
            />
          ) : (
            <ChatNoteCard drop={drop} onOpen={open} />
          )}

          {query.isError ? (
            <p className="px-3 pb-1 text-[11.5px] leading-4 text-dim">
              {dropTrouble(query.error, isVibe)}
            </p>
          ) : null}

          <div className="flex items-center border-t border-[color-mix(in_srgb,var(--line)_70%,transparent)] px-1.5 py-1">
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={busy}
              className={cn(act, liked && "text-accent")}
              aria-label={liked ? "Remove the felt" : "Felt"}
            >
              <Heart className={cn("size-4", liked && "fill-current")} />
              {drop.likes_off || likes <= 0 ? null : (
                <span className="num">{count(likes)}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className={act}
              aria-label="Comments"
            >
              <FaRegCommentDots className="size-4" />
              {comments > 0 ? (
                <span className="num">{count(comments)}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={openShare}
              className={act}
              aria-label="Share"
            >
              <FiShare2 className="size-4" />
              {drop.shares > 0 ? (
                <span className="num">{count(drop.shares)}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={onReply}
              className={cn(act, "ml-auto")}
              aria-label="Ping"
            >
              <Reply className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <CommentsModal
        drop={drop}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommented={() => setComments((value) => value + 1)}
      />
      {/* The share count under the card is the drop's own, and a share made
          from here moves it — the same re-read the app does when its sheet
          closes (`_share` in `chat_drop.dart`). */}
      <ShareSheet
        drop={drop}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={() =>
          void queryClient.invalidateQueries({
            queryKey: ["chat-drop", id, isVibe],
          })
        }
      />
    </>
  );
}

function SparkLookFrame({
  look,
  threadId,
  onSpent,
  onStatus,
}: {
  look: Message;
  threadId: string;
  onSpent: (message: Message) => void;
  onStatus: (id: string, ready: boolean, failed: boolean) => void;
}) {
  const media = useMediaUrl(look.asset?.content_url);
  const spent = useRef(false);
  const video = look.asset?.kind === "video";

  useEffect(() => {
    onStatus(look.id, Boolean(media.src), media.failed);
  }, [look.id, media.src, media.failed, onStatus]);

  useEffect(() => {
    if (!media.src || spent.current) return;
    spent.current = true;
    // What actually spends the look. A failure here leaves the card as the
    // server has it rather than claiming a look the person did not take.
    void chatService
      .openOnce(threadId, look.id)
      .then((response) => onSpent(response.message))
      .catch(() => undefined);
  }, [media.src, look.id, threadId, onSpent]);

  if (media.failed) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Sparkles className="size-[34px] text-white/40" aria-hidden />
        <p className="text-[15px] text-white/70">This Spark is gone.</p>
        <p className="text-[12.5px] text-white/40">
          It was made to be seen once, and there is nothing left of it.
        </p>
      </div>
    );
  }
  if (!media.src) {
    return (
      <div
        className="flex flex-col items-center gap-[18px]"
        aria-label="Loading Spark"
      >
        <Sparkles className="size-[30px] text-white/25" aria-hidden />
        <Spinner className="size-[22px] text-white/55" />
      </div>
    );
  }
  if (video) {
    return (
      <video
        src={media.src}
        className="max-h-full max-w-full object-contain"
        autoPlay
        playsInline
        muted
        loop
      />
    );
  }
  return (
    <img
      src={media.src}
      alt={look.asset?.original_name || "A Spark"}
      className="max-h-full max-w-full object-contain"
    />
  );
}

function SparkSoundBand({
  sound,
}: {
  sound: { id: string; title: string; startMs: number; endMs: number };
}) {
  const media = useMediaUrl(apiUrl(`/chat/assets/${sound.id}/content/`));
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const start = Math.max(0, sound.startMs) / 1000;
  const end = Math.max(0, sound.endMs) / 1000;

  useEffect(() => () => audio.current?.pause(), []);

  function toggle() {
    const node = audio.current;
    if (!node || !media.src) return;
    if (!node.paused) {
      node.pause();
      return;
    }
    if (end > 0 && node.currentTime >= end) node.currentTime = start;
    void node
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }

  return (
    <div className="flex items-center">
      <audio
        ref={audio}
        src={media.src ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          if (end > 0 && event.currentTarget.currentTime >= end) {
            event.currentTarget.pause();
            event.currentTarget.currentTime = start;
          }
        }}
        preload="metadata"
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        disabled={!media.src}
        className="flex items-center gap-[5px] px-1 py-0.5 text-left disabled:opacity-60"
        aria-label={playing ? "Pause the sound" : "Play the sound"}
      >
        <span className="flex size-[30px] shrink-0 items-center justify-center">
          {media.loading ? (
            <Spinner className="size-[13px] text-white" />
          ) : playing ? (
            <Pause className="size-[22px] fill-current text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.54)]" />
          ) : (
            <Play className="size-[22px] fill-current text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.54)]" />
          )}
        </span>
        <span className="max-w-[200px] truncate text-[11px] font-semibold tracking-[0.1px] text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.54)]">
          {sound.title || "Sound attached"}
        </span>
      </button>
    </div>
  );
}

function sparkSound(message: Message) {
  const payload = message.payload ?? {};
  const raw = payload.sound;
  const id =
    typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
  if (!id) return null;
  const ms = (value: unknown) =>
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value) || 0
        : 0;
  return {
    id,
    title:
      typeof payload.sound_title === "string" ? payload.sound_title.trim() : "",
    startMs: ms(payload.sound_start_ms),
    endMs: ms(payload.sound_end_ms),
  };
}

function SparkViewer({
  looks,
  threadId,
  onClose,
  onSpent,
  onReply,
}: {
  looks: Message[];
  threadId: string;
  onClose: () => void;
  onSpent: (message: Message) => void;
  onReply: (look: Message, body: string) => Promise<boolean>;
}) {
  const [at, setAt] = useState(0);
  const [status, setStatus] = useState<{
    id: string;
    ready: boolean;
    failed: boolean;
  }>({
    id: "",
    ready: false,
    failed: false,
  });
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const look = looks[at];
  const more = at + 1 < looks.length;
  const ready = status.id === look?.id && status.ready;
  const failed = status.id === look?.id && status.failed;
  const sound = look ? sparkSound(look) : null;

  const reportStatus = useMemo(
    () => (id: string, isReady: boolean, isFailed: boolean) =>
      setStatus({ id, ready: isReady, failed: isFailed }),
    [],
  );

  // Whether a run is on screen at all. The host keeps this component mounted
  // for the length of a convo and hands it an empty run while no Spark is open,
  // so both effects below have to ask rather than assume.
  const showing = Boolean(look);

  useEffect(() => {
    if (!showing) return;
    // Counted, like the modal's and the two viewers' — a Spark is opened over a
    // convo, and a convo can be holding the page still itself. See
    // `utils/scrollLock.ts`. The guard matters: an unguarded lock here held the
    // page still for as long as a convo was open, which is one of the orders
    // that used to leave it held after the convo was left.
    const releaseScroll = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [onClose, showing]);

  // And the walk goes back to the start when a run ends. It is this component
  // that is not unmounted, so `at` outlived a run: reopened on a shorter one it
  // pointed past the end and drew nothing at all — a tap that went nowhere.
  useEffect(() => {
    if (showing) return;
    setAt(0);
    setSent(false);
    setReply("");
  }, [showing]);

  if (!look) return null;

  // A tap moves the run forward and nothing moves back: the look behind is
  // spent, so there is nothing to go back to. The last tap closes the page.
  // While the picture is still coming, or a reply is being written, the tap is
  // refused rather than spending a Spark nobody has seen or re-aiming a draft.
  function advance() {
    if (!ready && !failed) return;
    if (reply.trim()) {
      replyRef.current?.blur();
      return;
    }
    if (more) {
      setAt((index) => index + 1);
      setSent(false);
      return;
    }
    onClose();
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const landed = await onReply(look, body);
      if (landed) {
        setReply("");
        setSent(true);
        window.setTimeout(() => setSent(false), 2000);
      }
    } finally {
      setSending(false);
    }
  }

  const who = look.sender?.name || look.sender?.username || "";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="A Spark"
    >
      <div className="relative min-h-0 flex-1" onClick={advance}>
        <div className="absolute inset-0 flex items-center justify-center px-3">
          <SparkLookFrame
            key={look.id}
            look={look}
            threadId={threadId}
            onSpent={onSpent}
            onStatus={reportStatus}
          />
        </div>
        <div className="pointer-events-none absolute left-[14px] top-[max(10px,env(safe-area-inset-top))] flex items-center gap-[7px]">
          <Sparkles className="size-[15px] text-white/70" aria-hidden />
          <span className="text-[13px] font-semibold tracking-[0.4px] text-white/70">
            Spark
          </span>
          {looks.length > 1 ? (
            <span className="ml-1 text-[12.5px] font-semibold text-white/40">
              {at + 1} of {looks.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="absolute right-2 top-[max(4px,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          aria-label="Close Spark"
        >
          <X className="size-[22px]" />
        </button>
      </div>

      <div className="shrink-0">
        {sound ? (
          <div className="px-4 pb-2">
            <SparkSoundBand key={look.id} sound={sound} />
          </div>
        ) : null}
        <div className="flex items-center justify-center gap-[7px] px-5 pb-4">
          <Sparkles className="size-[14px] text-white/40" aria-hidden />
          <span className="text-[12.5px] text-white/40">
            {more ? "Once only · Tap for the next" : "Once only · Tap to close"}
          </span>
        </div>
        <form
          onSubmit={(event) => void sendReply(event)}
          className="flex items-end gap-[6px] border-t border-line bg-page px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2"
        >
          <textarea
            ref={replyRef}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendReply(event);
              }
            }}
            rows={1}
            maxLength={8000}
            disabled={sending}
            placeholder={who ? `Reply to ${who}…` : "Reply to this Spark…"}
            className="max-h-[108px] min-h-[44px] flex-1 resize-none rounded-[22px] border border-line bg-card px-4 py-[11px] text-[15px] leading-5 text-ink outline-none transition placeholder:text-dim focus:border-[1.5px] focus:border-accent disabled:opacity-70"
          />
          <button
            type="submit"
            disabled={!reply.trim() || sending}
            className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-accent text-white transition active:scale-95 disabled:bg-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
            aria-label="Send reply"
          >
            {sending ? (
              <Spinner className="size-[18px] text-white/70" />
            ) : sent ? (
              <Check className="size-5" />
            ) : (
              <ArrowUp className="size-5" strokeWidth={2.6} />
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function SharedCard({
  message,
  mine,
  onReply,
}: {
  message: Message;
  /** Passed on to the drop card: a mention line is never drawn on the sender's copy. */
  mine: boolean;
  onReply: () => void;
}) {
  const payload = message.payload ?? {};
  const drop = sharedDrop(message);
  const playlist = payload.playlist as Playlist | undefined;
  const room = payload.room as
    | { id?: string; title?: string; listeners?: number }
    | undefined;
  const vibe = payload.vibe as Drop | undefined;
  if (drop?.id) {
    return <ChatDropCard message={message} mine={mine} onReply={onReply} />;
  }
  if (vibe?.id) {
    return <ChatDropCard message={message} mine={mine} onReply={onReply} />;
  }
  if (playlist?.id) {
    return (
      <Link
        to={`/app/audio/${playlist.id}`}
        className="flex items-center gap-3 rounded-[14px] border border-line bg-paper p-3 transition hover:border-accent/40"
      >
        <span className="flex size-11 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-accent">
          <Volume2 className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-extrabold">
            {playlist.name || playlist.title || "A playlist"}
          </span>
          <span className="block text-[10px] text-dim">
            {playlist.count ?? playlist.track_count ?? 0} tracks
            {playlist.owner ? ` · ${playlist.owner}` : ""}
          </span>
        </span>
      </Link>
    );
  }
  if (room?.id) {
    return (
      <Link
        to={`/app/live/${room.id}`}
        className="flex items-center gap-3 rounded-[14px] border border-line bg-paper p-3 transition hover:border-accent/40"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
          <Sparkles className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-extrabold">
            {room.title || "A live room"}
          </span>
          <span className="block text-[10px] text-dim">
            {room.listeners ?? 0} listening
          </span>
        </span>
      </Link>
    );
  }

  const sticker = sharedSticker(message);
  if (sticker) return <ChatStickerCard sticker={sticker} />;
  const song = sharedTrack(message);
  if (song)
    return (
      <ChatTrackCard
        message={message}
        track={song.track}
        fromDrop={song.fromDrop}
      />
    );
  const person = sharedPerson(message);
  if (person) return <ChatPersonCard person={person} />;
  const story = sharedStory(message);
  if (story)
    return <ChatStoryCard story={story} named={story.mention && !mine} />;
  return null;
}

function ShareWho({ person, size = 26 }: { person: UserCard; size?: number }) {
  const label = person.name || person.username;
  if (!label) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar user={person} size={size} />
      <div className="min-w-0">
        <p
          className="truncate text-[12.5px] font-bold"
          style={{ color: nameTint(person.id || person.username) }}
        >
          {label}
        </p>
        {person.username ? (
          <p className="truncate text-[11px] text-dim">@{person.username}</p>
        ) : null}
      </div>
    </div>
  );
}

function waveBars(seed: number, count = 26): number[] {
  let state =
    Math.imul((Math.abs(Math.trunc(seed)) + 7) >>> 0, 2654435761) >>> 0;
  const bars: number[] = [];
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const tall = 0.22 + ((state % 1000) / 1000) * 0.78;
    // Every fourth bar is pulled down a touch, so the run has a beat in it
    // rather than looking like noise.
    bars.push(
      index % 4 === 0 ? Math.min(1, Math.max(0.12, tall * 0.62)) : tall,
    );
  }
  return bars;
}

function ChatStickerCard({
  sticker,
}: {
  sticker: { id: string; name: string; url: string };
}) {
  const [failed, setFailed] = useState(false);
  const label = sticker.name || "Sticker";
  return (
    <span className="block size-[150px] rounded-[10px]" role="img" aria-label={label}>
      {failed ? (
        <span className="flex size-full items-center justify-center text-dim">
          <ImageOff className="size-[41px]" aria-hidden />
        </span>
      ) : (
        <img
          src={sticker.url}
          alt=""
          width={150}
          height={150}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-contain rounded-[10px]"
        />
      )}
    </span>
  );
}

function ChatTrackCard({
  message,
  track,
  fromDrop,
}: {
  message: Message;
  track: Track;
  fromDrop: boolean;
}) {
  const player = usePlayer();
  const on = player.current?.id === track.id;
  const playing = on && player.playing;
  const bars = useMemo(() => waveBars(seedOf(track.seed)), [track.seed]);
  const walked =
    on && player.duration > 0 ? Math.min(1, player.time / player.duration) : 0;

  return (
    <div
      style={{ "--accent": "var(--palette-accent)" } as React.CSSProperties}
      className="w-[272px] max-w-[76vw] p-2.5"
    >
      <ShareWho person={message.sender} />
      <div
        className={cn(
          "flex items-center",
          message.sender?.name || message.sender?.username ? "mt-[9px]" : "",
        )}
      >
        <CoverArt
          seed={seedOf(track.seed)}
          podcast={trackIsPodcast(track)}
          size={44}
        />
        <div className="ml-2.5 min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold">{track.title}</p>
          <p className="mt-[2px] truncate text-[11.5px] text-dim">
            {trackUnder(track)}
          </p>
        </div>
        {/* A share carries no liked state — the payload is what the sender's row
            knew and nothing about the reader — so the heart starts unfelt and
            moves only on the server's own answer. See `LikeButton`. */}
        <span className="ml-2 flex shrink-0">
          <LikeButton id={track.id} drop={fromDrop} size="md" />
        </span>
        <button
          type="button"
          onClick={() => {
            if (on) player.toggle();
            else player.play(track);
          }}
          aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
          className="ml-0.5 flex size-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition active:scale-95"
        >
          {playing ? (
            <Pause className="size-[15.3px] fill-current" />
          ) : (
            <Play className="size-[15.3px] fill-current" />
          )}
        </button>
      </div>
      <div className="mt-2 h-[22px]" aria-hidden>
        <div className="flex h-full w-full items-center">
          {bars.map((tall, index) => (
            <span
              key={index}
              className="flex h-full flex-1 items-center justify-center"
            >
              <span
                className="rounded-[2px]"
                style={{
                  width: 2.5,
                  height: 3 + tall * 19,
                  marginInline: 0.8,
                  backgroundColor:
                    index / bars.length < walked
                      ? "var(--accent)"
                      : "color-mix(in srgb, var(--ink) 16%, transparent)",
                }}
              />
            </span>
          ))}
        </div>
      </div>
      <div className="num mt-[4px] flex items-center justify-between text-[10.5px] font-semibold text-dim">
        <span>{duration(on ? player.time : 0)}</span>
        <span>
          {duration(
            track.seconds && track.seconds > 0
              ? track.seconds
              : on
                ? player.duration
                : 0,
          )}
        </span>
      </div>
      {on && player.failed ? (
        <p className="mt-1.5 text-[11.5px] text-[var(--bad)]">
          Could not play that.
        </p>
      ) : null}
    </div>
  );
}

function ChatPersonCard({
  person,
}: {
  person: {
    id: string;
    username: string;
    name: string;
    avatar: string;
    verified: boolean;
    isPrivate: boolean;
  };
}) {
  const label = person.name || person.username || "Somebody";
  const body = (
    <>
      <Avatar src={person.avatar || null} name={label} size={44} />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1">
          <span className="truncate text-[13.5px] font-extrabold">{label}</span>
          {person.verified ? <VerifiedTick size={12} /> : null}
        </span>
        {person.username ? (
          <span className="mt-[2px] block truncate text-[11px] text-dim">
            @{person.username}
          </span>
        ) : null}
        {person.isPrivate ? (
          <span className="mt-[3px] flex items-center gap-1 text-[10.5px] font-semibold text-dim">
            <Lock className="size-3" aria-hidden /> Private
          </span>
        ) : null}
      </span>
    </>
  );
  const shell =
    "flex w-[258px] max-w-[72vw] items-center gap-2.5 rounded-[18px] border border-line bg-card p-3";
  return person.username ? (
    <Link
      to={`/app/u/${encodeURIComponent(person.username)}`}
      className={cn(shell, "transition hover:border-accent/40")}
    >
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

function ChatStoryCard({
  story,
  named,
}: {
  story: {
    author: string;
    moment: string;
    memory: string;
    mention: boolean;
    by: string;
    gone: boolean;
  };
  /** Whether this card is somebody naming me — never drawn on my own copy. */
  named: boolean;
}) {
  const [walk, setWalk] = useState<Moment[] | null>(null);
  /** Whether the story has been asked to play. Reading it is not watching it. */
  const [viewing, setViewing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const { toast } = useToast();

  // The story itself, asked for once, the way the phone's card asks for it. A
  // Memory has no day to expire and is fetched off the shelf it lives on; a
  // moment is fetched by its own id.
  const read = useCallback(async (): Promise<Moment | null> => {
    if (story.gone) return null;
    if (story.memory) {
      const { memories } = await momentsService.memoriesByUser(story.author);
      const memory = (memories ?? []).find(
        (row) => String(row.id) === story.memory,
      );
      return memory ? memoryAsMoment(memory, null, false, story.author) : null;
    }
    if (!story.moment) return null;
    const { moment } = await momentsService.detail(story.moment);
    return moment ?? null;
  }, [story.author, story.moment, story.memory, story.gone]);

  useEffect(() => {
    if (story.gone) return;
    let alive = true;
    setLoading(true);
    read()
      .then((moment) => {
        if (!alive) return;
        if (!moment) setTrouble("This moment is no longer there.");
        else setWalk([moment]);
      })
      .catch((error) => {
        if (alive) setTrouble(errorMessage(error));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [read, story.gone]);

  async function open() {
    if (story.gone) return;
    // The story was read on the way in, so the press is the walk starting and
    // not a second fetch of the same thing.
    if (walk) {
      setViewing(true);
      return;
    }
    try {
      const { moments } = await momentsService.byUser(story.author);
      if (!moments?.length) {
        toast({
          title: "Nothing up right now",
          description: `@${story.author} has no day up.`,
          tone: "info",
        });
        return;
      }
      setWalk(moments);
      setViewing(true);
    } catch (error) {
      toast({
        title: "Could not open that",
        description: errorMessage(error),
        tone: "error",
      });
    }
  }

  const item = walk?.[0]?.items?.[0];
  const poster =
    item?.asset?.thumbnail_url ||
    (item?.asset?.kind === "video" ? null : item?.asset?.content_url) ||
    null;
  const status = story.gone
    ? "No longer there"
    : trouble
      ? trouble
      : loading
        ? "Opening..."
        : "Tap to watch";

  return (
    <div className="w-full">
      {named ? (
        <div className="flex max-w-full items-center gap-[5px] px-[2px] pb-1.5">
          <AtSign className="size-3.5 shrink-0 text-dim" aria-hidden />
          <span className="line-clamp-2 text-[12px] font-semibold text-dim">
            {story.by.trim()
              ? `${story.by} put you in their moment`
              : "You were put in their moment"}
          </span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void open()}
        disabled={story.gone}
        aria-label={
          story.gone
            ? "This moment is no longer there"
            : `Watch @${story.author}'s moment`
        }
        style={{ aspectRatio: "3 / 4" }}
        className={cn(
          "group relative block w-full min-w-[220px] overflow-hidden rounded-[10px] bg-[#0E0E13] text-left ring-1 ring-white/10 outline-none transition duration-300",
        )}
      >
        {poster ? (
          <AuthedImage
            src={poster}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,#34344a_0%,#191922_52%,#0c0c11_100%)]"
          />
        )}
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/75"
        />
        {item?.kind === "text" && item.body ? (
          <span className="absolute inset-x-5 top-1/2 -translate-y-1/2 text-center text-[17px] font-semibold leading-[1.3] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
            {item.body}
          </span>
        ) : null}
        {walk && walk[0].items.length > 1 ? (
          <span
            className="absolute inset-x-3 top-3 z-10 flex gap-1"
            aria-hidden
          >
            {walk[0].items.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-[3px] flex-1 rounded-full",
                  index === 0 ? "bg-white" : "bg-white/35",
                )}
              />
            ))}
          </span>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 z-10 flex items-end px-3 pb-3 pt-10">
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-[7px] text-[11.5px] font-semibold ring-1 backdrop-blur-md",
              story.gone
                ? "bg-white/10 text-white/65 ring-white/10"
                : "bg-black/35 text-white ring-white/15",
            )}
          >
            {story.gone || trouble ? (
              <AlertCircle className="size-4 shrink-0" aria-hidden />
            ) : loading ? (
              <Spinner className="size-4 text-white" />
            ) : (
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-white text-[#0E0E13]">
                <Play className="size-3 fill-current" aria-hidden />
              </span>
            )}
            <span className="truncate">{status}</span>
          </span>
        </span>
      </button>

      {viewing && walk ? (
        <Suspense fallback={null}>
          <MomentViewer
            moments={walk}
            onClose={() => setViewing(false)}
            // A like, a reply or taking it down happens in the viewer, and the
            // card behind it has to read the same story afterwards — a card left
            // showing a moment somebody has just deleted would be the one thing
            // on the page that is no longer true. Losing it closes the viewer,
            // because there is nothing left to walk.
            onChanged={() => {
              void read().then((moment) => {
                setWalk(moment ? [moment] : null);
                setViewing(Boolean(moment));
              });
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function MomentQuote({
  reference,
  mine,
}: {
  reference: { id: string; kind: string; text: string };
  /** Whether the line carrying this is mine, which is what its words turn on. */
  mine: boolean;
}) {
  const [walk, setWalk] = useState<Moment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const what =
    reference.kind === "video"
      ? "their moment · clip"
      : reference.kind === "text"
        ? "their moment"
        : reference.kind === "poll"
          ? "their moment · poll"
          : reference.kind === "drop"
            ? "their moment · drop"
            : "their moment · photo";

  async function open() {
    if (busy || !reference.id) return;
    setBusy(true);
    try {
      const { moment } = await momentsService.detail(reference.id);
      if (!moment) {
        toast({ title: "That moment is no longer up.", tone: "info" });
        return;
      }
      setWalk([moment]);
    } catch {
      toast({ title: "That moment is no longer up.", tone: "info" });
    } finally {
      setBusy(false);
    }
  }

  const shell =
    "mb-1.5 flex w-full flex-col rounded-[6px] border-l-2 border-accent bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-2 py-1.5 text-left";
  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy || !reference.id}
        className={shell}
      >
        <span className="flex items-center gap-1 text-[11px] font-bold text-accent">
          <Sparkles className="size-3" aria-hidden />
          {mine ? `Replying to ${what}` : "Replied to your moment"}
        </span>
        {reference.text ? (
          <span
            className="mt-[2px] line-clamp-1 text-[12px] opacity-80"
            style={{
              color: mine ? "var(--convo-out-dim)" : "var(--convo-in-dim)",
            }}
          >
            {reference.text}
          </span>
        ) : null}
      </button>
      {walk ? (
        <Suspense fallback={null}>
          <MomentViewer
            moments={walk}
            onClose={() => setWalk(null)}
            onChanged={() => setWalk(null)}
          />
        </Suspense>
      ) : null}
    </>
  );
}

function PollMessage({
  message,
  onVote,
}: {
  message: Message;
  onVote: (choice: number) => Promise<void>;
}) {
  const poll = message.poll;
  if (!poll?.options?.length) return null;
  const total = poll.total ?? 0;
  return (
    <div className="min-w-[250px] space-y-2 rounded-[10px] border border-line bg-card p-2">
      <p className="text-[13px] font-extrabold leading-5">
        {poll.question || "Ask the crowd"}
      </p>
      {poll.options.map((option) => {
        const mine = poll.mine === option.index;
        const share = total ? Math.round((option.count / total) * 100) : 0;
        return (
          <button
            key={option.index}
            type="button"
            onClick={() => void onVote(option.index)}
            className={cn(
              "relative block w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition hover:border-accent/45",
              mine
                ? "border-accent bg-[var(--accent-soft)]"
                : "border-line bg-[color-mix(in_srgb,var(--card)_70%,transparent)]",
            )}
          >
            <span
              className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] transition-[width]"
              style={{ width: `${share}%` }}
              aria-hidden
            />
            <span className="relative flex items-center gap-2 text-[11.5px] font-semibold">
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border",
                  mine
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line bg-card",
                )}
              >
                {mine ? <Check className="size-2.5" /> : null}
              </span>
              <span className="flex-1">{option.text}</span>
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  mine ? "font-bold text-accent" : "text-dim",
                )}
              >
                {share}%
              </span>
            </span>
          </button>
        );
      })}
      <p className="text-[9.5px] font-semibold text-dim">
        {count(total)} {total === 1 ? "vote" : "votes"}
      </p>
    </div>
  );
}

function chatDay(value: string) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const now = new Date();
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gap = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (gap === 0) return "Today";
  if (gap === 1) return "Yesterday";
  if (gap > 1 && gap < 7)
    return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(at);
  return `${at.getDate()} ${new Intl.DateTimeFormat(undefined, { month: "short" }).format(at)}`;
}

function rolledReaction(
  rows: Message["reactions"],
  emoji: string,
  mine: string | null,
): { reactions: NonNullable<Message["reactions"]>; my_reaction: string | null } {
  const list = (rows ?? []).map((row) => ({ ...row }));
  const drop = (target: string) => {
    const at = list.findIndex((row) => row.emoji === target);
    if (at < 0) return;
    if (list[at].count > 1) list[at] = { ...list[at], count: list[at].count - 1 };
    else list.splice(at, 1);
  };
  const add = (target: string) => {
    const at = list.findIndex((row) => row.emoji === target);
    if (at < 0) list.push({ emoji: target, count: 1 });
    else list[at] = { ...list[at], count: list[at].count + 1 };
  };
  if (mine === emoji) {
    drop(emoji);
    return { reactions: list, my_reaction: null };
  }
  if (mine) drop(mine);
  add(emoji);
  return { reactions: list, my_reaction: emoji };
}

function emojiSize(count: number) {
  if (count <= 1) return 44;
  if (count === 2) return 28;
  if (count === 3) return 28;
  if (count <= 6) return 28;
  return 22;
}

interface ReceiptMark {
  read?: number | null;
  delivered?: number | null;
}

interface PendingFile {
  file: File;
  kind: string;
  preview?: string;
  durationMs?: number;
  waveform?: number[];
}

/** What the composer needs to know about a file it has been handed. */
function pendingFile(file: File): PendingFile {
  const kind = kindOf(file);
  const preview =
    kind === "image" || kind === "video"
      ? URL.createObjectURL(file)
      : undefined;
  return { file, kind, preview };
}

/**
 * Why this file cannot be sent, or null when it can.
 *
 * The server takes clips in MP4 and MOV only — it reads the container itself
 * and refuses anything else, because a file it cannot parse has no length and
 * no frame the other side could draw. A browser's picker offers every video
 * format the machine knows, so the ones this server cannot take are caught
 * here, by name, before a byte of them travels.
 */
function fileTrouble(file: File, kind: string): string | null {
  const mime = (file.type || "").toLowerCase();
  if (
    kind === "video" &&
    !/^video\/(mp4|quicktime|m4v)$/.test(mime) &&
    !/\.(mp4|m4v|mov)$/i.test(file.name)
  ) {
    return `${file.name} is ${file.type || "a format this server cannot read"}. Send an MP4 or MOV clip.`;
  }
  return null;
}

interface OutgoingSend {
  clientId: string;
  localId: string;
  kind: string;
  body: string;
  replyToId?: string;
  payload?: Record<string, unknown>;
  channel?: string | null;
  file?: PendingFile;
  /** The uploaded asset, kept so a retry re-sends rather than re-uploads. */
  assetId?: string;
}

function AttachRow({
  icon,
  label,
  onClick,
  onMouseEnter,
  onFocus,
  onTouchStart,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  onMouseEnter?: () => void;
  onFocus?: () => void;
  onTouchStart?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      onTouchStart={onTouchStart}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition hover:bg-[var(--accent-soft)]"
    >
      <span className="text-accent">{icon}</span>
      {label}
    </button>
  );
}

function receiptWord(
  message: Message,
  thread: ThreadDetail,
  meId: string | undefined,
  marks: Record<string, ReceiptMark>,
) {
  if (message.failed) return "Not sent";
  if (message.pending) return "Sending";
  if (message.held) return "Waiting for them";
  const seats = (thread.members ?? []).filter(
    (seat) => seat.user?.id && seat.user.id !== meId && !seat.left_at,
  );
  if (!seats.length) {
    // A direct convo may not carry a roster; the card's own status is still
    // the server's answer about exactly this bubble.
    return thread.status || "Sent";
  }
  const ordinal = message.ordinal ?? 0;
  if (!ordinal) return "Sent";
  const floor = (which: "read" | "delivered") =>
    Math.min(
      ...seats.map((seat) => {
        const mark = marks[seat.user.id];
        if (which === "read") {
          return mark?.read ?? seat.last_read_ordinal ?? 0;
        }
        return mark?.delivered ?? seat.last_delivered_ordinal ?? 0;
      }),
    );
  if (floor("read") >= ordinal) return "Opened";
  if (floor("delivered") >= ordinal) return "Delivered";
  return "Sent";
}

interface CallNote {
  media: "audio" | "video";
  outcome: string;
  seconds: number | null;
}

function callNote(message: Message): CallNote | null {
  const row = message.payload;
  if (!row || typeof row !== "object") return null;
  if (row.call == null) return null;
  const media = String(row.media ?? "");
  if (media !== "audio" && media !== "video") return null;
  const seconds = Number(row.seconds);
  return {
    media,
    outcome: String(row.outcome ?? ""),
    seconds: Number.isFinite(seconds) ? seconds : null,
  };
}

function locationOf(message: Message) {
  const payload = message.payload ?? {};
  const raw = (payload.location ?? payload.place ?? {}) as Record<
    string,
    unknown
  >;
  const lat = Number(
    raw.lat ?? raw.latitude ?? payload.lat ?? payload.latitude,
  );
  const lng = Number(raw.lng ?? raw.longitude ?? raw.longitude ?? payload.lng);
  const label = String(
    raw.name ??
      raw.label ??
      payload.place_name ??
      message.body ??
      "Shared location",
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return { label, href: null, latitude: null, longitude: null };
  return {
    label,
    href: `https://www.google.com/maps?q=${lat},${lng}`,
    latitude: lat,
    longitude: lng,
  };
}

function MessageGesture({
  disabled,
  align,
  onLongPress,
  onDoubleTap,
  onSwipe,
  children,
}: {
  disabled?: boolean;
  align: "start" | "end";
  onLongPress: () => void;
  onDoubleTap: () => void;
  onSwipe: () => void;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const long = useRef(false);
  const travel = useRef(0);

  function clear() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }

  function down(event: React.PointerEvent) {
    if (disabled || event.button !== 0) return;
    long.current = false;
    travel.current = 0;
    start.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    timer.current = window.setTimeout(() => {
      long.current = true;
      onLongPress();
    }, 480);
  }

  function move(event: React.PointerEvent) {
    const origin = start.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dy) > 10 || Math.abs(dx) < 3) {
      if (Math.abs(dy) > 10) clear();
      return;
    }
    if (Math.abs(dx) > 10) clear();
    travel.current = dx > 0 ? Math.min(64, dx * 0.65) : 0;
    setOffset(travel.current);
  }

  function up() {
    clear();
    const travelled = travel.current;
    travel.current = 0;
    start.current = null;
    setDragging(false);
    setOffset(0);
    if (!long.current && travelled >= 42) onSwipe();
  }

  return (
    <div
      className={cn(
        "relative flex flex-col",
        align === "end" ? "items-end" : "items-start",
      )}
      style={{
        transform: offset ? `translateX(${offset}px)` : undefined,
        transition: dragging ? "none" : "transform 160ms ease",
        touchAction: "pan-y",
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(event) => {
        if (disabled) return;
        event.preventDefault();
        onLongPress();
      }}
      onDoubleClick={(event) => {
        if (disabled) return;
        event.preventDefault();
        onDoubleTap();
      }}
    >
      {children}
    </div>
  );
}

function senderSeed(sender: Message["sender"]) {
  if (!sender) return "";
  return sender.id || sender.username || sender.name || "";
}

function MessageBubble({
  message,
  meId,
  showSender,
  showStamp,
  group,
  receipt,
  canCall,
  onReply,
  onReact,
  onOptions,
  onVote,
  onOpenSpark,
  onCallBack,
  onRetry,
  progress,
  burst,
  picking,
  picked,
  onPick,
  frame,
  onOpenMedia,
  uploads,
}: {
  message: Message;
  meId?: string;
  showSender: boolean;
  /** The last line before a pause carries the time, not every back-and-forth. */
  showStamp: boolean;
  /** A group draws the faces behind a reaction; a direct convo has no room for them. */
  group: boolean;
  receipt: string;
  canCall?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => Promise<void>;
  onOptions: () => void;
  onVote: (choice: number) => Promise<void>;
  onOpenSpark: () => void;
  onCallBack?: (kind: "audio" | "video") => void;
  onRetry?: () => void;
  progress?: number;
  /** A pile is being picked, so this line wears its mark and answers a tap. */
  picking?: boolean;
  picked?: boolean;
  onPick?: () => void;
  /** The pictures sent in the same gesture, this one included, oldest first. */
  frame?: Message[] | null;
  /** Open this picture or clip large, with the rest of the thread a swipe away. */
  onOpenMedia?: (row: Message) => void;
  /** How far each row's own upload has come, by client id. */
  uploads?: Record<string, number>;
  /**
   * When this message arrived, if it has only just — the moment its emoji play
   * on. Undefined for everything already in the thread when it was opened.
   */
  burst?: number;
}) {
  const mine = meId ? message.sender?.id === meId : Boolean(message.mine);
  const deleted = message.deleted_for_all;
  const spark = isSparkMessage(message);
  const hasCard = isSharedMessage(message);
  const storyShare = Boolean(sharedStory(message));
  const [whoReacted, setWhoReacted] = useState(false);
  const reactors = useMemo(
    () =>
      (message.reactions ?? []).flatMap((reaction) =>
        (reaction.users ?? []).map((person) => ({
          ...person,
          emoji: reaction.emoji,
        })),
      ),
    [message.reactions],
  );
  const people = useMemo(() => {
    const seen = new Set<string>();
    return reactors.filter((person) => {
      const key = person.id || person.username;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [reactors]);
  const faces = people.slice(0, 3);
  const morePeople = people.length - faces.length;
  const reactionTotal = (message.reactions ?? []).reduce(
    (sum, reaction) => sum + reaction.count,
    0,
  );
  const sound = soundKind(message);
  const mediaKind =
    message.asset?.kind ||
    (["image", "video", "doc", "audio", "voice"].includes(message.kind)
      ? message.kind
      : "");
  const imageSrc = mediaKind === "image" ? assetSrc(message.asset) : null;
  const videoSrc = mediaKind === "video" ? assetSrc(message.asset) : null;
  const location = message.kind === "location" ? locationOf(message) : null;
  const moment = momentRef(message);
  // A share's words belong to the share, not to whichever of its rows is drawn:
  // the frame is one row and its caption sits under the grid. The row carrying
  // the words may be any of them — the upload order decides which one the thread
  // draws last — so the caption is read off the frame.
  const caption =
    message.body?.trim() ||
    (frame && frame.length > 1
      ? (frame.map((row) => row.body?.trim()).find(Boolean) ?? "")
      : "");
  // The same is true of the quote: a share is answered as a whole, and the row
  // holding the answer is not always the one the frame is drawn at.
  const reply =
    message.reply_to ??
    (frame && frame.length > 1
      ? (frame.find((row) => row.reply_to)?.reply_to ?? null)
      : null);
  const emojiCount = caption ? onlyEmojiCount(caption) : 0;
  const picture =
    !deleted &&
    !reply &&
    !caption &&
    (message.asset?.kind === "image" || message.asset?.kind === "video");
  const singleEmoji =
    !deleted &&
    !hasCard &&
    !message.asset &&
    !reply &&
    !location &&
    message.kind !== "poll" &&
    message.kind !== "collab" &&
    message.kind !== "vanish_ask" &&
    emojiCount === 1;
  // A frame of pictures is the message and nothing else — no card behind it,
  // for the same reason a single photograph gets none. A quoted one keeps the
  // card, because the quote is text and text needs something to sit on; and so
  // does a captioned one, because words under a picture with nothing behind
  // them read as a message of their own rather than as that picture's caption.
  const framed = Boolean(frame && frame.length > 1);
  const mediaCaption =
    Boolean(caption) &&
    (framed ||
      message.asset?.kind === "image" ||
      message.asset?.kind === "video");
  const bare =
    picture ||
    (!deleted && hasCard) ||
    singleEmoji ||
    (framed && !reply && !caption);
  const tailed = !bare;
  const corner = bare ? 0 : mine ? "10px 10px 0 10px" : "10px 10px 10px 0";

  const call = callNote(message);
  if (call) {
    const missed = call.outcome !== "ended";
    const alarm = missed && !mine;
    const Mark =
      call.media === "video"
        ? missed
          ? VideoOff
          : Video
        : missed
          ? PhoneMissed
          : Phone;
    const plate = cn(
      "flex items-center gap-2 rounded-full border border-line bg-card px-[13px] py-1.5 text-[13px] font-semibold",
      alarm ? "text-[var(--bad)]" : "text-dim",
    );
    const inside = (
      <>
        <Mark className="size-4 shrink-0" aria-hidden />
        <span>{message.body}</span>
        <span className="mt-1 text-[10px] font-normal text-dim">
          {clock(message.created_at)}
        </span>
      </>
    );
    return (
      <div className="flex justify-center py-[1px]">
        {canCall ? (
          <button
            type="button"
            onClick={() => onCallBack?.(call.media)}
            className={cn(
              plate,
              "transition hover:border-accent/40 active:scale-[0.98]",
            )}
            aria-label={`Call back, ${call.media}`}
          >
            {inside}
          </button>
        ) : (
          <div className={plate}>{inside}</div>
        )}
      </div>
    );
  }

  if (message.kind === "system") {
    const who = message.sender?.name || message.sender?.username || "";
    return (
      <div className="flex justify-center px-6 py-[1px]">
        <p className="rounded-full border border-line bg-card px-[13px] py-1.5 text-center text-[12.5px] font-semibold text-dim">
          {who ? `${who} ${message.body ?? ""}` : message.body}
        </p>
      </div>
    );
  }

  return (
    <div
      onClick={onPick}
      onContextMenu={picking ? (event) => event.preventDefault() : undefined}
      className={cn(
        "flex items-center gap-1.5 pb-[2px]",
        mine ? "justify-end" : "justify-start",
        onPick && "cursor-pointer",
      )}
    >
      {picking && mine ? <PickMark picked={Boolean(picked)} /> : null}
      <div
        style={storyShare ? { width: "74%", maxWidth: 380 } : undefined}
        className={cn(
          "relative flex max-w-[74%] flex-col",
          // A frame is as wide as the pictures in it, which means the column
          // has to have a width of its own to divide: two images cannot size
          // each other.
          framed && "w-[74%]",
          mine ? "items-end text-right" : "items-start text-left",
        )}
      >
        <MessageGesture
          disabled={Boolean(
            deleted || message.pending || message.failed || picking,
          )}
          align={mine ? "end" : "start"}
          onLongPress={onOptions}
          onDoubleTap={() => void onReact(REACTIONS[0])}
          onSwipe={onReply}
        >
          <div
            className={cn(
              "flex flex-col",
              mine ? "items-end" : "items-start",
              picking && "pointer-events-none",
            )}
          >
            {spark ? (
              <div
                className={cn(
                  "flex flex-col",
                  mine ? "items-end" : "items-start",
                )}
              >
                <SparkCard message={message} mine={mine} onOpen={onOpenSpark} />
                {sparkShotLine(message, mine)}
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: bare
                    ? "transparent"
                    : mine
                      ? "var(--convo-bubble-wash)"
                      : "var(--convo-in-wash)",
                  backgroundImage:
                    !bare && mine ? "var(--convo-bubble-run)" : undefined,
                  borderColor: bare
                    ? "transparent"
                    : picked
                      ? "var(--accent)"
                      : mine
                        ? "var(--convo-bubble-edge)"
                        : "var(--convo-in-edge)",
                  color: mine ? "var(--convo-out-ink)" : "var(--convo-in-ink)",
                  borderRadius: corner,
                }}
                className={cn(
                  "relative text-[15px] leading-[1.35] border transition-colors text-left",
                  bare
                    ? "overflow-visible bg-transparent border-transparent p-0"
                    : "overflow-visible p-1",
                  !bare &&
                    (mine
                      ? "shadow-[0_3px_12px_color-mix(in_srgb,var(--accent)_9%,transparent)]"
                      : "shadow-[0_1px_4px_rgba(17,17,26,0.05)]"),
                  deleted && "italic",
                  message.pending && "opacity-70",
                  message.failed &&
                    "border-[color-mix(in_srgb,var(--bad)_55%,var(--line))]",
                )}
              >
                {showSender && (!bare || singleEmoji) ? (
                  <p
                    className="text-[11.5px] font-bold leading-4"
                    style={{ color: nameTint(senderSeed(message.sender)) }}
                  >
                    {message.sender.name || message.sender.username}
                  </p>
                ) : null}
                {!deleted && moment ? (
                  <MomentQuote reference={moment} mine={mine} />
                ) : null}
                {/* What the server marks when a line was passed on rather than
                  written here — one word above it, as the phone draws it. */}
                {!deleted && message.payload?.forwarded ? (
                  <p className="mb-1 text-[11px] font-medium italic text-dim">
                    Forwarded
                  </p>
                ) : null}
                {reply ? (
                  <div
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--ink) 5%, transparent)",
                      borderColor: "var(--accent)",
                    }}
                    className="mb-0.5 rounded-[8px] border-l-[3px] px-2 py-0.5 text-[11px] leading-4"
                  >
                    <span className="block font-bold text-accent">
                      {reply.sender?.name || "Reply"}
                    </span>
                    <span
                      className="line-clamp-1 opacity-80"
                      style={{
                        color: mine
                          ? "var(--convo-out-dim)"
                          : "var(--convo-in-dim)",
                      }}
                    >
                      {reply.deleted_for_all ? (
                        "This was removed"
                      ) : (
                        <EmojiText text={reply.body} />
                      )}
                    </span>
                  </div>
                ) : null}

                {deleted ? (
                  <p className="italic">This was removed</p>
                ) : (
                  <>
                    {framed ? (
                      <FrameTiles
                        frame={frame!}
                        caption={Boolean(caption)}
                        onOpen={(row) => onOpenMedia?.(row)}
                        uploads={uploads}
                      />
                    ) : null}
                    {!framed && imageSrc ? (
                      <AuthedImage
                        src={imageSrc}
                        alt={message.asset?.original_name || "Photo"}
                        onClick={() => onOpenMedia?.(message)}
                        className={cn(
                          "h-[320px] w-[230px] rounded-[10px] border object-cover",
                          onOpenMedia && "cursor-zoom-in",
                          mediaCaption && "rounded-b-none",
                          !bare && "min-w-[180px]",
                        )}
                      />
                    ) : null}
                    {!framed && videoSrc ? (
                      <button
                        type="button"
                        onClick={() => onOpenMedia?.(message)}
                        className={cn(
                          "group relative block w-full overflow-hidden rounded-[10px] bg-[rgb(0_0_0_/_0.06)]",
                          mediaCaption && "rounded-b-none",
                          !bare && "min-w-[210px]",
                        )}
                        aria-label="Play clip"
                      >
                        <AuthedVideo
                          src={videoSrc}
                          muted
                          preload="metadata"
                          className="h-[320px] w-[210px] object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="flex size-12 items-center justify-center rounded-full bg-black/45 text-white transition group-hover:scale-105">
                            <Play className="size-6 fill-current" />
                          </span>
                        </span>
                        {message.asset?.duration_ms ? (
                          <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                            {duration(message.asset.duration_ms / 1000)}
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                    {!framed &&
                    (mediaKind === "image" || mediaKind === "video") &&
                    !imageSrc &&
                    !videoSrc ? (
                      <span className="flex h-[140px] w-[230px] flex-col items-center justify-center gap-1.5 rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_6%,var(--accent-soft))] px-3 text-center text-dim">
                        <ImageOff className="size-6" aria-hidden />
                        <span className="text-[11px] font-semibold leading-4">
                          {mediaKind === "video"
                            ? "This clip is not available"
                            : "This photo is not available"}
                        </span>
                      </span>
                    ) : null}
                    {sound === "voice" ? (
                      <VoiceBubble asset={message.asset} />
                    ) : null}
                    {sound === "audio" && assetSrc(message.asset) ? (
                      <ChatDocument
                        kind="audio"
                        src={assetSrc(message.asset)}
                        name={message.asset?.original_name}
                        asset={message.asset}
                      />
                    ) : null}
                    {mediaKind === "doc" && assetSrc(message.asset) ? (
                      <div className="">
                        <ChatDocument
                          src={assetSrc(message.asset)}
                          name={message.asset?.original_name}
                          asset={message.asset}
                        />
                      </div>
                    ) : null}
                    {message.kind === "poll" ? (
                      <PollMessage message={message} onVote={onVote} />
                    ) : null}
                    {location ? (
                      location.href &&
                      location.latitude != null &&
                      location.longitude != null ? (
                        <div className="mb-0.5 w-[230px] overflow-hidden rounded-[10px] border border-line bg-paper transition-[border-color] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]">
                          <div className="h-[112px] w-full overflow-hidden bg-[var(--accent-soft)]">
                            <MapPreview
                              latitude={location.latitude}
                              longitude={location.longitude}
                              className="h-full w-full"
                            />
                          </div>
                          <a
                            href={location.href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-2.5 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
                          >
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                              <MapPin className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-semibold text-ink">
                                {location.label}
                              </span>
                              <span className="block text-[10px] font-medium text-dim">
                                Open in Maps
                              </span>
                            </span>
                          </a>
                        </div>
                      ) : (
                        <p className="mb-0.5 flex items-center gap-1.5 text-[12px] font-semibold">
                          <MapPin className="size-3.5 text-accent" />{" "}
                          {location.label}
                        </p>
                      )
                    ) : null}
                    {message.kind === "collab" ||
                    message.kind === "vanish_ask" ? (
                      <div className="mb-1.5 min-w-[210px] rounded-[12px] border border-[color-mix(in_srgb,var(--accent)_28%,var(--line))] bg-[var(--accent-soft)] px-3 py-2.5">
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-accent">
                          {message.kind === "collab"
                            ? "Collab invite"
                            : "Disappearing request"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[12px] font-semibold leading-5 text-ink">
                          <EmojiText
                            burst={burst}
                            text={
                              caption ||
                              (message.kind === "collab"
                                ? "A collab invite"
                                : "A disappearing-message request")
                            }
                          />
                        </p>
                        {typeof message.payload?.answer === "string" ? (
                          <p className="mt-1 text-[10px] font-bold text-dim">
                            Answered: {String(message.payload.answer)}
                          </p>
                        ) : (
                          <p className="mt-1 text-[10px] font-semibold text-dim">
                            Waiting for an answer
                          </p>
                        )}
                      </div>
                    ) : null}
                    {hasCard ? (
                      <SharedCard
                        message={message}
                        mine={mine}
                        onReply={onReply}
                      />
                    ) : null}
                    {caption &&
                    !hasCard &&
                    // A place's name is already on its own card; drawn again as a
                    // caption it would say the same street twice.
                    message.kind !== "location" &&
                    message.kind !== "collab" &&
                    message.kind !== "vanish_ask" ? (
                      emojiCount > 0 && emojiCount <= 12 ? (
                        <div
                          className={cn(
                            "flex max-w-full items-center justify-center",
                            !mediaCaption && "-my-0.5",
                            mediaCaption &&
                              "border-t border-[color-mix(in_srgb,var(--line)_70%,transparent)] pt-1.5",
                          )}
                        >
                          <EmojiRow
                            text={caption}
                            burst={burst}
                            size={emojiSize(emojiCount)}
                          />
                        </div>
                      ) : (
                        <p
                          className={cn(
                            "whitespace-pre-wrap break-words",
                            mediaCaption &&
                              "border-t border-[color-mix(in_srgb,var(--line)_70%,transparent)] pt-1.5",
                          )}
                        >
                          <EmojiText text={caption} burst={burst} />
                        </p>
                      )
                    ) : null}
                    {!caption &&
                    !message.asset &&
                    !hasCard &&
                    message.kind !== "poll" &&
                    !location &&
                    message.kind !== "collab" &&
                    message.kind !== "vanish_ask" ? (
                      <p className="opacity-60">Empty message</p>
                    ) : null}
                  </>
                )}
                {tailed ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 10 14"
                    preserveAspectRatio="none"
                    className={cn(
                      "pointer-events-none absolute -bottom-[1px] h-[12px] w-[8px]",
                      mine ? "-right-[8px]" : "-left-[8px] -scale-x-100",
                      message.pending && "opacity-70",
                    )}
                    style={{
                      color: mine
                        ? "var(--convo-bubble-corner)"
                        : "var(--convo-in-wash)",
                    }}
                  >
                    <path
                      d="M0 0C0.4 5.4 2.8 9.3 7.6 11.6C9.3 12 9.8 12 9.8 12.2A1.8 1.8 0 0 1 8 14L0 14Z"
                      fill="currentColor"
                    />
                    <path
                      d="M0.4 0C0.4 5.4 2.8 9.3 7.6 11.6C9.3 12 9.8 12 9.8 12.2A1.8 1.8 0 0 1 8 14"
                      fill="none"
                      strokeWidth="1"
                      stroke={
                        mine
                          ? "var(--convo-bubble-edge)"
                          : "var(--convo-in-edge)"
                      }
                    />
                    <path
                      d="M0 13.5H9.2"
                      fill="none"
                      strokeWidth="1"
                      stroke={
                        mine
                          ? "var(--convo-bubble-edge)"
                          : "var(--convo-in-edge)"
                      }
                    />
                  </svg>
                ) : null}
              </div>
            )}

            {message.reactions?.length ? (
              <div
                className={cn(
                  "mb-1 flex flex-wrap gap-1",
                  mine ? "justify-end" : "justify-start",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (group) setWhoReacted(true);
                    else if (message.my_reaction) {
                      void onReact(message.my_reaction);
                    } else {
                      void onReact(message.reactions![0].emoji);
                    }
                  }}
                  aria-label={group ? "Who reacted" : "React to this message"}
                  style={{
                    backgroundColor: message.my_reaction
                      ? "color-mix(in srgb, var(--accent) 18%, var(--card))"
                      : "var(--card)",
                    borderColor: message.my_reaction
                      ? "color-mix(in srgb, var(--accent) 42%, transparent)"
                      : "color-mix(in srgb, var(--ink) 12%, var(--line))",
                    boxShadow: message.my_reaction
                      ? "0 2px 10px color-mix(in srgb, var(--accent) 16%, transparent)"
                      : "0 1px 3px rgba(17,17,26,0.06)",
                  }}
                  className="relative z-10 -mt-1.5 inline-flex items-center gap-[6px] rounded-full border px-[7px] py-[3px] leading-none text-ink transition hover:brightness-[1.03] active:scale-[0.98]"
                >
                  {group && faces.length ? (
                    <span className="flex items-center">
                      {faces.map((person, index) => (
                        <span
                          key={person.id || person.username}
                          className={cn(
                            "relative flex rounded-full",
                            index > 0 && "-ml-[8px]",
                          )}
                        >
                          <Avatar
                            name={person.name || person.username}
                            src={person.avatar}
                            size={15}
                          />
                        </span>
                      ))}
                      {morePeople > 0 ? (
                        <span className="-ml-[8px] inline-flex size-[15px] items-center justify-center border border-gray-500 rounded-full bg-[color-mix(in_srgb,var(--ink)_12%,var(--card))] text-[8.5px] font-bold leading-none text-dim">
                          +{morePeople > 9 ? "9" : morePeople}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <span className="flex items-center">
                    {message.reactions!.map((reaction) => (
                      <span
                        key={reaction.emoji}
                        className="text-[13px] leading-none"
                      >
                        {reaction.emoji}
                      </span>
                    ))}
                  </span>
                  <span
                    className={cn(
                      "num text-[11px] font-semibold leading-none",
                      message.my_reaction ? "text-accent" : "text-dim",
                    )}
                  >
                    {reactionTotal}
                  </span>
                </button>
              </div>
            ) : null}
            {!deleted && showStamp ? (
              <div
                className={cn(
                  "mt-[3px] flex items-center gap-1.5 px-1 text-[10px] leading-none",
                  mine ? "justify-end" : "justify-start",
                )}
              >
                <span className="tabular-nums text-dim">
                  {clock(message.created_at)}
                </span>
                {message.edited_at ? (
                  <span className="text-dim">Edited</span>
                ) : null}
                {mine ? (
                  message.failed ? (
                    <button
                      type="button"
                      onClick={onRetry}
                      disabled={!onRetry}
                      className="inline-flex items-center gap-[5px] text-[var(--bad)] transition enabled:hover:underline disabled:opacity-70"
                      title={
                        message.failure ??
                        (onRetry ? "Tap to send again" : "Not sent")
                      }
                    >
                      <AlertCircle className="size-[11px]" />
                      <span>Not sent</span>
                      {onRetry ? <RotateCcw className="size-[11px]" /> : null}
                    </button>
                  ) : (
                    <>
                      {message.pending || message.held ? (
                        <Clock3 className="size-[11px] text-dim" />
                      ) : null}
                      <span
                        className={cn(
                          receipt === "Read" ? "text-accent" : "text-dim",
                        )}
                      >
                        {message.pending && typeof progress === "number"
                          ? `Uploading ${progress}%`
                          : receipt}
                      </span>
                    </>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
        </MessageGesture>
      </div>
      {picking && !mine ? <PickMark picked={Boolean(picked)} /> : null}
      <Modal
        open={group && whoReacted}
        onClose={() => setWhoReacted(false)}
        title={
          reactors.length === 1
            ? "1 reaction"
            : `${count(reactors.length)} reactions`
        }
        size="sm"
      >
        {reactors.length ? (
          <div className="flex flex-col pb-1">
            {reactors.map((person) => {
              const own = Boolean(meId) && person.id === meId;
              return (
                <div
                  key={`${person.id}:${person.emoji}`}
                  className="flex items-center gap-3 border-b border-[color-mix(in_srgb,var(--line)_65%,transparent)] px-4 py-2.5 last:border-b-0"
                >
                  <Avatar
                    name={person.name || person.username}
                    src={person.avatar}
                    size={38}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate text-[13px] font-bold text-ink">
                        {person.name || person.username}
                      </span>
                      {person.verified ? <VerifiedTick size={13} /> : null}
                    </span>
                    <span className="block truncate text-[11.5px] text-dim">
                      @{person.username}
                    </span>
                  </span>
                  {own ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          void onReact(person.emoji);
                          setWhoReacted(false);
                        }}
                        aria-label="Remove my reaction"
                        title="Remove my reaction"
                        className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-[var(--bad)] transition hover:bg-[color-mix(in_srgb,var(--bad)_18%,transparent)]"
                      >
                        <Trash2 className="size-[16px]" />
                      </button>
                      <span className="-mr-1 shrink-0 text-[16px] leading-none">
                        {person.emoji}
                      </span>
                    </>
                  ) : (
                    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[16px] leading-none">
                      {person.emoji}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-4 pb-3">
            {(message.reactions ?? []).map((reaction) => (
              <span
                key={reaction.emoji}
                className="flex items-center gap-2 text-[13px] text-ink"
              >
                <span className="text-[18px] leading-none">
                  {reaction.emoji}
                </span>
                <span className="num font-semibold">{reaction.count}</span>
              </span>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function FrameTiles({
  frame,
  caption,
  onOpen,
  uploads,
}: {
  frame: Message[];
  caption: boolean;
  onOpen: (row: Message) => void;
  /** How far each row's own upload has come, by client id. */
  uploads?: Record<string, number>;
}) {
  const uploadOf = (row: Message) =>
    row.client_id ? uploads?.[row.client_id] : undefined;
  const shown = frame.slice(0, 4);
  const rows = frame.length > 2;
  return (
    <div
      className={cn(
        "w-full max-w-[320px] overflow-hidden rounded-[10px]",
        caption && "rounded-b-none",
      )}
    >
      <div
        className="grid gap-px"
        style={{
          // Two pictures keep their own shape side by side; three or more are a
          // square, because the tiles beside the tall one have to halve.
          aspectRatio: rows
            ? 1
            : Math.max(0.9, Math.min(1.6, frameShape(frame) * 2)),
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gridTemplateRows: rows ? "repeat(2, minmax(0, 1fr))" : undefined,
        }}
      >
        {shown.map((row, at) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpen(row)}
            className={cn(
              "relative min-w-0 overflow-hidden bg-[rgb(0_0_0_/_0.06)]",
              frame.length === 3 && at === 0 && "row-span-2",
            )}
            aria-label={
              row.asset?.kind === "video" ? "Play clip" : "Open photo"
            }
          >
            <FrameTile row={row} upload={uploadOf(row)} />
            {frame.length > 4 && at === 3 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[22px] font-bold text-white">
                +{frame.length - 3}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function FrameTile({ row, upload }: { row: Message; upload?: number }) {
  const src = assetSrc(row.asset);
  const kind = row.asset?.kind || row.kind;
  if (!src) {
    return (
      <span className="flex size-full items-center justify-center bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim">
        <ImageOff className="size-5" aria-hidden />
      </span>
    );
  }
  const pending = Boolean(row.pending);
  return (
    <>
      {kind === "video" ? (
        <AuthedVideo
          src={src}
          muted
          preload="metadata"
          className="size-full object-cover"
        />
      ) : (
        <AuthedImage
          src={src}
          alt={row.asset?.original_name || "Photo"}
          className="size-full object-cover"
        />
      )}
      {kind === "video" && !pending ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white">
            <Play className="size-5 fill-current" />
          </span>
        </span>
      ) : null}
      {pending ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-semibold text-white">
          {typeof upload === "number" ? (
            `${Math.round(upload)}%`
          ) : (
            <Spinner className="size-4 text-white" />
          )}
        </span>
      ) : null}
    </>
  );
}

function MediaViewer({
  items,
  at,
  onAt,
  onClose,
}: {
  items: Message[];
  at: number;
  onAt: (next: number) => void;
  onClose: () => void;
}) {
  const row = items[at];
  const many = items.length > 1;

  useEffect(() => {
    const release = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft")
        onAt((at + items.length - 1) % items.length);
      if (event.key === "ArrowRight") onAt((at + 1) % items.length);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [at, items.length, onAt, onClose]);

  const src = assetSrc(row?.asset);
  if (!src) return null;
  const clip = (row.asset?.kind || row.kind) === "video";

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-[rgb(9_9_14_/_0.94)]"
      role="dialog"
      aria-modal="true"
      aria-label={clip ? "Clip" : "Photo"}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white/80">
          {row.asset?.original_name || (clip ? "Clip" : "Photo")}
        </span>
        {many ? (
          <span className="text-[11px] tabular-nums text-white/60">
            {at + 1} / {items.length}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-10 flex-none items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="size-6" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
        {many ? (
          <button
            type="button"
            onClick={() => onAt((at + items.length - 1) % items.length)}
            className="absolute left-2 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
            aria-label="Previous"
          >
            <ChevronLeft className="size-6" />
          </button>
        ) : null}
        {clip ? (
          <AuthedVideo
            src={src}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          <AuthedImage
            src={src}
            alt={row.asset?.original_name || "Photo"}
            loading="eager"
            className="max-h-full max-w-full object-contain"
          />
        )}
        {many ? (
          <button
            type="button"
            onClick={() => onAt((at + 1) % items.length)}
            className="absolute right-2 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
            aria-label="Next"
          >
            <ChevronRight className="size-6" />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The mark a line wears while a pile is being picked: filled with a tick when it
 * is in the pile, a bare ring when it is not. Drawn in the margin on the side
 * away from the bubble, so it never lands over somebody's words.
 */
function PickMark({ picked }: { picked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-[22px] shrink-0 items-center justify-center rounded-full border transition",
        picked
          ? "border-accent bg-accent text-on-accent"
          : "border-[color-mix(in_srgb,var(--ink)_35%,transparent)] text-transparent",
      )}
      aria-hidden
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

function ThreadInfoPanel({
  onClose,
  onBack,
  thread,
  onOptions,
}: {
  onClose: () => void;
  onBack: () => void;
  thread: ThreadDetail;
  onOptions: () => void;
}) {
  const group = thread.kind === "group";
  const members = thread.members ?? [];
  const memberCount = thread.member_count ?? members.length;
  const face = thread.other ?? members[0]?.user;
  const title = threadTitle(thread);
  const vanishOn = Boolean(thread.vanish_mode && thread.vanish_mode !== "off");
  const vanish = vanishLabel(thread.vanish_mode ?? "off", thread.vanish_days);
  const online = !group && Boolean(thread.other?.online);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-[color-mix(in_srgb,var(--page)_58%,var(--card))] scroll-thin">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-line px-3.5 py-3 backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--card)), color-mix(in srgb, var(--card) 92%, transparent) 68%)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94] -ml-1 shrink-0"
          aria-label="Back to convo options"
        >
          <ArrowLeft className="size-5" />
        </button>
        <Avatar user={face} name={title} src={thread.avatar} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold tracking-[-0.25px]">
            {title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] font-medium text-dim">
            {online ? (
              <span className="size-1.5 shrink-0 rounded-full bg-[var(--good)]" />
            ) : null}
            {group
              ? `${memberCount} ${memberCount === 1 ? "member" : "members"}`
              : face?.username
                ? `@${face.username}`
                : "Direct convo"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink active:scale-95"
          aria-label="Close convo details"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="space-y-4 p-4 pb-6">
        <section
          className="relative overflow-hidden rounded-[22px] border border-line shadow-[0_1px_2px_rgba(17,17,26,0.04)]"
          style={{
            background:
              "linear-gradient(155deg, color-mix(in srgb, var(--accent) 9%, var(--card)), var(--card) 68%)",
          }}
        >
          <span
            className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full opacity-40 blur-2xl"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--accent) 32%, transparent)",
            }}
            aria-hidden
          />
          <div className="relative p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-1 text-[9px] font-extrabold text-dim">
                <Users className="size-3" />
                {group ? "Group" : "Direct"}
              </span>
              {vanishOn ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-extrabold text-accent">
                  <Clock3 className="size-3" />
                  {vanish}
                </span>
              ) : null}
              {thread.vaulted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-1 text-[9px] font-extrabold text-dim">
                  <Lock className="size-3" />
                  Vaulted
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--card)_82%,transparent)] p-2.5">
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.12em] text-dim">
                  {group ? "Members" : "Username"}
                </p>
                <p className="mt-1 truncate text-[12.5px] font-extrabold">
                  {group
                    ? `${memberCount} ${memberCount === 1 ? "person" : "people"}`
                    : face?.username
                      ? `@${face.username}`
                      : "—"}
                </p>
              </div>
              <div className="rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--card)_82%,transparent)] p-2.5">
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.12em] text-dim">
                  Disappearing
                </p>
                <p
                  className={cn(
                    "mt-1 truncate text-[12.5px] font-extrabold",
                    vanishOn ? "text-accent" : "text-ink",
                  )}
                >
                  {vanishOn ? vanish : "Off"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {group && members.length ? (
          <section className="overflow-hidden rounded-[20px] border border-line bg-card">
            <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--accent-soft)] text-accent">
                <Users className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[12px] font-extrabold">People</h3>
                <p className="mt-0.5 text-[10px] text-dim">
                  {memberCount} {memberCount === 1 ? "member" : "members"} in
                  this group
                </p>
              </div>
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto p-1.5 scroll-thin">
              {members.map((member) => {
                const role = (member.role || "member").toLowerCase();
                const admin =
                  role === "admin" || role === "owner" || role === "creator";
                return (
                  <Link
                    key={member.user.id}
                    to={`/app/u/${member.user.username}`}
                    className="group flex items-center gap-2.5 rounded-[13px] px-2 py-2 transition hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]"
                  >
                    <Avatar user={member.user} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-bold">
                        {member.user.name || member.user.username}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-dim">
                        @{member.user.username}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em]",
                        admin
                          ? "bg-[var(--accent-soft)] text-accent"
                          : "bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim",
                      )}
                    >
                      {role}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-[20px] border border-line bg-card p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-accent">
              <Info className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold">
                Need to change something?
              </p>
              <p className="mt-1 text-[10px] leading-4 text-dim">
                Mute, pin, the vault, wallpaper, the theme, disappearing
                messages, and clearing live in options.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            full
            onClick={onOptions}
            className="mt-3"
            icon={<MoreHorizontal className="size-4" />}
          >
            Open convo options
          </Button>
        </section>
      </div>
    </div>
  );
}

function MessageOptions({
  message,
  open,
  group,
  thread,
  onClose,
  onChanged,
  onReact,
  onReply,
  onSelectMore,
  onRetry,
  onDiscard,
}: {
  message: Message | null;
  open: boolean;
  group?: boolean;
  thread?: ThreadDetail;
  onClose: () => void;
  onChanged: () => void;
  onReact: (emoji: string) => Promise<void>;
  onReply: () => void;
  onSelectMore: (message: Message) => void;
  onRetry: (message: Message) => void;
  onDiscard: (message: Message) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEditing(false);
    setShareOpen(false);
    setInfoOpen(false);
    setTrashOpen(false);
    setBody(message?.body ?? "");
  }, [message]);

  if (!message) return null;
  const current = message;
  const gone = Boolean(current.deleted_for_all);
  const synced = !isLocalMessage(current);
  const spark = isSparkMessage(current);
  const copyable = !gone && (current.can_copy ?? Boolean(current.body));
  const picture =
    current.asset?.kind === "image" || current.asset?.kind === "video";
  const who = (thread?.other?.name || thread?.other?.username || "them").split(
    " ",
  )[0];

  async function edit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await chatService.edit(current.thread, current.id, body.trim());
      onChanged();
      onClose();
      toast({ title: "Message edited", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not edit that",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Bring the file down to this computer, which is the web's whole of the app's
   * *Keep in photos*: the bytes come through this account's own credentials and
   * the browser's download puts them where this machine keeps its files. See
   * `DropMenu.keepPicture`, which does the same for a drop.
   */
  async function keepInPhotos() {
    const url = current.asset?.content_url;
    if (!url || busy) return;
    setBusy(true);
    try {
      const blob = await mediaBlob(url);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = current.asset?.original_name || `xelvic-${current.id}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      onClose();
      toast({
        title: "Saved.",
        description: "It is in this computer's downloads.",
        tone: "success",
      });
    } catch (error) {
      toast({
        title: "Could not get that file to keep.",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Message options" size="sm">
        <p className="px-4 pb-1.5 pt-3 text-[11px] text-dim">
          {clock(message.created_at)}
        </p>
        <div className="p-3">
          {editing ? (
            <form
              onSubmit={(event) => void edit(event)}
              className="space-y-2.5"
            >
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                autoFocus
                rows={4}
                className="w-full resize-none rounded-[15px] border border-line bg-paper p-3.5 text-sm outline-none transition focus:border-accent focus:bg-card focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent)]"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit" loading={busy}>
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-1.5">
              {message.failed && message.failure ? (
                <p className="px-3 pb-1.5 text-[11.5px] leading-4 text-[var(--bad)]">
                  {message.failure}
                </p>
              ) : null}
              {message.failed ? (
                <>
                  <OptionRow
                    icon={<RotateCcw className="size-[22px]" />}
                    label="Retry"
                    onClick={() => {
                      onRetry(current);
                      onClose();
                    }}
                  />
                  <OptionRow
                    icon={<Trash2 className="size-[22px]" />}
                    label="Discard"
                    bad
                    onClick={() => {
                      onDiscard(current);
                      onClose();
                    }}
                  />
                </>
              ) : null}
              {!gone && synced ? (
                <div className="mb-1.5 flex items-center gap-0.5 px-0.5">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        void onReact(emoji);
                        onClose();
                      }}
                      style={{
                        backgroundColor:
                          message.my_reaction === emoji
                            ? "color-mix(in srgb, var(--accent) 20%, transparent)"
                            : undefined,
                      }}
                      className="flex size-[46px] shrink-0 items-center justify-center rounded-full text-[24px] transition hover:bg-[var(--accent-soft)]"
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
              {!gone && !spark && picture && message.asset?.content_url ? (
                <OptionRow
                  icon={<Download className="size-[22px]" />}
                  label="Keep in photos"
                  disabled={busy}
                  onClick={() => void keepInPhotos()}
                />
              ) : null}
              {!gone && synced ? (
                <OptionRow
                  icon={<Reply className="size-[22px]" />}
                  label="Ping"
                  onClick={() => {
                    onReply();
                    onClose();
                  }}
                />
              ) : null}
              {message.mine && !gone && synced && message.kind === "text" ? (
                <OptionRow
                  icon={<Pencil className="size-[22px]" />}
                  label="Edit"
                  onClick={() => setEditing(true)}
                />
              ) : null}
              {copyable ? (
                <OptionRow
                  icon={<Copy className="size-[22px]" />}
                  label="Text copy"
                  onClick={() => {
                    onClose();
                    void navigator.clipboard.writeText(message.body).then(
                      () => toast({ title: "Copied.", tone: "success" }),
                      () => toast({ title: "Could not copy", tone: "error" }),
                    );
                  }}
                />
              ) : null}
              {!gone && synced ? (
                <OptionRow
                  icon={<ListChecks className="size-[22px]" />}
                  label="Select more"
                  onClick={() => {
                    onSelectMore(current);
                    onClose();
                  }}
                />
              ) : null}
              {!gone && synced && !spark ? (
                <OptionRow
                  icon={<FiShare2 className="size-[22px]" />}
                  label="Share"
                  onClick={() => setShareOpen(true)}
                />
              ) : null}
              {group && message.mine && !gone && synced ? (
                <OptionRow
                  icon={<Info className="size-[22px]" />}
                  label="Info"
                  onClick={() => setInfoOpen(true)}
                />
              ) : null}
              <OptionRow
                icon={<Trash2 className="size-[22px]" />}
                label="Trash"
                bad
                onClick={() => setTrashOpen(true)}
              />
            </div>
          )}
        </div>
      </Modal>
      <TrashSheet
        message={message}
        who={who}
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        onChanged={onChanged}
      />
      <ForwardSheet
        messages={[message]}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
      <MessageInfoSheet
        message={message}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </>
  );
}

/**
 * One row of the long-press menu: a mark and a word, the shape the app's own
 * sheet draws. `bad` is the row that takes something away and is the only one
 * allowed to shout.
 */
function OptionRow({
  icon,
  label,
  onClick,
  bad,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  bad?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition disabled:opacity-50",
        bad
          ? "text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
          : "text-ink hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
      )}
    >
      <span className="flex size-[22px] shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-semibold">{label}</span>
    </button>
  );
}

/**
 * Where a line is trashed from, which the app asks as a question of its own:
 * this copy alone, or everybody's. Only my own bubble is offered the second —
 * nobody reaches into the other person's side of the conversation.
 */
function TrashSheet({
  message,
  who,
  open,
  onClose,
  onChanged,
}: {
  message: Message | null;
  who: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!message) return null;
  const mine = message.mine;
  const gone = Boolean(message.deleted_for_all);

  async function remove(all: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await chatService.removeMessage(message!.thread, message!.id, all);
      onChanged();
      onClose();
      toast({
        title: all ? "Removed for everyone" : "Removed from your copy",
        tone: "success",
      });
    } catch (error) {
      toast({
        title: "That message did not go",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="p-2.5 pt-3">
        <SheetChoice
          icon={<User className="size-[22px]" />}
          label="Trash from me"
          line="It goes from your side only."
          disabled={busy}
          onClick={() => void remove(false)}
        />
        {mine && !gone ? (
          <SheetChoice
            icon={<Users className="size-[22px]" />}
            label="Trash from everyone"
            line={`It goes from ${who}'s side as well.`}
            bad
            disabled={busy}
            onClick={() => void remove(true)}
          />
        ) : null}
      </div>
    </Modal>
  );
}

/** A row of a question sheet: the mark, the answer, and what it costs. */
function SheetChoice({
  icon,
  label,
  line,
  onClick,
  bad,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  line?: string;
  onClick: () => void;
  bad?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition disabled:opacity-50",
        bad
          ? "text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
          : "text-ink hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
      )}
    >
      <span className="flex size-[22px] shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        {line ? (
          <span className="mt-0.5 block text-[12px] text-dim">{line}</span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * What can be done with a pile, where the composer was: the words on the
 * clipboard, the same lines passed on, and the same lines gone from this side.
 * A mark with nothing behind it is drawn faded rather than taken away, so the
 * bar does not change shape under a hand.
 */
function PileBar({
  words,
  shipped,
  onCopy,
  onShare,
  onTrash,
}: {
  words: number;
  shipped: number;
  onCopy: () => void;
  onShare: () => void;
  onTrash: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[520px] items-stretch gap-1">
      <PileAction
        icon={<Copy className="size-[22px]" />}
        label="Copy"
        enabled={words > 0}
        onClick={onCopy}
      />
      <PileAction
        icon={<FiShare2 className="size-[22px]" />}
        label="Share"
        enabled={shipped > 0}
        onClick={onShare}
      />
      <PileAction
        icon={<Trash2 className="size-[22px]" />}
        label="Trash"
        bad
        enabled={shipped > 0}
        onClick={onTrash}
      />
    </div>
  );
}

function PileAction({
  icon,
  label,
  enabled,
  onClick,
  bad,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onClick: () => void;
  bad?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-[14px] py-3 transition",
        !enabled
          ? "cursor-default text-[color-mix(in_srgb,var(--ink)_32%,transparent)]"
          : bad
            ? "text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
            : "text-ink hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
      )}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

/**
 * The question a batch of trash is asked first, the way one line asks it: this
 * press is holding several backs at once, and only one of the two answers is a
 * removal.
 */
function PileAsk({
  open,
  count: total,
  busy,
  onClose,
  onRemove,
  onLeave,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onClose: () => void;
  onRemove: () => void;
  onLeave: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <p className="px-4 pb-1 pt-4 text-center text-[15px] font-semibold">
        {total === 1
          ? "Remove this line from your side?"
          : `Remove ${count} lines from your side?`}
      </p>
      <div className="p-2.5">
        <SheetChoice
          icon={<Trash2 className="size-[22px]" />}
          label="Remove them"
          bad
          disabled={busy}
          onClick={onRemove}
        />
        <SheetChoice
          icon={<X className="size-[22px]" />}
          label="Leave them"
          disabled={busy}
          onClick={onLeave}
        />
      </div>
    </Modal>
  );
}

/** The name a header wears while a pile is being picked. */
function PileHead({
  picked,
  all,
  onClose,
  onToggleAll,
}: {
  picked: number;
  all: boolean;
  onClose: () => void;
  onToggleAll: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94] -ml-1"
        aria-label="Done picking"
      >
        <X className="size-5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-[-0.2px]">
        {picked} picked
      </span>
      <button
        type="button"
        onClick={onToggleAll}
        className="flex-none rounded-full px-3 py-2 text-[13px] font-bold text-ink transition hover:bg-ink-6"
      >
        {all ? "None" : "All"}
      </button>
    </>
  );
}

function ForwardSheet({
  messages,
  open,
  onClose,
  onSent,
}: {
  messages: Message[];
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => chatService.threads(),
    enabled: open,
    staleTime: 10_000,
  });

  const first = messages[0] ?? null;

  useEffect(() => {
    if (open) setPicked([]);
  }, [open, first?.id, messages.length]);

  if (!first) return null;

  const rows = threads.data?.threads ?? [];

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id)
        ? current.filter((row) => row !== id)
        : [...current, id],
    );
  }

  /**
   * One request per line, in the thread's own order, so the other side reads
   * them in the order they were written rather than in whatever order the
   * network happens to deliver them.
   */
  async function forward() {
    if (!picked.length || busy) return;
    setBusy(true);
    try {
      for (const message of messages) {
        await chatService.forward(message.thread, message.id, picked);
      }
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      const people =
        picked.length === 1 ? "1 person" : `${count(picked.length)} people`;
      toast({
        title:
          messages.length === 1
            ? `Shared with ${people}.`
            : `Shared ${count(messages.length)} lines with ${people}.`,
        tone: "success",
      });
      onSent?.();
      onClose();
    } catch (error) {
      toast({
        title: "That forward did not land",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share"
      description={
        messages.length === 1
          ? "Pick where a copy of this message goes."
          : `Pick where a copy of these ${count(messages.length)} lines goes.`
      }
      size="md"
    >
      <div className="p-4">
        <div className="mb-3 rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))] px-3 py-2.5">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-dim">
            {messages.length === 1
              ? first.sender?.name || first.sender?.username || "Message"
              : `${count(messages.length)} lines`}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-ink">
            {first.body ||
              first.asset?.original_name ||
              `${first.kind} message`}
          </p>
        </div>

        {threads.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-14 rounded-[14px]"
              />
            ))}
          </div>
        ) : threads.isError ? (
          <ErrorState
            error={threads.error}
            onRetry={() => void threads.refetch()}
            compact
          />
        ) : !rows.length ? (
          <EmptyState
            icon={<Forward className="size-6" />}
            title="No other convos"
            body="Start a conversation first, then share this message into it."
          />
        ) : (
          <div className="max-h-[46dvh] space-y-1 overflow-y-auto rounded-[16px] border border-line p-1.5">
            {rows.map((row) => {
              const face = row.other ?? row.members?.[0]?.user;
              const active = picked.includes(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => toggle(row.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition",
                    active
                      ? "bg-[var(--accent-soft)]"
                      : "hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
                  )}
                >
                  <Avatar
                    user={face}
                    name={row.title}
                    src={row.avatar}
                    size={36}
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                    {row.title ||
                      face?.name ||
                      face?.username ||
                      "Conversation"}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition",
                      active
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line text-transparent",
                    )}
                    aria-hidden
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="button"
            loading={busy}
            disabled={!picked.length}
            onClick={() => void forward()}
          >
            {picked.length ? `Send ${count(picked.length)}` : "Send"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MessageInfoSheet({
  message,
  open,
  onClose,
}: {
  message: Message | null;
  open: boolean;
  onClose: () => void;
}) {
  const info = useQuery({
    queryKey: ["message-info", message?.thread, message?.id],
    queryFn: () => chatService.messageInfo(message!.thread, message!.id),
    enabled: open && Boolean(message && !message.pending && !message.failed),
  });

  if (!message) return null;

  const buckets = [
    { key: "seen", label: "Opened", rows: info.data?.seen ?? [] },
    { key: "delivered", label: "Delivered", rows: info.data?.delivered ?? [] },
    {
      key: "not_delivered",
      label: "Not delivered yet",
      rows: info.data?.not_delivered ?? [],
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Message info"
      description="Who has seen this message, straight from the server."
      size="sm"
    >
      <div className="p-4">
        {info.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] h-12 rounded-[12px]"
              />
            ))}
          </div>
        ) : info.isError ? (
          <ErrorState
            error={info.error}
            onRetry={() => void info.refetch()}
            compact
          />
        ) : (
          <div className="space-y-4">
            {buckets.map((bucket) => (
              <section key={bucket.key}>
                <h3 className="mb-1.5 flex items-center justify-between px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-dim">
                  <span>{bucket.label}</span>
                  <span className="tabular-nums">{bucket.rows.length}</span>
                </h3>
                {bucket.rows.length ? (
                  <div className="space-y-1 rounded-[14px] border border-line p-1.5">
                    {bucket.rows.map((item) => (
                      <div
                        key={item.user.id}
                        className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5"
                      >
                        <Avatar user={item.user} size={28} />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                          {item.user.name || item.user.username}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-dim">
                          {item.at ? clock(item.at) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] px-3 py-2 text-[10.5px] text-dim">
                    {bucket.key === "seen"
                      ? "No one has opened it yet."
                      : bucket.key === "delivered"
                        ? "No one in this group has received it yet."
                        : "Everyone has it."}
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function MediaSheet({
  threadId,
  open,
  onClose,
}: {
  threadId: string;
  open: boolean;
  onClose: () => void;
}) {
  const media = useQuery({
    queryKey: ["thread-media", threadId],
    queryFn: () => chatService.media(threadId),
    enabled: open,
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Media and files"
      description="Everything shared in this convo, in one place."
      size="lg"
    >
      <div className="p-4">
        {media.isLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
              <div
                key={row}
                className="relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] aspect-square rounded-[14px]"
              />
            ))}
          </div>
        ) : media.isError ? (
          <ErrorState
            error={media.error}
            onRetry={() => void media.refetch()}
            compact
          />
        ) : !media.data?.messages?.length ? (
          <EmptyState
            icon={<ImageIcon className="size-6" />}
            title="Nothing shared yet"
            body="Pictures, clips, voice notes and files will collect here."
          />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-dim">
                Shared here
              </p>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[9.5px] font-bold text-dim">
                {media.data.messages.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {media.data.messages.map((message) => (
                <div
                  key={message.id}
                  className="group relative aspect-square overflow-hidden rounded-[14px] border border-line bg-paper"
                >
                  {message.asset?.kind === "image" &&
                  assetSrc(message.asset) ? (
                    <AuthedImage
                      src={message.asset.thumbnail_url || assetSrc(message.asset)}
                      alt=""
                      className="h-full w-full transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : message.asset?.kind === "video" &&
                    assetSrc(message.asset) ? (
                    <AuthedVideo
                      src={assetSrc(message.asset)}
                      className="h-full w-full"
                      controls
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                      <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                        <DocumentGlyph
                          mime={message.asset?.mime}
                          name={message.asset?.original_name}
                          className="size-4"
                        />
                      </span>
                      <span className="line-clamp-2 text-[8.5px] font-semibold text-dim">
                        {message.asset?.original_name ||
                          message.body ||
                          message.asset?.kind}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function useSkinOverlay(wallpaper?: string | null, tint?: string | null) {
  const [overlay, setOverlay] = useState<{
    wallpaper?: string;
    tint?: string;
  }>({});
  useEffect(() => {
    setOverlay((current) =>
      current.wallpaper === undefined && current.tint === undefined
        ? current
        : {},
    );
  }, [wallpaper, tint]);
  return {
    wallpaper: overlay.wallpaper,
    tint: overlay.tint,
    apply: (patch: { wallpaper?: string; tint?: string }) =>
      setOverlay((current) => ({ ...current, ...patch })),
  };
}

export function ChatPage() {
  const { threadId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const callEngine = useCallEngine();
  const { status: socketStatus, send: sendSocket } = useSocket();
  const queryClient = useQueryClient();
  const cache = useMessageCache(threadId);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  /** What the picker handed over, waiting above the box for Send. */
  const [attachments, setAttachments] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(0);
  const [uploadPercent, setUploadPercent] = useState<Record<string, number>>(
    {},
  );
  const [infoOpen, setInfoOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [vibesOpen, setVibesOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  /** A pile is being picked: tapping lines adds them, the bar does the rest. */
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [pileAsk, setPileAsk] = useState(false);
  const [pileShareOpen, setPileShareOpen] = useState(false);
  const [pileBusy, setPileBusy] = useState(false);
  const [mediaView, setMediaView] = useState<{
    items: Message[];
    at: number;
  } | null>(null);
  const [sparkView, setSparkView] = useState<Message[] | null>(null);
  const [typers, setTypers] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, ReceiptMark>>({});
  const [channel, setChannel] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  /** Photos and clips: `image/*,video/*` and nothing else. See the inputs. */
  const mediaInput = useRef<HTMLInputElement>(null);
  /** Everything else this composer takes, a recording off a disk included. */
  const fileInput = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const voice = useVoiceNote({
    onSend: (note) => {
      const answering = replyTo;
      clearComposer();
      void sendMessage({
        kind: "voice",
        body: "",
        file: {
          file: note.file,
          kind: "voice",
          // The bubble is playable the instant the finger comes up, off the
          // recording itself, rather than after the upload lands.
          preview: URL.createObjectURL(note.file),
          durationMs: note.durationMs,
          waveform: note.waveform,
        },
        replyTo: answering,
      });
    },
    onSay: (message) => toast({ title: message, tone: "info" }),
  });
  /**
   * The composer's round button is the mic exactly when there is nothing to
   * send — the same one button it has always been, now tapped rather than held.
   */
  const micReady =
    voice.phase !== "idle" || (!text.trim() && !attachments.length);
  // The camera's code is fetched while this thread is being read, so that
  // tapping the Spark row is not also the tap that begins a download. See
  // `features/camera/warm.ts` for why this asks for no camera, no microphone
  // and no picture.
  useEffect(() => warmCameraWhenIdle(), []);
  useEffect(() => {
    const warm = setTimeout(() => void stickersService.shelf(), 800);
    return () => clearTimeout(warm);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(false);
  const lastThread = useRef("");
  const typingTimer = useRef<number | null>(null);
  const olderAnchor = useRef<{ height: number; top: number } | null>(null);
  const olderPending = useRef(false);
  const { styled, chatBackdrop, palette } = useTheme();

  const seededThread = useMemo(
    () => cachedThread(queryClient, threadId),
    [queryClient, threadId],
  );
  const threadQuery = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => chatService.thread(threadId),
    enabled: Boolean(threadId),
    staleTime: 15_000,
    placeholderData: seededThread ? { thread: seededThread } : undefined,
  });
  const messages = useInfiniteQuery({
    queryKey: ["messages", threadId],
    queryFn: ({ pageParam }) =>
      pageParam
        ? chatService.messagesAt(pageParam)
        : chatService.messages(threadId),
    initialPageParam: `/chat/threads/${threadId}/messages/` as string | null,
    getNextPageParam: (last) => apiPathFrom(last.next),
    enabled: Boolean(threadId),
  });

  const thread = threadQuery.data?.thread;
  const own = useOwnWall(threadId);
  const skinLocal = useSkinOverlay(thread?.wallpaper, thread?.tint);
  const ownWall = own && own.opacity > 0 ? own : null;
  const wallpaper = own
    ? null
    : wallUrl(skinLocal.wallpaper ?? thread?.wallpaper);
  const opacity = wallpaperOpacity();
  const tinted = chosenTint(skinLocal.tint ?? thread?.tint);
  const convo = useMemo(
    () =>
      tinted
        ? convoColors({
            ...convoPalette(palette),
            accent: tinted,
            chatTint: tinted,
          })
        : null,
    [tinted, palette],
  );
  const themeWall = wallpaper || own ? null : chatBackdrop;
  const wallpaperSrc = ownWall?.src ?? wallpaper;
  const painting =
    Object.keys(styled.art).length > 0 ||
    Boolean(styled.chatWall || styled.profileWall || styled.coverArt);
  /** The chat's bars: the page's own ink, or glass over the picture the page stands on. */
  const bar = painting
    ? "bg-[color-mix(in_srgb,var(--page)_88%,transparent)] backdrop-blur-xl"
    : "bg-page";

  useEffect(() => {
    if (!thread || searchParams.get("info") !== "1") return;
    setSheetOpen(false);
    setVibesOpen(false);
    setInfoOpen(true);
    const copy = new URLSearchParams(searchParams);
    copy.delete("info");
    setSearchParams(copy, { replace: true });
  }, [thread, searchParams, setSearchParams]);
  const allMessages = useMemo(() => {
    const seen = new Set<string>();
    return (messages.data?.pages ?? [])
      .flatMap((page) => page.results)
      .filter((message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
      })
      .sort((a, b) => {
        // Server pages arrive newest-first; render ascending. Optimistic rows
        // have no ordinal yet, so they must sit at the end, not the top.
        const ao = a.ordinal ?? Number.MAX_SAFE_INTEGER;
        const bo = b.ordinal ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return Date.parse(a.created_at) - Date.parse(b.created_at);
      });
  }, [messages.data]);
  const visibleMessages = channel
    ? allMessages.filter((message) => message.channel === channel)
    : allMessages;
  useEffect(() => {
    const newest = visibleMessages.slice(-160).reverse();
    warmMedia(newest.flatMap(messageMedia));
  }, [visibleMessages]);
  // Every line in the thread a pick can land on: the ones still there. A system
  // note and a call record wear no mark and answer no tap, so they are not in
  // the pile's own count either.
  const pickable = visibleMessages.filter(
    (message) =>
      !message.deleted_for_all &&
      message.kind !== "system" &&
      !callNote(message),
  );
  const pile = pickable.filter((message) => picked.includes(pickKey(message)));
  const pileWords = pile.filter((message) => message.body?.trim());
  const pileShipped = pile.filter((message) => !isLocalMessage(message));
  const allPicked = pickable.length > 0 && picked.length === pickable.length;
  const latestOrdinal = allMessages.reduce(
    (max, message) => Math.max(max, message.ordinal ?? 0),
    0,
  );
  const hasOlder = messages.hasNextPage;
  const fetchOlder = messages.fetchNextPage;

  useEffect(() => {
    setText(readDraft(threadId));
    setReplyTo(null);
    // Anything staged belongs to the convo it was picked in.
    setAttachments([]);
    setSelected(null);
    setSelecting(false);
    setPicked([]);
    setPileAsk(false);
    setPileShareOpen(false);
    setMediaView(null);
    setSparkView(null);
    setAttachOpen(false);
    setEmojiOpen(false);
    setChannel(null);
    setReceipts({});
    setTypers({});
    setSheetOpen(false);
    setVibesOpen(false);
    setInfoOpen(false);
    firstScroll.current = false;
    lastThread.current = threadId;
  }, [threadId]);

  useEffect(() => {
    if (socketStatus !== "live" || !threadId) return;
    sendSocket({ action: "subscribe", thread: threadId, fresh: true });
    return () => {
      sendSocket({ action: "unsubscribe", thread: threadId });
      sendSocket({ action: "away", thread: threadId });
    };
  }, [threadId, socketStatus, sendSocket]);

  useEffect(() => {
    if (!allMessages.length) return;
    const element = scrollRef.current;
    if (!element) return;
    const initial = !firstScroll.current;
    const near =
      element.scrollHeight - element.scrollTop - element.clientHeight < 280;
    if (initial || near) {
      window.requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({
          behavior: initial ? "auto" : "smooth",
          block: "end",
        });
      });
      firstScroll.current = true;
    }
  }, [allMessages.length, threadId]);

  useEffect(() => {
    if (!latestOrdinal) return;
    const timer = window.setTimeout(() => {
      void chatService.read(threadId, latestOrdinal).catch(() => undefined);
      if (socketStatus === "live")
        sendSocket({
          action: "read",
          thread: threadId,
          ordinal: latestOrdinal,
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [latestOrdinal, threadId, socketStatus, sendSocket]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => {
      setShowJump(
        element.scrollHeight - element.scrollTop - element.clientHeight > 600,
      );
      if (element.scrollTop > 240 || !hasOlder || olderPending.current) return;
      olderAnchor.current = {
        height: element.scrollHeight,
        top: element.scrollTop,
      };
      olderPending.current = true;
      void fetchOlder().finally(() => {
        olderPending.current = false;
      });
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [hasOlder, fetchOlder]);

  useEffect(() => {
    const anchor = olderAnchor.current;
    const element = scrollRef.current;
    if (!anchor || !element) return;
    window.requestAnimationFrame(() => {
      const row = scrollRef.current;
      if (!row) return;
      row.scrollTop = row.scrollHeight - anchor.height + anchor.top;
      olderAnchor.current = null;
    });
  }, [allMessages.length]);

  useEffect(() => {
    if (!text.trim() || socketStatus !== "live") return;
    sendSocket({ action: "typing", thread: threadId, typing: true });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      sendSocket({ action: "typing", thread: threadId, typing: false });
    }, 2400);
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, [text, threadId, socketStatus, sendSocket]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, []);

  const { gazeOf, watch, unwatch, say, leave } = useLooking();
  const chatterId = thread?.other?.id ? String(thread.other.id) : "";
  useEffect(() => {
    if (!chatterId) return;
    watch(chatterId);
    say(chatterId, "chat");
    return () => {
      unwatch(chatterId);
      leave(chatterId);
    };
    // The four callbacks are stable for the life of the provider, so this runs
    // when the convo changes and not when somebody's gaze moves. See
    // `hooks/useLooking.ts`.
  }, [chatterId, watch, unwatch, say, leave]);
  const chatterGaze = gazeOf(chatterId);

  useSocketEvent(
    [
      "message.new",
      "message.edit",
      "message.gone",
      "message.react",
      "message.poll",
      "thread.typing",
      "thread.read",
      "thread.update",
      "thread.members",
      "thread.channels",
    ],
    (frame) => {
      const data = (frame.data ?? {}) as Record<string, unknown>;
      const incomingThread = String(data.thread_id ?? data.id ?? "");
      if (incomingThread && incomingThread !== threadId) return;
      if (frame.event === "message.new") {
        const message = data.message as Message | undefined;
        if (message) {
          cache.arrive(message);
          if (!message.mine && document.visibilityState === "visible") {
            void chatService
              .read(threadId, message.ordinal)
              .catch(() => undefined);
          }
        }
      } else if (frame.event === "message.edit") {
        const message = data.message as Message | undefined;
        if (message) cache.insert(message);
      } else if (frame.event === "message.gone") {
        const ids = (data.message_ids as string[] | undefined) ?? [];
        cache.remove(ids);
      } else if (frame.event === "message.react") {
        cache.patch(String(data.message_id), {
          reactions: data.reactions as Message["reactions"],
          my_reaction:
            data.user_id === user?.id
              ? (data.emoji as string | null)
              : undefined,
        });
      } else if (frame.event === "message.poll") {
        cache.patch(String(data.message_id), {
          poll: data.poll as MessagePoll,
        });
      } else if (frame.event === "thread.typing") {
        const userId = String(data.user_id ?? "");
        if (!userId || userId === user?.id) return;
        const name =
          thread?.members?.find((member) => member.user.id === userId)?.user
            .name || "Someone";
        if (data.typing) {
          setTypers((current) => ({ ...current, [userId]: name }));
          window.setTimeout(
            () => {
              setTypers((current) => {
                const next = { ...current };
                delete next[userId];
                return next;
              });
            },
            Number(data.ttl ?? 5) * 1000,
          );
        } else {
          setTypers((current) => {
            const next = { ...current };
            delete next[userId];
            return next;
          });
        }
      } else if (frame.event === "thread.read") {
        // Honest receipts: the server tells us this seat's delivered/read
        // watermark. Store it both in local state (immediate) and in the
        // thread cache (so a remount still renders the same word).
        const userId = String(data.user_id ?? "");
        if (!userId || userId === user?.id) return;
        const delivered =
          typeof data.delivered === "number" ? data.delivered : undefined;
        const read = typeof data.read === "number" ? data.read : undefined;
        setReceipts((current) => ({
          ...current,
          [userId]: {
            delivered: delivered ?? current[userId]?.delivered,
            read: read ?? current[userId]?.read,
          },
        }));
        queryClient.setQueryData<{ thread: ThreadDetail; catalog?: unknown }>(
          ["thread", threadId],
          (current) => {
            if (!current?.thread) return current;
            const members = (current.thread.members ?? []).map((seat) =>
              seat.user?.id === userId
                ? {
                    ...seat,
                    last_delivered_ordinal:
                      delivered ?? seat.last_delivered_ordinal,
                    last_read_ordinal: read ?? seat.last_read_ordinal,
                  }
                : seat,
            );
            return { ...current, thread: { ...current.thread, members } };
          },
        );
      } else if (
        frame.event === "thread.update" ||
        frame.event === "thread.members" ||
        frame.event === "thread.channels"
      ) {
        void queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      }
    },
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selected) setSelected(null);
        else if (selecting) endSelect();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, selecting]);

  /** Let go of one staged file, and of the object URL that shows it. */
  function removeAttachment(at: number) {
    const file = attachments[at];
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setAttachments(attachments.filter((_, index) => index !== at));
  }

  /**
   * A pick lands in the composer, not in the thread.
   *
   * Whatever was chosen waits above the box until Send — pictures as
   * thumbnails, anything else by its own name — and the act that sends them is
   * the act that sends a typed line. The phone sends a pick the moment it is
   * made; here the box is the last word, because a browser's picker offers no
   * second chance to take something back before it lands.
   */
  function chooseFiles(files: File[]) {
    if (!files.length) return;
    const next: PendingFile[] = [];
    for (const file of files) {
      const staged = pendingFile(file);
      const trouble = fileTrouble(file, staged.kind);
      if (trouble) {
        if (staged.preview) URL.revokeObjectURL(staged.preview);
        toast({
          title: "That file cannot be sent",
          description: trouble,
          tone: "error",
        });
        continue;
      }
      next.push(staged);
    }
    if (next.length) setAttachments([...attachments, ...next]);
  }

  /** What the box lets go of once a message is on its way. */
  function clearComposer() {
    setText("");
    writeDraft(threadId, "");
    setReplyTo(null);
    setEmojiOpen(false);
  }

  /**
   * Send what the box is holding: the words, the files, or both.
   *
   * Several files go at once rather than one after another — no upload waits
   * for the one picked before it — and each is its own row carrying the same
   * share id, which is what the thread draws as one frame. The words ride the
   * first of them and the frame reads its caption off whichever row carries
   * one, so a caption does not depend on which upload finishes first.
   */
  async function sendDraft() {
    const body = text.trim();
    const files = attachments;
    const answering = replyTo;
    if (!body && !files.length) return;
    clearComposer();
    if (!files.length) {
      await sendMessage({ body, replyTo: answering });
      return;
    }
    // Handed over as they are: each row owns its own preview from here, and
    // revokes it when the real upload replaces the row.
    setAttachments([]);
    const group = files.length > 1 ? crypto.randomUUID() : undefined;
    await Promise.all(
      files.map((file, index) =>
        sendMessage({
          kind: file.kind,
          body: index === 0 ? body : "",
          payload: group ? { group } : undefined,
          file,
          replyTo: index === 0 ? answering : null,
        }),
      ),
    );
  }

  const outbox = useRef<Map<string, OutgoingSend>>(new Map());

  async function deliver(intent: OutgoingSend) {
    const { clientId, localId, kind, body, replyToId, payload, file } = intent;
    setSending((count) => count + 1);
    try {
      let assetId = intent.assetId;
      if (file && !assetId) {
        setUploadPercent((current) => ({ ...current, [clientId]: 0 }));
        const asset = await uploadAsset(file.file, {
          kind:
            file.kind === "voice"
              ? "voice"
              : file.kind === "image"
                ? "image"
                : file.kind === "video"
                  ? "video"
                  : file.kind === "audio"
                    ? "audio"
                    : "doc",
          voice: file.kind === "voice",
          durationMs: file.durationMs,
          waveform: file.waveform,
          onProgress: (percent) =>
            setUploadPercent((current) => ({
              ...current,
              [clientId]: percent,
            })),
        });
        assetId = asset.id;
        intent.assetId = asset.id;
        // Show the real uploaded asset while the message row lands.
        cache.patch(localId, { asset });
      }
      const response = await chatService.send(threadId, {
        kind,
        body,
        reply_to: replyToId,
        asset: assetId,
        payload,
        channel: intent.channel ?? undefined,
        client_id: clientId,
      });
      outbox.current.delete(clientId);
      cache.arrive(response.message);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return true;
    } catch (error) {
      // The sentence is kept on the row as well as toasted: a toast is gone in
      // four seconds, and the reason a clip was refused is the one thing the
      // person needs when they come back to press Retry.
      const reason = errorMessage(error);
      cache.markFailed(localId, reason);
      toast({
        title: "Your message did not send",
        description: reason,
        tone: "error",
      });
      return false;
    } finally {
      setSending((count) => Math.max(0, count - 1));
      setUploadPercent((current) => {
        if (!(clientId in current)) return current;
        const next = { ...current };
        delete next[clientId];
        return next;
      });
    }
  }

  function retrySend(clientId: string) {
    const intent = outbox.current.get(clientId);
    if (!intent) return;
    cache.patch(intent.localId, {
      pending: true,
      failed: false,
      failure: undefined,
    });
    void deliver(intent);
  }

  /** Drop a line that never went: nothing holds it but this browser. */
  function discardSend(message: Message) {
    if (message.client_id) outbox.current.delete(message.client_id);
    cache.remove([message.id]);
  }

  function endSelect() {
    setSelecting(false);
    setPicked([]);
    setPileAsk(false);
  }

  function togglePick(message: Message) {
    const key = pickKey(message);
    const next = picked.includes(key)
      ? picked.filter((row) => row !== key)
      : [...picked, key];
    setPicked(next);
    // Letting the last one go leaves the mode rather than a bar over an empty
    // pile, which is the shape a mistake should end in.
    if (!next.length) setSelecting(false);
  }

  function pickAll() {
    if (allPicked) {
      endSelect();
      return;
    }
    setPicked(pickable.map(pickKey));
  }

  /**
   * The way into a pile: one line is what a long press is holding, and this is
   * how the line under the thumb is joined by others. The reply and the edit
   * both belong to one line, and the composer that carries them is the thing
   * the pile replaces.
   */
  function startSelect(message: Message) {
    setSelecting(true);
    setPicked([pickKey(message)]);
    setReplyTo(null);
    setAttachOpen(false);
    setEmojiOpen(false);
    setStickerOpen(false);
  }

  async function copyPile() {
    const words = pileWords.map((message) => message.body.trim());
    if (!words.length) return;
    try {
      await navigator.clipboard.writeText(words.join("\n"));
      toast({
        title:
          words.length === 1
            ? "Copied."
            : `Copied ${count(words.length)} lines.`,
        tone: "success",
      });
    } catch {
      toast({ title: "Could not copy", tone: "error" });
    }
  }

  /** One request per line, in the thread's own order. */
  async function trashPile() {
    if (pileBusy) return;
    setPileBusy(true);
    try {
      for (const message of pileShipped) {
        await chatService.removeMessage(threadId, message.id, false);
      }
      cache.remove(pileShipped.map((message) => message.id));
      toast({ title: "Removed from your copy", tone: "success" });
      endSelect();
    } catch (error) {
      toast({
        title: "That message did not go",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setPileBusy(false);
    }
  }

  /**
   * One message on its way, out of what the caller hands it.
   *
   * The box is not read here and not cleared here: a share is several of these
   * at once, and a primitive that emptied the composer would empty it once per
   * row. See `sendDraft`.
   */
  async function sendMessage(
    options: {
      kind?: string;
      body?: string;
      payload?: Record<string, unknown>;
      file?: PendingFile | null;
      replyTo?: Message | null;
    } = {},
  ) {
    const body = (options.body ?? "").trim();
    const file = options.file ?? null;
    const kind = options.kind ?? file?.kind ?? "text";
    if (!body && !file) return true;
    const answering = options.replyTo === undefined ? replyTo : options.replyTo;

    const clientId = crypto.randomUUID();
    const localId = `local-${clientId}`;
    const intent: OutgoingSend = {
      clientId,
      localId,
      kind,
      body,
      replyToId: answering?.id ?? undefined,
      payload: options.payload,
      channel: channel ?? null,
      file: file ?? undefined,
    };
    outbox.current.set(clientId, intent);

    const preview = file?.preview;
    // A picture, a film and a voice note all have something to show before the
    // upload lands; a document has only its name.
    const showsPreview = Boolean(
      preview &&
      (file?.kind === "image" ||
        file?.kind === "video" ||
        file?.kind === "voice"),
    );
    const now = new Date().toISOString();
    const local: Message = {
      id: localId,
      thread: threadId,
      channel: channel ?? null,
      kind,
      body,
      sender: (user ??
        thread?.other ?? {
          id: "me",
          name: "You",
          username: "you",
        }) as Message["sender"],
      mine: true,
      reply_to: answering
        ? {
            id: answering.id,
            kind: answering.kind,
            body: answering.body,
            sender: {
              id: answering.sender?.id ?? "",
              name: answering.sender?.name ?? answering.sender?.username ?? "",
            },
            deleted_for_all: answering.deleted_for_all,
          }
        : null,
      asset:
        showsPreview && preview
          ? {
              id: localId,
              kind,
              content_url: preview,
              thumbnail_url:
                file?.kind === "image" || file?.kind === "video"
                  ? preview
                  : undefined,
              original_name: file?.file.name,
              mime: file?.file.type,
              size: file?.file.size,
              // The recording's own clock and shape, so the bubble that is drawn
              // before the upload lands is the same note the server will have.
              duration_ms: file?.durationMs ?? null,
              waveform: file?.waveform ?? null,
            }
          : undefined,
      payload: options.payload ?? null,
      pending: true,
      created_at: now,
      updated_at: now,
      client_id: clientId,
    };
    cache.insertLocal(local);

    window.requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
    );

    return deliver(intent);
  }

  async function replyToSpark(look: Message, body: string) {
    try {
      const response = await chatService.send(threadId, {
        kind: "text",
        body,
        reply_to: look.id,
        client_id: crypto.randomUUID(),
      });
      cache.arrive(response.message);
      return true;
    } catch (error) {
      toast({
        title: "Your reply did not send",
        description: errorMessage(error),
        tone: "error",
      });
      return false;
    }
  }

  async function sendSticker(sticker: ShelfSticker) {
    setStickerOpen(false);
    const answering = replyTo;
    clearComposer();
    await sendMessage({
      kind: "text",
      body: sticker.name || "Sticker",
      payload: {
        sticker: { id: sticker.id, url: sticker.url, name: sticker.name },
      },
      file: null,
      replyTo: answering,
    });
  }

  async function sendLocation(place: SharablePlace) {
    setLocationOpen(false);
    const answering = replyTo;
    clearComposer();
    await sendMessage({
      kind: "location",
      body: place.label,
      payload: {
        lat: place.latitude,
        lng: place.longitude,
        ...(place.accuracy == null
          ? {}
          : { accuracy_m: Math.round(place.accuracy) }),
      },
      file: null,
      replyTo: answering,
    });
  }

  async function react(message: Message, emoji: string) {
    if (message.pending || message.failed) return;
    const was = {
      reactions: message.reactions ?? [],
      my_reaction: message.my_reaction ?? null,
    };
    cache.patch(message.id, rolledReaction(was.reactions, emoji, was.my_reaction));
    try {
      const response = await chatService.react(threadId, message.id, emoji);
      cache.patch(message.id, {
        reactions: response.reactions,
        my_reaction: response.emoji,
      });
    } catch (error) {
      cache.patch(message.id, was);
      toast({
        title: "That reaction did not land",
        description: errorMessage(error),
        tone: "error",
      });
    }
  }

  async function vote(message: Message, choice: number) {
    if (message.pending || message.failed) return;
    try {
      const response = await chatService.vote(threadId, message.id, choice);
      cache.patch(message.id, { poll: response.poll });
    } catch (error) {
      toast({
        title: "Your vote did not land",
        description: errorMessage(error),
        tone: "error",
      });
    }
  }

  function openSpark(message: Message) {
    // Every Spark in this thread from the one tapped onward, oldest first. Mine
    // is not mine to look at, an opened one has nothing behind it any more, and
    // one whose bytes are gone has nothing to fetch. Anything above the tap is
    // left alone: opening a later Spark never spends an earlier one.
    const run = allMessages
      .filter(
        (row) =>
          isSparkMessage(row) &&
          !(user?.id ? row.sender?.id === user.id : row.mine) &&
          row.payload?.opened_at == null &&
          Boolean(row.asset?.content_url),
      )
      .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
    const start = run.findIndex((row) => row.id === message.id);
    setSparkView(start >= 0 ? run.slice(start) : [message]);
  }

  /**
   * Open a picture or a clip large, standing on the one that was tapped.
   *
   * The deck is every picture and clip in the convo, oldest first, so the
   * arrows walk forward in time — the same deck the app's own gallery opens.
   * A Spark is not in it: it is one look, and this is a place to look again.
   */
  function openMedia(row: Message) {
    const items = visibleMessages.filter(
      (message) =>
        !message.deleted_for_all &&
        (message.kind === "image" || message.kind === "video") &&
        !isSparkMessage(message) &&
        Boolean(message.asset?.content_url),
    );
    const at = items.findIndex((message) => message.id === row.id);
    setMediaView({ items, at: at < 0 ? 0 : at });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendDraft();
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setShowJump(false);
  }

  function refreshThread() {
    void threadQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
    void queryClient.invalidateQueries({ queryKey: ["vault"] });
    void queryClient.invalidateQueries({ queryKey: ["vault-rows"] });
  }

  useNames();

  const title = thread ? threadTitle(thread) : "Convo";
  const face = thread?.other ?? thread?.members?.[0]?.user;
  const rightOpen = sheetOpen || vibesOpen || infoOpen;

  function openOptions() {
    setInfoOpen(false);
    setVibesOpen(false);
    setSheetOpen(true);
  }

  // A call is placed on the server and relayed over the same socket this page
  // already holds; the media itself is peer to peer. Nothing here reports
  // success — the ring is only real once the server has answered it, and a
  // refusal (no convo, a gate, already on a call) is shown as it came.
  function startCall(kind: "audio" | "video") {
    const them = face?.id;
    if (!them) return;
    void callEngine.ring(them, kind).catch((error: unknown) => {
      toast({
        title: "That call did not go through.",
        description: errorMessage(error),
        tone: "error",
      });
    });
  }
  const typingNames = Object.values(typers);

  const canRingBack =
    Boolean(thread?.other?.username) && thread?.gate?.can_call === true;

  if (threadQuery.isLoading) {
    return (
      <div className="flex h-[calc(100dvh-57px)] items-center justify-center md:h-dvh">
        <Spinner className="size-7" />
      </div>
    );
  }
  if (threadQuery.isError || !thread) {
    return (
      <div className="mx-auto max-w-lg p-5">
        <div className="rounded-control border border-line bg-card">
          <ErrorState
            error={
              threadQuery.error ?? new Error("This convo is not available.")
            }
            onRetry={() => void threadQuery.refetch()}
          />
          <div className="flex justify-center pb-5">
            <Button variant="secondary" onClick={() => navigate("/app/convo")}>
              Back to Convo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative isolate flex h-[calc(100dvh-57px)] flex-col overflow-hidden bg-page md:h-dvh md:flex-row"
      style={
        {
          "--accent": "var(--convo-accent)",
          "--accent-soft":
            "color-mix(in srgb, var(--convo-accent) 12%, transparent)",
          "--accent-chip":
            "color-mix(in srgb, var(--convo-accent) 12%, var(--card))",
          "--accent-strong":
            "color-mix(in srgb, var(--convo-accent) 18%, var(--card))",
          "--accent-rgb": "var(--convo-accent-rgb)",
          ...(wallpaperSrc
            ? {
                backgroundImage: `url("${wallpaperSrc}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}),
          ...(convo && tinted
            ? {
                "--convo-accent": tinted,
                "--convo-accent-rgb": rgbChannels(tinted),
                "--convo-bubble-wash": convo.convoBubbleWash,
                "--convo-bubble-edge": convo.convoBubbleEdge,
                "--convo-bubble-run": convo.convoBubbleRun,
                "--convo-bubble-corner": convo.convoBubbleCorner,
                "--convo-out-ink": convo.convoOutInk,
                "--convo-out-dim": convo.convoOutDim,
                "--convo-in-wash": convo.convoInWash,
                "--convo-in-edge": convo.convoInEdge,
                "--convo-in-ink": convo.convoInInk,
                "--convo-in-dim": convo.convoInDim,
              }
            : {}),
        } as React.CSSProperties
      }
    >
      <Backdrop backdrop={themeWall} position="absolute" />
      {wallpaperSrc ? (
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundColor: "var(--page)",
            opacity: ownWall ? 1 - ownWall.opacity : opacity,
          }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 92% 36% at 50% 0%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 72%), radial-gradient(ellipse 84% 30% at 50% 100%, color-mix(in srgb, var(--accent) 4%, transparent), transparent 74%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "relative z-30 flex h-[56.5px] shrink-0 items-center gap-2.5 border-b border-[color-mix(in_srgb,var(--line)_78%,transparent)] px-3 md:px-5",
            bar,
          )}
        >
          {selecting ? (
            <PileHead
              picked={pile.length}
              all={allPicked}
              onClose={endSelect}
              onToggleAll={pickAll}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("/app/convo")}
                className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94] -ml-1 md:hidden"
                aria-label="Back to convos"
              >
                <ArrowLeft className="size-5" />
              </button>
              <Link
                to={face ? `/app/u/${face.username}` : "#"}
                className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5 pr-2 transition hover:opacity-90"
              >
                <span className="relative flex shrink-0">
                  <Avatar
                    user={face}
                    name={title}
                    src={thread.avatar}
                    size={38}
                  />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-[4px]">
                    <span className="truncate text-[16px] font-bold tracking-[-0.2px]">
                      {title}
                    </span>
                    {thread.kind !== "group" && face?.verified ? (
                      <BadgeCheck
                        className="size-5 shrink-0 fill-[#1D9BF0] text-white"
                        strokeWidth={2.5}
                        aria-label="Verified"
                      />
                    ) : null}
                    {thread.vaulted ? (
                      <Lock className="size-3 text-dim" aria-label="Vaulted" />
                    ) : null}
                  </span>
                  {thread.kind === "group" ? (
                    <span className="mt-0.5 flex items-center gap-1 text-[10.5px] font-medium leading-4 text-dim">
                      <Users className="size-3" aria-hidden />
                      {thread.member_count ?? thread.members?.length ?? 0}{" "}
                      members
                    </span>
                  ) : null}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-0.5">
                {thread.kind !== "group" ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94]"
                      onClick={() => startCall("audio")}
                      aria-label="Audio call"
                      title="Audio call"
                    >
                      <Phone className="size-[19px]" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94]"
                      onClick={() => startCall("video")}
                      aria-label="Video call"
                      title="Video call"
                    >
                      <Video className="size-[20px]" />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94]",
                    vibesOpen && "bg-[var(--accent-soft)] text-accent",
                  )}
                  onClick={() => {
                    setInfoOpen(false);
                    setSheetOpen(false);
                    setVibesOpen((open) => !open);
                  }}
                  aria-label={vibesOpen ? "Close Vibes" : "Open Vibes"}
                  aria-expanded={vibesOpen}
                  title="Vibes"
                >
                  <Clapperboard className="size-[19px]" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-transparent text-dim transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 hover:text-ink active:scale-[0.94]",
                    sheetOpen &&
                      !infoOpen &&
                      "bg-[var(--accent-soft)] text-accent",
                  )}
                  onClick={() => {
                    setInfoOpen(false);
                    setVibesOpen(false);
                    setSheetOpen((open) => !open);
                  }}
                  aria-label="Convo options"
                  aria-expanded={sheetOpen && !infoOpen}
                  title="Convo options"
                >
                  <MoreHorizontal className="size-[20px]" />
                </button>
              </div>
            </>
          )}
        </header>

        {thread.channels?.length ? (
          <div className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-[color-mix(in_srgb,var(--card)_70%,transparent)] px-3 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setChannel(null)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-extrabold transition",
                channel === null
                  ? "bg-accent text-on-accent shadow-[0_3px_9px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                  : "bg-[color-mix(in_srgb,var(--ink)_4.5%,transparent)] text-dim hover:text-ink",
              )}
            >
              All rooms
            </button>
            {thread.channels.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setChannel(room.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-extrabold transition",
                  channel === room.id
                    ? "bg-accent text-on-accent shadow-[0_3px_9px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                    : "bg-[color-mix(in_srgb,var(--ink)_4.5%,transparent)] text-dim hover:text-ink",
                )}
              >
                # {room.name}
              </button>
            ))}
          </div>
        ) : null}

        <div
          ref={scrollRef}
          className="[scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--dim)_30%,transparent)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-dim-26 min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3 md:px-4"
        >
          <div className="mx-auto max-w-[1040px]">
            {messages.isLoading ? (
              <div className="space-y-5 py-8" aria-hidden>
                {[0, 1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className={cn(
                      "flex",
                      row % 2 ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "relative overflow-hidden bg-line-58 after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-skeleton after:content-[''] rounded-[18px]",
                        row % 2
                          ? "h-11 w-44 rounded-br-[6px]"
                          : "h-14 w-64 rounded-bl-[6px]",
                      )}
                    />
                  </div>
                ))}
              </div>
            ) : messages.isError ? (
              <ErrorState
                error={messages.error}
                onRetry={() => void messages.refetch()}
                compact
              />
            ) : !visibleMessages.length ? (
              <div className="flex min-h-[42dvh] items-center justify-center">
                <div className="flex w-full max-w-[360px] flex-col items-center rounded-[24px] border border-line bg-card px-7 py-9 text-center shadow-[0_10px_30px_rgba(17,17,26,0.05)]">
                  <span className="flex size-14 items-center justify-center rounded-[20px] bg-[var(--accent-soft)] text-accent">
                    <MessageCircle className="size-6" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-extrabold tracking-tight">
                    No messages in this room
                  </h3>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-dim">
                    {thread.other
                      ? `Say the first thing to ${threadTitle(thread)}.`
                      : "The conversation starts here."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/*
                 * The strip: the top of every thread, and the one thing every
                 * convo says before it says anything else — the app's `_strip`
                 * in `screens/chat.dart`. It was drawn here only while
                 * disappearing messages were on, which left an ordinary chat
                 * with no word at all about what it is.
                 */}
                <div className="flex justify-center pb-3.5 pt-1.5">
                  <div
                    className={cn(
                      "inline-flex items-center gap-[5px] rounded-[20px] border bg-[color-mix(in_srgb,var(--card)_84%,transparent)] py-1.5 pl-[11px] pr-3 text-[10.5px] font-semibold backdrop-blur-md",
                      thread.vanish_mode && thread.vanish_mode !== "off"
                        ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-accent"
                        : "border-line text-dim",
                    )}
                  >
                    {thread.vanish_mode && thread.vanish_mode !== "off" ? (
                      <>
                        <Clock3 className="size-3" aria-hidden />
                        Disappearing convo ·{" "}
                        {vanishLabel(thread.vanish_mode, thread.vanish_days)}
                      </>
                    ) : (
                      <>
                        <Lock className="size-3" aria-hidden />
                        This convo is encrypted
                      </>
                    )}
                  </div>
                </div>
                {messages.isFetchingNextPage ? (
                  <div className="flex justify-center py-2">
                    <Spinner className="size-4" />
                  </div>
                ) : null}
                {visibleMessages.map((message, index) => {
                  // One line of a frame draws all of it; the rest of the frame is
                  // the same row of the thread and takes no height of its own.
                  const frame = frameAt(visibleMessages, index);
                  if (!frame) return null;
                  // The row is the whole frame, so what stands above it is the
                  // line above its oldest picture — not the one just before it in
                  // the list, which is drawn inside this same row.
                  const previous = visibleMessages[index - frame.length];
                  const showDay =
                    !previous ||
                    new Date(previous.created_at).toDateString() !==
                      new Date(message.created_at).toDateString();
                  const mineRow = user?.id
                    ? message.sender?.id === user.id
                    : Boolean(message.mine);
                  // Every line keeps the same step: who sent the last one, how
                  // long ago it was, and whether it was a note do not change the
                  // gap between two bubbles.
                  const distance = 2;
                  // A group names the speaker at the head of a run, never on each
                  // line of it — the same three breaks the spacing is drawn around.
                  const showSender =
                    !mineRow &&
                    thread.kind === "group" &&
                    (!previous ||
                      showDay ||
                      previous.sender?.id !== message.sender?.id ||
                      Math.abs(
                        new Date(message.created_at).getTime() -
                          new Date(previous.created_at).getTime(),
                      ) > 300_000);
                  const next = visibleMessages[index + 1];
                  // A back-and-forth is still one stretch of chat: the clock only
                  // returns when the conversation actually pauses, changes day,
                  // or hands over to a system note or a call.
                  const showStamp =
                    !next ||
                    new Date(next.created_at).toDateString() !==
                      new Date(message.created_at).toDateString() ||
                    next.kind === "system" ||
                    Boolean(callNote(next)) ||
                    Math.abs(
                      new Date(next.created_at).getTime() -
                        new Date(message.created_at).getTime(),
                    ) > 300_000;
                  return (
                    <div
                      key={message.id}
                      style={{ marginTop: showDay ? 0 : distance }}
                    >
                      {showDay ? (
                        <div className="flex justify-center pb-3 pt-2.5">
                          <span className="rounded-full border border-[color-mix(in_srgb,var(--line)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_84%,transparent)] px-3 py-1 text-[10.5px] font-semibold tracking-[0.18px] text-dim shadow-[0_1px_4px_rgba(17,17,26,0.04)] backdrop-blur-md">
                            {chatDay(message.created_at)}
                          </span>
                        </div>
                      ) : null}
                      <MessageBubble
                        message={message}
                        frame={frame}
                        burst={cache.arrivalOf(message)}
                        meId={user?.id}
                        showSender={showSender}
                        showStamp={showStamp}
                        group={thread.kind === "group"}
                        canCall={canRingBack}
                        receipt={
                          mineRow
                            ? receiptWord(message, thread, user?.id, receipts)
                            : ""
                        }
                        onReply={() => {
                          setReplyTo(message);
                          window.setTimeout(
                            () =>
                              document.getElementById("chat-input")?.focus(),
                            20,
                          );
                        }}
                        onReact={(emoji) => react(message, emoji)}
                        onOptions={() => setSelected(message)}
                        onOpenMedia={openMedia}
                        uploads={uploadPercent}
                        picking={selecting}
                        picked={selecting && picked.includes(pickKey(message))}
                        onPick={
                          selecting && !message.deleted_for_all
                            ? () => togglePick(message)
                            : undefined
                        }
                        onVote={(choice) => vote(message, choice)}
                        onOpenSpark={() => openSpark(message)}
                        onCallBack={startCall}
                        onRetry={
                          message.failed && message.client_id
                            ? () => retrySend(message.client_id!)
                            : undefined
                        }
                        progress={
                          message.client_id
                            ? uploadPercent[message.client_id]
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
                {/* The room the character keeps for itself. Held whether or not
                  somebody is writing — the phone's own `kPeekClear` — because
                  a list that lifted its newest line every time a figure came
                  up would be worse than the overlap it avoids. */}
                <div ref={bottomRef} style={{ height: PEEK_CLEAR }} />
              </>
            )}
          </div>
        </div>

        {showJump ? (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-28 right-4 z-20 flex size-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_18%,var(--line))] bg-card text-accent shadow-[0_6px_20px_rgba(17,17,26,0.12)] transition hover:-translate-y-0.5"
            aria-label="Jump to latest"
          >
            <ChevronDown className="size-4" />
          </button>
        ) : null}

        <div
          className={cn(
            // `isolate` is what keeps the character rising out of this seam
            // *behind* the box rather than over it — the phone paints the figure
            // under its own bar for the same reason, so the picture reads as
            // coming up out of the composer instead of sliding across the field.
            "relative isolate z-20 shrink-0 border-t border-line px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 md:px-5",
            bar,
          )}
        >
          {/* The character on the other side of this convo, standing up out of the
            seam — writing to me, or merely sitting on my convo doing nothing.
            Asked for 2026-11-12: *"jaise typing par charector typing indicator
            aa hai waise isme nahi aa raha hai"*, and then corrected in the same
            breath: *"usme typing aur wait 2 charector hai aur dono jaise work
            kar raha hai app me waise isme bhi karna chahiye"*. The words are gone
            from this box for the same reason the phone's went: the figure says
            it, and a reader who cannot see the figure is told in words by the
            peek.

            Their figure is read off `thread.other` and never off `face`: a group
            has no other, and the phone draws its bundled figure there rather
            than the first member's. Their gaze is a second fact about the same
            person, and it is exactly what the `wait` pose is for. */}
          {selecting ? null : (
            <TypingPeek
              character={thread?.other?.character}
              typing={typingNames.length > 0}
              gaze={chatterGaze}
              name={typingNames.join(", ") || face?.name || "Someone"}
              className="-z-10"
            />
          )}
          {selecting ? (
            <div className="py-1">
              <PileBar
                words={pileWords.length}
                shipped={pileShipped.length}
                onCopy={() => void copyPile()}
                onShare={() => setPileShareOpen(true)}
                onTrash={() => setPileAsk(true)}
              />
            </div>
          ) : (
            <div className="mx-auto min-w-[220px]">
              {replyTo ? (
                <div className="mb-1 flex items-center gap-2.5 rounded-lg border-l-4 border-[color-mix(in_srgb,var(--accent)_58%,var(--line))] bg-card px-2.5 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-accent">
                      <Reply className="size-4 shrink-0" />
                      <span className="truncate">
                        Replying to{" "}
                        {replyTo.sender.name || replyTo.sender.username}
                      </span>
                    </p>
                    <p className="truncate pl-5 text-[12px] text-dim">
                      {replyTo.body ||
                        replyTo.asset?.original_name ||
                        replyTo.kind}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="inline-flex flex-none items-center justify-center border border-transparent transition-[background-color,color,transform] duration-[160ms] hover:bg-ink-6 active:scale-[0.94] !size-7 !rounded-full text-dim hover:text-ink"
                    aria-label="Cancel reply"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              ) : null}
              {/* What the picker handed over, waiting for Send: pictures as the
              pictures they are, anything else by its own name and mark. */}
              {attachments.length ? (
                <div className="no-scrollbar mb-1.5 flex items-end gap-1.5 overflow-x-auto pb-1">
                  {attachments.map((file, at) => (
                    <div
                      key={`${file.file.name}-${at}`}
                      className="relative flex-none"
                    >
                      {file.preview && file.kind === "image" ? (
                        <img
                          src={file.preview}
                          alt={file.file.name}
                          className="size-[52px] rounded-[10px] border border-line object-cover"
                        />
                      ) : file.preview && file.kind === "video" ? (
                        <span className="relative block">
                          <video
                            src={file.preview}
                            className="size-[52px] rounded-[10px] border border-line object-cover"
                            muted
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[10px] bg-black/25 text-white">
                            <Play className="size-4 fill-current" />
                          </span>
                        </span>
                      ) : (
                        <span className="flex h-[52px] max-w-[132px] items-center gap-1.5 rounded-[10px] border border-line bg-card px-2">
                          <DocumentGlyph
                            mime={file.file.type}
                            name={file.file.name}
                            className="size-5 shrink-0 text-accent"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[10px] font-bold text-ink">
                              {file.file.name}
                            </span>
                            <span className="block text-[9px] text-dim">
                              {Math.max(1, Math.round(file.file.size / 1024))}{" "}
                              KB
                            </span>
                          </span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(at)}
                        className="absolute -right-1.5 -top-1.5 inline-flex size-[18px] items-center justify-center rounded-full border border-line bg-card text-dim shadow-sm transition hover:text-ink active:scale-90"
                        aria-label={`Remove ${file.file.name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {emojiOpen ? (
                <Suspense
                  // The emoji picker is a chunk of its own, and the box this holds
                  // for it while it arrives is the box it will be: the same rows,
                  // the same heights. It used to be a `h-[320px] w-[350px]`
                  // placeholder for a `340px`-wide, 363-pixel-tall panel, so the
                  // first look at the picker was a box that then changed size.
                  fallback={
                    <div
                      className={cn(
                        SHELF,
                        "absolute bottom-[61px] left-3 z-30",
                      )}
                    >
                      <div className={SHELF_SEARCH}>
                        <div className="h-8 w-full rounded-md border border-line bg-card" />
                      </div>
                      <div className={SHELF_TITLE} />
                      <div className={SHELF_GRID} />
                      <div className={SHELF_FOOTER} />
                    </div>
                  }
                >
                  <EmojiPicker
                    className="absolute bottom-[61px] left-3 z-30"
                    onPick={(char) => {
                      const next = `${text}${char}`;
                      setText(next);
                      writeDraft(threadId, next);
                    }}
                    onClose={() => setEmojiOpen(false)}
                  />
                </Suspense>
              ) : null}
              {stickerOpen ? (
                <StickerSheet
                  open={stickerOpen}
                  className="absolute bottom-[61px] left-3 z-30"
                  onClose={() => setStickerOpen(false)}
                  onPick={(sticker) => void sendSticker(sticker)}
                />
              ) : null}
              <form onSubmit={onSubmit} className="flex items-end gap-2">
                <input
                  ref={mediaInput}
                  type="file"
                  accept="image/*,video/mp4,video/quicktime,video/x-m4v"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    chooseFiles(files);
                  }}
                />
                <input
                  ref={fileInput}
                  type="file"
                  accept="audio/*,application/pdf,.doc,.docx,.txt"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    chooseFiles(files);
                  }}
                />
                <div className="flex min-h-[5px] flex-1 items-end gap-1 rounded-full border border-line bg-card p-1 shadow-[0_1px_2px_rgba(17,17,26,0.04)] transition focus-within:border-[color-mix(in_srgb,var(--accent)_38%,var(--line))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_9%,transparent)]">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full text-dim transition hover:bg-[var(--accent-soft)] hover:text-accent active:scale-95",
                        attachOpen && "bg-[var(--accent-soft)] text-accent",
                      )}
                      onClick={() => setAttachOpen((value) => !value)}
                      aria-label="Add attachment"
                      aria-expanded={attachOpen}
                    >
                      <Plus
                        className="size-[22px] font-bold"
                        strokeWidth={2.1}
                      />
                    </button>
                    {attachOpen ? (
                      <div className="absolute bottom-[46px] left-0 z-30 w-48 rounded-lg border border-line bg-card p-1.5 shadow-[0_6px_20px_rgba(17,17,26,0.18)]">
                        <AttachRow
                          icon={<ImageIcon className="size-4" />}
                          label="Photos and videos"
                          onClick={() => {
                            setAttachOpen(false);
                            mediaInput.current?.click();
                          }}
                        />
                        <AttachRow
                          icon={<FaFileLines className="size-4" />}
                          label="File"
                          onClick={() => {
                            setAttachOpen(false);
                            fileInput.current?.click();
                          }}
                        />
                        <AttachRow
                          icon={<MapPin className="size-4" />}
                          label="Send location"
                          onClick={() => {
                            setAttachOpen(false);
                            setLocationOpen(true);
                          }}
                        />
                        <AttachRow
                          icon={<Sparkles className="size-4" />}
                          label="Spark"
                          // A hover or a finger on the row is the beat before the tap,
                          // and that beat is enough to fetch the camera's chunk.
                          onMouseEnter={warmCamera}
                          onFocus={warmCamera}
                          onTouchStart={warmCamera}
                          onClick={() => {
                            setAttachOpen(false);
                            setCameraOpen(true);
                          }}
                        />
                        <AttachRow
                          icon={<Sticker className="size-4" />}
                          label="Sticker"
                          onClick={() => {
                            setAttachOpen(false);
                            setEmojiOpen(false);
                            setStickerOpen(true);
                          }}
                        />
                        <AttachRow
                          icon={<Smile className="size-4" />}
                          label="Emoji"
                          onClick={() => {
                            setAttachOpen(false);
                            setStickerOpen(false);
                            setEmojiOpen(true);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {voice.phase === "idle" ? (
                    <textarea
                      id="chat-input"
                      value={text}
                      onChange={(event) => {
                        setText(event.target.value);
                        writeDraft(threadId, event.target.value);
                        const element = event.currentTarget;
                        element.style.height = "auto";
                        element.style.height = `${Math.min(120, element.scrollHeight)}px`;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendDraft();
                        }
                      }}
                      rows={1}
                      maxLength={8000}
                      placeholder="Say something ...."
                      className="max-h-[120px] min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[15px] leading-5 text-ink outline-none placeholder:text-dim"
                    />
                  ) : (
                    // The recording takes the field's place rather than the
                    // composer's, so the mic stays exactly where it is while the
                    // note is being made.
                    <VoiceStrip
                      seconds={voice.seconds}
                      levels={voice.levels}
                      onDiscard={voice.discard}
                      onSend={voice.send}
                    />
                  )}
                </div>
                <button
                  type={
                    voice.phase === "idle" &&
                    (text.trim() || attachments.length)
                      ? "submit"
                      : "button"
                  }
                  onClick={() => {
                    if (voice.phase === "idle") {
                      if (micReady) voice.start();
                    } else {
                      voice.send();
                    }
                  }}
                  disabled={sending > 0 && !text.trim() && !attachments.length}
                  className={cn(
                    "flex size-11 shrink-0 select-none items-center justify-center rounded-full text-on-accent transition active:scale-95 disabled:opacity-40 disabled:shadow-none",
                    voice.phase === "idle"
                      ? "bg-accent shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
                      : "bg-[var(--bad)] shadow-[0_8px_20px_color-mix(in_srgb,var(--bad)_30%,transparent)] ring-4 ring-[color-mix(in_srgb,var(--bad)_16%,transparent)]",
                    !micReady && "hover:brightness-105",
                  )}
                  aria-label={
                    voice.phase !== "idle"
                      ? "Stop and send voice note"
                      : micReady
                        ? "Record a voice note"
                        : "Send message"
                  }
                >
                  {sending && voice.phase === "idle" ? (
                    <Spinner className="size-4 text-on-accent" />
                  ) : voice.phase !== "idle" ? (
                    <Square className="size-4 fill-current" />
                  ) : micReady ? (
                    <Mic className="size-6" />
                  ) : thread?.vanish_mode && thread.vanish_mode !== "off" ? (
                    <Clock3 className="size-[21px] fill-current" />
                  ) : (
                    <ArrowUp className="size-6" strokeWidth={2.6} />
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <aside
        className={cn(
          "absolute inset-0 z-40 flex h-full w-full flex-col overflow-hidden border-line bg-card transition-[transform,width,opacity] duration-300 ease-out motion-reduce:transition-none md:relative md:inset-auto md:z-auto md:h-auto md:shrink-0 md:border-l",
          rightOpen
            ? "translate-x-0 opacity-100 md:w-[340px]"
            : "pointer-events-none translate-x-full opacity-0 md:w-0 md:translate-x-0 md:border-l-0 md:opacity-100",
        )}
        aria-hidden={!rightOpen}
        aria-label={
          infoOpen ? "Convo details" : vibesOpen ? "Vibes" : "Convo options"
        }
      >
        <div className="flex h-full w-full shrink-0 flex-col md:w-[340px]">
          {infoOpen && thread.kind === "group" ? (
            <GroupPanel
              threadId={threadId}
              thread={thread}
              onClose={() => setInfoOpen(false)}
              onChanged={refreshThread}
              onGone={() => {
                void queryClient.invalidateQueries({ queryKey: ["threads"] });
                void queryClient.invalidateQueries({ queryKey: ["vault"] });
                void queryClient.invalidateQueries({
                  queryKey: ["vault-rows"],
                });
                navigate("/app/convo");
              }}
            />
          ) : infoOpen ? (
            <ThreadInfoPanel
              thread={thread}
              onClose={() => setInfoOpen(false)}
              onBack={openOptions}
              onOptions={openOptions}
            />
          ) : vibesOpen ? (
            <VibesPanel onClose={() => setVibesOpen(false)} />
          ) : (
            <ConvoSheet
              variant="panel"
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              thread={thread}
              kind="convo"
              onChanged={refreshThread}
              onSkin={skinLocal.apply}
              onGone={() => {
                void queryClient.invalidateQueries({ queryKey: ["threads"] });
                void queryClient.invalidateQueries({ queryKey: ["vault"] });
                void queryClient.invalidateQueries({
                  queryKey: ["vault-rows"],
                });
                navigate("/app/convo");
              }}
              onGroupSettings={() => {
                setSheetOpen(false);
                setVibesOpen(false);
                setInfoOpen(true);
              }}
              onMedia={() => {
                setSheetOpen(false);
                setMediaOpen(true);
              }}
            />
          )}
        </div>
      </aside>
      <MediaSheet
        threadId={threadId}
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
      />
      <SparkViewer
        looks={sparkView ?? []}
        threadId={threadId}
        onClose={() => setSparkView(null)}
        onSpent={(updated) => cache.insert(updated)}
        onReply={replyToSpark}
      />
      <Suspense
        // A lazy screen that draws `null` while it loads is a tap that appears
        // to have done nothing, and the chunk is the first half of what the
        // camera costs — this says the tap landed while the rest arrives.
        fallback={
          cameraOpen ? (
            <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 bg-black text-white">
              <Spinner className="size-7 text-white" />
              <p className="text-[13px] font-semibold text-white/70">
                Opening the camera…
              </p>
            </div>
          ) : null
        }
      >
        {cameraOpen ? (
          <CameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            fromChat={true}
            onPosted={() => {
              void queryClient.invalidateQueries({
                queryKey: ["messages", threadId],
              });
              void queryClient.invalidateQueries({ queryKey: ["threads"] });
            }}
          />
        ) : null}
      </Suspense>
      <LocationSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSend={(place) => void sendLocation(place)}
      />
      <MessageOptions
        message={selected}
        open={Boolean(selected)}
        group={thread.kind === "group"}
        thread={thread}
        onClose={() => setSelected(null)}
        onChanged={() => void messages.refetch()}
        onReact={(emoji) =>
          selected ? react(selected, emoji) : Promise.resolve()
        }
        onReply={() => {
          if (!selected) return;
          setReplyTo(selected);
          window.setTimeout(
            () => document.getElementById("chat-input")?.focus(),
            20,
          );
        }}
        onSelectMore={startSelect}
        onRetry={(message) => {
          if (message.client_id) retrySend(message.client_id);
        }}
        onDiscard={discardSend}
      />
      <ForwardSheet
        messages={pile}
        open={pileShareOpen}
        onClose={() => setPileShareOpen(false)}
        onSent={endSelect}
      />
      <PileAsk
        open={pileAsk}
        count={pileShipped.length}
        busy={pileBusy}
        onClose={() => setPileAsk(false)}
        onRemove={() => void trashPile()}
        onLeave={() => setPileAsk(false)}
      />
      {mediaView ? (
        <MediaViewer
          items={mediaView.items}
          at={mediaView.at}
          onAt={(next) =>
            setMediaView((current) =>
              current ? { ...current, at: next } : current,
            )
          }
          onClose={() => setMediaView(null)}
        />
      ) : null}
    </div>
  );
}
