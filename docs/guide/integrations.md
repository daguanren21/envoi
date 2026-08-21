# Vue and mock integrations

Keep one `AxiosInstance` for transport extensions. Register Vue bindings, request switchers, interceptors, and mock adapters on that instance, then pass it to `axiosAdapter(instance)`.

```text
vue-axios ───────────┐
Mokup ───────────────┼─> shared
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

`@envoijs/http` owns the axios runtime and exports `createAxiosInstance` plus `AxiosInstance`, so application code never imports axios directly. Install an ecosystem package only when using its section below; envoi does not bundle framework or mock tooling.

## `vue-axios`

[`vue-axios`](https://github.com/imcvampire/vue-axios) binds axios to `axios` and `$http`. It does not change the response contract: legacy calls still resolve `AxiosResponse`.

```bash
pnpm add vue-axios
```

The existing Vue plugin registration is the source of the axios instance. Add envoi immediately after the application's current `app.use(VueAxios, ...)` call:

```ts
// Vue application bootstrap, after the existing VueAxios registration
import { inject, type InjectionKey } from "vue";
import type { HttpClient } from "@envoijs/http";
import { axiosAdapter, createHttp } from "@envoijs/http";

const existingAxios = app.config.globalProperties.axios;
const http = createHttp({
  adapter: axiosAdapter(existingAxios),
  envelope: {
    code: "code",
    msg: "msg",
    data: "data",
  },
});

export const envoiHttpKey: InjectionKey<HttpClient> = Symbol("envoi-http");
app.provide(envoiHttpKey, http);

export function useHttp(): HttpClient {
  const client = inject(envoiHttpKey);
  if (!client) throw new Error("envoi HTTP client was not provided");
  return client;
}
```

Existing `Vue.use` applications can bind envoi to the instance already exposed by the plugin:

```ts
const http = createHttp({
  adapter: axiosAdapter(Vue.axios),
});
```

API modules can import `http` directly. Do not replace `$http` with envoi during migration: existing code may rely on `AxiosResponse`, axios config fields, or interceptor behavior.

`vue-axios` runtime accepts custom registration maps, but its published 3.5.2 declaration only types the default `AxiosStatic` registration. An existing custom `AxiosInstance` export or registration name can require local module augmentation. Do not create a second axios object just to satisfy that declaration.

## Mokup mock-server switching

[`@mokup/client`](https://github.com/sonofmagic/mokup) installs a request interceptor. It rewrites the request to `mockBase` or `realBase`; the response still comes from a server.

```bash
pnpm add @mokup/client
```

```ts
import { axiosAdapter, createHttp, type AxiosInstance } from "@envoijs/http";
import { applyMokupToAxios } from "@mokup/client";

export function enableMokup(instance: AxiosInstance) {
  applyMokupToAxios(instance, {
    resolverOptions: {
      mockBase: "http://localhost:3300",
      realBase: "https://api.example.com",
      pathMap: [{ from: "/api/*", to: "/*" }],
      markers: { header: true },
    },
  });

  return createHttp({
    adapter: axiosAdapter(instance),
    envelope: {},
  });
}
```

Call `enableMokup()` with the same object already exposed by VueAxios or exported by the module that owns the instance. Existing `$http` calls then use the same Mokup routing; there is no second transport configuration to synchronize.

Select the backend per request through native axios metadata:

```ts
const http = enableMokup(app.config.globalProperties.axios);

await http.get<User[]>("/users", {
  meta: { axios: { mock: true } },
});

await http.get<User[]>("/users", {
  meta: { axios: { mock: false } },
});
```

Mokup also accepts `meta.mokup` inside the axios config:

```ts
meta: {
  axios: {
    meta: { mokup: true },
  },
}
```

The mock server must return the same envelope as the real server. Keep response extraction and business-code classification in envoi. Mokup's current packages are ESM-only and require Node.js `^20.19.0 || >=22.12.0` for their tooling.

## In-process mocks with `axios-mock-adapter`

[`axios-mock-adapter`](https://github.com/ctimmerm/axios-mock-adapter) replaces the selected axios instance's low-level adapter. No mock server is required.

```bash
pnpm add -D axios-mock-adapter
```

```ts
// src/api/mock.ts
import type { AxiosInstance } from "@envoijs/http";

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

Install it on the project-owned instance before the first request:

```ts
import { axiosAdapter, createHttp, type AxiosInstance } from "@envoijs/http";

export async function createMockedHttp(instance: AxiosInstance) {
  if (import.meta.env.DEV) await installAxiosMocks(instance);

  return createHttp({
    adapter: axiosAdapter(instance),
    envelope: {},
  });
}

const http = await createMockedHttp(app.config.globalProperties.axios);
```

The handler matches the URL produced by the existing instance, including its `defaults.baseURL`. `axios-mock-adapter` checks both `config.url` and `baseURL + url`. Its response then passes through the real axios adapter and envelope pipeline.

| Mock reply                         | envoi result                      |
| ---------------------------------- | --------------------------------- |
| `reply(200, { code: 200, data })`  | resolves `data`                   |
| `reply(200, { code: 42201, msg })` | rejects a body-source `BizError`  |
| `reply(503, { code: 200, data })`  | rejects an HTTP-source `BizError` |
| `.networkError()` or `.timeout()`  | runs `onRequestError`             |

Use `onNoMatch: "throwException"` in tests so missing handlers fail immediately. Use `"passthrough"` only for an intentional hybrid between mocks and a live backend. Call `resetHandlers()` between tests or `restore()` when removing the mock adapter.

## Choose one mock transport

| Need                                                              | Use                                         |
| ----------------------------------------------------------------- | ------------------------------------------- |
| File-based handlers shared by a browser, CLI, and deployed worker | Mokup                                       |
| Fast unit/component tests without a server                        | `axios-mock-adapter`                        |
| Keep legacy Vue `$http` while new APIs return `Promise<T>`        | `vue-axios` plus envoi on the same instance |

Do not install Mokup and `axios-mock-adapter` on the same instance by default. Mokup rewrites the URL in a request interceptor before the mock adapter matches it, so handlers would need to match the rewritten mock-server URL. The two layers then duplicate mock routing without adding a response-contract benefit.
