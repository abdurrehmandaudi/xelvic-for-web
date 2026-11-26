import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ScanLine, Share2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { API_ORIGIN } from "@/config/env";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import type { UserCard } from "@/types/api";
import { MdVerified } from "react-icons/md";

function bracketPaths(total: number): string[] {
  const frame = total * 0.88;
  const o = (total - frame) / 2;
  const arm = Math.max(18, total * 0.09);
  const far = o + frame;
  return [
    `M ${o + arm} ${o} L ${o} ${o} L ${o} ${o + arm}`,
    `M ${far - arm} ${o} L ${far} ${o} L ${far} ${o + arm}`,
    `M ${o} ${far - arm} L ${o} ${far} L ${o + arm} ${far}`,
    `M ${far} ${far - arm} L ${far} ${far} L ${far - arm} ${far}`,
  ];
}

function useSquare(max: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setSide(Math.max(160, Math.min(entry.contentRect.width, max)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [max]);
  return [ref, side] as const;
}

export function ProfileQr({
  user,
  handle,
  name,
  mine = false,
  onClose,
}: {
  user: UserCard;
  handle: string;
  name: string;
  mine?: boolean;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [squareRef, total] = useSquare(300);

  const link = `${API_ORIGIN}/u/${encodeURIComponent(handle)}`;
  const plate = total * 0.76;
  const platePad = Math.max(14, total * 0.095);
  const modules = plate - platePad * 2;
  const face = plate * 0.23;
  const verified = user.verified === true;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`@${handle}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast({ title: t("Handle copied"), tone: "success" });
    } catch {
      toast({ title: t("Copy it from the page"), tone: "info" });
    }
  }

  async function share() {
    const line = mine
      ? t(`Add me on Xelvic — @${handle}\n${link}`)
      : t(`Add @${handle} on Xelvic.\n${link}`);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `@${handle}`, text: line });
        return;
      }
      await navigator.clipboard.writeText(line);
      toast({ title: t("Copied to the clipboard instead."), tone: "success" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: t("Copy the link from the address bar"), tone: "info" });
    }
  }

  return (
    <div className="relative flex flex-col gap-4 px-4 pb-5 pt-5">
      <button
        type="button"
        onClick={onClose}
        aria-label={t("Close")}
        className="absolute right-3 top-3 z-10 inline-flex size-10 items-center justify-center rounded-full text-dim transition-colors duration-150 hover:bg-ink-6 hover:text-ink"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-3 rounded-[12px] border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] py-2.5 pl-3.5 pr-3">
        <span className="flex shrink-0">
          <Avatar user={user} size={44} />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[16px] font-bold leading-tight">
              {name}
            </span>
            {verified ? (
              <MdVerified
                size={14}
                className="text-[#1D9BF0]"
                aria-label="Verified"
              />
            ) : null}
          </span>
          <span className="block truncate text-[12.5px] font-semibold text-accent">
            @{handle}
          </span>
        </span>
      </div>

      <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-card px-4 pb-4 pt-5 shadow-[0_1px_2px_color-mix(in_srgb,var(--ink)_5%,transparent)]">
        <div className="rounded-[18px] bg-[color-mix(in_srgb,var(--accent)_6%,var(--card))] p-3">
          <div
            ref={squareRef}
            className="relative mx-auto aspect-square w-full max-w-[300px]"
          >
            {total > 0 ? (
              <>
                <svg
                  viewBox={`0 0 ${total} ${total}`}
                  className="absolute inset-0 size-full"
                  aria-hidden
                >
                  {bracketPaths(total).map((d) => (
                    <path
                      key={d}
                      d={d}
                      fill="none"
                      stroke="color-mix(in srgb, var(--accent) 38%, transparent)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>

                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[12px] bg-card shadow-[0_1px_2px_color-mix(in_srgb,var(--ink)_6%,transparent)]"
                  style={{ width: plate, height: plate, padding: platePad }}
                >
                  <QRCodeSVG
                    value={link}
                    size={modules}
                    level="M"
                    includeMargin={false}
                    fgColor="currentColor"
                    bgColor="transparent"
                    className="block text-accent"
                    aria-label={t(`QR code for @${handle}`)}
                  />
                </div>

                <div
                  className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-card"
                  style={{ width: face, height: face }}
                >
                  <Avatar user={user} size={Math.round(face - 10)} />
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3.5 py-3">
          <ScanLine className="size-4 shrink-0 text-accent" aria-hidden />
          <p className="text-center text-[12px] leading-[1.45] text-dim">
            {mine
              ? t("Have somebody scan this to open your profile.")
              : t("Have somebody scan this to open this profile.")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[13.5px] font-semibold text-accent transition-[transform,background-color] duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] active:scale-[0.98]"
        >
          <Share2 className="size-[18px]" aria-hidden />
          {t("Share")}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[13.5px] font-semibold text-accent transition-[transform,background-color] duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] active:scale-[0.98]"
        >
          {copied ? (
            <Check className="size-[18px]" aria-hidden />
          ) : (
            <Copy className="size-[18px]" aria-hidden />
          )}
          {copied ? t("Copied") : t("Copy handle")}
        </button>
      </div>
    </div>
  );
}
