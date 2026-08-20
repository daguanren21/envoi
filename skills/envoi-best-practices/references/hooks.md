# Hook best practices

## Lifecycle

Hooks are phase callbacks, not Koa middleware. There is no `next()` and hook return values are ignored.

Global hook arrays execute first. Request-local hooks execute second.

## Use hooks for

- auth/locale/time-zone headers;
- trace IDs and telemetry;
- shared response normalization;
- global unauthorized handling;
- global toast/log policy;
- a one-request protocol exception via request-local hooks.

## Do not use hooks for

- endpoint data ownership;
- writing a specific list/detail into a store;
- a query cache;
- hiding a failed response as success without changing the documented protocol;
- retrying by returning a second request (return is ignored).

## Authentication

```ts
createHttp({
  hooks: {
    onRequest: auth(getToken),
    onResponseError: handleUnauthorized,
  },
});
```

Refresh-token retry requires an explicit outer request wrapper or an adapter feature. Prevent concurrent refresh requests with one shared refresh promise. Never recurse without a one-retry guard.

## Endpoint-local normalization

```ts
http.get("/legacy", {
  hooks: {
    onResponse: (ctx) => {
      ctx.response.body = normalizeLegacyBody(ctx.response.body);
    },
  },
});
```

Use `onResponse`, which runs before envelope classification. `onResponseError` observes a classified failure and cannot recover by returning a value.

## Error UI

Read `ctx.request.meta.silent` in an error hook when a caller intentionally suppresses global UI. Always throw/retain the underlying error so query/store state can observe failure.
