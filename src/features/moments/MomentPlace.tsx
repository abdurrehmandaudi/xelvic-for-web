import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { MapPreview } from "@/features/convo/MapPreview";
import { cn } from "@/utils/cn";
import { searchPlaces } from "@/utils/place";
import type { MomentItem } from "@/types/api";

export interface PlacedItem extends MomentItem {
  place?: string | null;
}

export function placeOf(item: MomentItem): string {
  const place = (item as PlacedItem).place;
  return typeof place === "string" ? place.trim() : "";
}

interface Point {
  latitude: number;
  longitude: number;
}

const points = new Map<string, Point | null>();
const waiting = new Map<string, Promise<Point | null>>();

async function pointOf(name: string): Promise<Point | null> {
  const key = name.toLowerCase();
  if (points.has(key)) return points.get(key) ?? null;
  const inflight = waiting.get(key);
  if (inflight) return inflight;
  const controller = new AbortController();
  const ask = searchPlaces(name, controller.signal)
    .then((rows) => {
      const row = rows.find(
        (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
      );
      const point =
        row && Number.isFinite(row.latitude) && Number.isFinite(row.longitude)
          ? { latitude: Number(row.latitude), longitude: Number(row.longitude) }
          : null;
      points.set(key, point);
      return point;
    })
    .catch(() => {
      points.set(key, null);
      return null;
    })
    .finally(() => {
      waiting.delete(key);
    });
  waiting.set(key, ask);
  return ask;
}

export function openPlaceOnMaps(name: string) {
  const query = encodeURIComponent(name);
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noreferrer");
}

export function MomentPlaceLine({ place, className }: { place: string; className?: string }) {
  const [point, setPoint] = useState<Point | null>(() => points.get(place.toLowerCase()) ?? null);

  useEffect(() => {
    let live = true;
    if (!place) return;
    void pointOf(place).then((answer) => {
      if (live) setPoint(answer);
    });
    return () => {
      live = false;
    };
  }, [place]);

  if (!place) return null;

  return (
    <button
      type="button"
      onClick={() => openPlaceOnMaps(place)}
      className={cn(
        "pointer-events-auto flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-line bg-card py-1 pe-3 ps-1 text-left transition active:scale-[0.98]",
        className,
      )}
      aria-label={`${place}, open in maps`}
    >
      {point ? (
        <span className="relative block size-8 shrink-0 overflow-hidden rounded-full">
          <MapPreview latitude={point.latitude} longitude={point.longitude} zoom={15} className="size-full" />
        </span>
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
          <MapPin className="size-4" aria-hidden />
        </span>
      )}
      <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">{place}</span>
    </button>
  );
}

export default MomentPlaceLine;
