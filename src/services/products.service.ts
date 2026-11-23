import api from "@/config/axios";
import { UPLOAD_TIMEOUT_MS } from "@/config/env";

export interface ProductPicture {
  id: string;
  url: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  link: string;
  button_text: string;
  images: ProductPicture[];
  is_active: boolean;
}

export interface MyProducts {
  products: Product[];
  limit: number;
}

export const PRODUCT_PICTURE_LIMIT = 6;

function pictureOf(raw: unknown): ProductPicture | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "");
  const url = String(row.url ?? "");
  if (!id || !url) return null;
  return { id, url };
}

function productOf(raw: unknown): Product {
  const row = (raw ?? {}) as Record<string, unknown>;
  const images = Array.isArray(row.images)
    ? row.images.map(pictureOf).filter((one): one is ProductPicture => one !== null)
    : [];
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    link: String(row.link ?? "").trim(),
    button_text: String(row.button_text ?? "").trim(),
    images,
    is_active: row.is_active !== false,
  };
}

function rowsOf(raw: unknown): Product[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows.map(productOf).filter((product) => product.id);
}

interface WriteInput {
  name?: string;
  description?: string;
  link?: string;
  buttonText?: string;
  shown?: boolean;
  order?: string[];
  images?: File[];
}

function bodyOf(input: WriteInput, forUpload: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.link !== undefined) body.link = input.link;
  if (input.buttonText !== undefined) body.button_text = input.buttonText;
  if (input.shown !== undefined) body.is_active = forUpload ? String(input.shown) : input.shown;
  if (input.order !== undefined) body.image_order = forUpload ? input.order.join(",") : input.order;
  return body;
}

function formOf(input: WriteInput): FormData {
  const form = new FormData();
  const body = bodyOf(input, true);
  for (const [key, value] of Object.entries(body)) form.append(key, String(value));
  for (const file of input.images ?? []) form.append("images", file);
  return form;
}

export const productsService = {
  mine: async (): Promise<MyProducts> => {
    const response = await api.get<{ products?: unknown; limit?: number }>("/products/mine/");
    const limit = Number(response.data?.limit);
    return {
      products: rowsOf(response.data?.products),
      limit: Number.isFinite(limit) && limit > 0 ? limit : 60,
    };
  },

  shelf: async (username: string): Promise<Product[]> => {
    const response = await api.get<{ products?: unknown }>(
      `/products/${encodeURIComponent(username)}/`,
    );
    return rowsOf(response.data?.products);
  },

  create: async (input: WriteInput): Promise<Product> => {
    const images = input.images ?? [];
    if (images.length) {
      const response = await api.post<unknown>("/products/mine/", formOf(input), {
        timeout: UPLOAD_TIMEOUT_MS,
      });
      return productOf(response.data);
    }
    const response = await api.post<unknown>("/products/mine/", bodyOf(input, false));
    return productOf(response.data);
  },

  change: async (id: string, input: WriteInput): Promise<Product> => {
    const images = input.images ?? [];
    const path = `/products/mine/${encodeURIComponent(id)}/`;
    if (images.length) {
      const response = await api.post<unknown>(path, formOf(input), {
        timeout: UPLOAD_TIMEOUT_MS,
      });
      return productOf(response.data);
    }
    const response = await api.patch<unknown>(path, bodyOf(input, false));
    return productOf(response.data);
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/products/mine/${encodeURIComponent(id)}/`);
  },
};

export default productsService;
