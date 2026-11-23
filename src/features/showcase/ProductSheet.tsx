import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { productButtonLabel, productHasLink } from "@/features/showcase/model";
import type { Product } from "@/services/products.service";

export function ProductSheet({
  open,
  onClose,
  product,
  mine,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  mine: boolean;
}) {
  const { t } = usePreferences();
  const { toast } = useToast();
  const [page, setPage] = useState(0);

  if (!product) return null;

  const images = product.images;
  const label = productButtonLabel(product, t("Open link"));
  const index = Math.min(page, Math.max(0, images.length - 1));

  function openLink() {
    try {
      window.open(product?.link ?? "", "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: t("Could not open that link."), tone: "error" });
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="px-5 pb-6 pt-5">
        {images.length ? (
          <>
            <div className="relative mx-auto aspect-square w-[min(360px,72vw)] overflow-hidden rounded-[22px] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]">
              <img src={images[index].url} alt="" className="h-full w-full object-cover" />
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPage((index - 1 + images.length) % images.length)}
                    aria-label={t("Previous")}
                    className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] text-white"
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((index + 1) % images.length)}
                    aria-label={t("Next")}
                    className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] text-white"
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                </>
              ) : null}
            </div>
            {images.length > 1 ? (
              <div className="mt-3 flex items-center justify-center gap-1.5">
                {images.map((picture, at) => (
                  <span
                    key={picture.id}
                    className={cn(
                      "size-[7px] rounded-full",
                      at === index ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_16%,transparent)]",
                    )}
                    aria-hidden
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        <h2 className="mt-4 text-[19px] font-extrabold leading-[1.25]">{product.name}</h2>

        {!product.is_active && mine ? (
          <p className="mt-1.5 text-[12.5px] text-dim">{t("Off your profile")}</p>
        ) : null}

        {product.description.trim() ? (
          <p className="mt-3.5 whitespace-pre-wrap text-[14px] leading-[1.5] text-dim">
            {product.description}
          </p>
        ) : null}

        {productHasLink(product) ? (
          <button
            type="button"
            onClick={openLink}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-[14px] font-extrabold text-on-accent transition hover:brightness-105 active:scale-[0.98]"
          >
            <span className="truncate">{label}</span>
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
