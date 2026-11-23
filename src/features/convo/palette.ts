function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function parseHex(hex: string): [number, number, number] | null {
  const said = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(said)) return null;
  const full =
    said.length === 3
      ? said
          .split("")
          .map((one) => one + one)
          .join("")
      : said;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((one) =>
      Math.round(Math.min(255, Math.max(0, one)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function mix(from: string, to: string, share: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return from;
  const t = clamp01(share);
  return toHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]);
}

function channel(value: number): number {
  const said = value / 255;
  return said <= 0.04045 ? said / 12.92 : ((said + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return (
    0.2126 * channel(rgb[0]) +
    0.7152 * channel(rgb[1]) +
    0.0722 * channel(rgb[2])
  );
}

export function contrastRatio(a: string, b: string): number {
  const one = luminance(a);
  const two = luminance(b);
  const light = Math.max(one, two);
  const dark = Math.min(one, two);
  return (light + 0.05) / (dark + 0.05);
}

export function bestInk(ground: string, wanted = 4.5): string {
  const white = "#ffffff";
  const black = "#111111";
  const target = wanted + 0.2;
  const towards = contrastRatio(ground, white) >= contrastRatio(ground, black)
    ? white
    : black;
  let share = 1;
  for (let step = 1; step <= 20; step += 1) {
    const tried = step / 20;
    if (contrastRatio(mix(ground, towards, tried), ground) >= target) {
      share = tried;
      break;
    }
  }
  return mix(ground, towards, share);
}

export function dimInk(ground: string, ink: string): string {
  let share = 0.45;
  while (share < 1 && contrastRatio(mix(ground, ink, share), ground) < 3) {
    share += 0.05;
  }
  return mix(ground, ink, share);
}

function saturation(rgb: [number, number, number]): number {
  const hi = Math.max(...rgb);
  const lo = Math.min(...rgb);
  return hi === 0 ? 0 : (hi - lo) / hi;
}

export interface PhotoPalette {
  ground: string;
  ink: string;
  dim: string;
  accent: string;
  tones: string[];
}

export function paletteOf(pixels: Array<[number, number, number]>): PhotoPalette | null {
  if (!pixels.length) return null;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (const [r, g, b] of pixels) {
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const held = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    held.n += 1;
    held.r += r;
    held.g += g;
    held.b += b;
    buckets.set(key, held);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n);
  const dominant = ranked[0];
  let ground = toHex([
    dominant.r / dominant.n,
    dominant.g / dominant.n,
    dominant.b / dominant.n,
  ]);
  let ink = bestInk(ground);
  for (let step = 0; step < 8; step += 1) {
    if (contrastRatio(ink, ground) >= 4.5) break;
    const away = luminance(ink) > luminance(ground) ? "#000000" : "#ffffff";
    ground = mix(ground, away, 0.18);
    ink = bestInk(ground);
  }
  const tones = ranked
    .map((held) => {
      const rgb: [number, number, number] = [
        held.r / held.n,
        held.g / held.n,
        held.b / held.n,
      ];
      return { hex: toHex(rgb), score: saturation(rgb), weight: held.n };
    })
    .filter((row) => row.score > 0.18 && contrastRatio(row.hex, ground) > 1.25)
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 4)
    .map((row) => row.hex);
  return {
    ground,
    ink,
    dim: dimInk(ground, ink),
    accent: tones[0] ?? ink,
    tones,
  };
}

export function paletteFromImage(url: string): Promise<PhotoPalette | null> {
  return new Promise((resolve) => {
    const picture = new Image();
    picture.crossOrigin = "anonymous";
    picture.decoding = "async";
    picture.onload = () => {
      try {
        const side = 24;
        const canvas = document.createElement("canvas");
        canvas.width = side;
        canvas.height = side;
        const brush = canvas.getContext("2d", { willReadFrequently: true });
        if (!brush) {
          resolve(null);
          return;
        }
        brush.drawImage(picture, 0, 0, side, side);
        const data = brush.getImageData(0, 0, side, side).data;
        const pixels: Array<[number, number, number]> = [];
        for (let at = 0; at < data.length; at += 4) {
          if (data[at + 3] < 200) continue;
          pixels.push([data[at], data[at + 1], data[at + 2]]);
        }
        resolve(paletteOf(pixels));
      } catch {
        resolve(null);
      }
    };
    picture.onerror = () => resolve(null);
    picture.src = url;
  });
}