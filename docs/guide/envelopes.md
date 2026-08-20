# Response envelopes

The envelope layer decides whether a parsed HTTP response succeeds and which value becomes `T`.

## Default fields

The default protocol is:

```ts
interface DefaultEnvelope<T> {
  code: number | string;
  msg?: string;
  data: T;
}
```

`code: 200` succeeds. `code: 401` is classified as unauthorized. HTTP status remains authoritative, so HTTP 500 cannot become success because the body contains `code: 200`.

```ts
const user = await http.get<User>("/users/1");
const packet = await http.envelope<User>("/users/1");

// user: User
// packet: DefaultEnvelope<User>
```

## HTTP-only responses

```ts
const rest = createHttp({ envelope: false });
```

The default client also uses HTTP status automatically when a body has no `code` field.

## Map renamed fields

```ts
const partner = createHttp({
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

const partner = createHttp({ envelope });
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
