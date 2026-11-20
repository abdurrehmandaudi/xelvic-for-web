import { createContext } from "react";
import type { LookingContextValue } from "@/providers/LookingProvider";

/**
 * What each of my partners is looking at, as every screen reads it.
 *
 * The context lives in its own module so that `hooks/useLooking.ts` can read it
 * without importing the provider's implementation — the provider imports the
 * context, the hook imports the context, and neither has to know the other. The
 * type comes from the provider as a type-only import, which disappears at build
 * time. This is the shape all the contexts in this folder share.
 */
export const LookingContext = createContext<LookingContextValue | null>(null);
