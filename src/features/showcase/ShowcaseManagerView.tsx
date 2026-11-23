import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleSlash2, Eye, EyeOff, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { SettingsShell } from "@/features/settings/parts";
import { errorMessage } from "@/utils/errors";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { productsService, type Product } from "@/services/products.service";
import { ShowcaseGrid } from "@/features/showcase/ShowcaseShelf";
import { ProductEditor } from "@/features/showcase/ProductEditor";
import { ProductSheet } from "@/features/showcase/ProductSheet";

export function ShowcaseManagerView({ onBack }: { onBack: () => void }) {
  const { t } = usePreferences();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [menu, setMenu] = useState<Product | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [takingDown, setTakingDown] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const shelf = useQuery({
    queryKey: ["showcase", "mine"],
    queryFn: () => productsService.mine(),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["showcase"] });
  }

  const rows = shelf.data?.products ?? [];
  const limit = shelf.data?.limit ?? 60;
  const full = rows.length >= limit;

  async function setShown(product: Product, shown: boolean) {
    if (busy) return;
    setMenu(null);
    setBusy(true);
    try {
      await productsService.change(product.id, { shown });
      toast({ title: t(shown ? "Back on your profile." : "Off your profile."), tone: "success" });
      refresh();
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function takeDown() {
    if (!takingDown || busy) return;
    const product = takingDown;
    setTakingDown(null);
    setBusy(true);
    try {
      await productsService.remove(product.id);
      toast({ title: t("Showcase taken down."), tone: "success" });
      refresh();
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsShell
      title={t("Showcase")}
      onBack={onBack}
      action={
        <button
          type="button"
          onClick={() => setEditor({ open: true, product: null })}
          disabled={full}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-extrabold text-on-accent transition hover:brightness-105 disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
          {t("Add showcase")}
        </button>
      }
    >
      <div className="px-4 pb-10 pt-3">
        {shelf.isLoading ? (
          <div className="flex justify-center py-16">
            <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : shelf.isError ? (
          <p className="py-10 text-center text-[13px] text-dim">{errorMessage(shelf.error)}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[color-mix(in_srgb,var(--accent)_60%,transparent)]">
              <Store className="size-7" aria-hidden />
            </span>
            <p className="mt-3.5 text-[14px] text-dim">{t("Nothing here yet.")}</p>
            <button
              type="button"
              onClick={() => setEditor({ open: true, product: null })}
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-extrabold text-on-accent transition hover:brightness-105"
            >
              <Plus className="size-4" aria-hidden />
              {t("Add showcase")}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-dim">
                {rows.length} / {limit}
              </span>
            </div>
            {full ? (
              <p className="mb-3 text-[12.5px] leading-[1.4] text-dim">
                {t(`Your profile holds ${limit} showcases. Take one down to add another.`)}
              </p>
            ) : null}
            <ShowcaseGrid
              rows={rows}
              mine
              onOpen={(product) => (product ? setViewing(product) : setEditor({ open: true, product: null }))}
              onMenu={(product) => setMenu(product)}
            />
          </>
        )}
      </div>

      <Modal open={menu !== null} onClose={() => setMenu(null)} size="sm" hideClose>
        <div className="py-1.5">
          <button
            type="button"
            onClick={() => {
              const product = menu;
              setMenu(null);
              if (product) setEditor({ open: true, product });
            }}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
          >
            <Pencil className="size-5 text-dim" aria-hidden />
            <span className="text-[15px] font-semibold">{t("Edit")}</span>
          </button>
          <button
            type="button"
            onClick={() => menu && void setShown(menu, !menu.is_active)}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
          >
            {menu?.is_active ? (
              <EyeOff className="size-5 text-dim" aria-hidden />
            ) : (
              <Eye className="size-5 text-dim" aria-hidden />
            )}
            <span className="text-[15px] font-semibold">
              {menu?.is_active ? t("Take off profile") : t("Put back on profile")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const product = menu;
              setMenu(null);
              setTakingDown(product);
            }}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-[var(--bad)] transition hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
          >
            <Trash2 className="size-5" aria-hidden />
            <span className="text-[15px] font-semibold">{t("Delete")}</span>
          </button>
        </div>
      </Modal>

      <Modal
        open={editor.open}
        onClose={() => setEditor({ open: false, product: null })}
        size="lg"
        hideClose
      >
        <ProductEditor
          existing={editor.product}
          onClose={() => setEditor({ open: false, product: null })}
          onSaved={refresh}
        />
      </Modal>

      <ProductSheet open={viewing !== null} onClose={() => setViewing(null)} product={viewing} mine />

      <ConfirmDialog
        open={takingDown !== null}
        onClose={() => setTakingDown(null)}
        onConfirm={() => void takeDown()}
        title={t("Take this showcase down?")}
        body={t("Its pictures go with it. This can't be undone.")}
        confirmLabel={t("Delete")}
        icon={<CircleSlash2 className="size-5" />}
        destructive
      />
    </SettingsShell>
  );
}

export default ShowcaseManagerView;
