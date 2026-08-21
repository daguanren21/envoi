# Adapters

Adapter 执行规范化后的请求。进入 adapter 前，envoi 已经处理 baseURL、用 ufo 序列化 query、合并公共 headers，并组合 timeout 与外部 AbortSignal。

## Axios

axios 是内置 adapter，但不会被隐式选择：

```ts
const http = createHttp({ adapter: "axios" });
```

已有项目应把自己持有的 instance 传进来。bridge 只接收 instance，不重新 import 或创建 axios：

```ts
import { axiosAdapter, createHttp, type AxiosInstance } from "@envoijs/http";

export function createProjectHttp(instance: AxiosInstance) {
  return createHttp({
    adapter: axiosAdapter(instance),
  });
}
```

调用 `createProjectHttp()` 时，传入宿主应用已经交给 interceptors、Vue plugin 或 request wrapper 的同一个对象。原 instance 的 baseURL、credentials 和 native defaults 会继续生效。

这个值必须是带有 `request`、`defaults` 和 `interceptors` 的真实 `AxiosInstance`。现有模块只导出二次包装函数时，需要额外导出内部 instance。只有明确迁移配置归属时才把字段移到 `createHttp.defaults`，不要在两处重复配置。

新项目只安装 envoi，通过它公开的 factory 创建可共享 instance：

```ts
import { axiosAdapter, createAxiosInstance, createHttp } from "@envoijs/http";

const instance = createAxiosInstance({
  baseURL: "/api",
  timeout: 15_000,
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
});

export const http = createHttp({
  adapter: axiosAdapter(instance),
});
```

### 接入现有 axios instance 与 `axios-plugins`

项目已经安装 interceptors 或 [`halo951/axios-plugins`](https://github.com/halo951/axios-plugins) 时，把同一个 `AxiosInstance` 交给 adapter：

```ts
import type { AxiosInstance } from "@envoijs/http";
import { useAxiosPlugin } from "axios-plugins/core";
import { merge } from "axios-plugins/plugins/merge";
import { normalize } from "axios-plugins/plugins/normalize";
import { axiosAdapter, createHttp } from "@envoijs/http";

export function installProjectPlugins(instance: AxiosInstance) {
  useAxiosPlugin(instance).plugin(normalize()).plugin(merge());

  return createHttp({
    adapter: axiosAdapter(instance),
  });
}
```

第一次请求发出前，把项目原有 instance 传给这个函数。envoi 调用 `instance.request()`，plugin wrapper 和 interceptors 都会执行。envoi 不会把 instance 当函数调用，因此不需要 `useAxiosPlugin(...).wrap()`。

单请求 plugin 参数放进带命名空间的 metadata：

```ts
await http.get("/orders", {
  meta: {
    axios: {
      merge: true,
    },
  },
});
```

axios adapter 先合并 `meta.axios`，随后写入 envoi 确定的 URL、method、body、headers、signal、timeout、responseType 和 `validateStatus`。plugin 参数不能覆盖这些协议字段。

#### 兼容边界

| Plugin 行为                                                 | 接入规则                                                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| merge、debounce、cache、loading、cancel、mock、请求参数整理 | plugin 最终返回完整 `AxiosResponse` 时可以接入                                                        |
| response transform                                          | 必须返回完整 `AxiosResponse`；返回 `response.data` 会破坏 adapter contract                            |
| retry                                                       | transport error 可以重试。envoi 固定 `validateStatus: () => true`，HTTP 4xx、5xx 会作为 response 返回 |
| throttle give-up                                            | 使用抛错模式。静默或空结果不满足 `AxiosResponse` contract                                             |
| 业务 code 解包或 reject                                     | 留在 envoi envelope，HTTP 与业务状态只维护一套分类规则                                                |

该插件的 request hooks 按注册顺序执行，response、error 和 completion hooks 反向执行。依赖顺序的 plugins 应在 axios instance 旁集中注册。这个接入边界不依赖前端框架。

## Native fetch

```ts
const http = createHttp({
  adapter: fetchAdapter({
    init: {
      credentials: "include",
      cache: "no-store",
    },
  }),
});
```

测试、polyfill 或 native bridge 可以注入自定义 fetch 实现。

## ofetch

先安装 optional peer：

```bash
pnpm add ofetch
```

```ts
const http = createHttp({
  adapter: ofetchAdapter({
    retry: 2,
    retryDelay: 250,
  }),
});
```

## 自定义 transport

```ts
import type { Adapter } from "@envoijs/http";

const nativeAdapter: Adapter = {
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
```

## Contract

adapter 收到最终 URL 和已处理的请求选项。4xx、5xx 需要返回 `HttpResponse`；网络失败、abort 和 timeout 才抛 transport error。

内置 adapter 需要通过同一组 conformance tests：

- baseURL 和绝对 URL；
- 数组、嵌套值和空值 query；
- JSON 与原生 request body；
- responseType；
- timeout 加外部 signal；
- 成功和 HTTP 失败 response。
