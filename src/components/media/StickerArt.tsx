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
 * A cell is now drawn *eagerly* the moment it is built, which is why this file
 * does not lean on lazy loading to keep the downloads down — and it is built by
 * a grid that only builds what is near the window it scrolls in, the way the
 * phone's own `GridView.builder` does. A cold open of the shelf pulls a
 * screenful, one request each, and every one of them answers `immutable,
 * max-age=2592000`, so it is paid once a month rather than once a visit.
 *
 * Three things this must not do, and does not:
 *
 * - **Fetch a picture twice.** The measurement reads the very `<img>` the grid
 *   has loaded, so measuring costs no request of its own — not even for the
 *   six hundredth sticker. A cell the window has moved away from and back to
 *   draws from what was measured the first time round.
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

/** What a picture is, once it has been seen: its ink, and the file it was in. */
interface Measured {
  ink: InkBox | null;
  width: number;
  height: number;
}

/** What has already been measured, by URL: the shelf is redrawn many times. */
const measured = new Map<string, Measured>();

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
  className,
}: {
  url: string;
  className?: string;
}) {
  // `null` with `known` false means "not measured yet", and the plain drawing
  // is what a cell shows until it is.
  const kept = measured.get(url);
  const [ink, setInk] = useState<InkBox | null>(() => kept?.ink ?? null);
  const [known, setKnown] = useState(() => Boolean(kept));
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(
    () => (kept ? { width: kept.width, height: kept.height } : null),
  );
  // Whether this picture may be asked for with CORS, which is what makes its
  // alpha readable. A host that refuses the request gets asked again without it.
  const [crossed, setCrossed] = useState(true);
  const node = useRef<HTMLImageElement | null>(null);
  const animated = /\.gif(\?|#|$)/i.test(url);

  const read = useCallback(
    (element: HTMLImageElement) => {
      const size = { width: element.naturalWidth, height: element.naturalHeight };
      if (!size.width || !size.height) return;
      const found = inkOf(element);
      measured.set(url, { ink: found, width: size.width, height: size.height });
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
    if (animated) return;
    if (element?.complete && element.naturalWidth) read(element);
  }, [animated, read]);

  // A URL that changed under us (a different sticker in the same cell) starts
  // again rather than showing the last one's shape. One that has been drawn
  // before starts where it left off, because a grid that only builds what is
  // near the window draws the same cell again every time it is scrolled back to.
  useEffect(() => {
    const was = measured.get(url);
    setInk(was?.ink ?? null);
    setKnown(Boolean(was));
    setNatural(was ? { width: was.width, height: was.height } : null);
  }, [url]);

  const spot =
    !animated && crossed && known && ink && natural ? place(ink, natural) : null;

  return (
    <span className={cn("relative block size-full overflow-hidden", className)}>
      <img
        ref={node}
        src={url}
        alt=""
        loading="eager"
        decoding="async"
        crossOrigin={!animated && crossed ? "anonymous" : undefined}
        onLoad={(event) => {
          if (!animated) read(event.currentTarget);
        }}
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
