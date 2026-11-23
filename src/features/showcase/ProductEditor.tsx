import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { FieldLabel } from "@/features/settings/parts";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { productsService, PRODUCT_PICTURE_LIMIT, type Product } from "@/services/products.service";
import { linkedAddress, looksLikeLink } from "@/features/showcase/model";

interface TrayItem {
  id?: string;
  file?: File;
  url: string;
}

function trayFrom(product: Product | null): TrayItem[] {
  return (product?.images ?? []).map((picture) => ({ id: picture.id, url: picture.url }));
}

const fieldClass =
  "w-full min-h-10 rounded-control border border-line bg-card px-4 py-3 text-ink transition-[border-color,box-shadow] duration-[160ms] placeholder:text-dim-80 focus:border-accent focus:shadow-field-focus focus:outline-none";

export function ProductEditor({
  existing = null,
  onClose,
  onSaved,
}: {
  existing?: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = usePreferences();
  const { toast } = useToast();
  const isNew = existing === null;

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [link, setLink] = useState(existing?.link ?? "");
  const [buttonText, setButtonText] = useState(existing?.button_text ?? "");
  const [tray, setTray] = useState<TrayItem[]>(() => trayFrom(existing));
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const room = PRODUCT_PICTURE_LIMIT - tray.length;
  const stage = tray[Math.min(active, Math.max(0, tray.length - 1))];

  function pick(files: FileList | null) {
    if (!files || !files.length) return;
    const chosen = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, room));
    if (!chosen.length) return;
    const added = chosen.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setActive(tray.length);
    setTray((current) => [...current, ...added]);
  }

  function remove(at: number) {
    const gone = tray[at];
    if (gone?.file) URL.revokeObjectURL(gone.url);
    const next = tray.filter((_, index) => index !== at);
    setTray(next);
    setActive((shown) => Math.min(shown, Math.max(0, next.length - 1)));
  }

  function move(at: number, to: number) {
    if (to < 0 || to >= tray.length || to === at) return;
    const next = [...tray];
    const [carried] = next.splice(at, 1);
    next.splice(to, 0, carried);
    setTray(next);
    setActive((shown) => (shown === at ? to : shown));
  }

  async function save() {
    if (busy) return;
    if (!name.trim()) {
      toast({ title: t("A showcase needs a title."), tone: "error" });
      return;
    }
    if (link.trim() && !looksLikeLink(link)) {
      toast({ title: t("A link is a web address, like https://example.com."), tone: "error" });
      return;
    }
    const kept = tray.filter((item) => item.id).map((item) => item.id as string);
    const fresh = tray.filter((item) => item.file).map((item) => item.file as File);
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        link: linkedAddress(link),
        buttonText: buttonText.trim(),
        images: fresh,
      };
      if (existing) {
        const saved = await productsService.change(existing.id, { ...payload, order: kept });
        if (fresh.length) await inTrayOrder(saved, tray, kept);
      } else {
        await productsService.create(payload);
      }
      toast({ title: t(isNew ? "Showcase added." : "Showcase saved."), tone: "success" });
      onSaved();
      onClose();
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function takeDown() {
    if (!existing || busy) return;
    setBusy(true);
    try {
      await productsService.remove(existing.id);
      toast({ title: t("Showcase taken down."), tone: "success" });
      onSaved();
      onClose();
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-page">
      <header className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] active:scale-[0.96]"
        >
          <X className="size-[18px]" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-extrabold tracking-[-0.03em]">
            {t(isNew ? "Create showcase" : "Edit showcase")}
          </h2>
          <p className="truncate text-[12px] text-dim">
            {t("Show your product, idea or anything amazing")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-extrabold text-on-accent transition hover:brightness-105 active:scale-[0.97] disabled:opacity-45"
        >
          {busy ? (
            <span className="size-4 animate-spin rounded-full border-2 border-on-accent border-t-transparent" />
          ) : (
            t("Save")
          )}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-12 pt-3">
        <FieldLabel>
          <span className="flex items-center justify-between">
            <span>{t("Photos")}</span>
            <span className="text-dim">
              {tray.length} / {PRODUCT_PICTURE_LIMIT}
            </span>
          </span>
        </FieldLabel>

        <div className="mt-1.5 flex items-center justify-center">
          <button
            type="button"
            onClick={() => (stage ? undefined : picker.current?.click())}
            className="relative aspect-square w-[min(300px,72vw)] overflow-hidden rounded-[22px] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
          >
            {stage ? (
              <img src={stage.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-accent">
                <ImagePlus className="size-7" aria-hidden />
                <span className="text-[13px] font-semibold">{t("Add photo")}</span>
              </span>
            )}
          </button>
        </div>

        {tray.length > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {tray.map((item, index) => (
              <span
                key={item.id ?? item.url}
                className={cn(
                  "size-[7px] rounded-full",
                  index === active ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_16%,transparent)]",
                )}
                aria-hidden
              />
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {tray.map((item, index) => (
            <div key={item.id ?? item.url} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                className={cn(
                  "block size-[64px] overflow-hidden rounded-[14px] border-2",
                  index === active ? "border-accent" : "border-line",
                )}
                aria-label={t("Show this photo")}
              >
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              </button>
              {index === 0 ? (
                <span className="absolute bottom-0 left-0 rounded-tr-[8px] bg-accent px-1.5 py-0.5 text-[9px] font-bold text-on-accent">
                  {t("Cover")}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={t("Remove this photo")}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_62%,transparent)] text-white"
              >
                <X className="size-3" aria-hidden />
              </button>
              <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                {index > 0 ? (
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    aria-label={t("Move back")}
                    className="flex size-5 items-center justify-center rounded-full border border-line bg-card text-ink"
                  >
                    <ChevronLeft className="size-3" aria-hidden />
                  </button>
                ) : null}
                {index < tray.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    aria-label={t("Move forward")}
                    className="flex size-5 items-center justify-center rounded-full border border-line bg-card text-ink"
                  >
                    <ChevronRight className="size-3" aria-hidden />
                  </button>
                ) : null}
              </span>
            </div>
          ))}
          {room > 0 ? (
            <button
              type="button"
              onClick={() => picker.current?.click()}
              aria-label={t("Add photo")}
              className="flex size-[64px] shrink-0 items-center justify-center rounded-[14px] border border-dashed border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-accent"
            >
              <Plus className="size-6" aria-hidden />
            </button>
          ) : null}
        </div>

        {tray.length >= PRODUCT_PICTURE_LIMIT ? (
          <p className="mt-2 text-[12px] leading-[1.4] text-dim">
            {t(`A showcase shows up to ${PRODUCT_PICTURE_LIMIT} photos.`)}
          </p>
        ) : null}

        <label className="mt-5 block">
          <FieldLabel>{t("Title")}</FieldLabel>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={90}
            placeholder={t("Enter a catchy title...")}
            className={fieldClass}
          />
        </label>

        <label className="mt-4 block">
          <FieldLabel>{t("Description")}</FieldLabel>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("Tell people about your showcase...")}
            className={cn(fieldClass, "resize-none")}
          />
        </label>

        <label className="mt-4 block">
          <FieldLabel>
            <span className="flex items-center gap-2">
              <span>{t("Link")}</span>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-bold text-dim">
                {t("Optional")}
              </span>
            </span>
          </FieldLabel>
          <input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("https://example.com")}
            className={fieldClass}
          />
        </label>

        <label className="mt-4 block">
          <FieldLabel>
            <span className="flex items-center gap-2">
              <span>{t("Button text")}</span>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-bold text-dim">
                {t("Optional")}
              </span>
            </span>
          </FieldLabel>
          <input
            value={buttonText}
            onChange={(event) => setButtonText(event.target.value)}
            maxLength={40}
            placeholder={t("e.g. Explore now")}
            className={fieldClass}
          />
        </label>

        {!isNew ? (
          <button
            type="button"
            onClick={() => void takeDown()}
            disabled={busy}
            className="mt-7 flex w-full items-center gap-3 rounded-[16px] border border-[color-mix(in_srgb,var(--bad)_28%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-4 py-3.5 text-left text-[var(--bad)] transition hover:bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] disabled:opacity-45"
          >
            <Trash2 className="size-5 shrink-0" aria-hidden />
            <span className="text-[14.5px] font-semibold">{t("Delete")}</span>
          </button>
        ) : null}

        <input
          ref={picker}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            pick(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

async function inTrayOrder(saved: Product, tray: TrayItem[], kept: string[]): Promise<Product> {
  const held = new Set(kept);
  const freshIds = saved.images
    .map((picture) => picture.id)
    .filter((id) => !held.has(id));
  let next = 0;
  const wanted = tray
    .map((item) => item.id ?? freshIds[next++])
    .filter((id): id is string => Boolean(id));
  const now = saved.images.map((picture) => picture.id);
  if (wanted.length === now.length && wanted.every((id, index) => id === now[index])) return saved;
  return productsService.change(saved.id, { order: wanted });
}
