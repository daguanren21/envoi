# Query libraries

Pinia Colada and TanStack Query cache the value returned by a query function. envoi gives them a stable `Promise<T>` contract.

## Why direct axios needs a wrapper

```ts
const getCurrentUserWithAxios = () => axios.get<ApiEnvelope<User>>("/users/me");
```

The resolved value is `AxiosResponse<ApiEnvelope<User>>`. The cache also sees HTTP 200 with `{ code: 500 }` as success.

A correct axios query function unwraps and throws on every endpoint:

```ts
async function getCurrentUserWithAxios(): Promise<User> {
  const response = await axios.get<ApiEnvelope<User>>("/users/me");
  const packet = response.data;
  if (packet.code !== 200) throw new Error(packet.msg);
  return packet.data;
}
```

envoi keeps that rule in one client:

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");
```

## Pinia Colada

```ts
import { defineQueryOptions, useQuery } from "@pinia/colada";

export const currentUserQuery = defineQueryOptions({
  key: ["current-user"],
  query: getCurrentUser,
});

const { data: user, status, asyncStatus } = useQuery(currentUserQuery);
```

## TanStack Query

```ts
import { useQuery } from "@tanstack/vue-query";

const { data: user, status } = useQuery({
  queryKey: ["current-user"],
  queryFn: getCurrentUser,
});
```

## Keep one owner

Use a query cache for server-owned data that needs stale time, cross-component request deduplication, invalidation, refetch, hydration, or optimistic updates.

Use a client store for session state, unsaved workflows, and UI state. Copying the same remote object into both systems creates extra synchronization paths.

## Framework boundary

envoi has no Vue, React, or state-library runtime dependency. Choose the query
library already used by the application and pass it the same `Promise<T>` API
function.
