# Public API

## `createHttp(options)`

Creates a callable `HttpClient`. `adapter` is required; an omitted `envelope` selects HTTP-only behavior.

```ts
const http = createHttp({
  adapter: "fetch",
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
    headers: { "Accept-Language": "en-US" },
  },
  envelope: { code: "code", msg: "msg", data: "data" },
  hooks: {
    onRequest,
    onRequestError,
    onResponse,
    onResponseError,
    onSuccess,
    onFinally,
  },
});
```

## `createHttpFactory(projectOptions)`

Returns a client factory. Per-client overrides replace adapter/envelope, merge defaults and headers, and append hooks.

```ts
const createProjectHttp = createHttpFactory(projectOptions);
const http = createProjectHttp();
const special = createProjectHttp(overrides);
```

## `HttpClient`

```ts
http<T>(url, options?): Promise<T>
http.get<T>(url, options?): Promise<T>
http.post<T>(url, data?, options?): Promise<T>
http.put<T>(url, data?, options?): Promise<T>
http.patch<T>(url, data?, options?): Promise<T>
http.delete<T>(url, options?): Promise<T>
http.envelope<TEnvelope>(url, options?): Promise<TEnvelope>
http.raw<T>(url, options?): Promise<HttpResponse<T>>
```

## Request options

```ts
interface CallOptions {
  method?: string;
  headers?: Record<string, string>;
  query?: QueryObject;
  body?: unknown;
  data?: unknown;
  params?: QueryObject;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: "json" | "text" | "blob" | "arrayBuffer" | "stream";
  silent?: boolean;
  skipEnvelope?: boolean;
  ignoreResponseError?: boolean;
  hooks?: HttpHooks;
  meta?: Record<string, unknown>;
}
```

`data` aliases `body`; `params` aliases `query`. Explicit `null`, `false`, `0`, and empty-string bodies are preserved.

Adapter-specific request fields use namespaced `meta`. The axios adapter merges `meta.axios` into its native config before enforcing the normalized request fields.

## `DefaultEnvelope<T>`

```ts
interface DefaultEnvelope<T> {
  code: number | string;
  msg?: string;
  data: T;
}
```

## `defineEnvelope<TBody, TValue>(config)`

Adds contextual types to arbitrary protocol callbacks and preserves custom errors.

## Hooks

```ts
interface HookContext {
  request: HttpRequest;
  response?: HttpResponse;
  error?: unknown;
  value?: unknown;
}

interface HttpHooks {
  onRequest?: Hook<HookContext> | Hook<HookContext>[];
  onRequestError?: Hook<RequestErrorContext> | Hook<RequestErrorContext>[];
  onResponse?: Hook<ResponseContext> | Hook<ResponseContext>[];
  onResponseError?: Hook<ResponseErrorContext> | Hook<ResponseErrorContext>[];
  onSuccess?: Hook<SuccessContext> | Hook<SuccessContext>[];
  onFinally?: Hook<HookContext> | Hook<HookContext>[];
}
```

## Adapters

```ts
createAxiosInstance(options?: AxiosInstanceOptions): AxiosInstance
axiosAdapter(options?: AxiosAdapterOptions): Adapter
axiosAdapter(instance: AxiosInstance): Adapter
fetchAdapter(options?): Adapter
ofetchAdapter(options?): Adapter
```

`AxiosInstance`, `AxiosInstanceOptions`, and `createAxiosInstance` are exported by envoi. Application code does not import axios directly.

A custom adapter implements:

```ts
interface Adapter {
  readonly name: string;
  request(request: HttpRequest): Promise<HttpResponse>;
}
```

## Errors

`BizError` exposes:

```ts
error.code;
error.msg;
error.body;
error.source; // "http" | "body"
error.kind; // "unauthorized" | "warning" | "error"
```

Transport errors pass through `onRequestError`, which may replace `ctx.error`. If request and cleanup hooks both fail, envoi rejects an `AggregateError` containing every failure.

## Middleware and built-in hooks

```ts
createMiddleware(hooks: HttpHooks): HttpHooks;
mergeMiddleware(...bundles: Array<HttpHooks | undefined>): HttpHooks;
auth(getToken): Hook<HookContext>;
legacyStringBody(): Hook<HookContext>;
```

`createMiddleware` defines a reusable typed hook bundle. `mergeMiddleware` composes bundles in declaration order. See [Reusable middleware](../guide/middleware).
