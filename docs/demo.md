# Protocol lab

This page runs the repository's `createHttp` implementation in the browser. No mocked UI state or framework adapter sits between the scenario and the result.

<ProtocolLab lang="en" />

## What each scenario proves

### Default success

HTTP 200 with `{ code: 200, data }` resolves the inner `data` as `User`.

### Business error

HTTP 200 with a failed business code rejects with `BizError`. Axios alone would resolve this response because the HTTP request succeeded.

### HTTP-only body

`envelope: false` returns the parsed body and uses HTTP status for success.

### Renamed fields

An envelope map reads `errno`, `errmsg`, and `result` without changing endpoint code.

### HTTP 503

HTTP status takes precedence. A stale body containing `code: 200` cannot turn HTTP 503 into success.

## The adapter used by the demo

The demo injects a small adapter and lets the normal hooks/envelope/error pipeline process its `HttpResponse`.

```ts
const adapter: Adapter = {
  name: "protocol-lab",
  async request() {
    return {
      status: scenario.status,
      statusText: scenario.statusText,
      headers: { "x-demo": "protocol-lab" },
      body: scenario.body,
    };
  },
};

const client = createHttp({
  adapter,
  envelope: scenario.envelope,
});

const result = await client.get<User>("/demo");
```

The same adapter contract is used for axios, native fetch, ofetch, native bridges, and tests.
