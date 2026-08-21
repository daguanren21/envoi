# Project policies

Core has no default transport and no default business envelope. Each application defines those choices once, then creates normal or specialized clients from that policy.

## Define one project factory

```ts
import { createHttpFactory, mergeMiddleware } from "@envoijs/http";

export const createProjectHttp = createHttpFactory({
  adapter: "fetch",
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
    headers: {
      "x-client": "seller-web",
    },
  },
  envelope: {
    code: "status",
    msg: "message",
    data: "payload",
    ok: (code) => code === 10_000,
    unauthorized: (code) => code === 14_001,
  },
  hooks: mergeMiddleware(authMiddleware, localeMiddleware, errorMiddleware),
});

export const http = createProjectHttp();
```

Another project can select a different adapter, response policy, and middleware without changing core.

## Create a specialized client

```ts
export const reportHttp = createProjectHttp({
  defaults: {
    baseURL: "/reports",
    timeout: 60_000,
    headers: {
      "x-domain": "reporting",
    },
  },
  hooks: {
    onRequest: addReportTrace,
    onFinally: stopReportTrace,
  },
});
```

Merge behavior is explicit:

| Option             | Factory behavior                                  |
| ------------------ | ------------------------------------------------- |
| `adapter`          | specialized value replaces project adapter        |
| `envelope`         | specialized value replaces project policy         |
| `defaults`         | shallow merge                                     |
| `defaults.headers` | key merge; specialized value wins                 |
| `hooks`            | project hooks run first, specialized hooks follow |

Use `envelope: false` in a specialized client to select HTTP-only behavior when the project factory normally unwraps a business packet.

## Customize one request

Request hooks run after all project and specialized-client hooks:

```ts
await reportHttp.get("/legacy", {
  hooks: {
    onRequest: (ctx) => {
      ctx.request.headers["x-legacy-format"] = "1";
    },
    onSuccess: (ctx) => {
      auditLegacyResult(ctx.value);
    },
    onFinally: () => {
      releaseLegacyResources();
    },
  },
});
```

This keeps endpoint exceptions next to the endpoint instead of adding URL branches to global middleware.

## Lifecycle customization

<LifecycleFlow lang="en" />

- `onRequestError` can replace `ctx.error` before rejection.
- `onResponse` can replace `ctx.response` before classification.
- `onResponseError` receives the classified error and can replace it.
- `onSuccess` receives the final `ctx.value` and can replace it.
- `onFinally` runs once for resolved and rejected requests.

All hooks run sequentially. Project hooks precede specialized-client hooks; request-local hooks run last.

If both the request and one or more `onFinally` hooks fail, envoi rejects with an `AggregateError`. Its `errors` array contains the request error first, followed by cleanup errors in declaration order. This preserves every failure without skipping later cleanup hooks.

## Explicit adapter examples

```ts
const fetchProject = createHttpFactory({
  adapter: "fetch",
});

const axiosProject = createHttpFactory({
  adapter: axiosAdapter(createAxiosInstance()),
});

const nativeProject = createHttpFactory({
  adapter: nativeBridgeAdapter,
});
```

The built-ins are conveniences. Project policy owns the selection.
