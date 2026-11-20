import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { LookingContext } from "@/context/looking";
import {
  focusAskFrame,
  focusLeaveFrame,
  focusSayFrame,
  GAZE_RECHECK_MS,
  GAZE_REFRESH_MS,
  gazeFrom,
  sameLook,
  staleGazes,
  type Gaze,
  type Look,
} from "@/features/presence/looking";
import { useAuth } from "@/hooks/useAuth";
import { useSocket, useSocketEvent } from "@/hooks/useSocket";

export interface LookingContextValue {
  /** What [userId] is looking at, if it is something of mine. */
  gazeOf: (userId: string | null | undefined) => Gaze | null;
  /** Somebody's gaze is on screen from now until [unwatch]. */
  watch: (userId: string) => void;
  unwatch: (userId: string) => void;
  /** Tell the server that I am on [userId]'s convo or profile. */
  say: (userId: string, look: Look) => void;
  /** I am not looking at anything of anybody's any more. */
  leave: (userId?: string) => void;
  /**
   * Grown by one every time the answer changes. Nobody reads it.
   *
   * It is here because the gaze map is a ref rather than state — a gaze
   * refreshed every fifteen seconds must not repaint anything, and only a
   * *change* of place is news — so this is what makes the context object a new
   * one when there is something new to draw. It is the web's half of the
   * phone's `notifyListeners`, in a client where the drawing is an object
   * identity rather than a subscription.
   */
  version: number;
}

/**
 * Who is looking, and where I am.
 *
 * Ported from `lib/looking.dart`, which is a singleton `ChangeNotifier` the
 * phone reaches from anywhere. Here it is a provider for the same reason
 * `SocketProvider` is one: the rules live in `features/presence/looking.ts` and
 * this is the clocks and the frames around them.
 *
 * Two directions, and they are two halves of one conversation. [watch] and
 * [ask] are me finding out where somebody else is, which is what stands their
 * `wait` character up over my composer while they sit on my convo doing nothing.
 * [say] is me telling the server where *I* am, which is what stands my figure up
 * on their screen. Both expire on the server, so both are repeated on a timer:
 * a person sitting still is the case most worth telling.
 *
 * **This is not presence.** The green dot is a REST field on a card
 * (`UserCard.online`), and the phone's separate `Presence` store — which
 * re-asks the server who is online — is not ported here. What is ported is the
 * half the character over the composer needs.
 *
 * Frames go out only while something is watching or while I have said where I
 * am, so a tab that is reading the feed says nothing at all.
 */
export function LookingProvider({ children }: { children: ReactNode }) {
  const { send } = useSocket();
  const { status: authStatus } = useAuth();

  /** What each partner is looking at. A ref: only a change of place is news. */
  const seen = useRef(new Map<string, Gaze>());
  /** Who I am watching, and how many screens are asking. */
  const watched = useRef(new Map<string, number>());
  /** What I last told the server I was looking at, so the same thing twice costs nothing. */
  const mine = useRef<{ user: string; look: Look } | null>(null);
  const askTimer = useRef<number | null>(null);
  const keepTimer = useRef<number | null>(null);
  const [version, drawn] = useReducer((count: number) => count + 1, 0);

  /**
   * Drop anybody whose gaze has gone quiet for longer than the window.
   *
   * Run on every ask, before it goes out, rather than on a timer of its own:
   * asking is what produces the renewals this reads, so the two are the same
   * beat, and a second timer would be one more thing to cancel below.
   */
  const sweep = useCallback(() => {
    const gone = staleGazes(seen.current, Date.now());
    if (!gone.length) return;
    for (const who of gone) seen.current.delete(who);
    drawn();
  }, []);

  /** Ask about everybody I am watching. The answer arrives as `focus` frames. */
  const ask = useCallback(() => {
    if (watched.current.size === 0) return;
    sweep();
    send(focusAskFrame([...watched.current.keys()]));
  }, [send, sweep]);

  /** Say where I am again, because a fact like this expires. */
  const resend = useCallback(() => {
    const held = mine.current;
    if (!held) return;
    send(focusSayFrame(held.user, held.look));
  }, [send]);

  const watch = useCallback(
    (userId: string) => {
      if (!userId) return;
      watched.current.set(userId, (watched.current.get(userId) ?? 0) + 1);
      ask();
      askTimer.current ??= window.setInterval(ask, GAZE_RECHECK_MS);
    },
    [ask],
  );

  const unwatch = useCallback((userId: string) => {
    const left = (watched.current.get(userId) ?? 0) - 1;
    if (left > 0) watched.current.set(userId, left);
    else watched.current.delete(userId);
    if (watched.current.size === 0 && askTimer.current !== null) {
      window.clearInterval(askTimer.current);
      askTimer.current = null;
    }
  }, []);

  const say = useCallback(
    (userId: string, look: Look) => {
      if (!userId) return;
      const held = mine.current;
      const changed = held?.user !== userId || held?.look !== look;
      mine.current = { user: userId, look };
      if (changed) send(focusSayFrame(userId, look));
      keepTimer.current ??= window.setInterval(resend, GAZE_REFRESH_MS);
    },
    [send, resend],
  );

  /**
   * I am not looking at anything of anybody's any more.
   *
   * [userId] is the person whose screen is going away, and passing it matters.
   * A screen is disposed *after* the one replacing it has been built, so a convo
   * that is closing can be heard from after the convo that replaced it has
   * already said where it is. Without the name, closing one chat would take the
   * next one's word off the server with it, and the person the next one is about
   * would be told nothing at all — which is a character that never appears, in a
   * convo that is open and sitting right there.
   */
  const leave = useCallback(
    (userId?: string) => {
      const held = mine.current;
      if (!held) return;
      if (userId != null && held.user !== userId) return;
      if (keepTimer.current !== null) {
        window.clearInterval(keepTimer.current);
        keepTimer.current = null;
      }
      mine.current = null;
      send(focusLeaveFrame());
    },
    [send],
  );

  /**
   * Signing out, and the tab closing. What anybody was looking at was looked at
   * for somebody else, and nothing is said on the way out: the socket is going
   * with it, and the server's own TTL is the net for a word never taken back.
   */
  const forget = useCallback(() => {
    seen.current.clear();
    watched.current.clear();
    mine.current = null;
    if (askTimer.current !== null) {
      window.clearInterval(askTimer.current);
      askTimer.current = null;
    }
    if (keepTimer.current !== null) {
      window.clearInterval(keepTimer.current);
      keepTimer.current = null;
    }
    drawn();
  }, []);

  useSocketEvent(["focus", "ready"], (frame) => {
    if (frame.event === "ready") {
      // A reconnect missed whatever was said while the socket was down, and the
      // server has forgotten what we said too — so both halves are said again.
      ask();
      resend();
      return;
    }
    const data = (frame.data ?? {}) as Record<string, unknown>;
    const who = String(data.user_id ?? "");
    if (!who) return;
    const gaze = gazeFrom(data, Date.now());
    if (!gaze) {
      // Not on anything of mine any more — either they said so, or their entry
      // lapsed and the server answered `none` for them. Nothing to draw and
      // nothing to remember.
      if (!seen.current.has(who)) return;
      seen.current.delete(who);
      drawn();
      return;
    }
    const was = seen.current.get(who);
    if (was && sameLook(was, gaze)) {
      // The same gaze arriving again is a refresh of something already on
      // screen, and it happens every fifteen seconds. The clock on it restarts
      // — which is the whole of how a gaze in progress is told apart from one
      // that has stopped — but there is nothing here worth a repaint.
      seen.current.set(who, gaze);
      return;
    }
    seen.current.set(who, gaze);
    drawn();
  });

  useEffect(() => {
    if (authStatus === "authenticated") return;
    forget();
  }, [authStatus, forget]);

  useEffect(() => () => forget(), [forget]);

  const gazeOf = useCallback(
    (userId: string | null | undefined) =>
      userId ? seen.current.get(userId) ?? null : null,
    [],
  );

  const value = useMemo(
    () => ({ gazeOf, watch, unwatch, say, leave, version }),
    [gazeOf, watch, unwatch, say, leave, version],
  );

  return <LookingContext.Provider value={value}>{children}</LookingContext.Provider>;
}

export default LookingProvider;
