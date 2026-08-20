# Hooks

Hooks share request and response behavior without coupling the HTTP client to a router, UI library, or state store.

## Lifecycle

```text
onRequest -> adapter -> onResponse -> envelope -> T
                  \-> onRequestError
non-ok response ------------------> onResponseError -> throw
```

A hook or hook array runs sequentially. Return values are ignored; mutate the context directly.

## Global hooks

```ts
const http = createHttp({
  hooks: {
    onRequest: [auth(getToken), addLocale, addTraceId],
    onRequestError: reportNetworkFailure,
    onResponse: normalizeSharedHeaders,
    onResponseError: [handleUnauthorized, showErrorToast],
  },
});
```

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
  hooks: {
    onRequest: auth(() => localStorage.getItem("token")),
  },
});
```

Existing `Authorization` headers are not overwritten.

## Error UI and silent requests

The `silent` option is stored in request metadata for an error hook to read.

```ts
const http = createHttp({
  hooks: {
    onResponseError: (ctx) => {
      if (ctx.request.meta.silent !== true) showError(ctx.response.body);
    },
  },
});

await http.get("/background-check", { silent: true });
```

Keep throwing the underlying error so stores and query libraries observe failure.

## Refresh tokens

Hook return values cannot replace a failed request. Token refresh needs an explicit outer request wrapper or an adapter feature. Use one shared refresh promise and a one-retry guard to prevent refresh storms and infinite recursion.

## Ownership rules

Use hooks for auth, locale, time zone, tracing, logging, shared normalization, and global errors. Keep endpoint data writes in the API, store action, atom, or query that owns that request.
