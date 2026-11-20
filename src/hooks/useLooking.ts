import { useContext } from "react";
import { LookingContext } from "@/context/looking";

export type { LookingContextValue } from "@/providers/LookingProvider";

/**
 * Who is looking, and where I am — the two directions of `focus`.
 *
 * Reads the context that `providers/LookingProvider.tsx` fills in. A screen that
 * only *draws* a gaze reads `gazeOf`; a screen that is somewhere reads `say` and
 * `leave`; a convo does all four, because it is the one screen that is both on
 * somebody's places and watching one of its own.
 *
 * The four callbacks are stable for the life of the provider, so a screen may
 * put them in an effect's dependencies without that effect re-running every time
 * somebody's gaze moves. `gazeOf` is the reader: the object this returns is new
 * whenever there is something new to draw, which is what makes a screen that
 * reads it repaint.
 */
export function useLooking() {
  const context = useContext(LookingContext);
  if (!context) throw new Error("useLooking must be used inside LookingProvider");
  return context;
}
