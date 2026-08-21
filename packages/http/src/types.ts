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
  value?: unknown;
}

export interface RequestErrorContext extends HookContext {
  error: unknown;
}

export interface ResponseContext extends HookContext {
  response: HttpResponse;
}

export interface ResponseErrorContext extends ResponseContext {
  error: Error;
}

export interface SuccessContext<T = unknown> extends ResponseContext {
  value: T;
}

/**
 * Lifecycle hooks run sequentially in declaration order. Return values are
 * ignored; mutate the typed context when customization is required.
 *
 * - `onRequest` — before request normalization and adapter dispatch
 * - `onRequestError` — adapter threw (network / abort / timeout)
 * - `onResponse` — adapter returned, before response policy classification
 * - `onResponseError` — HTTP or envelope policy classified a failure
 * - `onSuccess` — final value selected, before the promise resolves
 * - `onFinally` — once after every resolved or rejected request
 */
export interface HttpHooks {
  onRequest?: Hook<HookContext> | Hook<HookContext>[];
  onRequestError?: Hook<RequestErrorContext> | Hook<RequestErrorContext>[];
  onResponse?: Hook<ResponseContext> | Hook<ResponseContext>[];
  onResponseError?: Hook<ResponseErrorContext> | Hook<ResponseErrorContext>[];
  onSuccess?: Hook<SuccessContext> | Hook<SuccessContext>[];
  onFinally?: Hook<HookContext> | Hook<HookContext>[];
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

/** Standard `{ code, msg, data }` packet for an explicitly configured envelope. */
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

export interface HttpDefaults {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface CreateHttpOptions<TBody = unknown, TValue = unknown> {
  /** Explicit transport: a built-in name or a custom adapter object. */
  adapter: AdapterOption;
  defaults?: HttpDefaults;
  /** Undefined and false both mean HTTP-only response handling. */
  envelope?: EnvelopeOption<TBody, TValue>;
  hooks?: HttpHooks;
}

export interface HttpClientOverrides<TBody = unknown, TValue = unknown> {
  adapter?: AdapterOption;
  defaults?: HttpDefaults;
  envelope?: EnvelopeOption<TBody, TValue>;
  hooks?: HttpHooks;
}

export interface HttpClientFactory<TBody = unknown, TValue = unknown> {
  (overrides?: HttpClientOverrides<TBody, TValue>): HttpClient;
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
  /** Namespaced adapter/plugin data, for example `meta.axios`. */
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
  envelope<TEnvelope = unknown>(url: string, options?: HttpRequestOptions): Promise<TEnvelope>;
  raw<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  readonly adapter: Adapter;
}
