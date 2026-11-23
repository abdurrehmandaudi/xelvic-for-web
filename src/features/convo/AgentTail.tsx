import { cn } from "@/utils/cn";
import { EmojiText } from "@/features/emoji/EmojiText";

export function AgentTail({
  partial,
  className,
}: {
  partial: string;
  className?: string;
}) {
  const writing = partial !== "";
  return (
    <div className={cn("flex items-center gap-1.5 pb-[2px]", className)}>
      <div
        style={{
          backgroundColor: "var(--convo-in-wash)",
          borderColor: "var(--convo-in-edge)",
          color: "var(--convo-in-ink)",
          borderRadius: "10px 10px 10px 0",
        }}
        className="agent-tail relative max-w-[74%] border px-1 py-1 text-[15px] leading-[1.35]"
      >
        {writing ? (
          <p className="agent-text whitespace-pre-wrap break-words px-2 py-1">
            <EmojiText text={partial} />
          </p>
        ) : (
          <span className="agent-dots flex h-[28px] items-center gap-[6px] px-2.5">
            <i className="block size-[7px] rounded-full bg-current" />
            <i className="block size-[7px] rounded-full bg-current" />
            <i className="block size-[7px] rounded-full bg-current" />
          </span>
        )}
        <svg
          aria-hidden="true"
          viewBox="0 0 10 14"
          preserveAspectRatio="none"
          className="pointer-events-none absolute -bottom-[1px] -left-[8px] h-[12px] w-[8px] -scale-x-100"
          style={{ color: "var(--convo-in-wash)" }}
        >
          <path
            d="M0 0C0.4 5.4 2.8 9.3 7.6 11.6C9.3 12 9.8 12 9.8 12.2A1.8 1.8 0 0 1 8 14L0 14Z"
            fill="currentColor"
          />
          <path
            d="M0.4 0C0.4 5.4 2.8 9.3 7.6 11.6C9.3 12 9.8 12 9.8 12.2A1.8 1.8 0 0 1 8 14"
            fill="none"
            strokeWidth="1"
            stroke="var(--convo-in-edge)"
          />
        </svg>
        <span className="sr-only" role="status" aria-live="polite">
          {writing ? "" : "Xelvic Agent is writing"}
        </span>
      </div>
    </div>
  );
}
