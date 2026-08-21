# Adapters

An adapter executes the normalized request. envoi applies baseURL, serializes query parameters with ufo, merges common headers, and combines timeout with an external AbortSignal before the adapter runs.

## Axios

Axios is the default when an application has no existing HTTP client:

```ts
const http = createHttp();
```

An existing application should pass the instance it already owns. The reusable bridge receives that instance; it does not import or create axios:

```ts
import { axiosAdapter, createHttp, type AxiosInstance } from "@envoijs/http";

export function createProjectHttp(instance: AxiosInstance) {
  return createHttp({
    adapter: axiosAdapter(instance),
  });
}
```

Call `createProjectHttp()` with the exact object the host application already gives to its interceptors, Vue plugin, or request wrapper. The instance keeps its baseURL, credentials, and native defaults.

The value must be an actual `AxiosInstance` with `request`, `defaults`, and `interceptors`. If the existing module exports only a convenience function, export its underlying instance separately. Move configuration into `createHttp.defaults` only as a deliberate migration; do not configure the same field in both places.

For a new application, install only envoi and create the shareable instance through its public factory:

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

### Existing axios instances and `axios-plugins`

Pass an existing `AxiosInstance` when a project already installs interceptors or a wrapper such as [`halo951/axios-plugins`](https://github.com/halo951/axios-plugins):

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

Pass the project-owned instance into this function before the first request. envoi calls `instance.request()`, so its plugin wrapper and interceptors remain active. `useAxiosPlugin(...).wrap()` is unnecessary because envoi never calls the instance as a function.

Per-request axios plugin fields go through the namespaced metadata escape hatch:

```ts
await http.get("/orders", {
  meta: {
    axios: {
      merge: true,
    },
  },
});
```

The axios adapter merges `meta.axios` into `AxiosRequestConfig`, then applies envoi's canonical URL, method, body, headers, signal, timeout, response type, and `validateStatus`. Plugin options cannot override those protocol invariants.

#### Compatibility boundaries

| Plugin behavior                                                      | Rule                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| merge, debounce, cache, loading, cancel, mock, request normalization | Safe when the plugin ultimately returns a complete `AxiosResponse`                                       |
| response transform                                                   | Must return the complete `AxiosResponse`; returning `response.data` breaks the adapter contract          |
| retry                                                                | Transport errors are safe. HTTP 4xx/5xx remain responses because envoi sets `validateStatus: () => true` |
| throttle give-up                                                     | Use the throwing mode. A silent or empty result is not an `AxiosResponse`                                |
| business-code unwrap or reject                                       | Keep it in the envoi envelope so HTTP and business classification have one owner                         |

The plugin library runs request-side hooks forward and response/error/completion hooks in reverse registration order. Keep order-dependent plugins beside the axios instance. This integration boundary has no framework runtime dependency.

## Native fetch

```ts
import { createHttp, fetchAdapter } from "@envoijs/http";

const http = createHttp({
  adapter: fetchAdapter({
    init: {
      credentials: "include",
      cache: "no-store",
    },
  }),
});
```

A custom fetch implementation can be injected for a runtime bridge or test.

## ofetch

Install the optional peer before selecting the adapter:

```bash
pnpm add ofetch
```

```ts
import { createHttp, ofetchAdapter } from "@envoijs/http";

const http = createHttp({
  adapter: ofetchAdapter({
    retry: 2,
    retryDelay: 250,
  }),
});
```

## Custom transport

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

Adapters receive a final URL and parsed request options. They must return all HTTP responses, including 4xx and 5xx. They throw only transport failures such as a network error, abort, or timeout.

A built-in adapter is accepted only after it passes the shared conformance suite for:

- baseURL and absolute URLs;
- arrays and nested query values;
- JSON and native request bodies;
- responseType;
- timeout plus external signal;
- success and HTTP failure responses.
