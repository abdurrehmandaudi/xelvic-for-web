import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "@/utils/errors";
import { uploadAsset } from "@/utils/upload";
import type { Asset } from "@/types/api";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/config/axios", () => ({ default: { post } }));

const MB = 1024 * 1024;
const PART = 16 * MB;

const ASSET: Asset = {
  id: "asset-1",
  kind: "doc",
  size: 60 * MB,
  original_name: "report.pdf",
  content_url: "/media/report.pdf",
};

/**
 * A file whose bytes are never in memory.
 *
 * A 60 MB `File` in a test is 60 MB of the machine for no assertion it makes:
 * the module only reads `size`, `name`, `type` and whatever `slice` hands to
 * axios, and axios is mocked. So `slice` records the range it was asked for and
 * returns a tiny stand-in with the right size.
 */
function fakeFile(size: number, name = "report.pdf", type = "application/pdf") {
  const slices: { start: number; end: number; size: number }[] = [];
  const file = {
    name,
    type,
    size,
    slice(start: number, end: number) {
      const part = { size: end - start, type: "" };
      slices.push({ start, end, size: part.size });
      return part as unknown as Blob;
    },
  } as unknown as File;
  return { file, slices };
}

function beginReply(id = "upload-1", parts = 4) {
  return { data: { upload: { id, part_size: PART, parts } } };
}

function isPart(url: string) {
  return /\/chat\/assets\/upload\/[^/]+\/part\/\d+\/$/.test(url);
}

beforeEach(() => {
  post.mockReset();
});

describe("uploadAsset", () => {
  test("a file over 50 MB is begun, sent in parts, and completed", async () => {
    const size = 60 * MB;
    const { file, slices } = fakeFile(size);
    const progress: number[] = [];
    let completed: FormData | null = null;

    post.mockImplementation(async (url: string, data: FormData | { size: number }, config) => {
      if (url === "/chat/assets/upload/") {
        expect(data).toMatchObject({ kind: "doc", size, mime: "application/pdf", name: "report.pdf" });
        expect((data as unknown as { upload_id: string }).upload_id).toMatch(/^[0-9a-f-]{36}$/);
        return beginReply();
      }
      if (isPart(url)) {
        expect(config.headers["Content-Type"]).toBe("application/octet-stream");
        const body = data as { size: number };
        config.onUploadProgress?.({ loaded: body.size, total: body.size });
        const number = Number(url.match(/part\/(\d+)\//)?.[1]);
        return { data: { number, etag: `"etag-${number}"` } };
      }
      if (url.endsWith("/complete/")) {
        completed = data as FormData;
        return { data: { asset: ASSET } };
      }
      throw new Error(`unexpected ${url}`);
    });

    const asset = await uploadAsset(file, { onProgress: (percent) => progress.push(percent) });

    expect(asset).toBe(ASSET);
    expect(slices).toEqual([
      { start: 0, end: PART, size: PART },
      { start: PART, end: 2 * PART, size: PART },
      { start: 2 * PART, end: 3 * PART, size: PART },
      { start: 3 * PART, end: size, size: size - 3 * PART },
    ]);
    expect(completed).not.toBeNull();
    const form = completed as unknown as FormData;
    expect(JSON.parse(String(form.get("parts")))).toEqual([
      { number: 1, etag: "etag-1" },
      { number: 2, etag: "etag-2" },
      { number: 3, etag: "etag-3" },
      { number: 4, etag: "etag-4" },
    ]);
    expect(form.get("quality")).toBe("standard");
    expect(form.get("thumb")).toBeNull();
    // 100 is said only after `complete` has answered; every earlier number is
    // progress on the byte road and stops short of done.
    expect(progress.at(-1)).toBe(100);
    expect(Math.max(...progress.slice(0, -1))).toBeLessThan(100);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  test("a 409 from begin falls back to the one-request road", async () => {
    const { file } = fakeFile(60 * MB);
    let oneShot: FormData | null = null;

    post.mockImplementation(async (url: string, data: FormData) => {
      if (url === "/chat/assets/upload/") {
        throw new ApiError("This server cannot take that file directly.", {
          status: 409,
          code: "direct_upload_unavailable",
        });
      }
      if (url === "/chat/assets/") {
        oneShot = data;
        return { data: { asset: ASSET } };
      }
      throw new Error(`unexpected ${url}`);
    });

    const asset = await uploadAsset(file);

    expect(asset).toBe(ASSET);
    expect(oneShot).not.toBeNull();
    const form = oneShot as unknown as FormData;
    expect(form.get("kind")).toBe("doc");
    expect(form.get("file")).toBeTruthy();
    expect(post.mock.calls.some(([url]) => isPart(url))).toBe(false);
  });

  test("a file at or below 50 MB never asks to begin", async () => {
    const { file } = fakeFile(50 * MB);
    post.mockResolvedValue({ data: { asset: ASSET } });

    await uploadAsset(file);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe("/chat/assets/");
    expect(post.mock.calls[0][1]).toBeInstanceOf(FormData);
  });

  test("a failed part surfaces an ApiError and never completes", async () => {
    const { file } = fakeFile(60 * MB);

    post.mockImplementation(async (url: string) => {
      if (url === "/chat/assets/upload/") return beginReply();
      if (isPart(url)) {
        const number = Number(url.match(/part\/(\d+)\//)?.[1]);
        if (number === 2) {
          throw new ApiError("That part did not arrive.", { status: 502, code: "bad_gateway" });
        }
        return { data: { number, etag: `etag-${number}` } };
      }
      throw new Error(`unexpected ${url}`);
    });

    const failure = await uploadAsset(file).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(502);
    expect((failure as ApiError).message).toBe("That part did not arrive.");
    expect(post.mock.calls.some(([url]) => String(url).endsWith("/complete/"))).toBe(false);
    expect(post.mock.calls.some(([url]) => url === "/chat/assets/")).toBe(false);
  });
});
