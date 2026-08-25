[![npm version](https://img.shields.io/npm/v/%40envoijs%2Fplugins.svg)](https://www.npmjs.com/package/@envoijs/plugins)
[![NPM downloads](https://img.shields.io/npm/dm/%40envoijs%2Fplugins.svg?style=flat)](https://www.npmjs.com/package/@envoijs/plugins)
![license](https://badgen.net/static/license/MIT/blue)

> Tips: The English version of the document may not be updated in a timely manner, please refer to [README.md](./README.md) for accuracy

> @envoijs/plugins is ESM-only. Use `import`; CommonJS `require()` is no longer supported.

## Features

- [Single entry] Import every plugin, helper, and type from `@envoijs/plugins`, with tree-shaking support.
- [Multiple instance support] Plugin cache variables are associated with axios instances, and multiple axios instances do not interfere with each other.
- [Low intrusiveness] Plugins are extended by wrapping, without affecting the existing configuration of the instance, and without destroying the api of axios.
- [Low integration cost] Compared with other plugins, there is no need to make a lot of changes to integrate the plugin, and there is no learning cost.
- [Rich plugin selection] Compared with other plugins based on `axios.interceptors`, this library provides more diversified plugin options.
- [Extendable] Provides the `IPlugin` interface, which only needs to follow the interface specification to extend more plugin capabilities on its own.

## Usage

- install

```bash
pnpm add axios @envoijs/plugins
# or
npm install axios @envoijs/plugins
# or
yarn add axios @envoijs/plugins
```

- use plugin

```typescript
import axios from "axios";
import { installPlugins, mock } from "@envoijs/plugins";

export const request = axios.create({/* ... */});

installPlugins(request, [mock()]);

request.post("/api", {}, { mock: true });
```

`installPlugins` mutates the existing instance in place; it does not create a manager or wrapper.
Use `request.request(...)` or an HTTP method. Axios's callable `request({...})` shorthand is not patched.

- single package entry

```typescript
import axios from "axios";
import { installPlugins, loading } from "@envoijs/plugins";

export const request = axios.create({/* ... */});

installPlugins(request, [loading()]);
```

### Third-party plugin development

Declare `axios` and `@envoijs/plugins` as peer dependencies. Import the stable plugin contract directly from
`@envoijs/plugins`; host applications declaratively install third-party plugins with
`installPlugins(request, [plugin])`.

```json
{
  "peerDependencies": {
    "axios": "^1.0.0",
    "@envoijs/plugins": ">=0.1.0"
  }
}
```

```typescript
import { definePlugin } from "@envoijs/plugins";

export const headerPlugin = (name: string, value: string) =>
  definePlugin({
    name: "header",
    lifecycle: {
      preRequestTransform(config) {
        config.headers = { ...config.headers, [name]: value };
        return config;
      },
    },
  });
```

## Plugins

| Plugin                | Description                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [debounce](#debounce) | When duplicate requests are made within a certain time, the later request will wait for the last request to complete before executing          |
| [throttle](#throttle) | When duplicate requests are made within a certain time, the later request will be discarded                                                    |
| [merge](#merge)       | When duplicate requests are made within a certain time, the requests will only be made once, and each requester will receive the same response |
| retry                 | When a request fails (errors), retry n times. If all retries fail, an exception will be thrown                                                 |
| cancel                | Provides `cancelAll()` method to cancel all ongoing requests                                                                                   |
| cache                 | Stores the response content of the request and returns it for the next request (within cache expiration time)                                  |
| envs                  | Normalizes axios environment configuration tool                                                                                                |
| loading               | Provides a unified control capability for global loading to reduce the workload of independent loading control for each loading method         |
| mock                  | Provides global or single interface request mock capability                                                                                    |
| normalize             | Filters out undefined, null, and other parameters generated during the request process                                                         |
| pathParams            | Expands support for Restful API specification of route parameters                                                                              |
| sign                  | Calls an application-provided signing algorithm for normalized request data                                                                    |
| sentryCapture         | Extension `Sentry.captureException` implementation                                                                                             |
| onlySend              | Provides a wrapper method for `navigator.sendBeacon` to submit embedded data when the page is exited. This requires backend support            |
| mp                    | Expands support for network requests from small programs (WeChat, Toutiao, QQ, etc.) and cross-platform frameworks (uni-app, taro)             |
| encrypt               | Declaratively RSA-encrypts selected top-level request data fields; includes OAEP and PKCS#1 v1.5                                               |

## Example

#### debounce

```typescript
import { installPlugins, debounce } from "@envoijs/plugins";

const request = axios.create({});

// add plugin
installPlugins(request, [debounce()]);

// set delay judgment time
debounce({ delay: 200 });

// set filter pattern
debounce({ includes: "/api/", excludes: [] });

// set duplicate request determination method
debounce({ calcRequstHash: (config) => config.url });

// on execute request, set higher priority judgment criteria
request.post("/api/xxx", {}, { debounce: true });

// set different delay judgment times
request.post("/api/xxx", {}, { debounce: { delay: 1000 } });
```

#### throttle

```typescript
import { installPlugins, throttle, GiveUpRule } from "@envoijs/plugins";

const request = axios.create({});
/** 配置 */
// 基础使用
installPlugins(request, [throttle()]);

// set delay judgment time
throttle({ delay: 200 });

// 设置哪些请求将触发节流策略 (按需设置 `includes`, `excludes`)
throttle({ includes: "/api/", excludes: [] });

// 设置节流策略处理规则
throttle({ giveUp: GiveUpRule.throw }); // 抛出异常 (默认)
throttle({ giveUp: GiveUpRule.cancel }); // 中断请求, 并返回空值结果
throttle({ giveUp: GiveUpRule.slient }); // 静默, 既不返回成功、也不抛出异常

// 自定义相同请求判定规则 (忽略参数差异时比较有用)
throttle({ calcRequstHash: (config) => config.url });

// 在请求时, 设置请求将触发防抖策略 (优先级更高)
request.post("/api/xxx", {}, { throttle: true });

// set different delay judgment times
request.post("/api/xxx", {}, { throttle: { delay: 1000 } });
// in request, set capture throttle handle rule
request.post("/api/xxx", {}, { throttle: { giveUp: GiveUpRule.cancel } });
// 单个请求设置触发节流后抛出的异常消息
request.post("/api/xxx", {}, { throttle: { throttleErrorMessage: "xxxxx" } });
```

#### merge

```typescript
import { installPlugins, merge } from "@envoijs/plugins";

const request = axios.create({});
/** 配置 */
// 基础使用
installPlugins(request, [merge()]);

// set delay judgment time
merge({ delay: 200 });

// 设置哪些请求将触发重复请求合并策略 (按需设置 `includes`, `excludes`)
merge({ includes: "/api/", excludes: [] });

// 自定义相同请求判定规则 (忽略参数差异时比较有用)
merge({ calcRequstHash: (config) => config.url });

// 在请求时, 设置请求将触发重复请求合并策略 (优先级更高)
request.post("/api/xxx", {}, { merge: true });

// 单个请求设置不同的触发延时
request.post("/api/xxx", {}, { merge: { delay: 1000 } });
```

##### retry

```typescript
import { installPlugins, retry } from "@envoijs/plugins";

const request = axios.create({});
/** 配置 */
// 基础使用 (必须设置重试次数)
installPlugins(request, [retry({ max: 3 })]);

// 设置哪些请求失败后将重试 (不建议设置这个option, 建议在请求时指定retry参数)
retry({ includes: [], excludes: [] });

// 自定义失败请求检查方法 (不建议设置这个option, 建议在添加一个 `axios.interceptors` 或 `transform()` 插件来判断响应结果)
retry({ isExceptionRequest: (config) => false });

// 在请求时, 设置请求将触发防抖策略 (优先级更高)
request.post("/api/xxx", {}, { retry: 3 });
```

##### cancel

> TIP: 如果请求指定了 cancelToken, 将会导致此插件失效.

```typescript
import { installPlugins, cancel, cancelAll } from "@envoijs/plugins";

const request = axios.create({});
// 添加插件
installPlugins(request, [cancel()]);

// > 中止所有在执行的请求
cancelAll(request);
```

#### transform

```typescript
import { installPlugins, transform } from "@envoijs/plugins";

const request = axios.create({});
// 添加插件
installPlugins(request, [
  transform({
    // + 转换请求参数
    request: (config) => {
      // TODO
      return config;
    },
    // + 转换响应参数
    response: (res) => {
      // TODO
      return res;
    },
    // + 转换异常信息
    capture: (e) => {
      // TODO
      throw e;
    },
  }),
]);
```

#### cache

```typescript
import { installPlugins, cache } from "@envoijs/plugins";

const request = axios.create({});
// 添加插件
installPlugins(request, [cache()]);

// 设置全局缓存失效时间
cache({ expires: Date.now() + 24 * 60 * 60 * 1000 });
// 设置缓存存储位置 (默认: sessionStorage)
cache({ storage: localStorage });
// 设置 storage 中, 缓存cache的字段名
cache({ storageKey: "axios.cache" });
// 设置自定义的缓存key计算方法
cache({ key: (config) => config.url });

// 请求时, 指定此接口触发响应缓存
request.post("/api", {}, { cache: true });
// 自定义此接口缓存失效时间
request.post("/api", {}, { cache: { expires: Date.now() } });
// 自定义此接口缓存key
request.post("/api", {}, { cache: { key: "/api" } });
```

#### envs

```typescript
import { installPlugins, envs } from "@envoijs/plugins";

const request = axios.create({});
// 添加插件
installPlugins(request, [
  envs([
    {
      rule: () => process.env.NODE_ENV === "development",
      config: {
        baseURL: "http://dev",
      },
    },
    {
      rule: () => process.env.NODE_ENV === "production",
      config: {
        baseURL: "http://prod",
      },
    },
  ]),
]);
```

#### loading

```typescript
import { installPlugins, loading } from "@envoijs/plugins";
import { loading as ElLoading } from "element-plus";

const request = axios.create({});

let loadingEl;
// 添加插件
installPlugins(request, [
  loading({
    onTrigger: (show) => {
      if (show) {
        loadingEl = ElLoading({
          lock: true,
          text: "Loading",
          spinner: "el-icon-loading",
          background: "rgba(0, 0, 0, 0.7)",
        });
      } else {
        loadingEl.close();
      }
    },
  }),
]);
// 自定义显示延时和隐藏延时 (避免频繁显示或隐藏 loading 效果)
loading({ delay: 200, delayClose: 200 });

// 指定请求禁用 loading
request.post("/api", {}, { loading: false });
```

#### mock

> 建议借助三方工具(如: apifox, apipost 等) 实现 mock 能力

```typescript
import { installPlugins, mock } from "@envoijs/plugins";

const request = axios.create({});

installPlugins(request, [
  // 添加插件, 并指定mock服务器地址
  mock({ mockUrl: "http://mock" }),
]);
// 自定义启用条件 (如果没有使用 webpack, vite 那么此参数是必要的)
mock({ enable: () => false });

// 使用全局mock
const request1 = axios.create({
  mock: true,
});

// 按需mock (单个请求mock)
request.post("/api", {}, { mock: true });

// 针对不同接口使用不同的mock服务器
request.post("/api", {}, { mock: { mock: true, mockUrl: "http://mock1" } });
```

#### normalize

```typescript
import { installPlugins, normalize } from "@envoijs/plugins";

const request = axios.create({});

installPlugins(request, [
  normalize({
    // 过滤url
    url: {
      // 过滤url中, 重复的 `//`, 如: `/api/a//b` -> `/api/a/b`
      noDuplicateSlash: true,
    },
    // 设置完整的过滤参数
    data: {
      /** 过滤 null 值 */
      noNull: true,
      /** 过滤 undefined 值 */
      noUndefined: true,
      /** 过滤 nan */
      noNaN: true,
      /** 是否对对象进行递归 */
      deep: true,
    },
    // 设置仅过滤 undefined
    params: true,
  }),
]);
```

### pathParams

```typescript
import { installPlugins, pathParams } from "@envoijs/plugins";

const request = axios.create({});

// 添加插件
installPlugins(request, [pathParams()]);

// 设置仅从 params 中获取路径参数
pathParams({ form: "params" });
```

#### sign

```typescript
import { installPlugins, sign } from "@envoijs/plugins";
import { createRequestSignature } from "./request-signing";

const request = axios.create({});

installPlugins(request, [
  sign({
    algorithm: createRequestSignature,
    key: "signature",
    salt: { nonce: "request-nonce" },
  }),
]);
```

`algorithm` is required and may return `string` or `Promise<string>`. Implement HMAC or asymmetric signing with secure session material in application code; never hard-code a shared secret in the browser bundle.

#### sentryCapture

```typescript
import { installPlugins, sentryCapture } from "@envoijs/plugins";
import * as sentry from "@sentry/browser"; // or @sentry/vue or @sentry/react ...

const request = axios.create({});

// 添加插件
installPlugins(request, [sentryCapture({ sentry })]);
```

#### onlySend

```typescript
import { installPlugins, onlySend } from "@envoijs/plugins";

const request = axios.create({});

// 添加插件
installPlugins(request, [onlySend()]);

// 设置浏览器不支持 `navigator.sendBeacon` api时报错
onlySend({ noSupport: "error" });
```

#### mp

```typescript
import { installPlugins, mp } from "@envoijs/plugins";

const request = axios.create({});

// 添加插件
installPlugins(request, [mp({ env: "wx" })]);

// 指定不同的小程序平台
mp({ env: "tt" }); // 头条、抖音等等
// 添加请求的公共配置
mp({
  config: {/** ... */},
});
```

#### encrypt

`encrypt(options)` uses the built-in key protocol. `fields` is the plugin instance's global field
rule: matching top-level request data fields are encrypted automatically without per-endpoint config.
The plugin fetches `GET /api/rsa/public-key` through the installed Axios instance. The endpoint may
return a PEM/base64 string or `{ publicKey, algorithm }`.

```typescript
import axios from "axios";
import { installPlugins, encrypt, refreshEncryptPublicKey } from "@envoijs/plugins";

const request = axios.create({});

installPlugins(request, [
  encrypt({
    encoding: "hex",
    fields: ["password"],
  }),
]);

// The matching password field is encrypted by the global rule.
await request.post("/login", { account: "demo", password: "secret" });

// Disable the global rule for one request.
await request.post("/debug-login", { account: "demo", password: "plain" }, { encrypt: false });

// Override fields and encoding for one request.
await request.post(
  "/payment",
  { cardNo: "4111111111111111", cvv: "123" },
  {
    encrypt: {
      fields: ["cardNo", "cvv"],
      encoding: "base64",
    },
  },
);

await refreshEncryptPublicKey(request);
```

Without global fields, pass the zero-argument factory directly; this is equivalent to `encrypt({})`:

```typescript
installPlugins(request, [encrypt]);
await request.post("/login", { password: "secret" }, { encrypt: ["password"] });
```

Precedence:

| Global `fields` | Request `encrypt`      | Fields                                                   | Encoding                                  |
| --------------- | ---------------------- | -------------------------------------------------------- | ----------------------------------------- |
| Configured      | Omitted                | Encrypt matching global fields; skip when all are absent | Global `encoding`, default base64         |
| Configured      | `false`                | Disable encryption                                       | Not applicable                            |
| Any             | Field array            | Request fields replace global fields                     | Inherit global `encoding`, default base64 |
| Any             | `{ fields }`           | Request fields replace global fields                     | Inherit global `encoding`, default base64 |
| Any             | `{ fields, encoding }` | Request fields replace global fields                     | Request `encoding`                        |

Only top-level string fields are encrypted, and the caller's data object is not mutated.
`RSA/ECB/PKCS1Padding` automatically uses PKCS#1 v1.5; OAEP uses WebCrypto.
Consumers do not install or inject a `jsencrypt` provider. Key caches are isolated per Axios instance.
For `OAEPWithSHA-*AndMGF1Padding`, the server must configure the OAEP and MGF1 digests to the same SHA.
WebCrypto cannot configure those two digests independently.

## Thanks

- [axios](https://axios-http.com/)
- [axios-extensions](https://github.com/kuitos/axios-extensions)
- [alova](https://github.com/alovajs/alova/)
- [ahooks](https://ahooks.gitee.io/zh-CN/hooks/use-request/index)
