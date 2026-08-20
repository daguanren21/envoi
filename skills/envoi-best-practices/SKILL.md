---
name: envoi-best-practices
description: Use when implementing, integrating, reviewing, or debugging @envoijs/http; choosing an adapter; defining response envelopes; writing request/response hooks; connecting envoi to state/query/ability libraries; evaluating a new dependency; or preparing an envoi release.
version: "1.0.0"
---

# envoi best practices

Keep transport, protocol, and state ownership separate.

## Start with ownership

Classify the requested behavior before writing code:

| Concern                                                                                                | Owner                          |
| ------------------------------------------------------------------------------------------------------ | ------------------------------ |
| HTTP execution                                                                                         | adapter                        |
| auth, locale, tracing, shared normalization                                                            | hooks                          |
| `{ code, msg, data }` or another protocol                                                              | envelope                       |
| endpoint-specific data mapping                                                                         | API function                   |
| app-owned state                                                                                        | existing state library         |
| roles and permissions                                                                                  | ability/auth domain            |
| stale/refetch/invalidation                                                                             | Pinia Colada or TanStack Query |
| Do not solve a store problem in a global HTTP hook. Do not solve a transport problem in a query cache. |

## Create the client

Axios is the default. Common settings belong to `defaults`; native settings belong to the typed adapter factory.

```ts
import { axiosAdapter, createHttp } from "@envoijs/http";

export const http = createHttp({
  adapter: axiosAdapter({ withCredentials: true }),
  defaults: {
    baseURL: "/api",
    timeout: 15_000,
  },
});
```

Read [references/adapters.md](references/adapters.md) before adding or changing an adapter.

Before adding a third-party package, apply
[references/dependencies.md](references/dependencies.md).

## Define the envelope once

Default `{ code, msg, data }` requires no config. HTTP-only backends use `envelope: false`. Renamed fields use `EnvelopeMap`. Arbitrary structures use `defineEnvelope<TBody, TValue>()`.

Read [references/envelopes-and-errors.md](references/envelopes-and-errors.md) before changing response extraction or error behavior.

## Use hooks only for cross-cutting behavior

Hooks match ofetch:

```text
onRequest -> adapter -> onResponse
               throw -> onRequestError
non-ok response -> onResponseError -> throw
```

Global hooks run before request-local hooks. Hook return values are ignored; mutate context directly.

```ts
await http.get("/special", {
  hooks: {
    onResponse: normalizeOnlyThisEndpoint,
  },
});
```

Read [references/hooks.md](references/hooks.md) before implementing authentication, refresh, retries, toasts, or endpoint-specific normalization.

## Keep state libraries outside HTTP

`@envoijs/http` returns `Promise<T>`. Pinia/Vuex/Jotai/Zustand/Redux own assignment. Pinia Colada/TanStack Query own server-state caches.

Do not claim ordinary `store.set(await request())` as an envoi feature. Automatic endpoint-to-store synchronization is not implemented.

Read [references/state-and-query.md](references/state-and-query.md) before adding state examples or a query integration.

## Request-body rules

- Objects: adapter serializes JSON unless the body is a native body type.
- FormData/Blob/ArrayBuffer/stream: pass through.
- Strings: set Content-Type explicitly.
- Legacy axios 0.x form-style strings: opt into `legacyStringBody()`.
- Preserve `null`, `false`, `0`, and `""`; never use `??` to select an explicit body.

## Error rules

- HTTP status failure takes precedence over default business `code`.
- `raw()`, blob, and `skipEnvelope` still enforce HTTP errors.
- Use `ignoreResponseError: true` only when the caller intentionally inspects a non-ok response.
- Custom envelope errors are thrown unchanged.
- `value()` runs only for successful custom envelopes.

## Before completion

Run the canonical gate:

```bash
pnpm verify
```

It must pass audit, oxlint, oxfmt, typecheck, tests, builds, publint, and Are The Types Wrong.

For adapter changes, add the adapter to the shared conformance suite. For public API changes, add a type contract test. For release work, follow [references/release.md](references/release.md).
