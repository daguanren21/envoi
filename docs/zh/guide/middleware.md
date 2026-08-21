# 可复用 Middleware

envoi 的 middleware 是一组可复用的生命周期 hooks，不使用 Koa 风格的 `next()`。

```ts
interface HttpHooks {
  onRequest?: Hook | Hook[];
  onRequestError?: Hook | Hook[];
  onResponse?: Hook | Hook[];
  onResponseError?: Hook | Hook[];
  onSuccess?: Hook | Hook[];
  onFinally?: Hook | Hook[];
}
```

## 定义 middleware 模块

```ts
// src/api/middleware/auth.ts
import { auth, createMiddleware } from "@envoijs/http";

export const authMiddleware = createMiddleware({
  onRequest: auth(() => sessionStorage.getItem("access_token")),
  onResponseError: (ctx) => {
    if (ctx.response.status === 401) clearSessionAndRedirect();
  },
});
```

```ts
// src/api/middleware/locale.ts
export const localeMiddleware = createMiddleware({
  onRequest: (ctx) => {
    ctx.request.headers["Accept-Language"] = getLocale();
    ctx.request.headers["X-Time-Zone"] = Intl.DateTimeFormat().resolvedOptions().timeZone;
  },
});
```

## 组合 middleware

```ts
import { createHttp, mergeMiddleware } from "@envoijs/http";

export const http = createHttp({
  adapter: "fetch",
  defaults: { baseURL: "/api" },
  hooks: mergeMiddleware(authMiddleware, localeMiddleware, traceMiddleware, errorMiddleware),
});
```

每个阶段都按声明顺序执行。

```text
auth.onRequest
locale.onRequest
trace.onRequest
adapter
error.onResponse
```

response hooks 也保持声明顺序，不会反向回卷。

## 只给一个请求接入 middleware

```ts
const reportMiddleware = createMiddleware({
  onRequest: (ctx) => {
    ctx.request.headers["X-Report-Version"] = "1";
  },
  onResponse: (ctx) => {
    ctx.response.body = normalizeLegacyReport(ctx.response.body);
  },
});

await http.get("/legacy/report", {
  hooks: reportMiddleware,
});
```

全局 middleware 先执行，随后执行单请求 middleware。

## 接入已有状态码定义

```ts
export const ApiCode = {
  Ok: 0,
  Unauthorized: 10_001,
  Validation: 20_001,
} as const;

const http = createHttp({
  adapter: "fetch",
  envelope: {
    code: "status",
    msg: "message",
    data: "payload",
    ok: (code) => code === ApiCode.Ok,
    unauthorized: (code) => code === ApiCode.Unauthorized,
    warning: (code) => code === ApiCode.Validation,
  },
  hooks: mergeMiddleware(authMiddleware, errorMiddleware),
});
```

`onResponseError` 会收到分类完成的 error：

```ts
import { BizError, createMiddleware } from "@envoijs/http";

export const errorMiddleware = createMiddleware({
  onResponseError: (ctx) => {
    if (!(ctx.error instanceof BizError)) return;

    if (ctx.error.kind === "unauthorized") {
      clearSessionAndRedirect();
      return;
    }

    if (ctx.error.code === ApiCode.Validation) {
      showValidationWarning(ctx.error.msg);
      return;
    }

    if (ctx.request.meta.silent !== true) showError(ctx.error.msg);
  },
});
```

envelope 负责协议状态分类。middleware 根据分类结果执行登录跳转、提示等跨接口行为。

## 区分 HTTP status 与业务 code

`ctx.response.status` 是 HTTP status。`BizError.code` 是映射后的协议 code，`BizError.source` 标记失败来自哪一层：

```ts
onResponseError: (ctx) => {
  if (ctx.response.status === 429) scheduleRetry();

  if (ctx.error instanceof BizError && ctx.error.source === "body")
    reportBusinessCode(ctx.error.code);
};
```

使用字段映射的 envelope 时，HTTP response 需要先满足 2xx。HTTP 401 分类为 `unauthorized`，其他非 2xx 状态分类为 `error`。response body 的成功 code 无法把 HTTP 500 改成成功。

后端对 HTTP status 有特殊语义时，使用 [`defineEnvelope()`](./envelopes)。它的 `kind(body, response)` 可以同时读取 `response.status` 和 body。middleware 会收到最终分类结果。

## 从 axios interceptors 迁移

| 现有 axios 逻辑               | envoi 接入位置                        |
| ----------------------------- | ------------------------------------- |
| request interceptor           | `onRequest` middleware                |
| request rejection interceptor | `onRequestError` middleware           |
| 成功 response interceptor     | `onResponse` middleware 或 envelope   |
| HTTP / 业务错误 interceptor   | `onResponseError` middleware          |
| 返回 `response.data.data`     | envelope 的 `data` 映射               |
| 根据业务 code reject          | envelope 的 `ok/unauthorized/warning` |

所有接口共用的 response 取值规则放进 envelope。`onResponse` 用于 envelope 分类前确实需要执行的 response 标准化。
