# Getting started

Install the public package:

```bash
pnpm add @envoijs/http
```

## Create one client

Choose the adapter and response policy explicitly. Common base URL, headers, and timeout stay in `defaults`.

```ts
// src/api/http.ts
import { createHttp } from "@envoijs/http";

export const http = createHttp({
  adapter: "fetch",
  envelope: {},
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

`adapter` is required. `envelope: {}` explicitly selects the standard `{ code, msg, data }` policy.

## Define typed API functions

```ts
// src/api/users.ts
import { http } from "./http";

export interface User {
  id: number;
  name: string;
}

export function getUser(id: number): Promise<User> {
  return http.get<User>(`/users/${id}`);
}
```

### Hover API descriptions

Twoslash-enabled examples expose the real package types. Hover `get` below to see its signature and method description:

```ts twoslash
import { createHttp } from "@envoijs/http";

interface User {
  id: number;
  name: string;
}

const typedHttp = createHttp({
  adapter: "fetch",
  envelope: {},
});

const userPromise = typedHttp.get<User>("/users/1");
```

Given this backend response:

```json
{
  "code": 200,
  "msg": "ok",
  "data": { "id": 1, "name": "Ada" }
}
```

The caller receives a `User`:

```ts
const user = await getUser(1);
user.name;
```

## Use an HTTP-only service

HTTP-only is the core response policy. Omit `envelope` and the parsed response body is returned unchanged:

```ts
const rest = createHttp({
  adapter: "fetch",
  defaults: {
    baseURL: "https://api.example.test",
  },
});
```

## Add endpoint-local behavior

Global hooks run first. Add a local hook when one endpoint needs an exception.

```ts
await http.get("/legacy/report", {
  hooks: {
    onRequest: (ctx) => {
      ctx.request.headers["X-Legacy-Format"] = "v1";
    },
    onResponse: (ctx) => {
      ctx.response.body = normalizeLegacyReport(ctx.response.body);
    },
  },
});
```

## Next

- Encapsulate defaults with [project policies](./project-policies).
- Configure [response envelopes](./envelopes).
- Share behavior with [hooks](./hooks).
- Choose or implement an [adapter](./adapters).
- Use an API function with [Pinia Colada or TanStack Query](./query-libraries).
