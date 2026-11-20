import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

/**
 * A sticker, drawn at the size a sticker is.
 *
 * The owner's report of 2026-11-12: *"sticker panel jo stckers hai un sab ka
 * size ek jaisa nahi hai, please sabhi ka size ek jaisa kijiye, chota bada na
 * dikhe"*.
 *
 * The grid already gave every sticker the same square cell — measured in the
 * running app, 75x75 with a 63x63 drawing box inside it. What differed was
 * inside the files, and it differed a lot. Of ninety stickers sampled off the
 * real catalogue, **forty-nine carried a transparent margin on at least one
 * axis**, and the drawings came out anywhere between 775 and 3843 square pixels
 * of visible ink — a five-fold spread, and the smallest of them twenty-two
 * pixels tall next to a sixty-three pixel neighbour. `object-contain` cannot
 * help with that: it fits the *file*, and the file is mostly empty. One of them
 * — `image-removebg-preview (3)`, a 512x279 file whose ink occupies 48%x73% of
 * it — was being drawn at 31x25 inside a 63-pixel box, and next to a sticker
 * that filled its box it looked like a different kind of thing entirely.
 *
 * So the ink is measured rather than assumed, and the *ink* is what is fitted
 * to the box: every sticker's longest visible edge is drawn at the same size as
 * every other's. Nothing is cropped — a wide sticker keeps its wings — and
 * nothing is stretched, because only the transparent margin is taken up.
 *
 * The same evening the owner reported the other half of it: *"Abhi sabhi
 * stickers nahi aa raha hai, please ise fix kijiye jisse sabhi stickers aaye"*.
 * Every sticker *was* there — the shelf fetched all seven catalogue pages
 * (`matched: 602`) and the grid built 602 cells, not one of them broken. What
 * was missing was the pictures. `loading="lazy"` leaves a cell blank until it
 * comes near the 258-pixel window the shelf scrolls in, and of the 602 only 76
 * had drawn when the panel opened; twenty screens of scrolling raised that to
 * 312, and even after jumping to the very bottom **216 cells were still empty**.
 * On a shelf 11,941 pixels tall, that reads as stickers that never came.
 *
 * So a shelf that has been asked for is asked for *eagerly* (`eager`), which is
 * why this file no longer leans on lazy loading to keep the downloads down. The
 * cost is written down rather than hidden, and it is measured rather than
 * guessed: a cold open of the shelf pulls **602 pictures, 26 MB, one request
 * each**, and the last of them is drawn about 7.5 seconds after the panel
 * appears. (An earlier estimate from `content-length` headers on a sample of
 * twenty-five said 54 MB; the wire count says 26 MB, and the wire count is the
 * one to believe.) Every one of them answers `immutable, max-age=2592000`, so it
 * is paid once a month rather than once a visit — a warm re-open costs almost
 * nothing — and the shelf turns the flag on a beat after it opens, so that the
 * first screenful keeps the connections to itself.
 *
 * Three things this must not do, and does not:
 *
 * - **Fetch a picture twice.** The measurement reads the very `<img>` the grid
 *   has loaded, so measuring costs no request of its own — not even for the
 *   six hundredth sticker.
 * - **Break a sticker because its host forbids reading it.** Reading a canvas
 *   needs the picture's own CORS header. The picture is requested with
 *   `crossorigin="anonymous"` so it can be measured; if the host refuses that
 *   request outright, the element is retried *without* it — the sticker is then
 *   drawn the plain way rather than not drawn at all.
 * - **Wait to be seen.** Until the ink is known, the sticker is drawn exactly as
 *   it was before, so a cell is never empty and nothing flickers.
 */

/** The box a file's visible pixels occupy, as fractions of the file. */
export interface InkBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What has already been measured, by URL: the shelf is redrawn many times. */
const measured = new Map<string, InkBox | null>();

/** How wide the picture is drawn while its alpha is being read. */
const SAMPLE = 128;

/** Below this an alpha byte is the edge of a picture, not the picture. */
const OPAQUE = 12;

/**
 * One scratch pad for the whole shelf. Setting `width` clears it, so six hundred
 * measurements in a row can share the one canvas instead of allocating six
 * hundred of them.
 */
let scratch: HTMLCanvasElement | null = null;

/**
 * Find the visible box by the picture's own alpha channel.
 *
 * A picture with no transparency at all measures as its own whole file, which
 * is the right answer: there is no margin to take up.
 */
function inkOf(image: HTMLImageElement): InkBox | null {
  const wide = SAMPLE;
  const tall = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * wide));
  const canvas = (scratch ??= document.createElement("canvas"));
  canvas.width = wide;
  canvas.height = tall;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(image, 0, 0, wide, tall);
    const { data } = context.getImageData(0, 0, wide, tall);
    let minX = wide;
    let minY = tall;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < tall; y += 1) {
      for (let x = 0; x < wide; x += 1) {
        if (data[(y * wide + x) * 4 + 3] > OPAQUE) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || maxY < 0) return null;
    return {
      x: minX / wide,
      y: minY / tall,
      w: (maxX - minX + 1) / wide,
      h: (maxY - minY + 1) / tall,
    };
  } catch {
    // A canvas the browser will not let us read — a host without the header,
    // most likely. The sticker is drawn the plain way.
    return null;
  }
}

/**
 * Where to put a picture so that its *ink* fills the box it is given.
 *
 * Everything is a percentage of the box, so the grid stays responsive: the
 * picture's own size is whatever makes its longest visible edge exactly the
 * box's edge, and it is then slid so that the middle of the ink sits in the
 * middle of the box. The transparent margin hangs outside the box, where it
 * costs nothing and can be clipped away.
 */
function place(ink: InkBox, natural: { width: number; height: number }) {
  const inkWide = ink.w * natural.width;
  const inkTall = ink.h * natural.height;
  const longest = Math.max(inkWide, inkTall);
  if (!longest) return null;
  const width = (100 * natural.width) / longest;
  const height = (100 * natural.height) / longest;
  const middleX = (100 * (ink.x + ink.w / 2) * natural.width) / longest;
  const middleY = (100 * (ink.y + ink.h / 2) * natural.height) / longest;
  return { width, height, left: 50 - middleX, top: 50 - middleY };
}

export function StickerArt({
  url,
  eager = false,
  className,
}: {
  url: string;
  /**
   * Draw this sticker whether or not it is near the window. The shelf of six
   * hundred turns this on once it is open, so that a scroll never arrives
   * before the picture does — and turns it off again when it closes, so the
   * downloads are asked for by somebody who actually opened the shelf.
   */
  eager?: boolean;
  className?: string;
}) {
  // `null` with `known` false means "not measured yet", and the plain drawing
  // is what a cell shows until it is.
  const [ink, setInk] = useState<InkBox | null>(() => measured.get(url) ?? null);
  const [known, setKnown] = useState(() => measured.has(url));
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  // Whether this picture may be asked for with CORS, which is what makes its
  // alpha readable. A host that refuses the request gets asked again without it.
  const [crossed, setCrossed] = useState(true);
  const node = useRef<HTMLImageElement | null>(null);

  const read = useCallback(
    (element: HTMLImageElement) => {
      const size = { width: element.naturalWidth, height: element.naturalHeight };
      if (!size.width || !size.height) return;
      const found = inkOf(element);
      measured.set(url, found);
      setNatural(size);
      setInk(found);
      setKnown(true);
    },
    [url],
  );

  // A picture already in the browser's cache can be complete before React
  // attaches the `onLoad` that would have measured it.
  useEffect(() => {
    const element = node.current;
    if (element?.complete && element.naturalWidth) read(element);
  }, [read]);

  // A URL that changed under us (a different sticker in the same cell) starts
  // again rather than showing the last one's shape.
  useEffect(() => {
    setInk(measured.get(url) ?? null);
    setKnown(measured.has(url));
    setNatural(null);
  }, [url]);

  const spot = crossed && known && ink && natural ? place(ink, natural) : null;

  return (
    <span className={cn("relative block size-full overflow-hidden", className)}>
      <img
        ref={node}
        src={url}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        crossOrigin={crossed ? "anonymous" : undefined}
        onLoad={(event) => read(event.currentTarget)}
        onError={() => {
          // Tried with CORS and the host said no. Ask again the plain way: a
          // sticker drawn at the old, uneven size is worth more than a hole.
          if (crossed) {
            setCrossed(false);
            setKnown(false);
            setInk(null);
            setNatural(null);
          }
        }}
        className={cn("absolute", spot ? "max-w-none" : "inset-0 size-full object-contain")}
        style={
          spot
            ? {
                width: `${spot.width}%`,
                height: `${spot.height}%`,
                left: `${spot.left}%`,
                top: `${spot.top}%`,
              }
            : undefined
        }
      />
    </span>
  );
}

export default StickerArt;
