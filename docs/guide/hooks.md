# Hooks

Hooks share request and response behavior without coupling the HTTP client to a router, UI library, or state store.

## Lifecycle

<LifecycleFlow lang="en" />

`onRequestError` handles adapter throws. `onResponseError` runs after response policy classifies non-ok. `onSuccess` receives the value selected for resolution. `onFinally` runs once on every path.

Hooks run sequentially. Return values are ignored; mutate `ctx.request`, `ctx.response`, `ctx.error`, or `ctx.value` at the matching phase.

## Global hooks

```ts
const http = createHttp({
  adapter: "fetch",
  hooks: {
    onRequest: [auth(getToken), addLocale, addTraceId],
    onRequestError: reportNetworkFailure,
    onResponse: normalizeSharedHeaders,
    onResponseError: [handleUnauthorized, showErrorToast],
    onSuccess: observeResolvedValue,
    onFinally: stopTrace,
  },
});
```

## Success and cleanup

```ts
const http = createHttp({
  adapter: "fetch",
  hooks: {
    onSuccess: (ctx) => {
      ctx.value = normalizeResolvedValue(ctx.value);
    },
    onFinally: (ctx) => {
      finishTrace(ctx.request, ctx.error);
    },
  },
});
```

`onFinally` hooks all run even when an earlier cleanup hook fails. If the request and cleanup both fail, the promise rejects with an `AggregateError`: request error first, cleanup errors after it in declaration order.

## Request-local hooks

Use local hooks for one endpoint instead of adding URL branches to a global hook.

```ts
await http.get("/legacy/report", {
  hooks: {
    onRequest: (ctx) => {
      ctx.request.headers["X-Format"] = "legacy";
    },
    onResponse: (ctx) => {
      ctx.response.body = normalizeLegacyReport(ctx.response.body);
    },
  },
});
```

Global hooks run before request-local hooks.

## Built-in auth helper

```ts
import { auth, createHttp } from "@envoijs/http";

const http = createHttp({
  adapter: "fetch",
  hooks: {
    onRequest: auth(() => localStorage.getItem("token")),
  },
});
```

Existing `Authorization` headers are not overwritten.

## Error UI and silent requests

The `silent` option is stored in request metadata for an error hook to read. `ctx.error` is already classified as `BizError` for HTTP and envelope failures.

```ts
import { BizError } from "@envoijs/http";

const http = createHttp({
  adapter: "fetch",
  hooks: {
    onResponseError: (ctx) => {
      if (ctx.error instanceof BizError && ctx.request.meta.silent !== true)
        showError(ctx.error.msg);
    },
  },
});

await http.get("/background-check", { silent: true });
```

The same error is thrown after the hook, so stores and query libraries observe failure.

To package several phases together, see [Reusable middleware](./middleware).

## Refresh tokens

Hook return values cannot replace a failed request. Token refresh needs an explicit outer request wrapper or an adapter feature. Use one shared refresh promise and a one-retry guard to prevent refresh storms and infinite recursion.

## Ownership rules

Use hooks for auth, locale, time zone, tracing, logging, shared normalization, and global errors. Keep endpoint data writes in the API, store action, atom, or query that owns that request.
