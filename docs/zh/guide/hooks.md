# Hooks

Hooks 用来复用公共请求和响应行为，不会把 HTTP 客户端绑定到路由、UI 组件库或状态库。

## 生命周期

```text
onRequest -> adapter -> onResponse -> envelope -> T
                  \-> onRequestError
失败 response --------------------> onResponseError -> throw
```

hook 或 hook 数组按顺序执行。返回值不会替换 context，需要直接修改 context。

## 全局 hooks

```ts
const http = createHttp({
  hooks: {
    onRequest: [auth(getToken), addLocale, addTraceId],
    onRequestError: reportNetworkFailure,
    onResponse: normalizeSharedHeaders,
    onResponseError: [handleUnauthorized, showErrorToast],
  },
});
```

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
  hooks: {
    onRequest: auth(() => localStorage.getItem("token")),
  },
});
```

请求已经带有 `Authorization` 时，helper 不会覆盖。

## 静默请求

`silent` 会写入 request metadata，公共错误 hook 可以读取。

```ts
const http = createHttp({
  hooks: {
    onResponseError: (ctx) => {
      if (ctx.request.meta.silent !== true) showError(ctx.response.body);
    },
  },
});

await http.get("/background-check", { silent: true });
```

错误仍然需要继续抛出，让 store 和 query library 看到失败状态。

## Token 刷新

hook 的返回值不会替换失败请求。Token refresh 需要外层 request wrapper 或 adapter 能力。用一个共享 refresh promise 和一次重试标记，避免并发刷新和无限递归。
