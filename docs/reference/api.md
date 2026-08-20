# Public API

## `createHttp(options?)`

Creates a callable `HttpClient`. Axios is the default adapter.

```ts
const http = createHttp({
  adapter: "axios",
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
    headers: { "Accept-Language": "en-US" },
  },
  envelope: { code: "code", msg: "msg", data: "data" },
  hooks: { onRequest, onResponse, onRequestError, onResponseError },
});
```

## `HttpClient`

```ts
http<T>(url, options?): Promise<T>
http.get<T>(url, options?): Promise<T>
http.post<T>(url, data?, options?): Promise<T>
http.put<T>(url, data?, options?): Promise<T>
http.patch<T>(url, data?, options?): Promise<T>
http.delete<T>(url, options?): Promise<T>
http.envelope<TData, TEnvelope?>(url, options?): Promise<TEnvelope>
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
interface HttpHooks {
  onRequest?: Hook<HookContext> | Hook<HookContext>[];
  onRequestError?: Hook<RequestErrorContext> | Hook<RequestErrorContext>[];
  onResponse?: Hook<ResponseContext> | Hook<ResponseContext>[];
  onResponseError?: Hook<ResponseContext> | Hook<ResponseContext>[];
}
```

## Adapters

```ts
axiosAdapter(options?): Adapter
fetchAdapter(options?): Adapter
ofetchAdapter(options?): Adapter
```

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

Transport errors remain the underlying adapter error and pass through `onRequestError`.

## Built-in helpers

```ts
auth(getToken);
legacyStringBody();
```

Both are `onRequest` hooks.
