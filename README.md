<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./brand/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./brand/logo-light.svg">
    <img src="./brand/logo-light.svg" alt="envoi" width="200">
  </picture>
</p>

<p align="center">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://daguanren21.github.io/envoi/">Documentation</a> ·
  <a href="https://www.npmjs.com/package/@envoijs/http">npm</a> ·
  <a href="https://github.com/daguanren21/envoi">GitHub</a>
</p>

# envoi

A typed HTTP client that turns transport responses and backend envelopes into a stable `Promise<T>`.

```bash
pnpm add @envoijs/http
```

## Why envoi exists

Frontend projects often grow their own `request.ts` around axios. The file starts with a token header and gradually absorbs language headers, time zones, login redirects, downloads, business status codes, toasts, and project-specific response extraction. Every application then maintains a different copy.

Query libraries expose the second problem. Passing `axios.get()` directly to Pinia Colada or TanStack Query resolves an `AxiosResponse<Envelope<T>>`; it also treats HTTP 200 with a failed business code as a successful query. Each API function has to unwrap `response.data`, validate `code`, return `data`, and throw the correct error.

envoi centralizes that contract once:

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");
```

The query cache receives `User`. HTTP and business failures reject.

## When to use it

Use envoi when one or more of these apply:

- multiple applications maintain similar axios interceptors;
- the backend wraps data in `{ code, msg, data }` or another shared envelope;
- some services use business codes while others rely only on HTTP status;
- the same API functions must work with Pinia Colada, TanStack Query, Vuex, Pinia, Jotai, Zustand, or Redux;
- authentication, locale, tracing, and shared error handling need reusable hooks;
- axios is the default today, but fetch, ofetch, or a custom transport may be needed later.

A project that only needs a few plain HTTP calls and has no shared response protocol can keep using native fetch or axios directly.

## Quick start

Axios is the default adapter.

```ts
import { createHttp } from "@envoijs/http";

export const http = createHttp({
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
  },
  hooks: {
    onRequest: (ctx) => {
      const token = localStorage.getItem("token");
      if (token) ctx.request.headers.Authorization = `Bearer ${token}`;
    },
    onResponseError: (ctx) => {
      if (ctx.response.status === 401) location.href = "/login";
    },
  },
});
```

```ts
interface User {
  id: number;
  name: string;
}

const user = await http.get<User>("/users/1");
```

Given this response:

```json
{
  "code": 200,
  "msg": "ok",
  "data": { "id": 1, "name": "Ada" }
}
```

`user` is:

```ts
{ id: 1, name: "Ada" }
```

## Response envelopes

### Default `{ code, msg, data }`

No configuration is required. `code: 200` succeeds and `code: 401` is classified as unauthorized.

```ts
const user = await http.get<User>("/users/1");
const packet = await http.envelope<User>("/users/1");

// user: User
// packet: DefaultEnvelope<User>
```

HTTP status remains authoritative. HTTP 500 cannot be converted into success by a body containing `code: 200`.

### HTTP-only APIs

Disable business-envelope handling when a service returns REST data directly:

```ts
const rest = createHttp({
  adapter: "fetch",
  envelope: false,
});

const user = await rest.get<User>("/users/1");
```

A body without a `code` field already falls back to HTTP status, so mixed services can often use the default client.

### Renamed fields

```ts
const partner = createHttp({
  envelope: {
    code: "errno",
    msg: "errmsg",
    data: "result",
    ok: (code) => code === 0,
    unauthorized: (code) => code === 10_001,
  },
});
```

### Arbitrary response structures

```ts
import { createHttp, defineEnvelope } from "@envoijs/http";

interface PartnerBody<T> {
  success: boolean;
  result: T;
  message: string;
}

const envelope = defineEnvelope<PartnerBody<User>, User>({
  read: (response) => response.body as PartnerBody<User>,
  kind: (body) => (body.success ? "ok" : "error"),
  value: (body) => body.result,
  error: (body) => new Error(body.message),
});

const partner = createHttp({ envelope });
```

Custom errors are preserved. `value()` runs only for successful responses.

## Hooks

Hooks follow the ofetch lifecycle:

- `onRequest`
- `onRequestError`
- `onResponse`
- `onResponseError`

A hook or hook array runs sequentially. Hooks mutate the context; return values are ignored.

```ts
const http = createHttp({
  hooks: {
    onRequest: [addAuthHeader, addLocaleHeader],
    onRequestError: reportNetworkFailure,
    onResponse: normalizeSharedResponse,
    onResponseError: [handleUnauthorized, showErrorToast],
  },
});
```

One endpoint can add local hooks without putting URL checks in the global client. Global hooks run first.

```ts
await http.get("/legacy/report", {
  hooks: {
    onRequest: addLegacyHeader,
    onResponse: normalizeLegacyReport,
  },
});
```

Use hooks for cross-cutting behavior such as authentication, locale, tracing, logging, shared normalization, and global errors. Keep endpoint data ownership in the API/store/query that requested it.

### Reusable middleware and status codes

Group related hooks into middleware modules, then compose them once:

```ts
import { BizError, createHttp, createMiddleware, mergeMiddleware } from "@envoijs/http";

const authMiddleware = createMiddleware({
  onRequest: addAuthHeader,
  onResponseError: (ctx) => {
    if (ctx.error instanceof BizError && ctx.error.kind === "unauthorized")
      clearSessionAndRedirect();
  },
});

const errorMiddleware = createMiddleware({
  onResponseError: (ctx) => {
    if (ctx.error instanceof BizError && ctx.request.meta.silent !== true) showError(ctx.error.msg);
  },
});

const ApiCode = {
  Ok: 0,
  Unauthorized: 10_001,
  Validation: 20_001,
} as const;

const http = createHttp({
  envelope: {
    code: "status",
    msg: "message",
    data: "payload",
    ok: (code) => code === ApiCode.Ok,
    unauthorized: (code) => code === ApiCode.Unauthorized,
    warning: (code) => code === ApiCode.Validation,
  },
  hooks: mergeMiddleware(authMiddleware, errorMiddleware),
});
```

`onResponseError` receives the classified `ctx.error`. Read `BizError.code`, `kind`, and `source` instead of parsing the response body again. Global middleware runs before request-local middleware.

See the [middleware integration guide](https://daguanren21.github.io/envoi/guide/middleware) for axios interceptor mapping and per-request middleware.

## Adapters

Built-in adapters:

```ts
createHttp(); // axios
createHttp({ adapter: "axios" });
createHttp({ adapter: "fetch" });
createHttp({ adapter: "ofetch" }); // optional peer
```

Common baseURL, headers, and timeout belong to `createHttp.defaults`. Native adapter settings use typed factories.

```ts
import { axiosAdapter, createHttp, fetchAdapter, ofetchAdapter } from "@envoijs/http";

createHttp({
  adapter: axiosAdapter({ withCredentials: true }),
});

createHttp({
  adapter: fetchAdapter({ init: { credentials: "include" } }),
});

createHttp({
  adapter: ofetchAdapter({ retry: 2, retryDelay: 250 }),
});
```

Any other transport implements the adapter contract:

```ts
import type { Adapter } from "@envoijs/http";

const customAdapter: Adapter = {
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

const http = createHttp({ adapter: customAdapter });
```

Adapters receive a final URL with baseURL and query parameters already applied. They return every HTTP response, including 4xx and 5xx, and throw only transport failures such as network errors, aborts, and timeouts.

## Pinia Colada and TanStack Query

Plain axios can be used as a query function after writing a wrapper:

```ts
async function getCurrentUserWithAxios(): Promise<User> {
  const response = await axios.get<ApiEnvelope<User>>("/users/me");
  if (response.data.code !== 200) throw new Error(response.data.msg);
  return response.data.data;
}
```

Passing `axios.get()` directly caches `AxiosResponse<ApiEnvelope<User>>` and treats HTTP 200 business failures as success. envoi supplies the wrapper centrally:

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");
```

```ts
// Pinia Colada
const { data: user } = useQuery({
  key: ["current-user"],
  query: getCurrentUser,
});

// TanStack Query
const { data: user } = useQuery({
  queryKey: ["current-user"],
  queryFn: getCurrentUser,
});
```

Server-owned data with stale time, deduplication, invalidation, or optimistic updates should remain in the query cache instead of being copied into another store.

## State stores and authorization abilities

envoi returns `Promise<T>` and does not import Pinia, Vuex, Jotai, Zustand, Redux, or an ability library. A store action can call the API function that owns the request.

Authorization abilities have a specific synchronization point after the auth profile request:

```ts
interface AuthProfile {
  roles: string[];
  permissions: string[];
}

const getAuthProfile = (): Promise<AuthProfile> => http.get<AuthProfile>("/auth/profile");

async function refreshAuthorization(): Promise<AuthProfile> {
  const profile = await getAuthProfile();
  ability.update(profile);
  return profile;
}

function logout(): void {
  ability.reset();
}
```

A global unauthorized hook may call `ability.reset()`. Endpoint-specific profile updates should remain in the auth service or store action. Frontend ability checks control UI behavior; the backend must still enforce every permission.

## Raw responses, downloads, and errors

```ts
import { BizError } from "@envoijs/http";

try {
  const response = await http.raw<Blob>("/reports/export", {
    responseType: "blob",
  });
  saveAs(response.body, "report.xlsx");
} catch (error) {
  if (error instanceof BizError) {
    console.error(error.code, error.kind, error.body);
  }
}
```

`raw()`, blob responses, and `skipEnvelope` still enforce HTTP errors. Inspect an expected non-ok response explicitly:

```ts
const response = await http.raw("/health", {
  ignoreResponseError: true,
});
```

## Request bodies

Objects are serialized as JSON. FormData, Blob, ArrayBuffer, typed arrays, URLSearchParams, and streams pass through. Explicit `null`, `false`, `0`, and empty-string bodies are preserved.

Set Content-Type explicitly for string bodies:

```ts
await http.post("/form", new URLSearchParams({ name: "Ada" }));

await http.post("/legacy-form", "name=Ada", {
  headers: {
    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
  },
});
```

Projects migrating axios 0.x form-style strings can opt into `legacyStringBody()` as an `onRequest` hook.

## Runtime support

- Node.js 18+
- Browsers with the selected adapter's required APIs
- ESM and CommonJS
- TypeScript declarations included

## Agent guidance

The repository includes an `envoi-best-practices` skill covering adapters, hooks, envelopes, state/query ownership, dependency admission, and releases.

```bash
npx skills add daguanren21/envoi --skill envoi-best-practices
```
