import type { QueryObject } from "ufo";
import type { ResultKind } from "./error";
import type { Hook } from "./hooks";

export type { Hook };

/**
 * Wire request. `url` is final (baseURL + serialized query) when an adapter
 * receives it. Hooks may edit `query`; the core serializes it after onRequest.
 */
export interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  query?: QueryObject;
  signal?: AbortSignal;
  timeout?: number;
  responseType?: "json" | "text" | "blob" | "arrayBuffer" | "stream";
  meta: Record<string, unknown>;
}

/**
 * Wire response after the adapter has parsed the body.
 * `raw` is the original AxiosResponse / Response / ofetch result.
 */
export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: T;
  raw?: unknown;
}

export interface HookContext {
  request: HttpRequest;
  response?: HttpResponse;
  error?: unknown;
}

/**
 * ofetch-shaped lifecycle hooks. Arrays run in order. Return values are ignored
 * (same as ofetch — a hook cannot replace the request by returning).
 *
 * - `onRequest` — mutate `ctx.request` before the adapter
 * - `onRequestError` — adapter threw (network / abort)
 * - `onResponse` — adapter returned; mutate `ctx.response` (status, body, headers)
 * - `onResponseError` — HTTP 4xx/5xx **or** envelope non-ok, before throw
 */
export interface HttpHooks {
  onRequest?: Hook<HookContext> | Hook<HookContext>[];
  onRequestError?:
    | Hook<HookContext & { error: unknown }>
    | Hook<HookContext & { error: unknown }>[];
  onResponse?:
    | Hook<HookContext & { response: HttpResponse }>
    | Hook<HookContext & { response: HttpResponse }>[];
  onResponseError?:
    | Hook<HookContext & { response: HttpResponse }>
    | Hook<HookContext & { response: HttpResponse }>[];
}

/**
 * Transport adapter contract.
 * Return every HTTP response, including 4xx/5xx. Throw only for transport
 * failures such as network errors, aborts, or timeouts.
 */
export interface Adapter {
  readonly name: string;
  request(req: HttpRequest): Promise<HttpResponse>;
}

export type AdapterName = "axios" | "fetch" | "ofetch";

export type AdapterOption = AdapterName | Adapter;

export interface EnvelopeKeys {
  code?: string;
  msg?: string;
  data?: string;
}

export interface EnvelopeMap extends EnvelopeKeys {
  ok?: (code: number | string) => boolean;
  unauthorized?: (code: number | string) => boolean;
  warning?: (code: number | string) => boolean;
}

/** Default protocol body used by `envelope<TData>()`. */
export interface DefaultEnvelope<TData> {
  code: number | string;
  msg?: string;
  data: TData;
}

export interface EnvelopeFns<TBody = unknown, TValue = unknown> {
  read: (res: HttpResponse) => TBody;
  kind: (body: TBody, res: HttpResponse) => ResultKind;
  value: (body: TBody, res: HttpResponse) => TValue;
  error: (body: TBody, res: HttpResponse) => Error;
}

export type EnvelopeOption<TBody = unknown, TValue = unknown> =
  | EnvelopeMap
  | EnvelopeFns<TBody, TValue>
  | false;

export interface CreateHttpOptions<TBody = unknown, TValue = unknown> {
  /**
   * Transport. Built-in: `'axios'` (default), `'fetch'`, `'ofetch'`.
   * Pass `{ name, request }` for ky / got / mocks.
   */
  adapter?: AdapterOption;
  defaults?: {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
  };
  envelope?: EnvelopeOption<TBody, TValue>;
  hooks?: HttpHooks;
}

export interface CallOptions {
  method?: string;
  headers?: Record<string, string>;
  query?: QueryObject;
  body?: unknown;
  data?: unknown;
  params?: QueryObject;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: HttpRequest["responseType"];
  silent?: boolean;
  skipEnvelope?: boolean;
  /**
   * Return a non-ok response instead of throwing.
   * The returned value is the complete response body (or HttpResponse for raw()).
   * @default false
   */
  ignoreResponseError?: boolean;
  /** Hooks for this request only. Global hooks run first. */
  hooks?: HttpHooks;
  meta?: Record<string, unknown>;
}

export interface HttpRequestOptions extends CallOptions {}

export interface HttpClient {
  /**
   * ofetch-shaped callable. Same unwrap as {@link HttpClient.get}.
   * Store-agnostic: Vuex / Pinia / Jotai / Redux all `await` this `Promise<T>`.
   */
  <T = unknown>(url: string, options?: CallOptions): Promise<T>;
  get<T = unknown>(url: string, options?: HttpRequestOptions): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions): Promise<T>;
  patch<T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions): Promise<T>;
  delete<T = unknown>(url: string, options?: HttpRequestOptions): Promise<T>;
  envelope<TData = unknown, TEnvelope = DefaultEnvelope<TData>>(
    url: string,
    options?: HttpRequestOptions,
  ): Promise<TEnvelope>;
  raw<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  readonly adapter: Adapter;
}
