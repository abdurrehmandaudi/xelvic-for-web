import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { MapPreview } from "@/features/convo/MapPreview";
import { cn } from "@/utils/cn";
import {
  myPlace,
  searchPlaces,
  type MyPlace,
  type PlaceChoice,
  type PlaceRefusal,
} from "@/utils/place";

/** A place this sheet is willing to send: one with a position on it. */
export interface SharablePlace extends PlaceChoice {
  latitude: number;
  longitude: number;
  /** The browser's own confidence in the fix, when it was the browser's. */
  accuracy?: number | null;
}

/**
 * A place that can actually be sent, or null.
 *
 * The sheet only ever offers rows that carry a position, and this is the one
 * place that decides it — a name with no numbers on it cannot be a location,
 * because there would be nothing to put on the map. The camera's place tool
 * allows one (it is a caption on a picture, and a caption is allowed to be
 * words); this is not, and saying so here rather than at the send is what keeps
 * the Send button from ever being pressed on something that cannot travel.
 */
function sharable(choice: PlaceChoice): SharablePlace | null {
  const latitude = Number(choice.latitude);
  const longitude = Number(choice.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { ...choice, latitude, longitude };
}

const REFUSALS: Record<PlaceRefusal, string> = {
  denied:
    "This browser is not allowed to see where you are. Allow location for this site — the lock icon in the address bar, then Location → Allow — and if the machine's own location services are off (Windows: Settings → Privacy & security → Location), turn those on too. Then try again. A place can still be searched for above.",
  unavailable:
    "Where you are could not be worked out just now. A place can still be searched for above.",
  timeout:
    "Finding where you are took too long. A place can still be searched for above — or try again.",
  unsupported:
    "This browser cannot work out where it is. A place can still be searched for above.",
  insecure:
    "This page is not on https, and a browser only gives a position to a secure page. A place can still be searched for above.",
};

/**
 * How much the fix is worth, said plainly.
 *
 * The app's own rule, from `place_probe.dart`: tens of metres is a fix,
 * kilometres is a guess wearing a city's name. The owner reported exactly that
 * on 2026-10-15 — *"mumbai se lucknow aa jau, abhi bhi mumbai aa raha"* — so a
 * guess is drawn as a guess rather than hidden behind a confident-looking
 * street name.
 */
function worthOf(accuracy: number | null | undefined): string {
  if (accuracy == null) return "This browser's position";
  if (accuracy <= 150) return `Accurate to about ${Math.round(accuracy)} m`;
  if (accuracy <= 1000) return `Within about ${Math.round(accuracy)} m`;
  return `Approximate — could be ${Math.round(accuracy / 1000)} km off`;
}

/**
 * Share where you are, or where something else is.
 *
 * Both halves, for the reason the app's own place picker has both: the browser
 * says where it thinks it is, and the search box is where somebody says *no* —
 * the hotel they are sitting in, the street the party is on, the city they are
 * actually in while a connection-placed fix insists on another one. The owner
 * asked for the second half in as many words, and a location that could only
 * ever be "where the browser thinks it is" would be wrong in exactly the case
 * they reported.
 *
 * Nothing here is sent by itself. A row is a choice and the Send button under it
 * is the act, because a position is not something to put in a convo by
 * mis-tapping a list.
 */
export function LocationSheet({
  open,
  onClose,
  onSend,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (place: SharablePlace) => void;
  /** A send in flight, so the button says so rather than looking absent. */
  busy?: boolean;
}) {
  const [finding, setFinding] = useState(false);
  const [here, setHere] = useState<SharablePlace | null>(null);
  const [refusal, setRefusal] = useState<PlaceRefusal | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SharablePlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<SharablePlace | null>(null);
  /** Bumped by "Try again", so the ask below runs once more. */
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  /**
   * Whether this page is running inside somebody else's frame — an editor's
   * preview, an embedded view. A frame is not allowed to ask the browser for a
   * position unless the page around it says so, and the refusal that comes back
   * is the same one a blocked site gets, which sends a person looking in the
   * wrong place.
   */
  const framed =
    typeof window !== "undefined" && window.self !== window.top;
  /** Windows keeps its own location switch, and a browser cannot reach past it. */
  const windows =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
  /** The address whose permission has to be allowed, named so it can be found. */
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Ask for a fix.
   *
   * Always reached from a tap — the row this sheet draws, or the retry beside a
   * refusal — because a position is a permission, and a browser that gates the
   * prompt on a gesture of the person's own would refuse this one silently if
   * it were asked from an effect. That silent refusal is exactly what "this
   * browser is not allowed to see where you are" looked like with nothing
   * having been asked.
   */
  const locate = useCallback(async () => {
    setFinding(true);
    setRefusal(null);
    const answer = await myPlace()
      .catch(() => ({ ok: false, why: "unavailable" }) as MyPlace);
    if (!alive.current) return;
    if (answer.ok) {
      const place = sharable(answer.fix);
      if (place) setHere({ ...place, accuracy: answer.fix.accuracy });
    } else {
      setRefusal(answer.why);
    }
    setFinding(false);
  }, []);

  // A fresh sheet every time it opens: what was chosen for the last message is
  // not a default for this one, and a position from a minute ago is exactly the
  // stale fix the app's own picker refuses to trust.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setChosen(null);
      setRefusal(null);
      setHere(null);
      setFinding(false);
      return;
    }
    let cancelled = false;
    setRefusal(null);
    setHere(null);
    // Only a permission already granted is asked without a tap. Anything else
    // opens on the button below: the sheet asks when it is tapped, which is the
    // gesture the prompt needs, and is the same shape as the phone's picker.
    void (async () => {
      try {
        const status = await navigator.permissions?.query({
          name: "geolocation",
        });
        if (cancelled) return;
        // A grant is asked about by itself; a refusal is drawn as the refusal,
        // because no tap can turn it into a prompt. Only the undecided state
        // waits for the tap that raises the prompt.
        if (status?.state === "granted") await locate();
        else if (status?.state === "denied") setRefusal("denied");
      } catch {
        // A browser without the Permissions API answers null, and the button
        // below is then the only way in — which is a working way in.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, attempt, locate]);

  // The search is the browser's keystrokes and not a request each: a query is
  // asked for once it has stopped moving, and the one before it is abandoned.
  // Nominatim rate-limits by caller, and a lookup per letter is how a search box
  // gets an app blocked.
  useEffect(() => {
    const text = query.trim();
    if (!open || text.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchPlaces(text, controller.signal)
        .then((rows) => {
          const places = rows
            .map(sharable)
            .filter((place): place is SharablePlace => place !== null);
          if (alive.current) setResults(places);
        })
        .catch(() => {
          // A search that could not be answered is drawn as nothing found, which
          // is also what a genuinely empty answer draws. The two are not worth
          // telling apart in front of somebody typing the name of their hotel.
          if (alive.current) setResults([]);
        })
        .finally(() => {
          if (alive.current) setSearching(false);
        });
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  // One button in both states rather than two shapes, so the act is always in
  // the same place under the same finger. It says what is missing rather than
  // being absent, which is the difference between a sheet that is waiting and a
  // sheet that has stopped working.
  /** The place the map should be standing on: what was chosen, or where I am. */
  const preview = chosen ?? here;

  const button = (
    <Button
      type="button"
      full
      loading={Boolean(busy) && Boolean(chosen)}
      disabled={!chosen || busy}
      icon={<MapPin className="size-4" />}
      onClick={() => {
        if (chosen) onSend(chosen);
      }}
    >
      {chosen ? "Send this location" : "Pick a place to send"}
    </Button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share a location"
      description="Where you are, or a place you look up."
      size="md"
      footer={button}
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 rounded-[14px] border border-line bg-paper px-3">
          <Search className="size-4 shrink-0 text-dim" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a hotel, a street, a city..."
            aria-label="Search for a place"
            className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-dim"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex size-7 items-center justify-center rounded-full text-dim transition hover:text-ink"
              aria-label="Clear the search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {/* The place in hand, on the ground: a name is what is sent, but the
            picture is what makes it the right place to send. It follows the
            choice — the browser's own fix until a row is picked, that row's
            pin after. */}
        {preview ? (
          <div className="overflow-hidden rounded-[14px] border border-line bg-paper">
            <MapPreview
              latitude={preview.latitude}
              longitude={preview.longitude}
              className="h-[150px] w-full"
            />
          </div>
        ) : null}

        {finding ? (
          <p className="flex items-center gap-2.5 px-1 py-2 text-[13px] font-semibold text-dim">
            <Spinner className="size-4" />
            Finding where you are...
          </p>
        ) : null}

        {!finding && refusal ? (
          <div className="rounded-[12px] bg-surface-2 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[12px] leading-5 text-dim">
                {refusal === "denied" && framed ? (
                  "This page is running inside a frame — an editor's preview or an embedded view — and a frame is not allowed to ask the browser for a location. Open the app in a normal browser tab and it will."
                ) : refusal === "denied" ? (
                  <>
                    Location is blocked for{" "}
                    <span className="font-semibold text-ink">{origin}</span>.
                    Open the icon at the left of the address bar → Location →
                    Allow, then press Try again.
                    {windows
                      ? " If Windows also has location switched off, the browser cannot get a fix even once the site is allowed."
                      : null}
                  </>
                ) : (
                  REFUSALS[refusal]
                )}
              </p>
              {/* Asking again is worth a row only where the answer can change:
                  a permission granted in the address bar, a fix that timed out.
                  A plain page and a browser with no position in it will not. */}
              {refusal !== "insecure" && refusal !== "unsupported" ? (
                <button
                  type="button"
                  onClick={() => setAttempt((count) => count + 1)}
                  className="shrink-0 rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-bold text-ink transition hover:border-[color-mix(in_srgb,var(--accent)_50%,var(--line))]"
                >
                  Try again
                </button>
              ) : null}
            </div>
            {/* The other half of the same refusal, and the harder one to find:
                a browser cannot ask the machine where it is when the machine
                has location turned off. This opens that switch on Windows. */}
            {windows && (refusal === "denied" || refusal === "unavailable") ? (
              <a
                href="ms-settings:privacy-location"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-bold text-ink transition hover:border-[color-mix(in_srgb,var(--accent)_50%,var(--line))]"
              >
                <LocateFixed className="size-3.5" />
                Open Windows location settings
              </a>
            ) : null}
          </div>
        ) : null}

        {!finding && here ? (
          <PlaceRow
            place={here}
            note={worthOf(here.accuracy)}
            selected={chosen?.label === here.label}
            onChoose={() => setChosen(here)}
          />
        ) : null}

        {/* The tap that asks. A position is a permission, and some browsers
            only raise the prompt for a gesture of the person's own — so the
            sheet opens on this row rather than asking from an effect and being
            refused without a prompt ever appearing. */}
        {!finding && !refusal && !here ? (
          <button
            type="button"
            onClick={() => void locate()}
            className="flex w-full items-center gap-3 rounded-[14px] border border-line px-2.5 py-2.5 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
              <LocateFixed className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-ink">
                Use my current location
              </span>
              <span className="block text-[11px] text-dim">
                The browser will ask before it says where you are.
              </span>
            </span>
          </button>
        ) : null}

        {searching ? (
          <p className="flex items-center gap-2.5 px-1 py-2 text-[12px] font-semibold text-dim">
            <Spinner className="size-4" />
            Searching places...
          </p>
        ) : null}

        {!searching && results.length
          ? results.map((place) => (
              <PlaceRow
                key={`${place.latitude},${place.longitude},${place.label}`}
                place={place}
                note={place.detail}
                selected={chosen?.label === place.label}
                onChoose={() => setChosen(place)}
              />
            ))
          : null}

        {!searching && query.trim().length >= 2 && results.length === 0 ? (
          <p className="px-1 py-2 text-[13px] text-dim">
            {`Nothing by "${query.trim()}"`}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** One place in the list: a row that chooses, and says that it is chosen. */
function PlaceRow({
  place,
  note,
  selected,
  onChoose,
}: {
  place: SharablePlace;
  note?: string;
  selected: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] border px-2.5 py-2.5 text-left transition",
        selected
          ? "border-accent bg-[var(--accent-soft)]"
          : "border-transparent hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          selected
            ? "bg-accent text-on-accent"
            : "bg-[var(--accent-soft)] text-accent",
        )}
      >
        <MapPin className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-ink">
          {place.label}
        </span>
        {note ? (
          <span className="block truncate text-[11px] text-dim">{note}</span>
        ) : null}
      </span>
    </button>
  );
}

export default LocationSheet;
