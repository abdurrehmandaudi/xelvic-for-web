import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/utils/cn";

const TILE = 256;

interface Tile {
  key: string;
  url: string;
  left: number;
  top: number;
}

/**
 * The ordinary squares of the map that cover a box this size, laid out so the
 * point is in the middle of it.
 *
 * The projection is the web's own (a Mercator square, `z` deep), which is the
 * one the tiles are drawn in — anything else would put the pin a street or two
 * from the place it names.
 */
function tilesFor(
  latitude: number,
  longitude: number,
  zoom: number,
  width: number,
  height: number,
): Tile[] {
  const deep = 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const rad = (lat * Math.PI) / 180;
  const x = ((longitude + 180) / 360) * deep;
  const y =
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * deep;

  const left = x * TILE - width / 2;
  const top = y * TILE - height / 2;
  const firstX = Math.floor(left / TILE);
  const lastX = Math.floor((left + width) / TILE);
  const firstY = Math.floor(top / TILE);
  const lastY = Math.floor((top + height) / TILE);

  const tiles: Tile[] = [];
  for (let row = firstY; row <= lastY; row += 1) {
    if (row < 0 || row >= deep) continue;
    for (let column = firstX; column <= lastX; column += 1) {
      // The world wraps east–west, so a map near the date line continues on
      // the other side rather than showing a blank edge.
      const wrapped = ((column % deep) + deep) % deep;
      tiles.push({
        key: `${zoom}/${column}/${row}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${row}.png`,
        left: column * TILE - left,
        top: row * TILE - top,
      });
    }
  }
  return tiles;
}

/**
 * A still of a place, made of the map's own squares.
 *
 * Squares rather than the map's embed page: the embed arrives with its own zoom
 * buttons and its own block of credits and terms sitting over the picture, and
 * a location card in a conversation has no room for a page inside it. The
 * squares are only pictures — no script, no controls — and the one line of
 * credit the map's terms ask for is written small in the corner. `lazy` keeps a
 * thread holding a dozen places from asking for all of them at once.
 *
 * The frame takes no pointer events: the card or the row it sits in is the
 * thing that answers a tap, and a map that swallowed the click would be a
 * picture of a place that could not be opened.
 */
export function MapPreview({
  latitude,
  longitude,
  /** The map's own depth: 16 is a neighbourhood, 13 a district. */
  zoom = 16,
  className,
}: {
  latitude: number;
  longitude: number;
  zoom?: number;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () =>
      setBox((current) =>
        current &&
        current.width === node.clientWidth &&
        current.height === node.clientHeight
          ? current
          : { width: node.clientWidth, height: node.clientHeight },
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(measure);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  const zoomLevel = Math.max(1, Math.min(19, Math.round(zoom)));
  const tiles =
    box && box.width > 0 && box.height > 0
      ? tilesFor(latitude, longitude, zoomLevel, box.width, box.height)
      : [];

  return (
    <div
      ref={frame}
      aria-hidden
      className={cn(
        "pointer-events-none relative overflow-hidden bg-[var(--accent-soft)]",
        className,
      )}
    >
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          // `max-w-none` is what keeps the squares whole: the interface's own
          // `img { max-width: 100% }` would shrink each one to the width of the
          // card and leave a stripe of the background between neighbours.
          className="absolute max-w-none select-none"
          style={{
            left: tile.left,
            top: tile.top,
            width: TILE,
            height: TILE,
          }}
        />
      ))}
      <MapPin
        className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-full text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]"
        fill="var(--accent)"
        strokeWidth={1.6}
      />
      <span className="absolute bottom-0 right-0 bg-white/70 px-1 text-[8px] leading-[12px] text-black/70">
        © OpenStreetMap
      </span>
    </div>
  );
}