<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./brand/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./brand/logo-light.svg">
    <img src="./brand/logo-light.svg" alt="envoi" width="200">
  </picture>
</p>

<p align="center">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <a href="https://daguanren21.github.io/envoi/zh/">在线文档</a> ·
  <a href="https://www.npmjs.com/package/@envoijs/http">npm</a> ·
  <a href="https://github.com/daguanren21/envoi">GitHub</a>
</p>

# envoi

一个带完整 TypeScript 类型的 HTTP 客户端。它把 transport response 和后端 envelope 处理成稳定的 `Promise<T>`。

```bash
pnpm add @envoijs/http
```

## 研发背景

很多前端项目都有一份 `request.ts`。最初只加 token，后来陆续塞入语言、时区、登录跳转、文件下载、业务状态码、错误提示和各系统自己的 response 解构。项目一多，这些文件看起来相似，实际行为和 axios 版本已经分叉。

Pinia Colada 和 TanStack Query 会直接缓存 query function resolve 的值。把 `axios.get()` 直接传进去，缓存里得到的是 `AxiosResponse<Envelope<T>>`。HTTP 200 里出现 `code: 500` 时，axios 也不会 reject。每个 API 都要重复取 `response.data`、判断 `code`、返回 `data`、构造错误。

envoi 把这段契约放到统一客户端里：

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");
```

query cache 收到 `User`，HTTP 错误和业务错误都会 reject。

## 适用场景

下面这些项目可以使用 envoi：

- 多个应用各自维护相似的 axios interceptor；
- 后端统一返回 `{ code, msg, data }`，或使用另一套固定字段；
- 一部分服务使用业务状态码，另一部分服务只看 HTTP status；
- 同一组 API 要接入 Pinia Colada、TanStack Query、Vuex、Pinia、Jotai、Zustand 或 Redux；
- token、语言、链路追踪和公共错误处理需要复用；
- 当前默认使用 axios，后续还要接 fetch、ofetch 或自定义 transport。

只有少量普通 HTTP 调用、没有公共 response 协议和 hook 的项目，可以继续直接使用 fetch 或 axios。

## 快速开始

默认 adapter 是 axios。

```ts
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

```ts
interface User {
  id: number;
  name: string;
}

const user = await http.get<User>("/users/1");
```

后端返回：

```json
{
  "code": 200,
  "msg": "ok",
  "data": { "id": 1, "name": "Ada" }
}
```

`user` 的值为：

```ts
{ id: 1, name: "Ada" }
```

## Response envelope

### 默认 `{ code, msg, data }`

默认配置把 `code: 200` 识别为成功，把 `code: 401` 识别为未授权。

```ts
const user = await http.get<User>("/users/1");
const packet = await http.envelope<User>("/users/1");

// user: User
// packet: DefaultEnvelope<User>
```

HTTP status 优先。HTTP 500 不会因为 body 里有 `code: 200` 就变成成功。

### 只使用 HTTP status

REST API 可以关闭业务 envelope：

```ts
const rest = createHttp({
  adapter: "fetch",
  envelope: false,
});

const user = await rest.get<User>("/users/1");
```

body 没有 `code` 字段时，默认客户端也会自动回到 HTTP status，并返回完整 body。

### 字段名不同

```ts
const partner = createHttp({
  envelope: {
    code: "errno",
    msg: "errmsg",
    data: "result",
    ok: (code) => code === 0,
    unauthorized: (code) => code === 10_001,
  },
});
```

### 任意 response 结构

```ts
import { createHttp, defineEnvelope } from "@envoijs/http";

interface PartnerBody<T> {
  success: boolean;
  result: T;
  message: string;
}

const envelope = defineEnvelope<PartnerBody<User>, User>({
  read: (response) => response.body as PartnerBody<User>,
  kind: (body) => (body.success ? "ok" : "error"),
  value: (body) => body.result,
  error: (body) => new Error(body.message),
});

const partner = createHttp({ envelope });
```

自定义 error 会原样抛出。失败 response 不会执行 `value()`。

## Hooks

生命周期和 ofetch 一致：

- `onRequest`
- `onRequestError`
- `onResponse`
- `onResponseError`

hook 或 hook 数组按顺序执行。返回值不会替换 context，需要直接修改 context。

```ts
const http = createHttp({
  hooks: {
    onRequest: [addAuthHeader, addLocaleHeader],
    onRequestError: reportNetworkFailure,
    onResponse: normalizeSharedResponse,
    onResponseError: [handleUnauthorized, showErrorToast],
  },
});
```

单个接口可以附加局部 hook，全局 hook 先执行：

```ts
await http.get("/legacy/report", {
  hooks: {
    onRequest: addLegacyHeader,
    onResponse: normalizeLegacyReport,
  },
});
```

全局 hook 用于认证、语言、链路追踪、日志、公共 response 归一化和统一错误。某个接口的数据写入哪个 store，由发起请求的 API、store 或 query 决定。

### 可复用 middleware 与状态码

把同一组 hooks 定义成 middleware，再在客户端统一组合：

```ts
import { BizError, createHttp, createMiddleware, mergeMiddleware } from "@envoijs/http";

const authMiddleware = createMiddleware({
  onRequest: addAuthHeader,
  onResponseError: (ctx) => {
    if (ctx.error instanceof BizError && ctx.error.kind === "unauthorized")
      clearSessionAndRedirect();
  },
});

const errorMiddleware = createMiddleware({
  onResponseError: (ctx) => {
    if (ctx.error instanceof BizError && ctx.request.meta.silent !== true) showError(ctx.error.msg);
  },
});

const ApiCode = {
  Ok: 0,
  Unauthorized: 10_001,
  Validation: 20_001,
} as const;

const http = createHttp({
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

`onResponseError` 会收到分类完成的 `ctx.error`。直接读取 `BizError.code`、`kind` 和 `source`，无需重新解析 response body。全局 middleware 先于单请求 middleware 执行。

axios interceptor 对照和单请求接入方式见 [middleware 接入指南](https://daguanren21.github.io/envoi/zh/guide/middleware)。

## Adapters

内置 adapter：

```ts
createHttp(); // axios
createHttp({ adapter: "axios" });
createHttp({ adapter: "fetch" });
createHttp({ adapter: "ofetch" }); // optional peer
```

baseURL、公共 headers 和 timeout 放在 `createHttp.defaults`。各 transport 的原生选项通过带类型的 factory 配置。

```ts
import { axiosAdapter, createHttp, fetchAdapter, ofetchAdapter } from "@envoijs/http";

createHttp({
  adapter: axiosAdapter({ withCredentials: true }),
});

createHttp({
  adapter: fetchAdapter({ init: { credentials: "include" } }),
});

createHttp({
  adapter: ofetchAdapter({ retry: 2, retryDelay: 250 }),
});
```

其他 transport 实现统一 adapter contract：

```ts
import type { Adapter } from "@envoijs/http";

const customAdapter: Adapter = {
  name: "native-bridge",
  async request(request) {
    const response = await nativeBridge.request(request);
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
      raw: response,
    };
  },
};

const http = createHttp({ adapter: customAdapter });
```

adapter 收到的 URL 已经包含 baseURL 和序列化后的 query。4xx、5xx 需要作为 `HttpResponse` 返回；网络失败、abort 和 timeout 才抛 transport error。

## 接入 Pinia Colada 和 TanStack Query

axios 可以接 query library，但需要手工建立返回值和错误契约：

```ts
async function getCurrentUserWithAxios(): Promise<User> {
  const response = await axios.get<ApiEnvelope<User>>("/users/me");
  if (response.data.code !== 200) throw new Error(response.data.msg);
  return response.data.data;
}
```

直接传 `axios.get()` 时，query cache 会保存 `AxiosResponse<ApiEnvelope<User>>`。HTTP 200 下的业务失败也会被记为成功。envoi 在客户端统一处理了这段逻辑：

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");
```

```ts
// Pinia Colada
const { data: user } = useQuery({
  key: ["current-user"],
  query: getCurrentUser,
});

// TanStack Query
const { data: user } = useQuery({
  queryKey: ["current-user"],
  queryFn: getCurrentUser,
});
```

带 stale time、跨组件去重、失效刷新和乐观更新的服务端数据，直接交给 query cache。重复存入另一个 store 会增加同步点。

## 状态库和权限 Ability

envoi 返回 `Promise<T>`，不会导入 Pinia、Vuex、Jotai、Zustand、Redux 或 Ability 实现。store action 可以调用拥有该请求的 API。

权限实例在 auth profile 拉取完成后更新：

```ts
interface AuthProfile {
  roles: string[];
  permissions: string[];
}

const getAuthProfile = (): Promise<AuthProfile> => http.get<AuthProfile>("/auth/profile");

async function refreshAuthorization(): Promise<AuthProfile> {
  const profile = await getAuthProfile();
  ability.update(profile);
  return profile;
}

function logout(): void {
  ability.reset();
}
```

全局未授权 hook 可以调用 `ability.reset()`。profile 更新留在 auth service 或 store action 中，避免全局 hook 根据 URL 偷偷写入业务状态。前端 Ability 负责 UI 和路由判断，后端仍要校验每次请求的权限。

## Raw response、下载和错误

```ts
import { BizError } from "@envoijs/http";

try {
  const response = await http.raw<Blob>("/reports/export", {
    responseType: "blob",
  });
  saveAs(response.body, "report.xlsx");
} catch (error) {
  if (error instanceof BizError) console.error(error.code, error.kind, error.body);
}
```

`raw()`、blob response 和 `skipEnvelope` 仍会处理 HTTP 错误。明确需要读取非成功 response 时再开启：

```ts
const response = await http.raw("/health", {
  ignoreResponseError: true,
});
```

## Request body

对象按 JSON 发送。FormData、Blob、ArrayBuffer、TypedArray、URLSearchParams 和 stream 原样传给 adapter。`null`、`false`、`0` 和空字符串都会保留。

字符串 body 需要明确写 Content-Type：

```ts
await http.post("/form", new URLSearchParams({ name: "Ada" }));

await http.post("/legacy-form", "name=Ada", {
  headers: {
    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
  },
});
```

从 axios 0.x 表单字符串迁移的项目，可以把 `legacyStringBody()` 加到 `onRequest`。

## 运行环境

- Node.js 18+
- 浏览器能力取决于所选 adapter
- ESM 和 CommonJS
- 包含 TypeScript declarations

## Agent skill

仓库提供 `envoi-best-practices` skill，覆盖 adapter、hooks、envelope、状态归属、依赖准入和发版流程。

```bash
npx skills add daguanren21/envoi --skill envoi-best-practices
```
