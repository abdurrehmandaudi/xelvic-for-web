/**
 * A big file, sent in pieces through the API.
 *
 * Measured 2026-11-27: a 120 MB POST to `chat/assets/` came back a 413 from
 * Cloudflare, not from Django — the proxy in front of this server refuses a
 * body that size before the request is ever routed. The server has taken files
 * in parts for a while (`apps/chat/direct_uploads.py`), but that arrangement
 * hands the client presigned bucket addresses, and a browser cannot use them:
 * the bucket would have to grant this origin a CORS rule, which this
 * deployment cannot make. So the server also proxies each part, and this module
 * is that road's client. Every request goes through the ordinary `api`
 * instance, so it carries the account's Bearer token like any other call, and
 * each part is 16 MiB — comfortably under the proxy's ceiling.
 *
 * `upload.ts` takes this road only above 50 MB. At or below it the one-request
 * route is cheaper and already proven, so pictures, voice notes and small
 * documents behave exactly as they did.
 */

import api from "@/config/axios";
import { UPLOAD_TIMEOUT_MS } from "@/config/env";
import { ApiError, errorFromResponse } from "@/utils/errors";
import type { Asset } from "@/types/api";

/**
 * Above this, one POST is refused by the proxy in front of Django.
 *
 * The 413 was measured at 120 MB; 50 MB is the line because it leaves room
 * under the proxy's limit for anything the browser adds to the body, and
 * because a document up to 50 MB through one request is already a size that
 * works today.
 */
export const DIRECT_UPLOAD_THRESHOLD = 50 * 1024 * 1024;

/**
 * How many parts are in the air at once.
 *
 * Three is enough to keep a single uplink busy without turning a dropped
 * connection into three failures at the same moment, and it is deliberately
 * small: the order of magnitude that matters is "parts overlap", not "saturate
 * the network".
 */
const PART_CONCURRENCY = 3;

/** The begin route's answer, trimmed to what this client reads. */
interface BeginReply {
  upload?: {
    id: string;
    part_size: number;
    parts: number;
  };
  /** A finished upload with the same client id answers with its asset instead. */
  asset?: Asset;
}

interface PartReply {
  number: number;
  etag: string;
}

/** The description of the file both upload roads send. */
export interface DirectUploadShape {
  quality?: string;
  width?: number;
  height?: number;
  duration_ms?: number;
  waveform?: number[];
  thumb?: File;
}

export interface DirectUploadOptions {
  signal?: AbortSignal;
  /** Called with 0–100 while the whole file is moving to the server. */
  onProgress?: (percent: number) => void;
}

/**
 * "This server cannot take a file this way."
 *
 * A deployment with no bucket answers the begin route with 409, and a server
 * from before this route existed answers 404. Both mean *use the road you
 * already have* rather than *this upload failed*, so they leave here as their
 * own signal and `upload.ts` falls back on it.
 */
export class DirectUploadUnavailable extends Error {
  constructor(message = "Direct uploads are not available on this server.") {
    super(message);
    this.name = "DirectUploadUnavailable";
  }
}

export function isDirectUploadUnavailable(error: unknown): error is DirectUploadUnavailable {
  return error instanceof DirectUploadUnavailable;
}

function isAbort(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Every failure leaving this module is the `ApiError` the one-request road
 * already throws.
 *
 * Going through `api` means the interceptor has usually done that already; the
 * branch for a raw response exists for the client's own tests, which replace
 * that instance, and so this module still reports a status and the server's
 * words rather than an axios-shaped object.
 */
function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const shaped = error as {
    response?: { status?: number; data?: unknown; headers?: Record<string, string> };
    message?: string;
  } | null;
  const status = shaped?.response?.status;
  if (typeof status === "number") {
    const mapped = errorFromResponse(
      status,
      shaped?.response?.data,
      shaped?.response?.headers?.["retry-after"] ?? null,
    );
    // A 413 without a code of the server's own is still the same refusal the
    // one-request road reports when the client checks the limit itself.
    if (status === 413 && mapped.code === "request_failed") mapped.code = "too_large";
    return mapped;
  }
  return new ApiError(
    (error instanceof Error && error.message) || "The upload did not finish.",
    { code: "request_failed" },
  );
}

function unavailable(status: number | undefined): boolean {
  // 409 is this server saying it has no bucket; 404 is a server from before the
  // route existed. Anything else — a 400, a 500, a part that failed — is a real
  // failure and must not be retried as a single body that would only 413.
  return status === 409 || status === 404;
}

function statusOf(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  const shaped = error as { response?: { status?: number } } | null;
  return shaped?.response?.status;
}

/**
 * Strip the quotes the bucket puts around an etag.
 *
 * The proxied route already does this, but an etag is only ever compared as a
 * token and a quoted one handed to `complete` is a part S3 says it does not
 * have. Being forgiving here costs nothing and removes a class of "the file is
 * not in one piece" that is really "the quotes were in the wrong place".
 */
function bareEtag(value: string): string {
  return value.replace(/^"|"$/g, "");
}

function partCountFor(reply: BeginReply["upload"], size: number): number {
  if (!reply) return 0;
  if (reply.parts > 0) return reply.parts;
  return Math.max(1, Math.ceil(size / reply.part_size));
}

/**
 * Send one file in parts and return the asset the one-request road would have
 * returned.
 *
 * The begin request decides the part size, not this client: the server already
 * raises it for a file too large to fit in a thousand parts, and a client that
 * picked its own would disagree with the bucket about where part seven starts.
 */
export async function directUploadAsset(
  file: File,
  kind: Asset["kind"],
  shape: DirectUploadShape,
  options: DirectUploadOptions = {},
): Promise<Asset> {
  const uploadId = crypto.randomUUID();
  let begun: BeginReply;
  try {
    const response = await api.post<BeginReply>(
      "/chat/assets/upload/",
      {
        upload_id: uploadId,
        kind,
        size: file.size,
        mime: file.type || "",
        name: file.name || "",
      },
      { signal: options.signal, timeout: UPLOAD_TIMEOUT_MS },
    );
    begun = response.data;
  } catch (error) {
    if (isAbort(error)) throw error;
    if (unavailable(statusOf(error))) {
      throw new DirectUploadUnavailable();
    }
    throw asApiError(error);
  }

  if (!begun.upload) {
    // The only other answer `begin` gives is a finished upload's asset, which
    // a fresh client id can only reach if the reply was lost and the retry
    // replayed it. Nothing is left to send in that case.
    if (begun.asset) {
      options.onProgress?.(100);
      return begun.asset;
    }
    throw new ApiError("The server did not open that upload.", { code: "request_failed" });
  }

  const upload = begun.upload;
  const partSize = Math.max(1, upload.part_size);
  const count = partCountFor(upload, file.size);
  const total = file.size;
  const etags: { number: number; etag: string }[] = new Array(count);

  /*
   * Progress while parts overlap cannot be one part's percentage: three parts
   * are in the air and a single number has to describe all of them. So the
   * bytes of finished parts are counted once, the bytes each in-flight part
   * reports are added as they are reported, and the sum is divided by the whole
   * file. It never reaches 100 before `complete` has answered, because the last
   * part's bytes are not the server's acceptance of them.
   */
  let finishedBytes = 0;
  let reported = 0;
  const moving = new Map<number, number>();
  const report = () => {
    if (!options.onProgress || total <= 0) return;
    let loaded = finishedBytes;
    for (const partLoaded of moving.values()) loaded += partLoaded;
    const percent = Math.min(99, Math.round((loaded / total) * 100));
    if (percent > reported) {
      reported = percent;
      options.onProgress(percent);
    }
  };

  const sendPart = async (number: number) => {
    const start = (number - 1) * partSize;
    const end = Math.min(start + partSize, total);
    if (end <= start) return { number, etag: "" };
    const body = file.slice(start, end);
    const response = await api.post<PartReply>(
      `/chat/assets/upload/${uploadId}/part/${number}/`,
      body,
      {
        signal: options.signal,
        timeout: UPLOAD_TIMEOUT_MS,
        headers: { "Content-Type": "application/octet-stream" },
        onUploadProgress: options.onProgress
          ? (event) => {
              if (!event.total) return;
              moving.set(number, Math.min(event.loaded, end - start));
              report();
            }
          : undefined,
      },
    );
    return {
      number: response.data?.number ?? number,
      etag: bareEtag(response.data?.etag ?? ""),
    };
  };

  let failure: unknown = null;
  let next = 1;
  const worker = async () => {
    while (failure === null && !options.signal?.aborted) {
      const number = next;
      next += 1;
      if (number > count) return;
      const start = (number - 1) * partSize;
      const end = Math.min(start + partSize, total);
      try {
        etags[number - 1] = await sendPart(number);
        finishedBytes += Math.max(0, end - start);
        moving.delete(number);
        report();
      } catch (error) {
        failure = error;
        return;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PART_CONCURRENCY, count) }, () => worker()),
  );

  if (failure !== null) {
    if (isAbort(failure)) throw failure;
    throw asApiError(failure);
  }
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const form = new FormData();
  form.append("parts", JSON.stringify(etags.filter(Boolean)));
  form.append("quality", shape.quality ?? "standard");
  if (shape.width) form.append("width", String(shape.width));
  if (shape.height) form.append("height", String(shape.height));
  if (shape.duration_ms !== undefined) form.append("duration_ms", String(Math.round(shape.duration_ms)));
  if (shape.waveform?.length) form.append("waveform", JSON.stringify(shape.waveform));
  if (shape.thumb) form.append("thumb", shape.thumb);

  let finished: { asset?: Asset } & Asset;
  try {
    const response = await api.post<{ asset?: Asset } & Asset>(
      `/chat/assets/upload/${uploadId}/complete/`,
      form,
      { signal: options.signal, timeout: UPLOAD_TIMEOUT_MS },
    );
    finished = response.data;
  } catch (error) {
    if (isAbort(error)) throw error;
    throw asApiError(error);
  }

  options.onProgress?.(100);
  return finished.asset ?? finished;
}
