# Axios Plugins

`@envoijs/plugins` 为 `@envoijs/http` 使用的同一个 Axios instance 增加请求控制、参数转换、安全、可观测性和平台适配能力。所有插件、辅助函数、错误类和 TypeScript 类型都从唯一的包入口导出。

## 安装与接入

```bash
pnpm add @envoijs/http @envoijs/plugins
```

第一次请求前，把插件安装到 Axios instance，再把这个 instance 原样传给 envoi adapter：

下面的示例已启用 Twoslash；悬浮 `installPlugins`、`merge` 或 `retry` 可以直接查看源码中的 API description。

```ts twoslash
import { axiosAdapter, createAxiosInstance, createHttp } from "@envoijs/http";
import { installPlugins, merge, normalize, retry } from "@envoijs/plugins";

const axiosInstance = createAxiosInstance({
  baseURL: "/api",
  timeout: 15_000,
});

installPlugins(axiosInstance, [normalize(), merge(), retry({ max: 2 })]);

export const http = createHttp({
  adapter: axiosAdapter(axiosInstance),
});
```

`installPlugins` 会原地修改 instance。请在客户端初始化时安装一次。调用 `instance.request()` 或 Axios 的 HTTP 方法；Axios 的 `instance({...})` 函数简写不会被改写。

不使用 `@envoijs/http` 的 Axios 项目也可以单独使用本包：同时安装 `axios` 和 `@envoijs/plugins`，再把 `AxiosInstance` 传给 `installPlugins`。

## 唯一包入口

所有运行时 API 和类型都从 `@envoijs/plugins` 导入：

```ts
import {
  GiveUpRule,
  cancelAll,
  debounce,
  definePlugin,
  encrypt,
  installPlugins,
  loading,
  merge,
  refreshEncryptPublicKey,
  removeCache,
  retry,
  throttle,
  type IMergeOptions,
  type IMpOptions,
  type IPlugin,
} from "@envoijs/plugins";
```

`@envoijs/plugins/core`、`@envoijs/plugins/plugin` 和 `@envoijs/plugins/plugins/*` 不属于公共入口。

## 通过 envoi 配置单请求插件

Axios plugin 的单请求字段放在 `meta.axios`。Axios adapter 会先把这个命名空间复制进 `AxiosRequestConfig`，再写入 envoi 负责的协议字段：

```ts
const order = await http.get<Order>("/orders/42", {
  meta: {
    axios: {
      merge: true,
      retry: 2,
    },
  },
});
```

业务 envelope 继续由 `@envoijs/http` 处理。响应转换插件必须返回完整的 `AxiosResponse`。

## 插件目录

### 请求控制

| 插件       | 作用                                 | 根入口相关导出                                    |
| ---------- | ------------------------------------ | ------------------------------------------------- |
| `debounce` | 重复请求等待当前请求完成后再执行     | `IDebounceOptions`                                |
| `throttle` | 在时间窗口内拒绝、静默或中断重复请求 | `IThrottleOptions`、`GiveUpRule`、`ThrottleError` |
| `merge`    | 等价的并发请求共享同一个响应         | `IMergeOptions`                                   |
| `retry`    | 按最大次数重试 transport 异常        | `IRetryOptions`                                   |
| `cancel`   | 按 Axios instance 跟踪可取消请求     | `cancelAll`                                       |
| `cache`    | 按过期时间保存响应                   | `ICacheOptions`、`removeCache`、`clearAllCache`   |

### 参数转换与安全

| 插件         | 作用                                   | 根入口相关导出                                                    |
| ------------ | -------------------------------------- | ----------------------------------------------------------------- |
| `normalize`  | 移除配置指定的空值或无效请求参数       | `INormalizeOptions`                                               |
| `pathParams` | 使用请求数据替换 REST 风格路径占位符   | `IPathParamsOptions`                                              |
| `transform`  | 执行请求、响应和异常转换               | `ITransformOptions`                                               |
| `auth`       | 发送前执行异步登录态检查               | `IAuthOptions`                                                    |
| `sign`       | 使用业务提供的算法为序列化请求数据签名 | `ISignOptions`                                                    |
| `encrypt`    | 对指定顶层请求字段执行 RSA 加密        | `EncryptPluginOptions`、`EncryptError`、`refreshEncryptPublicKey` |

`sign` 必须传入 `algorithm`，不再内置 MD5 fallback，也不会在浏览器包里保存共享密钥。请在业务代码中使用安全的会话材料实现 HMAC 或非对称签名。

### 工具与平台适配

| 插件            | 作用                                       | 根入口相关导出                      |
| --------------- | ------------------------------------------ | ----------------------------------- |
| `loading`       | 统一控制全局 loading                       | `ILoadingOptions`                   |
| `mock`          | 把选定请求重定向到 mock server             | `IMockOptions`                      |
| `envs`          | 按环境规则应用 Axios defaults              | `IEnvsOptions`                      |
| `sentryCapture` | 把请求异常上报给兼容 Sentry 的客户端       | `ISentryOptions`                    |
| `onlySend`      | 使用 `navigator.sendBeacon` 执行只发送请求 | `IOnlySendOptions`、`OnlySendError` |
| `mp`            | 适配小程序和跨平台框架的请求 runtime       | `IMpOptions`、`MpRequestError`      |

## 注册与生命周期顺序

按请求预处理期望的执行顺序声明插件。请求侧 hook 按注册顺序执行；响应、异常、完成和中断 hook 按相反顺序回退。带 `enforce: "pre"` 或 `enforce: "post"` 的插件会排在普通插件前后，同一等级内保持声明顺序。

只有插件确实要恢复或替换失败结果时才使用 `captureException`。日志、指标和清理插件应使用 `exceptionObserved`；它只会在恢复 hook 放弃处理或重新抛出最终异常后执行，不会把请求转换成 fulfilled。

推荐按以下层次组织：

1. 规范化或改写请求数据。
2. 校验登录态并执行安全转换。
3. 应用重复请求、缓存和重试控制。
4. 接入 loading 和异常上报。

不要在同一个 instance 上重复安装同一套插件。

## 兼容边界

Envoi Axios adapter 始终负责规范化后的 URL、method、body、headers、signal、timeout、response type 和 `validateStatus`。Plugin metadata 不能覆盖这些字段。Retry、transform、mock 和业务异常还有额外的 response contract 约束。

组合响应转换、重试与 envoi envelope 前，请阅读 [Axios adapter 兼容边界](./adapters#兼容边界)。
