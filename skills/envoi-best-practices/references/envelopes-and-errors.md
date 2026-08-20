# Envelopes and errors

## Default protocol

```ts
interface DefaultEnvelope<T> {
  code: number | string;
  msg?: string;
  data: T;
}
```

Default ok = 200, unauthorized = 401. A body without `code` uses HTTP status and is returned as-is.

HTTP status is authoritative. HTTP 500 + body `{ code: 200 }` is still an HTTP error.

## HTTP-only backend

```ts
createHttp({ envelope: false });
```

## Renamed fields

```ts
createHttp({
  envelope: {
    code: "errno",
    msg: "errmsg",
    data: "result",
    ok: (code) => code === 0,
  },
});
```

## Arbitrary protocol

```ts
const partner = defineEnvelope<PartnerBody<User>, User>({
  read: (response) => response.body as PartnerBody<User>,
  kind: (body) => (body.success ? "ok" : "error"),
  value: (body) => body.result,
  error: (body) => new PartnerError(body.message),
});
```

Rules:

- `value()` runs only for ok.
- `error()` is thrown unchanged.
- do not show UI inside envelope functions;
- do not read stores or routers inside envelope functions;
- keep mapping deterministic and side-effect free.

## Return modes

```ts
http.get<User>(url); // User
http.envelope<User>(url); // DefaultEnvelope<User>
http.raw<User>(url); // HttpResponse<User>
```

`raw()` skips business-envelope extraction, not HTTP error classification.

```ts
await http.raw(url, { ignoreResponseError: true });
```

Use ignore only when inspecting the failure payload is the explicit caller contract.
