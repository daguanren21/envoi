# Protocol lab

This page runs the repository's `createHttp` implementation in the browser. No mocked UI state or framework adapter sits between the scenario and the result.

<ProtocolLab lang="en" />

## What each scenario proves

### Envelope success

HTTP 200 with an explicit `{ code, msg, data }` policy resolves the inner `data` as `User`.

### Business error

HTTP 200 with a failed business code rejects with `BizError`. Axios alone would resolve this response because the HTTP request succeeded.

### HTTP-only body

With `envelope` omitted, core returns the parsed body and uses only HTTP status.

### Renamed fields

An envelope map reads `errno`, `errmsg`, and `result` without changing endpoint code.

### HTTP 503

HTTP status takes precedence. A stale body containing `code: 200` cannot turn HTTP 503 into success.

## The adapter used by the demo

The demo injects a small adapter and lets the configured hooks, response policy, and error pipeline process its `HttpResponse`.

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
