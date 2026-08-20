# 快速开始

安装公开包：

```bash
pnpm add @envoijs/http
```

## 创建统一客户端

默认 adapter 是 axios。baseURL、公共 headers 和 timeout 放在 `defaults`。

```ts
// src/api/http.ts
import { createHttp } from "@envoijs/http";

export const http = createHttp({
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
  },
  hooks: {
    onRequest: (ctx) => {
      const token = localStorage.getItem("token");
      if (token) ctx.request.headers.Authorization = `Bearer ${token}`;
    },
    onResponseError: (ctx) => {
      if (ctx.response.status === 401) location.href = "/login";
    },
  },
});
```

## 定义 API 函数

```ts
// src/api/users.ts
import { http } from "./http";

export interface User {
  id: number;
  name: string;
}

export function getUser(id: number): Promise<User> {
  return http.get<User>(`/users/${id}`);
}
```

后端返回：

```json
{
  "code": 200,
  "msg": "ok",
  "data": { "id": 1, "name": "Ada" }
}
```

调用方直接拿到 `User`：

```ts
const user = await getUser(1);
user.name;
```

## 接入只看 HTTP status 的服务

body 没有 `code` 字段时，默认客户端会回到 HTTP status。整个服务都返回 REST 数据时，可以明确关闭 envelope。

```ts
const rest = createHttp({
  adapter: "fetch",
  envelope: false,
  defaults: {
    baseURL: "https://api.example.test",
  },
});
```

## 给单个接口加特殊处理

全局 hook 先执行，局部 hook 只作用于当前请求。

```ts
await http.get("/legacy/report", {
  hooks: {
    onRequest: (ctx) => {
      ctx.request.headers["X-Legacy-Format"] = "v1";
    },
    onResponse: (ctx) => {
      ctx.response.body = normalizeLegacyReport(ctx.response.body);
    },
  },
});
```

## 继续阅读

- [响应 Envelope](./envelopes)
- [Hooks](./hooks)
- [Adapters](./adapters)
- [Pinia Colada 和 TanStack Query](./query-libraries)
