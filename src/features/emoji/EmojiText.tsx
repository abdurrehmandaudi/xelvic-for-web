import { Fragment } from "react";
import { cn } from "@/utils/cn";
import { EmojiArt } from "./EmojiArt";
import { splitEmoji } from "./text";

/** An emoji in a sentence sits just above the baseline, at the text's own size. */
const INLINE =
  "inline-grid size-[1.15em] align-middle -translate-y-[0.25em] mr-0.5";

export function EmojiText({ text, burst }: { text: string; burst?: number }) {
  const runs = splitEmoji(text);
  if (!runs.some((run) => run.art)) return <>{text}</>;
  return (
    <>
      {runs.map((run, index) =>
        run.art ? (
          <EmojiArt
            key={index}
            char={run.text}
            motion={run.art.motion}
            still={run.art.still}
            mode="text"
            burst={burst}
            className={cn(
              INLINE,
              runs[index + 1]?.art ? "mr-[0.35em]" : undefined,
            )}
          />
        ) : (
          <Fragment key={index}>{run.text}</Fragment>
        ),
      )}
    </>
  );
}
