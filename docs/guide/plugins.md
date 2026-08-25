# Axios plugins

`@envoijs/plugins` adds request control, transformation, security, observability, and platform adapters to the same Axios instance used by `@envoijs/http`. Every public plugin, helper, error class, and TypeScript type is exported from one package entry.

## Install and connect

```bash
pnpm add @envoijs/http @envoijs/plugins
```

Install the plugins on the Axios instance before its first request, then pass that exact instance to the envoi adapter:

Hover `installPlugins`, `merge`, or `retry` in this Twoslash-enabled example to read their source-level API descriptions.

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

`installPlugins` mutates the instance in place. Install once during client setup. Use `instance.request()` or an Axios HTTP method; Axios's callable `instance({...})` shorthand is not patched.

A standalone Axios application can use the package without `@envoijs/http`; install `axios` alongside `@envoijs/plugins` and pass an `AxiosInstance` to `installPlugins`.

## One package entry

All runtime APIs and types come from `@envoijs/plugins`:

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

`@envoijs/plugins/core`, `@envoijs/plugins/plugin`, and `@envoijs/plugins/plugins/*` are intentionally not public entry points.

## Per-request options through envoi

Plugin-specific Axios fields belong under `meta.axios`. The Axios adapter copies that namespace into `AxiosRequestConfig` before applying envoi's protocol invariants:

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

Keep business-envelope handling in `@envoijs/http`. Plugin response transforms must continue returning a complete `AxiosResponse`.

## Plugin catalog

### Request control

| Plugin     | Purpose                                                         | Related root exports                              |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `debounce` | Queues a duplicate request until the active request completes   | `IDebounceOptions`                                |
| `throttle` | Rejects, silences, or aborts duplicate requests within a window | `IThrottleOptions`, `GiveUpRule`, `ThrottleError` |
| `merge`    | Shares one in-flight response across equivalent requests        | `IMergeOptions`                                   |
| `retry`    | Retries transport failures according to a maximum count         | `IRetryOptions`                                   |
| `cancel`   | Tracks cancellable requests on one Axios instance               | `cancelAll`                                       |
| `cache`    | Stores responses with an expiration time                        | `ICacheOptions`, `removeCache`, `clearAllCache`   |

### Transformation and security

| Plugin       | Purpose                                                                     | Related root exports                                              |
| ------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `normalize`  | Removes configured nullish or invalid request values                        | `INormalizeOptions`                                               |
| `pathParams` | Replaces REST-style path placeholders from request data                     | `IPathParamsOptions`                                              |
| `transform`  | Runs request, response, and exception transformations                       | `ITransformOptions`                                               |
| `auth`       | Performs an asynchronous login-state check before sending                   | `IAuthOptions`                                                    |
| `sign`       | Calls an application-provided signing algorithm for serialized request data | `ISignOptions`                                                    |
| `encrypt`    | RSA-encrypts selected top-level request fields                              | `EncryptPluginOptions`, `EncryptError`, `refreshEncryptPublicKey` |

`sign` requires an `algorithm` function and has no built-in MD5 fallback or embedded shared secret. Implement HMAC or asymmetric signing with secure session material in application code.

### Utilities and adapters

| Plugin          | Purpose                                                           | Related root exports                |
| --------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `loading`       | Coordinates one global loading indicator                          | `ILoadingOptions`                   |
| `mock`          | Redirects selected requests to a mock server                      | `IMockOptions`                      |
| `envs`          | Applies Axios defaults selected by an environment rule            | `IEnvsOptions`                      |
| `sentryCapture` | Reports captured request exceptions to a Sentry-compatible client | `ISentryOptions`                    |
| `onlySend`      | Uses `navigator.sendBeacon` for fire-and-forget delivery          | `IOnlySendOptions`, `OnlySendError` |
| `mp`            | Adapts Axios to mini-program and cross-platform request runtimes  | `IMpOptions`, `MpRequestError`      |

## Registration and lifecycle order

Declare request preparation in the order it should run. Request-side hooks run in registration order; response, exception, completion, and abort hooks unwind in reverse order. Plugins with `enforce: "pre"` or `enforce: "post"` are sorted around normal plugins while preserving declaration order within the same rank.

Use `captureException` only when a plugin intentionally recovers from or replaces a failure. Logging, metrics, and cleanup plugins should use `exceptionObserved`; it runs only after recovery hooks decline or rethrow the final error and does not convert the request to a fulfilled result.

A practical sequence is:

1. Normalize or rewrite request data.
2. Validate authentication and apply security transforms.
3. Apply duplicate-request, cache, and retry controls.
4. Attach loading and exception reporting.

Do not install the same plugin stack more than once on an instance.

## Compatibility boundaries

The envoi Axios adapter always owns canonical URL, method, body, headers, signal, timeout, response type, and `validateStatus`. Plugin metadata cannot override those fields. Retry, transform, mock, and business-error behavior have additional response-contract rules.

See [Axios adapter compatibility boundaries](./adapters#compatibility-boundaries) before combining response transforms or retries with an envoi envelope.
