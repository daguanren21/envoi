# Reusable middleware

Middleware in envoi is a reusable bundle of lifecycle hooks. It does not use a Koa-style `next()` function.

```ts
interface HttpHooks {
  onRequest?: Hook | Hook[];
  onRequestError?: Hook | Hook[];
  onResponse?: Hook | Hook[];
  onResponseError?: Hook | Hook[];
}
```

## Define one middleware module

```ts
// src/api/middleware/auth.ts
import { auth, createMiddleware } from "@envoijs/http";

export const authMiddleware = createMiddleware({
  onRequest: auth(() => sessionStorage.getItem("access_token")),
  onResponseError: (ctx) => {
    if (ctx.response.status === 401) clearSessionAndRedirect();
  },
});
```

```ts
// src/api/middleware/locale.ts
export const localeMiddleware = createMiddleware({
  onRequest: (ctx) => {
    ctx.request.headers["Accept-Language"] = getLocale();
    ctx.request.headers["X-Time-Zone"] = Intl.DateTimeFormat().resolvedOptions().timeZone;
  },
});
```

## Compose middleware

```ts
import { createHttp, mergeMiddleware } from "@envoijs/http";

export const http = createHttp({
  defaults: { baseURL: "/api" },
  hooks: mergeMiddleware(authMiddleware, localeMiddleware, traceMiddleware, errorMiddleware),
});
```

Earlier bundles run first in each phase.

```text
auth.onRequest
locale.onRequest
trace.onRequest
adapter
error.onResponse
```

Response hooks also keep declaration order; they do not unwind in reverse.

## Use middleware for one request

```ts
const reportMiddleware = createMiddleware({
  onRequest: (ctx) => {
    ctx.request.headers["X-Report-Version"] = "1";
  },
  onResponse: (ctx) => {
    ctx.response.body = normalizeLegacyReport(ctx.response.body);
  },
});

await http.get("/legacy/report", {
  hooks: reportMiddleware,
});
```

Global middleware runs first, followed by request-local middleware.

## Connect an existing status-code definition

```ts
export const ApiCode = {
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

`onResponseError` receives the classified error:

```ts
import { BizError, createMiddleware } from "@envoijs/http";

export const errorMiddleware = createMiddleware({
  onResponseError: (ctx) => {
    if (!(ctx.error instanceof BizError)) return;

    if (ctx.error.kind === "unauthorized") {
      clearSessionAndRedirect();
      return;
    }

    if (ctx.error.code === ApiCode.Validation) {
      showValidationWarning(ctx.error.msg);
      return;
    }

    if (ctx.request.meta.silent !== true) showError(ctx.error.msg);
  },
});
```

The envelope classifies protocol state. Middleware decides cross-cutting application behavior after classification.

## Distinguish HTTP status from business code

`ctx.response.status` is the HTTP status. `BizError.code` is the mapped protocol code, and `BizError.source` tells which layer failed:

```ts
onResponseError: (ctx) => {
  if (ctx.response.status === 429) scheduleRetry();

  if (ctx.error instanceof BizError && ctx.error.source === "body")
    reportBusinessCode(ctx.error.code);
};
```

Map envelopes require an HTTP 2xx response before a body code can succeed. HTTP 401 is `unauthorized`; other non-2xx statuses are `error`. A body containing a success code cannot turn HTTP 500 into success.

If a backend gives HTTP statuses different semantics, use [`defineEnvelope()`](./envelopes#define-an-arbitrary-protocol). Its `kind(body, response)` callback can read both `response.status` and the parsed body. Middleware then receives the resulting error classification.

## Map axios interceptors

| Existing axios code             | envoi integration                   |
| ------------------------------- | ----------------------------------- |
| request interceptor             | `onRequest` middleware              |
| request rejection interceptor   | `onRequestError` middleware         |
| successful response interceptor | `onResponse` middleware or envelope |
| HTTP/business error interceptor | `onResponseError` middleware        |
| return `response.data.data`     | envelope `data` mapping             |
| reject on business code         | envelope `ok/unauthorized/warning`  |

Response extraction belongs in the envelope when every endpoint shares it. Keep `onResponse` for normalization that genuinely changes the parsed response before envelope classification.
