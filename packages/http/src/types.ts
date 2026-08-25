import type { QueryObject } from "ufo";
import type { ResultKind } from "./error";
import type { Hook } from "./hooks";

export type { Hook };

/**
 * Wire request. `url` is final (baseURL + serialized query) when an adapter
 * receives it. Hooks may edit `query`; the core serializes it after onRequest.
 */
export interface HttpRequest {
  /** Final URL passed to the adapter, including `baseURL` and serialized query parameters. */
  url: string;
  /** Uppercase HTTP method used for transport dispatch. */
  method: string;
  /** Case-insensitive request headers normalized to string values. */
  headers: Record<string, string>;
  /** Request payload before the selected adapter performs transport-specific serialization. */
  body?: unknown;
  /** Query values serialized after `onRequest` hooks finish. */
  query?: QueryObject;
  /** Abort signal combining the caller signal with the configured timeout. */
  signal?: AbortSignal;
  /** Timeout in milliseconds; `0` disables timeout-driven cancellation. */
  timeout?: number;
  /** Response representation requested from the transport. */
  responseType?: "json" | "text" | "blob" | "arrayBuffer" | "stream";
  /** Namespaced adapter and plugin metadata that core request normalization does not interpret. */
  meta: Record<string, unknown>;
}

/**
 * Wire response after the adapter has parsed the body.
 * `raw` is the original AxiosResponse / Response / ofetch result.
 */
export interface HttpResponse<T = unknown> {
  /** HTTP status code returned by the transport. */
  status: number;
  /** HTTP status text when provided by the runtime. */
  statusText: string;
  /** Response headers normalized to string values. */
  headers: Record<string, string>;
  /** Parsed response payload. */
  body: T;
  /** Original transport response retained for adapter-specific integrations. */
  raw?: unknown;
}

/**
 * Mutable state shared by hooks for one request.
 *
 * Hooks may update `request`, `value`, or error-related fields for the current lifecycle only.
 */
export interface HookContext {
  /** Normalized request being processed. */
  request: HttpRequest;
  /** Transport response once one has been received. */
  response?: HttpResponse;
  /** Current request or classification error. */
  error?: unknown;
  /** Application value selected by the response policy. */
  value?: unknown;
}

/** Context passed to `onRequestError` after a transport failure. */
export interface RequestErrorContext extends HookContext {
  error: unknown;
}

/** Context passed to `onResponse` after the adapter returns. */
export interface ResponseContext extends HookContext {
  response: HttpResponse;
}

/** Context passed to `onResponseError` after HTTP or envelope classification fails. */
export interface ResponseErrorContext extends ResponseContext {
  error: Error;
}

/** Context passed to `onSuccess` before the request promise resolves. */
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
  /** Runs before URL/query normalization and adapter dispatch. */
  onRequest?: Hook<HookContext> | Hook<HookContext>[];
  /** Runs when the adapter throws for network, abort, or timeout failures. */
  onRequestError?: Hook<RequestErrorContext> | Hook<RequestErrorContext>[];
  /** Runs after an adapter returns and before response classification. */
  onResponse?: Hook<ResponseContext> | Hook<ResponseContext>[];
  /** Runs after HTTP or envelope policy classifies a failure. */
  onResponseError?: Hook<ResponseErrorContext> | Hook<ResponseErrorContext>[];
  /** Runs with the final application value before resolving. */
  onSuccess?: Hook<SuccessContext> | Hook<SuccessContext>[];
  /** Runs exactly once after every resolved or rejected request. */
  onFinally?: Hook<HookContext> | Hook<HookContext>[];
}

/**
 * Transport adapter contract.
 * Return every HTTP response, including 4xx/5xx. Throw only for transport
 * failures such as network errors, aborts, or timeouts.
 */
export interface Adapter {
  /** Stable adapter identifier exposed on the created client. */
  readonly name: string;
  /** Dispatches one normalized request and returns every HTTP response, including 4xx/5xx. */
  request(req: HttpRequest): Promise<HttpResponse>;
}

/** Built-in transport names accepted by `createHttp`. */
export type AdapterName = "axios" | "fetch" | "ofetch";

/** A built-in transport name or a custom object implementing the adapter contract. */
export type AdapterOption = AdapterName | Adapter;

/** Field names used to read a mapped backend envelope. */
export interface EnvelopeKeys {
  /** Backend field containing the business result code. */
  code?: string;
  /** Backend field containing the display or diagnostic message. */
  msg?: string;
  /** Backend field containing the application payload. */
  data?: string;
}

/** Declarative envelope mapping with optional business-code classifiers. */
export interface EnvelopeMap extends EnvelopeKeys {
  /** Returns true when the business code represents success. */
  ok?: (code: number | string) => boolean;
  /** Returns true when the business code requires authentication. */
  unauthorized?: (code: number | string) => boolean;
  /** Returns true when the response should resolve while being classified as a warning. */
  warning?: (code: number | string) => boolean;
}

/** Standard `{ code, msg, data }` packet for an explicitly configured envelope. */
export interface DefaultEnvelope<TData> {
  /** Business result code returned by the backend. */
  code: number | string;
  /** Optional backend message. */
  msg?: string;
  /** Application payload extracted by the standard envelope policy. */
  data: TData;
}

/** Functional envelope policy for non-standard backend response shapes. */
export interface EnvelopeFns<TBody = unknown, TValue = unknown> {
  /** Reads the backend envelope from a parsed transport response. */
  read: (res: HttpResponse) => TBody;
  /** Classifies the envelope outcome. */
  kind: (body: TBody, res: HttpResponse) => ResultKind;
  /** Extracts the application value returned by normal client methods. */
  value: (body: TBody, res: HttpResponse) => TValue;
  /** Creates the error thrown for non-success outcomes. */
  error: (body: TBody, res: HttpResponse) => Error;
}

/** Declarative, functional, or disabled response-envelope policy. */
export type EnvelopeOption<TBody = unknown, TValue = unknown> =
  | EnvelopeMap
  | EnvelopeFns<TBody, TValue>
  | false;

/** Defaults merged into every request before request-local options. */
export interface HttpDefaults {
  /** Base URL prepended to relative request URLs. */
  baseURL?: string;
  /** Default timeout in milliseconds. */
  timeout?: number;
  /** Headers applied before request-local headers and hooks. */
  headers?: Record<string, string>;
}

/** Construction options for a typed HTTP client. */
export interface CreateHttpOptions<TBody = unknown, TValue = unknown> {
  /** Explicit transport: a built-in name or a custom adapter object. */
  adapter: AdapterOption;
  /** Request defaults shared by every call. */
  defaults?: HttpDefaults;
  /** Undefined and false both mean HTTP-only response handling. */
  envelope?: EnvelopeOption<TBody, TValue>;
  /** Global lifecycle hooks. Request-local hooks run after these hooks. */
  hooks?: HttpHooks;
}

/** Overrides accepted by a project-level `HttpClientFactory`. */
export interface HttpClientOverrides<TBody = unknown, TValue = unknown> {
  /** Replacement transport for this client instance. */
  adapter?: AdapterOption;
  /** Request defaults merged with the factory defaults, including a header-level merge. */
  defaults?: HttpDefaults;
  /** Replacement envelope policy for this client instance. */
  envelope?: EnvelopeOption<TBody, TValue>;
  /** Lifecycle hooks appended after the factory hooks. */
  hooks?: HttpHooks;
}

/** Callable factory produced by `createHttpFactory`. */
export interface HttpClientFactory<TBody = unknown, TValue = unknown> {
  /** Creates one client by merging optional overrides with the factory baseline. */
  (overrides?: HttpClientOverrides<TBody, TValue>): HttpClient;
}

/** Per-request options accepted by the callable client form. */
export interface CallOptions {
  /** HTTP method used by the callable client; defaults to `GET`. */
  method?: string;
  /** Request-local headers applied after client defaults. */
  headers?: Record<string, string>;
  /** Canonical query object. */
  query?: QueryObject;
  /** Canonical request body. */
  body?: unknown;
  /** Axios-compatible alias for `body`. */
  data?: unknown;
  /** Axios-compatible alias for `query`. */
  params?: QueryObject;
  /** Request-local timeout override in milliseconds. */
  timeout?: number;
  /** Caller-controlled abort signal. */
  signal?: AbortSignal;
  /** Requested response representation. */
  responseType?: HttpRequest["responseType"];
  /** Suppresses user-interface side effects in project hooks; core does not interpret this flag. */
  silent?: boolean;
  /** Skips envelope extraction and returns the complete parsed body. */
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

/** Method-call request options; currently identical to `CallOptions`. */
export interface HttpRequestOptions extends CallOptions {}

/**
 * Typed HTTP client whose normal methods resolve application values.
 *
 * Use `envelope()` for the complete parsed envelope and `raw()` for transport metadata.
 */
export interface HttpClient {
  /**
   * ofetch-shaped callable. Same unwrap as {@link HttpClient.get}.
   * Store-agnostic: Vuex / Pinia / Jotai / Redux all `await` this `Promise<T>`.
   */
  <T = unknown>(url: string, options?: CallOptions): Promise<T>;
  /** Sends a GET request and resolves the envelope's application value. */
  get<T = unknown>(url: string, options?: HttpRequestOptions): Promise<T>;
  /** Sends a POST request with `data` and resolves the envelope's application value. */
  post<T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions): Promise<T>;
  /** Sends a PUT request with `data` and resolves the envelope's application value. */
  put<T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions): Promise<T>;
  /** Sends a PATCH request with `data` and resolves the envelope's application value. */
  patch<T = unknown>(url: string, data?: unknown, options?: HttpRequestOptions): Promise<T>;
  /** Sends a DELETE request and resolves the envelope's application value. */
  delete<T = unknown>(url: string, options?: HttpRequestOptions): Promise<T>;
  /** Returns the complete parsed envelope without extracting its application value. */
  envelope<TEnvelope = unknown>(url: string, options?: HttpRequestOptions): Promise<TEnvelope>;
  /** Returns transport metadata and the parsed body without applying envelope extraction. */
  raw<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** Adapter selected when the client was created. */
  readonly adapter: Adapter;
}
