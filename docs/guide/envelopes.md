# Response envelopes

The envelope layer decides whether a parsed HTTP response succeeds and which value becomes `T`.

## HTTP-only default

Without an envelope policy, core uses HTTP status and returns the parsed body unchanged:

```ts
const rest = createHttp({
  adapter: "fetch",
});
```

A body containing `code`, `status`, or `success` has no special meaning until the project selects a policy.

## Standard field map

Select `envelope: {}` for this packet:

```ts
interface DefaultEnvelope<T> {
  code: number | string;
  msg?: string;
  data: T;
}
```

```ts
const api = createHttp({
  adapter: "fetch",
  envelope: {},
});

const user = await api.get<User>("/users/1");
const packet = await api.envelope<DefaultEnvelope<User>>("/users/1");
```

`code: 200` succeeds and `code: 401` is unauthorized. HTTP status remains authoritative, so HTTP 500 cannot become success because the body contains `code: 200`.

## Map renamed fields

```ts
const partner = createHttp({
  adapter: "fetch",
  envelope: {
    code: "errno",
    msg: "errmsg",
    data: "result",
    ok: (code) => code === 0,
    unauthorized: (code) => code === 10_001,
    warning: (code) => code === 20_001,
  },
});
```

## Define an arbitrary protocol

Use `defineEnvelope<TBody, TValue>()` to type each callback.

```ts
import { createHttp, defineEnvelope } from "@envoijs/http";

interface PartnerBody<T> {
  success: boolean;
  result: T;
  message: string;
}

const envelope = defineEnvelope<PartnerBody<User>, User>({
  read: (response) => response.body as PartnerBody<User>,
  kind: (body) => (body.success ? "ok" : "error"),
  value: (body) => body.result,
  error: (body) => new PartnerError(body.message),
});

const partner = createHttp({ adapter: "fetch", envelope });
```

`value()` runs only when `kind()` returns `ok`. The error returned by `error()` is thrown unchanged.

## Read an expected failure body

Response errors throw by default, including `raw()` and blob responses. Opt out for an endpoint whose contract requires inspecting a non-success response.

```ts
const response = await http.raw<HealthPayload>("/health", {
  ignoreResponseError: true,
});

if (response.status === 503) showMaintenance(response.body);
```

## Keep mapping pure

Envelope callbacks should only classify and transform protocol data. UI toasts, routing, state writes, and auth refresh belong in hooks or the calling application layer.
