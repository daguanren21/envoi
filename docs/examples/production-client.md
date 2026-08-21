# Example: production HTTP client

This example covers the code that usually ends up scattered across a large `request.ts`: credentials, auth headers, locale, business envelopes, endpoint exceptions, query functions, downloads, errors, and gradual axios migration.

## Requirements

The backend uses an existing response type and status dictionary:

```ts
export const ApiCode = {
  Ok: 10_000,
  SessionExpired: 14_001,
  Validation: 24_001,
} as const;

interface ApiEnvelope<T> {
  status: (typeof ApiCode)[keyof typeof ApiCode];
  message: string;
  payload: T;
}
```

Downloads return blobs. One legacy endpoint still expects a form string.

## 1. Define reusable middleware

```ts
// src/api/middleware.ts
import { auth, BizError, createMiddleware, legacyStringBody } from "@envoijs/http";

export const requestMiddleware = createMiddleware({
  onRequest: [
    auth(() => sessionStorage.getItem("access_token")),
    (ctx) => {
      ctx.request.headers["Accept-Language"] = getLocale();
      ctx.request.headers["X-Trace-Id"] = crypto.randomUUID();
    },
    legacyStringBody(),
  ],
});

export const responseMiddleware = createMiddleware({
  onResponseError: (ctx) => {
    if (!(ctx.error instanceof BizError)) return;

    if (ctx.error.kind === "unauthorized") {
      clearSessionAndRedirect();
      return;
    }

    if (ctx.request.meta.silent !== true) showApiError(ctx.error.msg);
  },
});
```

## 2. Create the client

```ts
// src/api/http.ts
import {
  axiosAdapter,
  createAxiosInstance,
  createHttpFactory,
  mergeMiddleware,
} from "@envoijs/http";
import { ApiCode } from "./contracts";
import { requestMiddleware, responseMiddleware } from "./middleware";

const instance = createAxiosInstance({
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
});

export const createProjectHttp = createHttpFactory({
  adapter: axiosAdapter(instance),
  defaults: {
    baseURL: "/api",
    timeout: 20_000,
    headers: {
      Accept: "application/json",
    },
  },
  envelope: {
    code: "status",
    msg: "message",
    data: "payload",
    ok: (code) => code === ApiCode.Ok,
    unauthorized: (code) => code === ApiCode.SessionExpired,
    warning: (code) => code === ApiCode.Validation,
  },
  hooks: mergeMiddleware(requestMiddleware, responseMiddleware),
});

export const http = createProjectHttp();
```

## 3. Keep API functions small

```ts
// src/api/profile.ts
import { http } from "./http";

export interface Profile {
  id: number;
  displayName: string;
  roles: string[];
}

export function getProfile(): Promise<Profile> {
  return http.get<Profile>("/profile");
}
```

```ts
// src/api/orders.ts
interface Order {
  id: string;
  status: "draft" | "paid" | "shipped";
  total: number;
}

interface Page<T> {
  rows: T[];
  total: number;
}

export function listOrders(query: {
  page: number;
  pageSize: number;
  status?: Order["status"];
}): Promise<Page<Order>> {
  return http.get<Page<Order>>("/orders", { query });
}
```

## 4. Hand the function to any consumer

```ts
// Plain application code
const profile = await getProfile();

// Query library
const profileQuery = {
  queryKey: ["profile"],
  queryFn: getProfile,
};

// Background request without global toast
await http.get("/session/check", { silent: true });
```

The API function contract stays `Promise<T>` in every case.

## 5. Handle a one-endpoint exception locally

```ts
const reportMiddleware = createMiddleware({
  onRequest: (ctx) => {
    ctx.request.headers["X-Report-Version"] = "1";
  },
  onResponse: (ctx) => {
    ctx.response.body = normalizeLegacyReport(ctx.response.body);
  },
});

export function getLegacyReport(): Promise<Report> {
  return http.get<Report>("/legacy/report", {
    hooks: reportMiddleware,
  });
}
```

The exception remains visible beside the endpoint. Global hooks stay free of URL branches.

## 6. Download a file

```ts
export async function downloadInvoice(id: string): Promise<void> {
  const response = await http.raw<Blob>(`/invoices/${id}/file`, {
    responseType: "blob",
  });

  saveAs(response.body, `invoice-${id}.pdf`);
}
```

HTTP 4xx/5xx still reject. Use `ignoreResponseError: true` only when the endpoint contract explicitly returns useful failure payloads.

## 7. Migrate a legacy form endpoint

New code should use `URLSearchParams`:

```ts
export function copyOrder(input: { orderId: string }): Promise<void> {
  return http.post("/orders/copy", new URLSearchParams({ orderId: input.orderId }));
}
```

An unchanged axios 0.x-style string can opt into the compatibility hook configured above:

```ts
return http.post("/legacy/copy", "orderId=ord_42");
```

`legacyStringBody()` sets an explicit form Content-Type for non-JSON strings.

## 8. Migrate incrementally

The old request module and envoi client can coexist:

```text
src/api/http.ts          new envoi client
src/api/profile.ts       migrated
src/api/orders.ts        migrated
src/utils/request.ts     remaining legacy endpoints
```

Move one API module at a time. Delete the old interceptor file after the last caller has moved and behavior has been verified.

## Suggested file layout

```text
src/api/
├── http.ts
├── profile.ts
├── orders.ts
└── invoices.ts
```

The HTTP client owns transport and response policy. Each API module owns endpoint paths and business types. Components, stores, and query libraries consume the resulting promises.
