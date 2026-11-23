import type { Product } from "@/services/products.service";

export function productCover(product: Product): string | null {
  return product.images.length ? product.images[0].url : null;
}

export function productHasLink(product: Product): boolean {
  return product.link.trim().length > 0;
}

export function productButtonLabel(product: Product, fallback: string): string {
  const word = product.button_text.trim();
  return word || fallback;
}

export function linkedAddress(typed: string): string {
  const value = typed.trim();
  if (!value || value.includes("://")) return value;
  return `https://${value}`;
}

export function looksLikeLink(typed: string): boolean {
  const value = linkedAddress(typed);
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const host = new URL(value).hostname;
    return host.includes(".");
  } catch {
    return false;
  }
}
