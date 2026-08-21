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

## `vue-axios`

[`vue-axios`](https://github.com/imcvampire/vue-axios) binds axios to `axios` and `$http`. It does not change the response contract: legacy calls still resolve `AxiosResponse`.

```bash
pnpm add vue-axios
```

Create the shared clients once:

```ts
// src/api/http.ts
import axios from "axios";
import { axiosAdapter, createHttp } from "@envoijs/http";

// vue-axios 3.5.2 types this argument as AxiosStatic, so the default export
// avoids a cast while still giving envoi the same AxiosInstance.
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

Register both contracts under different keys:

```ts
// Vue application bootstrap
import { createApp, inject, type InjectionKey } from "vue";
import VueAxios from "vue-axios";
import type { HttpClient } from "@envoijs/http";
import { axiosInstance, http } from "./api/http";

export const envoiHttpKey: InjectionKey<HttpClient> = Symbol("envoi-http");

const app = createApp(App);
app.use(VueAxios, axiosInstance); // existing this.$http / this.axios callers
app.provide(envoiHttpKey, http); // new Promise<T> callers
app.mount("#app");

export function useHttp(): HttpClient {
  const client = inject(envoiHttpKey);
  if (!client) throw new Error("envoi HTTP client was not provided");
  return client;
}
```

Existing applications using `Vue.use` pass the same axios object:

```ts
Vue.use(VueAxios, axiosInstance);
```

API modules can import `http` directly. Do not replace `$http` with envoi during migration: existing code may rely on `AxiosResponse`, axios config fields, or interceptor behavior.

`vue-axios` runtime accepts custom registration maps, but its published 3.5.2 declaration only types the default `AxiosStatic` registration. Custom names or an `axios.create()` instance can require local module augmentation. This is a `vue-axios` typing boundary, not an envoi runtime restriction.

## Mokup mock-server switching

[`@mokup/client`](https://github.com/sonofmagic/mokup) installs a request interceptor. It rewrites the request to `mockBase` or `realBase`; the response still comes from a server.

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

Select the backend per request through native axios metadata:

```ts
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

Install it before the first request, then give envoi the same instance:

```ts
const instance = axios.create();

if (import.meta.env.DEV) await installAxiosMocks(instance);

export const http = createHttp({
  adapter: axiosAdapter(instance),
  defaults: { baseURL: "/api" },
});
```

The mock handler matches envoi's final URL, including `defaults.baseURL`. Its response passes through the real axios adapter and envelope pipeline.

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
