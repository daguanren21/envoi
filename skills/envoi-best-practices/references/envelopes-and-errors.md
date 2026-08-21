# Envelopes and errors

## HTTP-only default

```ts
createHttp({ adapter: "fetch" });
```

Core uses HTTP status and returns the parsed body unchanged. It never infers a business protocol from body fields.

## Standard `{ code, msg, data }`

```ts
interface DefaultEnvelope<T> {
  code: number | string;
  msg?: string;
  data: T;
}

createHttp({
  adapter: "fetch",
  envelope: {},
});
```

Explicit standard mapping uses ok = 200 and unauthorized = 401. HTTP status remains authoritative.

## Renamed fields

```ts
createHttp({
  adapter: "fetch",
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
http.envelope<DefaultEnvelope<User>>(url); // DefaultEnvelope<User>
http.raw<User>(url); // HttpResponse<User>
```

`raw()` skips business-envelope extraction, not HTTP error classification.

```ts
await http.raw(url, { ignoreResponseError: true });
```

Use ignore only when inspecting the failure payload is the explicit caller contract.
