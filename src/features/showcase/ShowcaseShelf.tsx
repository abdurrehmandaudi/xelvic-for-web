import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Store } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { usePreferences } from "@/hooks/usePreferences";
import { productsService, type Product, type MyProducts } from "@/services/products.service";
import { productCover } from "@/features/showcase/model";
import { ProductEditor } from "@/features/showcase/ProductEditor";
import { ProductSheet } from "@/features/showcase/ProductSheet";

function ShelfEmptyFace({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("flex items-center justify-center text-[color-mix(in_srgb,var(--accent)_55%,transparent)]", className)}>
      <Store style={{ width: size, height: size }} aria-hidden />
    </span>
  );
}

export function ProductTile({
  product,
  mine,
  onOpen,
  onMenu,
}: {
  product: Product;
  mine: boolean;
  onOpen: () => void;
  onMenu?: () => void;
}) {
  const { t } = usePreferences();
  const cover = productCover(product);
  return (
    <div className="flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-[18px] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]">
        <button type="button" onClick={onOpen} className="block h-full w-full" aria-label={product.name}>
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <ShelfEmptyFace className="h-full w-full" />
          )}
        </button>
        {!product.is_active && mine ? (
          <span className="absolute bottom-2 left-2 rounded-[9px] bg-[color-mix(in_srgb,var(--ink)_62%,transparent)] px-2 py-0.5 text-[10.5px] font-bold text-white">
            {t("Off your profile")}
          </span>
        ) : null}
        {onMenu ? (
          <button
            type="button"
            onClick={onMenu}
            aria-label={t("More")}
            className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_40%,transparent)] text-white"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <span className="mt-2 truncate text-[13.5px] font-semibold">{product.name}</span>
      {product.description.trim() ? (
        <span className="mt-0.5 truncate text-[12.5px] text-dim">{product.description}</span>
      ) : null}
    </div>
  );
}

export function ShowcaseAddTile({ onTap }: { onTap: () => void }) {
  const { t } = usePreferences();
  return (
    <button type="button" onClick={onTap} className="flex flex-col text-left">
      <span className="flex aspect-square w-full items-center justify-center rounded-[18px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent">
        <Plus className="size-[22px]" aria-hidden />
      </span>
      <span className="mt-2 truncate text-[13.5px] font-semibold text-accent">{t("Add showcase")}</span>
    </button>
  );
}

export function ShowcaseGrid({
  rows,
  mine,
  leading,
  onOpen,
  onMenu,
}: {
  rows: Product[];
  mine: boolean;
  leading?: boolean;
  onOpen: (product: Product | null) => void;
  onMenu?: (product: Product) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-4 sm:grid-cols-3">
      {leading ? <ShowcaseAddTile onTap={() => onOpen(null)} /> : null}
      {rows.map((product) => (
        <ProductTile
          key={product.id}
          product={product}
          mine={mine}
          onOpen={() => onOpen(product)}
          onMenu={onMenu ? () => onMenu(product) : undefined}
        />
      ))}
    </div>
  );
}

export function ShowcaseShelf({ username, mine }: { username: string; mine: boolean }) {
  const { t } = usePreferences();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [viewing, setViewing] = useState<Product | null>(null);

  const shelf = useQuery<MyProducts>({
    queryKey: ["showcase", mine ? "mine" : username],
    queryFn: async () => {
      if (mine) return productsService.mine();
      return { products: await productsService.shelf(username), limit: 60 };
    },
    enabled: mine || Boolean(username),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["showcase"] });
  }

  const rows = shelf.data?.products ?? [];
  const limit = shelf.data?.limit ?? 60;

  if (shelf.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (shelf.isError) {
    return <p className="py-5 text-[13px] leading-5 text-dim">{errorMessage(shelf.error)}</p>;
  }

  if (!rows.length && !mine) return null;

  function open(product: Product | null) {
    if (product) setViewing(product);
    else setEditor({ open: true, product: null });
  }

  return (
    <div>
      {mine ? (
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-dim">
            {rows.length} / {limit}
          </span>
          <button
            type="button"
            onClick={() => navigate("/app/settings?section=showcase")}
            className="text-[12.5px] font-bold text-accent"
          >
            {t("Manage")}
          </button>
        </div>
      ) : null}
      {mine && rows.length >= limit ? (
        <p className="pb-2.5 text-[12.5px] leading-[1.4] text-dim">
          {t(`Your profile holds ${limit} showcases. Take one down to add another.`)}
        </p>
      ) : null}
      <ShowcaseGrid rows={rows} mine={mine} leading={mine} onOpen={open} />
      <ProductSheet open={viewing !== null} onClose={() => setViewing(null)} product={viewing} mine={mine} />
      <Modal open={editor.open} onClose={() => setEditor({ open: false, product: null })} size="lg" hideClose>
        <ProductEditor
          existing={editor.product}
          onClose={() => setEditor({ open: false, product: null })}
          onSaved={refresh}
        />
      </Modal>
    </div>
  );
}
