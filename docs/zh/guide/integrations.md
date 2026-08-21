# Vue 与 Mock 接入

transport 扩展共用一个 `AxiosInstance`。Vue 注入、Mokup interceptor 和内存 mock 都装在这个 instance 上，随后传给 `axiosAdapter(instance)`。

```text
vue-axios ───────────┐
Mokup ───────────────┼─> 共用
axios-mock-adapter ──┘      │
                            ▼
                     AxiosInstance
                            │
                            ▼
                     axiosAdapter
                            │
                            ▼
                          envoi
```

## `vue-axios`

[`vue-axios`](https://github.com/imcvampire/vue-axios) 只负责把 axios 注册成 `axios` 和 `$http`。旧调用仍然 resolve `AxiosResponse`。

```bash
pnpm add vue-axios
```

客户端只创建一次：

```ts
// src/api/http.ts
import axios from "axios";
import { axiosAdapter, createHttp } from "@envoijs/http";

// vue-axios 3.5.2 的参数类型是 AxiosStatic。使用默认导出可以避免类型断言，
// envoi 仍然会收到同一个 AxiosInstance。
export const axiosInstance = axios;
axiosInstance.defaults.baseURL = "/api";
axiosInstance.defaults.withCredentials = true;

export const http = createHttp({
  adapter: axiosAdapter(axiosInstance),
  envelope: {
    code: "code",
    msg: "msg",
    data: "data",
  },
});
```

旧 axios contract 和新 envoi contract 使用不同的注入 key：

```ts
// Vue 应用入口
import { createApp, inject, type InjectionKey } from "vue";
import VueAxios from "vue-axios";
import type { HttpClient } from "@envoijs/http";
import { axiosInstance, http } from "./api/http";

export const envoiHttpKey: InjectionKey<HttpClient> = Symbol("envoi-http");

const app = createApp(App);
app.use(VueAxios, axiosInstance); // 现有 this.$http / this.axios
app.provide(envoiHttpKey, http); // 新代码使用 Promise<T>
app.mount("#app");

export function useHttp(): HttpClient {
  const client = inject(envoiHttpKey);
  if (!client) throw new Error("envoi HTTP client was not provided");
  return client;
}
```

已有 `Vue.use` 入口传入同一个 axios 对象：

```ts
Vue.use(VueAxios, axiosInstance);
```

API 模块也可以直接 import `http`。迁移期间不要把 `$http` 替换成 envoi，旧代码可能读取 `AxiosResponse`、axios config 或 interceptor 结果。

`vue-axios` runtime 支持自定义注册表，但 3.5.2 发布的声明只覆盖默认 `AxiosStatic` 和 `axios/$http`。使用自定义名称或 `axios.create()` 时，项目可能需要补 module augmentation。这个限制来自 `vue-axios` 类型声明，envoi runtime 可以接收 `AxiosInstance`。

## 用 Mokup 切换 Mock Server

[`@mokup/client`](https://github.com/sonofmagic/mokup) 安装 request interceptor，根据配置把请求地址改写到 `mockBase` 或 `realBase`。response 仍然来自 HTTP server。

```bash
pnpm add @mokup/client
```

```ts
import axios from "axios";
import { applyMokupToAxios } from "@mokup/client";
import { axiosAdapter, createHttp } from "@envoijs/http";

const instance = axios.create();

applyMokupToAxios(instance, {
  resolverOptions: {
    mockBase: "http://localhost:3300",
    realBase: "https://api.example.com",
    pathMap: [{ from: "/api/*", to: "/*" }],
    markers: { header: true },
  },
});

export const http = createHttp({
  adapter: axiosAdapter(instance),
  defaults: { baseURL: "/api" },
});
```

单请求选择 mock 或 real：

```ts
await http.get<User[]>("/users", {
  meta: { axios: { mock: true } },
});

await http.get<User[]>("/users", {
  meta: { axios: { mock: false } },
});
```

Mokup 也会读取 axios config 里的 `meta.mokup`：

```ts
meta: {
  axios: {
    meta: { mokup: true },
  },
}
```

mock server 需要返回与真实服务一致的 envelope。response 解包和业务 code 分类继续由 envoi 处理。Mokup 当前包为 ESM-only，工具链要求 Node.js `^20.19.0 || >=22.12.0`。

## 用 `axios-mock-adapter` 做内存 Mock

[`axios-mock-adapter`](https://github.com/ctimmerm/axios-mock-adapter) 会替换指定 axios instance 的底层 adapter，不需要启动 mock server。

```bash
pnpm add -D axios-mock-adapter
```

```ts
// src/api/mock.ts
import type { AxiosInstance } from "axios";

export async function installAxiosMocks(instance: AxiosInstance) {
  const { default: AxiosMockAdapter } = await import("axios-mock-adapter");
  const mock = new AxiosMockAdapter(instance, {
    delayResponse: 250,
    onNoMatch: "throwException",
  });

  mock.onGet("/api/users/42").reply(200, {
    code: 200,
    msg: "ok",
    data: { id: 42, name: "Ada" },
  });

  return mock;
}
```

第一次请求发出前完成安装，envoi 使用同一个 instance：

```ts
const instance = axios.create();

if (import.meta.env.DEV) await installAxiosMocks(instance);

export const http = createHttp({
  adapter: axiosAdapter(instance),
  defaults: { baseURL: "/api" },
});
```

handler 匹配 envoi 已经拼好的最终 URL，包含 `defaults.baseURL`。mock response 会经过真实 axios adapter 和 envelope pipeline。

| Mock 返回                          | envoi 结果                    |
| ---------------------------------- | ----------------------------- |
| `reply(200, { code: 200, data })`  | resolve `data`                |
| `reply(200, { code: 42201, msg })` | reject body-source `BizError` |
| `reply(503, { code: 200, data })`  | reject HTTP-source `BizError` |
| `.networkError()` 或 `.timeout()`  | 执行 `onRequestError`         |

测试环境使用 `onNoMatch: "throwException"`，缺少 handler 时可以立即失败。只有明确需要 mock 与真实后端混用时才配置 `"passthrough"`。每个测试后调用 `resetHandlers()`，移除 mock adapter 时调用 `restore()`。

## 选择 Mock 方式

| 使用场景                                        | 方案                                      |
| ----------------------------------------------- | ----------------------------------------- |
| 浏览器、CLI 和部署 worker 共用文件路由 handlers | Mokup                                     |
| 不启动 server 的单测或组件测试                  | `axios-mock-adapter`                      |
| 保留旧 `$http`，新 API 返回 `Promise<T>`        | 同一个 instance 接入 `vue-axios` 与 envoi |

默认不要在同一个 instance 上同时安装 Mokup 和 `axios-mock-adapter`。Mokup 会先在 request interceptor 中改写 URL，mock adapter 随后按改写后的 mock-server URL 匹配。两层同时维护 mock 路由会增加重复配置。
