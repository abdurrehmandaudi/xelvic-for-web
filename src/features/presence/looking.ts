/**
 * What somebody is looking at, when what they are looking at is me.
 *
 * Ported from `lib/looking.dart`. Presence answers "are they there"; this
 * answers "are they on my convo, or on my profile" — which is the difference
 * between a green dot and knowing that the person you are waiting on has your
 * chat open and is doing nothing with it. On the phone that second fact is what
 * stands the **second** character up over the composer: `wait`, the pose for
 * somebody who is merely *there*, against `typing` for somebody who is writing.
 * The owner asked for exactly that pair on 2026-11-12: *"usme typing aur wait 2
 * charector hai aur dono jaise work kar raha hai app me waise isme bhi karna
 * chahiye"*.
 *
 * This file is the rules and nothing else — what a frame means, when a fact has
 * gone stale, and the three frames this side says. The React wiring that owns
 * the clocks and the socket is `providers/LookingProvider.tsx`, and the reason
 * for the split is the same reason the phone splits them: these are the parts
 * worth testing without a browser.
 *
 * **It is deliberately narrow.** The server only ever carries this between
 * people who already have a direct convo, and only ever about somebody looking
 * at *you* — so there is nothing here to read about a third party, and nothing
 * to read about a stranger. See `services.focus_of` in the backend, which is
 * where that rule is enforced; this side only has to not pretend otherwise.
 *
 * **It expires.** The server forgets what somebody was looking at thirty
 * seconds after they stop saying it (`FOCUS_TTL_SECONDS`), and a person who
 * closes the app mid-scroll — or has it taken away from them by the system —
 * says nothing on the way out. So a screen showing this keeps asking, exactly
 * as it does for presence; and a gaze that stops being renewed goes away here
 * as well ([staleGazes]), because a socket can go quiet from either end.
 */

/** Which of my two places they are on. The app's `enum Look`. */
export type Look = "chat" | "profile";

/** One person's gaze, as it arrived. The app's `Gaze`. */
export interface Gaze {
  look: Look;
  /**
   * When this arrived, in `Date.now()` milliseconds.
   *
   * Not used to expire anything on its own — the server stops sending, and a
   * frame saying they left is what ends it — but it is the difference between a
   * fact and a fact from ten minutes ago. See [staleGazes].
   */
  at: number;
}

/**
 * How long a told fact is believed without a fresh frame. The app's
 * `Looking.stale`.
 *
 * Twice [GAZE_RECHECK_MS], and that ratio is the whole of why a real gaze is
 * never blinked away: every poll that still finds somebody renews them, so
 * their clock is never more than one interval old and it takes two missed polls
 * in a row to reach this. It is also comfortably inside the server's own
 * `FOCUS_TTL_SECONDS`, which is thirty.
 *
 * The server says its own thirty in the `ready` frame as `focus_ttl`, and the
 * phone reads it no more than this file does — the number is a constant on both
 * sides on purpose, because a net at exactly the server's TTL would drop a
 * character between two polls that were both on time.
 */
export const GAZE_STALE_MS = 30_000;

/** How often a watched person is asked about. The app's `Looking.recheck`. */
export const GAZE_RECHECK_MS = 15_000;

/**
 * How often my own word is repeated. The app's `Looking.refresh`.
 *
 * Half the server's TTL, so one dropped frame is not enough to make somebody
 * disappear from the other person's screen.
 */
export const GAZE_REFRESH_MS = 15_000;

/**
 * The kind in a `focus` frame, as one of my two places or nothing.
 *
 * `none` is the server saying they are not looking at anything of mine — either
 * because they said so on the way out, or because their entry lapsed and
 * `services.focus_of` answered for them. A kind this build does not know is
 * nothing as well, which is what the phone's `_look` does with it: a newer
 * server naming a third place must leave this screen quiet rather than invent a
 * character for it.
 */
export function lookOf(kind: unknown): Look | null {
  return kind === "chat" || kind === "profile" ? kind : null;
}

/** The gaze in one `focus` frame's `data`, or nothing when there is none. */
export function gazeFrom(data: unknown, at: number): Gaze | null {
  if (!data || typeof data !== "object") return null;
  const look = lookOf((data as Record<string, unknown>).kind);
  return look ? { look, at } : null;
}

/**
 * Whether two gazes are the same fact.
 *
 * Only the place is compared: the same gaze arriving again is a refresh of
 * something already on screen, and it happens every fifteen seconds. It is
 * still a refresh in the other sense — the clock on it restarts — and that is
 * the whole of how a gaze in progress is told apart from one that has stopped.
 */
export function sameLook(a: Gaze, b: Gaze): boolean {
  return a.look === b.look;
}

/**
 * The ids whose gaze has gone quiet for longer than [stale].
 *
 * [`Looking._sweep`]'s half of "it expires", and the half that catches the
 * silence coming from *this* side — a wedged socket, a server that is not
 * answering — where no frame is coming to say anything either way. Run on every
 * ask, before it goes out, rather than on a timer of its own: asking is what
 * produces the renewals this reads, so the two are the same beat.
 */
export function staleGazes(
  seen: Map<string, Gaze>,
  now: number,
  stale: number = GAZE_STALE_MS,
): string[] {
  const gone: string[] = [];
  for (const [who, gaze] of seen) {
    if (now - gaze.at >= stale) gone.push(who);
  }
  return gone;
}

// ---------------------------------------------------------------------------
// The three frames this side says
// ---------------------------------------------------------------------------

/**
 * Where I am. `{action: "focus", user, kind, phase}`.
 *
 * `phase` is the phone's own word and it is always `idle`: the backend knows
 * `moving` and a `direction` as well, and nothing in the app has ever sent
 * either — the character over a composer is a fact about a screen being open,
 * not about a finger moving on it. Sent unchanged so that the two clients say
 * the same sentence.
 */
export function focusSayFrame(user: string, look: Look): Record<string, unknown> {
  return { action: "focus", user, kind: look, phase: "idle" };
}

/**
 * Who I want to know about. `{action: "focus", users: [...]}`.
 *
 * The backend tells these apart by the key and not by a flag — `"users" in
 * content` is the ask — so an ask that carried no list would be read as a
 * statement instead. See `ChatConsumer.receive_json`.
 */
export function focusAskFrame(users: string[]): Record<string, unknown> {
  return { action: "focus", users };
}

/**
 * I am not looking at anything of anybody's any more.
 *
 * Said without a target, which is the phone's own choice and the server's own
 * shape: the entry is one per person, so "none" is not about a place.
 */
export function focusLeaveFrame(): Record<string, unknown> {
  return { action: "focus", kind: "none" };
}
