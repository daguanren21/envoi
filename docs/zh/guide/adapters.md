# Adapters

Adapter 执行规范化后的请求。进入 adapter 前，envoi 已经处理 baseURL、用 ufo 序列化 query、合并公共 headers，并组合 timeout 与外部 AbortSignal。

## Axios

默认 adapter 使用 `@envoijs/http` 维护的 axios 版本。

```ts
const http = createHttp();
```

axios 原生选项通过带类型的 factory 配置：

```ts
const http = createHttp({
  adapter: axiosAdapter({
    withCredentials: true,
    xsrfCookieName: "XSRF-TOKEN",
  }),
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
  },
});
```

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
