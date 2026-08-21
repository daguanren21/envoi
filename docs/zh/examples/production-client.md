# 案例：生产环境 HTTP 客户端

这个案例处理大型 `request.ts` 里常见的逻辑：credentials、token、语言、业务 envelope、单接口例外、query function、文件下载和渐进迁移。

## 后端约定

项目已经维护了一份 response 类型和状态码字典：

```ts
export const ApiCode = {
  Ok: 10_000,
  SessionExpired: 14_001,
  Validation: 24_001,
} as const;

interface ApiEnvelope<T> {
  status: (typeof ApiCode)[keyof typeof ApiCode];
  message: string;
  payload: T;
}
```

下载接口返回 blob。一个遗留接口仍接收表单字符串。

## 1. 定义可复用 middleware

```ts
// src/api/middleware.ts
import { auth, BizError, createMiddleware, legacyStringBody } from "@envoijs/http";

export const requestMiddleware = createMiddleware({
  onRequest: [
    auth(() => sessionStorage.getItem("access_token")),
    (ctx) => {
      ctx.request.headers["Accept-Language"] = getLocale();
      ctx.request.headers["X-Trace-Id"] = crypto.randomUUID();
    },
    legacyStringBody(),
  ],
});

export const responseMiddleware = createMiddleware({
  onResponseError: (ctx) => {
    if (!(ctx.error instanceof BizError)) return;

    if (ctx.error.kind === "unauthorized") {
      clearSessionAndRedirect();
      return;
    }

    if (ctx.request.meta.silent !== true) showApiError(ctx.error.msg);
  },
});
```

## 2. 创建客户端

```ts
// src/api/http.ts
import {
  axiosAdapter,
  createAxiosInstance,
  createHttpFactory,
  mergeMiddleware,
} from "@envoijs/http";
import { ApiCode } from "./contracts";
import { requestMiddleware, responseMiddleware } from "./middleware";

const instance = createAxiosInstance({
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
});

export const createProjectHttp = createHttpFactory({
  adapter: axiosAdapter(instance),
  defaults: {
    baseURL: "/api",
    timeout: 20_000,
    headers: {
      Accept: "application/json",
    },
  },
  envelope: {
    code: "status",
    msg: "message",
    data: "payload",
    ok: (code) => code === ApiCode.Ok,
    unauthorized: (code) => code === ApiCode.SessionExpired,
    warning: (code) => code === ApiCode.Validation,
  },
  hooks: mergeMiddleware(requestMiddleware, responseMiddleware),
});

export const http = createProjectHttp();
```

## 3. API 函数保持简单

```ts
// src/api/profile.ts
import { http } from "./http";

export interface Profile {
  id: number;
  displayName: string;
  roles: string[];
}

export function getProfile(): Promise<Profile> {
  return http.get<Profile>("/profile");
}
```

```ts
// src/api/orders.ts
interface Order {
  id: string;
  status: "draft" | "paid" | "shipped";
  total: number;
}

interface Page<T> {
  rows: T[];
  total: number;
}

export function listOrders(query: {
  page: number;
  pageSize: number;
  status?: Order["status"];
}): Promise<Page<Order>> {
  return http.get<Page<Order>>("/orders", { query });
}
```

## 4. 调用方使用同一份 API 函数

```ts
const profile = await getProfile();

const profileQuery = {
  queryKey: ["profile"],
  queryFn: getProfile,
};

await http.get("/session/check", { silent: true });
```

组件、store 和 query library 都接收 `Promise<T>`。

## 5. 单接口例外留在 API 旁边

```ts
const reportMiddleware = createMiddleware({
  onRequest: (ctx) => {
    ctx.request.headers["X-Report-Version"] = "1";
  },
  onResponse: (ctx) => {
    ctx.response.body = normalizeLegacyReport(ctx.response.body);
  },
});

export function getLegacyReport(): Promise<Report> {
  return http.get<Report>("/legacy/report", {
    hooks: reportMiddleware,
  });
}
```

全局 middleware 不需要维护 URL 判断分支。

## 6. 下载文件

```ts
export async function downloadInvoice(id: string): Promise<void> {
  const response = await http.raw<Blob>(`/invoices/${id}/file`, {
    responseType: "blob",
  });

  saveAs(response.body, `invoice-${id}.pdf`);
}
```

HTTP 4xx、5xx 仍会 reject。接口明确需要读取失败 payload 时，再使用 `ignoreResponseError: true`。

## 7. 迁移遗留表单接口

新代码使用 `URLSearchParams`：

```ts
export function copyOrder(input: { orderId: string }): Promise<void> {
  return http.post("/orders/copy", new URLSearchParams({ orderId: input.orderId }));
}
```

保留原有字符串格式时，前面配置的 `legacyStringBody()` 会为非 JSON 字符串补上表单 Content-Type。

```ts
return http.post("/legacy/copy", "orderId=ord_42");
```

## 8. 按 API 模块渐进迁移

```text
src/api/http.ts          新 envoi 客户端
src/api/profile.ts       已迁移
src/api/orders.ts        已迁移
src/utils/request.ts     剩余遗留接口
```

一次迁移一个 API 模块。最后一个调用方完成验证后，再删除旧 interceptor 文件。

## 文件结构

```text
src/api/
├── contracts.ts
├── middleware.ts
├── http.ts
├── profile.ts
├── orders.ts
└── invoices.ts
```

HTTP 客户端维护 transport 和 response policy。API 模块维护路径与业务类型。调用方使用返回的 Promise。
