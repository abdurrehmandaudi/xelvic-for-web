import { useEffect, useRef, useState } from "react";
import { Check, LocateFixed, MapPin, Search, X } from "lucide-react";
import { Spinner } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import {
  myPlace,
  reversePlace,
  searchPlaces,
  type MyPlace,
  type PlaceChoice,
  type PlaceRefusal,
} from "@/utils/place";

const REFUSALS: Record<PlaceRefusal, string> = {
  denied:
    "This browser is not allowed to see where you are. Allow location for this site — the lock icon in the address bar, then Location → Allow — and turn the machine's own location services on too. A place can still be searched for above.",
  unavailable: "Where you are could not be worked out just now. A place can still be searched for above.",
  timeout: "Finding where you are took too long. A place can still be searched for above — or try again.",
  unsupported: "This browser cannot work out where it is. A place can still be searched for above.",
  insecure: "This page is not on https, and a browser only gives a position to a secure page. A place can still be searched for above.",
};

export function MomentPlaceSheet({
  open,
  onClose,
  current,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  current?: string | null;
  onPick: (name: string) => void;
}) {
  const [finding, setFinding] = useState(false);
  const [here, setHere] = useState<PlaceChoice | null>(null);
  const [refusal, setRefusal] = useState<PlaceRefusal | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setRefusal(null);
      setHere(null);
      setFinding(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const status = await navigator.permissions?.query({ name: "geolocation" });
        if (cancelled) return;
        if (status?.state === "denied") setRefusal("denied");
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  async function locate() {
    setFinding(true);
    setRefusal(null);
    const answer = await myPlace().catch(() => ({ ok: false, why: "unavailable" }) as MyPlace);
    if (!alive.current) return;
    if (answer.ok) {
      const named = await reversePlace(answer.fix.latitude, answer.fix.longitude).catch(
        () => answer.fix,
      );
      if (alive.current) setHere(named);
    } else {
      setRefusal(answer.why);
    }
    setFinding(false);
  }

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
          if (alive.current) setResults(rows);
        })
        .catch(() => {
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

  function pick(name: string) {
    onPick(name.trim());
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Place"
      description="Where this was put up from."
      size="md"
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

        {current ? (
          <button
            type="button"
            onClick={() => pick(current)}
            aria-pressed
            className="flex w-full items-center gap-3 rounded-[14px] border border-accent bg-[var(--accent-soft)] px-2.5 py-2.5 text-left"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <MapPin className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-ink">{current}</span>
              <span className="block truncate text-[11px] text-dim">On this moment now</span>
            </span>
            <Check className="size-4 shrink-0 text-accent" aria-hidden />
          </button>
        ) : null}

        {finding ? (
          <p className="flex items-center gap-2.5 px-1 py-2 text-[13px] font-semibold text-dim">
            <Spinner className="size-4" />
            Finding where you are...
          </p>
        ) : null}

        {!finding && refusal ? (
          <div className="flex items-start gap-2 rounded-[12px] bg-surface-2 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[12px] leading-5 text-dim">{REFUSALS[refusal]}</p>
            <button
              type="button"
              onClick={() => setAttempt((count) => count + 1)}
              className="shrink-0 rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-bold text-ink transition hover:border-[color-mix(in_srgb,var(--accent)_50%,var(--line))]"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!finding && here ? (
          <PlaceRow place={here} onChoose={() => pick(here.label)} />
        ) : null}

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
              <span className="block text-[13px] font-bold text-ink">Use my current location</span>
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
                onChoose={() => pick(place.label)}
              />
            ))
          : null}

        {!searching && query.trim().length >= 2 && results.length === 0 ? (
          <p className="px-1 py-2 text-[13px] text-dim">{`Nothing by "${query.trim()}"`}</p>
        ) : null}
      </div>
    </Modal>
  );
}

function PlaceRow({ place, onChoose }: { place: PlaceChoice; onChoose: () => void }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] border border-transparent px-2.5 py-2.5 text-left transition",
        "hover:bg-surface-2",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
        <MapPin className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-ink">{place.label}</span>
        {place.detail ? <span className="block truncate text-[11px] text-dim">{place.detail}</span> : null}
      </span>
    </button>
  );
}

export default MomentPlaceSheet;
