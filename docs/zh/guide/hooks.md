# Hooks

Hooks 用来复用公共请求和响应行为，不会把 HTTP 客户端绑定到路由、UI 组件库或状态库。

## 生命周期

<LifecycleFlow lang="zh" />

`onRequestError` 处理 adapter 抛错。`onResponseError` 在 response policy 分类为 non-ok 后执行。`onSuccess` 收到即将 resolve 的值。`onFinally` 在所有路径执行一次。

hooks 按顺序执行，返回值会被忽略。需要定制时修改当前阶段对应的 `ctx.request`、`ctx.response`、`ctx.error` 或 `ctx.value`。

## 全局 hooks

```ts
const http = createHttp({
  adapter: "fetch",
  hooks: {
    onRequest: [auth(getToken), addLocale, addTraceId],
    onRequestError: reportNetworkFailure,
    onResponse: normalizeSharedHeaders,
    onResponseError: [handleUnauthorized, showErrorToast],
    onSuccess: observeResolvedValue,
    onFinally: stopTrace,
  },
});
```

## 成功与 cleanup

```ts
const http = createHttp({
  adapter: "fetch",
  hooks: {
    onSuccess: (ctx) => {
      ctx.value = normalizeResolvedValue(ctx.value);
    },
    onFinally: (ctx) => {
      finishTrace(ctx.request, ctx.error);
    },
  },
});
```

前一个 cleanup hook 失败后，后面的 `onFinally` 仍会执行。请求和 cleanup 同时失败时，Promise reject `AggregateError`：第一个元素是请求 error，后面按声明顺序排列 cleanup errors。

`ignoreResponseError: true` 只取消 reject，不会清除分类结果。调用方拿到 response body 时，`onResponseError`、`onSuccess` 和 `onFinally` 仍能读取分类后的 `ctx.error`。

## 单请求 hooks

单个接口的例外放在请求参数里，避免全局 hook 根据 URL 分支。

```ts
await http.get("/legacy/report", {
  hooks: {
    onRequest: (ctx) => {
      ctx.request.headers["X-Format"] = "legacy";
    },
    onResponse: (ctx) => {
      ctx.response.body = normalizeLegacyReport(ctx.response.body);
    },
  },
});
```

执行顺序是全局 hooks 在前，单请求 hooks 在后。

## Auth helper

```ts
import { auth, createHttp } from "@envoijs/http";

const http = createHttp({
  adapter: "fetch",
  hooks: {
    onRequest: auth(() => localStorage.getItem("token")),
  },
});
```

请求已经带有 `Authorization` 时，helper 不会覆盖。

## 静默请求

`silent` 会写入 request metadata。HTTP 和 envelope 失败完成分类后，公共错误 hook 可以直接读取 `ctx.error`。

```ts
import { BizError } from "@envoijs/http";

const http = createHttp({
  adapter: "fetch",
  hooks: {
    onResponseError: (ctx) => {
      if (ctx.error instanceof BizError && ctx.request.meta.silent !== true)
        showError(ctx.error.msg);
    },
  },
});

await http.get("/background-check", { silent: true });
```

hook 执行后会抛出同一个 error，store 和 query library 能收到失败状态。

需要把多个阶段封装成一个模块时，参考[可复用 Middleware](./middleware)。

## Token 刷新

hook 的返回值不会替换失败请求。Token refresh 需要外层 request wrapper 或 adapter 能力。用一个共享 refresh promise 和一次重试标记，避免并发刷新和无限递归。
