# 快速开始

安装公开包：

```bash
pnpm add @envoijs/http
```

## 创建统一客户端

adapter 和 response policy 都需要明确选择。baseURL、公共 headers 和 timeout 放在 `defaults`。

```ts
// src/api/http.ts
import { createHttp } from "@envoijs/http";

export const http = createHttp({
  adapter: "fetch",
  envelope: {},
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

`adapter` 是必填项。`envelope: {}` 明确选择标准 `{ code, msg, data }` policy。

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

### 悬浮查看 API 说明

启用 Twoslash 的示例会读取包内真实类型。把鼠标悬浮在下面的 `get` 上，即可查看方法签名和 description：

```ts twoslash
import { createHttp } from "@envoijs/http";

interface User {
  id: number;
  name: string;
}

const typedHttp = createHttp({
  adapter: "fetch",
  envelope: {},
});

const userPromise = typedHttp.get<User>("/users/1");
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

HTTP-only 是 core 的默认 response policy。省略 `envelope` 后直接返回解析完成的 body：

```ts
const rest = createHttp({
  adapter: "fetch",
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

- [项目默认策略](./project-policies)
- [响应 Envelope](./envelopes)
- [Hooks](./hooks)
- [Adapters](./adapters)
- [Pinia Colada 和 TanStack Query](./query-libraries)
