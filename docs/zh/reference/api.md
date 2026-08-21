# 公共 API

## `createHttp(options)`

创建可调用的 `HttpClient`。`adapter` 必填；省略 `envelope` 时使用 HTTP-only policy。

```ts
const http = createHttp({
  adapter: "fetch",
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
    headers: { "Accept-Language": "zh-CN" },
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

返回项目客户端 factory。特殊客户端会替换 adapter/envelope、合并 defaults 与 headers，并追加 hooks。

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

adapter 专用参数放在带命名空间的 `meta` 中。axios adapter 会把 `meta.axios` 合并到原生 config，再写入规范化后的请求字段。

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

envoi 会导出 `AxiosInstance`、`AxiosInstanceOptions` 和 `createAxiosInstance`，应用代码无需直接 import axios。

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

transport error 经过 `onRequestError`，hook 可以替换 `ctx.error`。请求和 cleanup hooks 同时失败时，envoi reject 包含全部错误的 `AggregateError`。

## Middleware 与内置 hooks

```ts
createMiddleware(hooks: HttpHooks): HttpHooks;
mergeMiddleware(...bundles: Array<HttpHooks | undefined>): HttpHooks;
auth(getToken): Hook<HookContext>;
legacyStringBody(): Hook<HookContext>;
```

`createMiddleware` 定义带类型的 hook bundle。`mergeMiddleware` 按声明顺序组合多个 bundle。完整示例见[可复用 Middleware](../guide/middleware)。
