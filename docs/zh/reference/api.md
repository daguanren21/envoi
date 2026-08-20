# 公共 API

## `createHttp(options?)`

创建可调用的 `HttpClient`，默认 adapter 为 axios。

```ts
const http = createHttp({
  adapter: "axios",
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
    headers: { "Accept-Language": "zh-CN" },
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

## 请求选项

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

`data` 是 `body` 的别名，`params` 是 `query` 的别名。`null`、`false`、`0` 和空字符串 body 都会保留。

## `DefaultEnvelope<T>`

```ts
interface DefaultEnvelope<T> {
  code: number | string;
  msg?: string;
  data: T;
}
```

## `defineEnvelope<TBody, TValue>(config)`

给任意协议回调补全类型，并保留自定义 error。

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

自定义 adapter：

```ts
interface Adapter {
  readonly name: string;
  request(request: HttpRequest): Promise<HttpResponse>;
}
```

## Errors

`BizError` 提供：

```ts
error.code;
error.msg;
error.body;
error.source; // "http" | "body"
error.kind; // "unauthorized" | "warning" | "error"
```

transport error 保留 adapter 原始错误，并经过 `onRequestError`。

## 内置 helpers

```ts
auth(getToken);
legacyStringBody();
```

二者都是 `onRequest` hook。
