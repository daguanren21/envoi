import { withBase, withQuery } from "ufo";
import { resolveAdapter } from "./adapters/resolve";
import { errorFromEnvelope, resolveEnvelope } from "./envelope";
import { normalizeHeaders } from "./headers";
import { callHooks } from "./hooks";
import type {
  Adapter,
  CallOptions,
  CreateHttpOptions,
  HookContext,
  HttpClient,
  HttpRequest,
  HttpRequestOptions,
} from "./types";

function toRequest(
  url: string,
  options: CallOptions = {},
  defaults: CreateHttpOptions["defaults"],
): HttpRequest {
  const method = (options.method ?? "GET").toUpperCase();
  const req: HttpRequest = {
    url,
    method,
    headers: { ...defaults?.headers, ...normalizeHeaders(options.headers) },
    meta: { ...options.meta },
  };
  const body = options.body !== undefined ? options.body : options.data;
  const query = options.query ?? options.params;
  if (body !== undefined) req.body = body;
  if (query) req.query = query;
  if (options.signal) req.signal = options.signal;
  const timeout = options.timeout ?? defaults?.timeout;
  if (timeout !== undefined) req.timeout = timeout;
  if (options.responseType) req.responseType = options.responseType;
  if (options.silent !== undefined) req.meta.silent = options.silent;
  if (options.skipEnvelope !== undefined) req.meta.skipEnvelope = options.skipEnvelope;
  if (options.ignoreResponseError !== undefined)
    req.meta.ignoreResponseError = options.ignoreResponseError;
  return req;
}

function finalizeRequest(request: HttpRequest, defaults: CreateHttpOptions["defaults"]): void {
  request.url = defaults?.baseURL ? withBase(request.url, defaults.baseURL) : request.url;
  if (request.query) {
    request.url = withQuery(request.url, request.query);
    delete request.query;
  }
}

function applyTimeout(request: HttpRequest): (() => void) | undefined {
  if (!request.timeout) return undefined;

  const externalSignal = request.signal;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    request.timeout,
  );
  let forwardAbort: (() => void) | undefined;

  if (externalSignal?.aborted) {
    controller.abort(externalSignal.reason);
  } else if (externalSignal) {
    forwardAbort = () => controller.abort(externalSignal.reason);
    externalSignal.addEventListener("abort", forwardAbort, { once: true });
  }
  request.signal = controller.signal;

  return () => {
    clearTimeout(timer);
    if (forwardAbort) externalSignal?.removeEventListener("abort", forwardAbort);
  };
}

/**
 * Create a typed HTTP client.
 *
 * Default adapter is `'axios'` (pinned). Hooks match ofetch:
 * `onRequest` → adapter → `onResponse` / `onRequestError` / `onResponseError`.
 * Arrays run in order. Returns ignored.
 *
 * Stores are not imported. Pinia / Vuex / Jotai `await` the `Promise<T>`.
 */
export function createHttp<TBody = unknown, TValue = unknown>(
  options: CreateHttpOptions<TBody, TValue> = {},
): HttpClient {
  const adapter: Adapter = resolveAdapter(options.adapter ?? "axios");
  const hooks = options.hooks ?? {};

  async function dispatch<T>(
    url: string,
    callOptions: CallOptions,
    mode: "value" | "envelope" | "raw",
  ): Promise<T> {
    const ctx: HookContext = { request: toRequest(url, callOptions, options.defaults) };
    const localHooks = callOptions.hooks ?? {};
    await callHooks(ctx, hooks.onRequest);
    await callHooks(ctx, localHooks.onRequest);
    finalizeRequest(ctx.request, options.defaults);

    const cleanupTimeout = applyTimeout(ctx.request);
    try {
      ctx.response = await adapter.request(ctx.request);
    } catch (error) {
      ctx.error = error;
      const errorContext = ctx as HookContext & { error: unknown };
      await callHooks(errorContext, hooks.onRequestError);
      await callHooks(errorContext, localHooks.onRequestError);
      throw error;
    } finally {
      cleanupTimeout?.();
    }
    const responseContext = ctx as HookContext & {
      response: NonNullable<HookContext["response"]>;
    };
    await callHooks(responseContext, hooks.onResponse);
    if (!ctx.response) throw new Error("[envoi] global onResponse removed the response");
    await callHooks(responseContext, localHooks.onResponse);
    const response = ctx.response;
    if (!response) throw new Error("[envoi] request onResponse removed the response");
    const skipEnvelope =
      mode === "raw" ||
      ctx.request.meta.skipEnvelope === true ||
      ctx.request.responseType === "blob";
    const resolved = resolveEnvelope(response, skipEnvelope ? false : options.envelope);

    const responseError = errorFromEnvelope(resolved);
    if (responseError) {
      ctx.error = responseError;
      const errorContext = ctx as HookContext & {
        response: typeof response;
        error: Error;
      };
      await callHooks(errorContext, hooks.onResponseError);
      await callHooks(errorContext, localHooks.onResponseError);
      if (ctx.request.meta.ignoreResponseError !== true) throw responseError;
      return (mode === "raw" ? response : resolved.body) as T;
    }

    if (skipEnvelope) return (mode === "raw" ? response : response.body) as T;

    return (mode === "envelope" ? resolved.body : resolved.value) as T;
  }

  async function call<T>(url: string, callOptions: CallOptions = {}): Promise<T> {
    return dispatch<T>(url, callOptions, "value");
  }

  const http = Object.assign(call, {
    get<T>(url: string, req: HttpRequestOptions = {}) {
      return dispatch<T>(url, { ...req, method: "GET" }, "value");
    },
    post<T>(url: string, data?: unknown, req: HttpRequestOptions = {}) {
      const body = data !== undefined ? data : req.body;
      return dispatch<T>(url, { ...req, method: "POST", body }, "value");
    },
    put<T>(url: string, data?: unknown, req: HttpRequestOptions = {}) {
      const body = data !== undefined ? data : req.body;
      return dispatch<T>(url, { ...req, method: "PUT", body }, "value");
    },
    patch<T>(url: string, data?: unknown, req: HttpRequestOptions = {}) {
      const body = data !== undefined ? data : req.body;
      return dispatch<T>(url, { ...req, method: "PATCH", body }, "value");
    },
    delete<T>(url: string, req: HttpRequestOptions = {}) {
      return dispatch<T>(url, { ...req, method: "DELETE" }, "value");
    },
    envelope<T>(url: string, req: HttpRequestOptions = {}) {
      return dispatch<T>(url, req, "envelope");
    },
    raw<T>(url: string, req: HttpRequestOptions = {}) {
      return dispatch<T>(url, { ...req, skipEnvelope: true }, "raw");
    },
    get adapter() {
      return adapter;
    },
  }) as HttpClient;

  return http;
}
