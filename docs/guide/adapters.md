# Adapters

An adapter executes the normalized request. envoi applies baseURL, serializes query parameters with ufo, merges common headers, and combines timeout with an external AbortSignal before the adapter runs.

## Axios

Axios is the default and is owned by `@envoijs/http`.

```ts
const http = createHttp();
```

Native axios settings use the typed factory:

```ts
import { axiosAdapter, createHttp } from "@envoijs/http";

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
