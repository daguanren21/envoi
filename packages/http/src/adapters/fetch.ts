import { headersFromFetch } from "../headers";
import type { Adapter, HttpRequest, HttpResponse } from "../types";

export interface FetchAdapterOptions {
  /** Custom fetch implementation (test mock, runtime bridge, polyfill). */
  fetch?: typeof globalThis.fetch;
  /** Native defaults such as credentials, cache, redirect, mode, integrity. */
  init?: Omit<RequestInit, "method" | "headers" | "body" | "signal">;
}

async function parseBody(res: Response, type: HttpRequest["responseType"]): Promise<unknown> {
  if (type === "blob") return res.blob();
  if (type === "arrayBuffer") return res.arrayBuffer();
  if (type === "stream") return res.body;
  if (type === "text") return res.text();
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isNativeBody(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
  );
}

/** Native fetch adapter. Common URL/headers/timeout come from createHttp. */
export function fetchAdapter(options: FetchAdapterOptions = {}): Adapter {
  const fetcher = options.fetch ?? globalThis.fetch;
  return {
    name: "fetch",
    async request(req: HttpRequest): Promise<HttpResponse> {
      const headers = new Headers(req.headers);
      const init: RequestInit = { ...options.init, method: req.method, headers };
      if (req.signal) init.signal = req.signal;
      const body = req.body;
      if (body !== undefined && req.method !== "GET" && req.method !== "HEAD") {
        const nativeBody = isNativeBody(body);
        init.body = nativeBody ? body : JSON.stringify(body);
        if (!nativeBody && !headers.has("content-type"))
          headers.set("content-type", "application/json");
      }

      const res = await fetcher(req.url, init);
      return {
        status: res.status,
        statusText: res.statusText,
        headers: headersFromFetch(res.headers),
        body: await parseBody(res, req.responseType),
        raw: res,
      };
    },
  };
}
