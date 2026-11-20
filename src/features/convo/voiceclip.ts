export const WAVE_HEIGHT = 30;
export const WAVE_LIMIT = 56;
export const WAVE_IDLE_BARS = 24;
export const WAVE_TRACK_WIDTH = 150;
export const WAVE_PULSE_MS = 900;
export const SPEED_RING = [1, 1.5, 2] as const;

function bounded(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.trunc(value)));
}

export function cleanWaveform(samples: readonly unknown[] | null | undefined): number[] {
  if (!samples) return [];
  const out: number[] = [];
  for (const sample of samples) {
    if (typeof sample !== "number" || !Number.isFinite(sample)) continue;
    out.push(bounded(sample));
  }
  return out;
}

export function boundedWaveform(
  samples: readonly unknown[] | null | undefined,
  limit = WAVE_LIMIT,
): number[] {
  const given = cleanWaveform(samples);
  if (limit <= 0 || given.length === 0) return [];
  if (given.length <= limit) return given;
  const out: number[] = [];
  for (let index = 0; index < limit; index += 1) {
    const from = Math.floor((index * given.length) / limit);
    const to = Math.min(
      given.length,
      Math.max(from + 1, Math.floor(((index + 1) * given.length) / limit)),
    );
    let peak = 0;
    for (let at = from; at < to; at += 1) {
      if (given[at] > peak) peak = given[at];
    }
    out.push(peak);
  }
  return out;
}

export interface WaveCell {
  count: number;
  thick: number;
  gap: number;
}

export function waveCell(width: number, count: number, height = WAVE_HEIGHT): WaveCell {
  const cell = Number.isFinite(width) && count > 0 ? width / count : 4;
  const thick = Math.min(height >= 44 ? 5 : 4, Math.max(0.8, cell * 0.42));
  const gap = Math.min(2, Math.max(0, (cell - thick) / 2));
  return { count, thick, gap };
}

export function idleHeight(index: number, unit = 1): number {
  return (4 + (index % 6) * 2) * unit;
}

export function sampleHeight(sample: number, unit = 1): number {
  return (4 + (bounded(sample) / 100) * 24) * unit;
}

export function danceHeight(index: number, count: number, phase: number, unit = 1): number {
  const spread = (index / count) * 2 * Math.PI;
  const wave =
    (Math.sin(phase + spread) + Math.sin(phase * 1.7 + spread * 0.6)) / 2;
  return (5 + ((wave + 1) / 2) * 21) * unit;
}

export function idleHeights(count: number, height = WAVE_HEIGHT): number[] {
  const unit = height / WAVE_HEIGHT;
  return Array.from({ length: count }, (_, index) => idleHeight(index, unit));
}

export function danceHeights(
  count: number,
  phase: number,
  height = WAVE_HEIGHT,
): number[] {
  const unit = height / WAVE_HEIGHT;
  return Array.from({ length: count }, (_, index) =>
    danceHeight(index, count, phase, unit),
  );
}

export function sampleHeights(
  samples: readonly number[],
  height = WAVE_HEIGHT,
): number[] {
  const unit = height / WAVE_HEIGHT;
  return samples.map((sample) => sampleHeight(sample, unit));
}

export function nextSpeed(speed: number): number {
  const at = SPEED_RING.indexOf(speed as (typeof SPEED_RING)[number]);
  return SPEED_RING[(at + 1) % SPEED_RING.length];
}

export function trackProgress(position: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, position / total));
}
