# @envoijs/http

<p>
  <strong>English</strong> ·
  <a href="https://github.com/daguanren21/envoi/blob/main/README.zh-CN.md">简体中文</a>
</p>

A typed HTTP client that turns transport responses and backend envelopes into a stable `Promise<T>`.

ESM-only. Supports Node.js 18+ and browsers with the selected adapter's required APIs.

Axios is included as a runtime dependency. Application code uses `createAxiosInstance()` and `AxiosInstance` from `@envoijs/http` instead of importing axios.

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

### Reusable middleware

```ts
const responseMiddleware = createMiddleware({
  onResponseError: (ctx) => {
    if (ctx.error instanceof BizError && ctx.error.kind === "unauthorized")
      clearSessionAndRedirect();
  },
});

const http = createHttp({
  envelope: {
    code: "status",
    msg: "message",
    data: "payload",
    ok: (code) => code === ApiCode.Ok,
    unauthorized: (code) => code === ApiCode.Unauthorized,
  },
  hooks: mergeMiddleware(authMiddleware, responseMiddleware),
});
```

`createMiddleware()` types a reusable hook bundle. `mergeMiddleware()` composes bundles in declaration order. `onResponseError` receives the classified `ctx.error`, including `BizError.code`, `kind`, and `source`.

## Adapters

```ts
createHttp(); // axios
createHttp({ adapter: "fetch" });
createHttp({ adapter: "ofetch" });
```

Create a shareable axios instance without importing axios in application code:

```ts
const instance = createAxiosInstance({ withCredentials: true });
createHttp({ adapter: axiosAdapter(instance) });
createHttp({ adapter: fetchAdapter({ init: { credentials: "include" } }) });
createHttp({ adapter: ofetchAdapter({ retry: 2 }) });
```

An existing `AxiosInstance` keeps its interceptors and wrappers:

```ts
function attachEnvoi(instance: AxiosInstance) {
  useAxiosPlugin(instance).plugin(merge());
  return createHttp({ adapter: axiosAdapter(instance) });
}
```

The [adapter guide](https://daguanren21.github.io/envoi/guide/adapters#existing-axios-instances-and-axios-plugins) documents plugin compatibility boundaries.

The [Vue and mock guide](https://daguanren21.github.io/envoi/guide/integrations) covers `vue-axios`, Mokup, and `axios-mock-adapter` on the shared instance.

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

Full documentation: [daguanren21.github.io/envoi](https://daguanren21.github.io/envoi/).
