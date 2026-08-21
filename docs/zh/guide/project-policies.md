# 项目默认策略

core 不预设 transport，也不预设业务 envelope。每个应用只定义一次 adapter、response policy 和公共 hooks，再从这份策略创建普通客户端或特殊客户端。

## 定义项目 factory

```ts
import { createHttpFactory, mergeMiddleware } from "@envoijs/http";

export const createProjectHttp = createHttpFactory({
  adapter: "fetch",
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
    headers: {
      "x-client": "seller-web",
    },
  },
  envelope: {
    code: "status",
    msg: "message",
    data: "payload",
    ok: (code) => code === 10_000,
    unauthorized: (code) => code === 14_001,
  },
  hooks: mergeMiddleware(authMiddleware, localeMiddleware, errorMiddleware),
});

export const http = createProjectHttp();
```

另一个项目可以选择不同 adapter、response policy 和 middleware，core 无需增加项目分支。

## 创建特殊客户端

```ts
export const reportHttp = createProjectHttp({
  defaults: {
    baseURL: "/reports",
    timeout: 60_000,
    headers: {
      "x-domain": "reporting",
    },
  },
  hooks: {
    onRequest: addReportTrace,
    onFinally: stopReportTrace,
  },
});
```

合并规则固定如下：

| 参数               | Factory 行为                               |
| ------------------ | ------------------------------------------ |
| `adapter`          | 特殊客户端替换项目 adapter                 |
| `envelope`         | 特殊客户端替换项目 response policy         |
| `defaults`         | 浅合并                                     |
| `defaults.headers` | 按 key 合并，特殊客户端优先                |
| `hooks`            | 项目 hooks 先执行，特殊客户端 hooks 后执行 |

项目 factory 默认解业务 packet，而某个客户端只按 HTTP 处理时，设置 `envelope: false`。

## 定制单个请求

单请求 hooks 在项目 hooks 和特殊客户端 hooks 之后执行：

```ts
await reportHttp.get("/legacy", {
  hooks: {
    onRequest: (ctx) => {
      ctx.request.headers["x-legacy-format"] = "1";
    },
    onSuccess: (ctx) => {
      auditLegacyResult(ctx.value);
    },
    onFinally: () => {
      releaseLegacyResources();
    },
  },
});
```

接口例外留在接口旁边，全局 middleware 不需要维护 URL 分支。

## 生命周期定制

<LifecycleFlow lang="zh" />

- `onRequestError` 可以在 reject 前替换 `ctx.error`。
- `onResponse` 可以在分类前替换 `ctx.response`。
- `onResponseError` 收到分类后的 error，也可以替换它。
- `onSuccess` 收到最终 `ctx.value`，可以替换返回值。
- `onFinally` 在 resolve 和 reject 路径都执行一次。

所有 hooks 按顺序执行。项目 hooks 在前，特殊客户端 hooks 居中，单请求 hooks 最后执行。

请求和一个或多个 `onFinally` 同时失败时，envoi reject `AggregateError`。`errors` 数组先放请求 error，再按声明顺序放 cleanup errors。后续 cleanup hook 不会因为前一个失败而跳过。

## 明确选择 adapter

```ts
const fetchProject = createHttpFactory({
  adapter: "fetch",
});

const axiosProject = createHttpFactory({
  adapter: axiosAdapter(createAxiosInstance()),
});

const nativeProject = createHttpFactory({
  adapter: nativeBridgeAdapter,
});
```

内置 adapter 只提供 transport 实现，具体选择属于项目策略。
