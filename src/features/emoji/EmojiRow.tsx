import { EmojiArt } from "./EmojiArt";
import { splitEmoji } from "./text";

export function EmojiRow({
  text,
  burst,
  size,
}: {
  text: string;
  burst?: number;
  size: number;
}) {
  const runs = splitEmoji(text);
  if (!runs.some((run) => run.art)) return <>{text}</>;
  return (
    <span
      className="flex max-w-full flex-wrap items-center justify-center"
    >
      {runs.map((run, index) =>
        run.art ? (
          <span
            key={index}
            className="block shrink-0"
            style={{ width: size, height: size }}
          >
            <EmojiArt
              char={run.text}
              motion={run.art.motion}
              still={run.art.still}
              mode="text"
              burst={burst}
            />
          </span>
        ) : null,
      )}
    </span>
  );
}