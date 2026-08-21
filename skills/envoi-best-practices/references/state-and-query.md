# State and query ownership

## Current contract

`@envoijs/http` returns `Promise<T>`. That is the only current state-library contract.

Calling an API function inside a Pinia/Vuex/Jotai/Zustand/Redux action is normal usage, not an envoi integration feature.

## Axios versus envoi as a query function

`query: () => axios.get<Envelope<T>>(url)` resolves and caches
`AxiosResponse<Envelope<T>>`. HTTP 200 + business `code: 500` is also treated as
success unless the caller unwraps and throws manually.

`query: () => http.get<T>(url)` resolves `T`; transport and envelope objects are
removed, and business failures reject. Axios can achieve the same result with
a manual wrapper, but envoi centralizes that wrapper once.

## Choose one owner

Use Pinia Colada or TanStack Query for server-owned data that needs:

- staleTime;
- request dedupe across components;
- invalidation/refetch;
- optimistic mutation;
- cache hydration.

Use a client store for:

- authenticated session identity;
- unsaved workflow state;
- UI state;
- state not owned by the remote server.

Do not copy query-cache data into another store without a documented ownership reason.

## Ability and authorization

An ability instance is authorization-domain state. Fetch the typed auth
profile through envoi, then call `ability.update(profile)` in the auth
service/store action that owns the refresh. Call `ability.reset()` on logout
or globally observed 401.

Do not make envoi core import an ability implementation. Do not infer frontend
ability checks are a security boundary; the backend still enforces permission.

Do not add `@icebreakers/ability` as a built-in while it is unpublished and
unadopted. See [dependencies.md](dependencies.md).

## Framework boundary

envoi has no Vue, React, or state-library runtime dependency. Integration
guidance should explain the `Promise<T>` contract without claiming framework
compatibility as an envoi feature.
