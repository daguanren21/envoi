# @envoijs/http

<p>
  <strong>English</strong> ·
  <a href="https://github.com/daguanren21/envoi/blob/main/README.zh-CN.md">简体中文</a>
</p>

A typed HTTP client that turns transport responses and backend envelopes into a stable `Promise<T>`.

```bash
pnpm add @envoijs/http
```

## Quick start

Axios is the default adapter.

```ts
import { createHttp } from "@envoijs/http";

const http = createHttp({
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
  },
  hooks: {
    onRequest: (ctx) => {
      ctx.request.headers.Authorization = `Bearer ${token}`;
    },
  },
});

const user = await http.get<User>("/users/1");
```

A response such as `{ code: 200, msg: "ok", data: user }` resolves to `user`. A body without `code` falls back to HTTP status and is returned as-is.

## Envelopes

```ts
// HTTP-only API
createHttp({ envelope: false });

// Renamed fields
createHttp({
  envelope: {
    code: "errno",
    msg: "errmsg",
    data: "result",
    ok: (code) => code === 0,
  },
});
```

Arbitrary structures use `defineEnvelope<TBody, TValue>()`:

```ts
const envelope = defineEnvelope<PartnerBody<User>, User>({
  read: (response) => response.body as PartnerBody<User>,
  kind: (body) => (body.success ? "ok" : "error"),
  value: (body) => body.result,
  error: (body) => new Error(body.message),
});
```

## Hooks

Hooks follow the ofetch lifecycle. Global hooks run before request-local hooks.

```ts
const http = createHttp({
  hooks: {
    onRequest: [addAuthHeader, addLocaleHeader],
    onRequestError: reportNetworkFailure,
    onResponse: normalizeSharedResponse,
    onResponseError: handleUnauthorized,
  },
});

await http.get("/legacy", {
  hooks: {
    onResponse: normalizeOnlyThisEndpoint,
  },
});
```

## Adapters

```ts
createHttp(); // axios
createHttp({ adapter: "fetch" });
createHttp({ adapter: "ofetch" });
```

Native options use typed factories:

```ts
createHttp({ adapter: axiosAdapter({ withCredentials: true }) });
createHttp({ adapter: fetchAdapter({ init: { credentials: "include" } }) });
createHttp({ adapter: ofetchAdapter({ retry: 2 }) });
```

Custom transports implement `{ name, request }` and return every HTTP response, including 4xx/5xx.

## Query libraries

Passing `axios.get()` directly to a query library caches `AxiosResponse<Envelope<T>>`; HTTP 200 business failures also resolve as success. `http.get<T>()` resolves `T` and rejects failed business codes.

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");

const { data: user } = useQuery({
  key: ["current-user"],
  query: getCurrentUser,
});
```

## Ability-style authorization

Fetch the auth profile through envoi, then update the consumer-owned ability instance:

```ts
const profile = await http.get<AuthProfile>("/auth/profile");
ability.update(profile);
```

Call `ability.reset()` on logout or globally observed 401. Backend authorization remains mandatory.

## Raw responses and errors

```ts
const response = await http.raw<Blob>("/reports/export", {
  responseType: "blob",
});
```

`raw()` and blob responses still enforce HTTP failures. Use `ignoreResponseError: true` only when inspecting a non-ok response intentionally.

Full documentation: [github.com/daguanren21/envoi](https://github.com/daguanren21/envoi).
