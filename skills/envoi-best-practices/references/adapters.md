# Adapter best practices

## Contract

```ts
interface Adapter {
  readonly name: string;
  request(request: HttpRequest): Promise<HttpResponse>;
}
```

The core gives adapters:

- final URL with baseURL applied;
- query serialized by ufo;
- merged headers;
- timeout and combined AbortSignal;
- explicit responseType;
- preserved body values.

Adapters MUST return 4xx/5xx as `HttpResponse`. They MUST throw only transport failures.

## Built-ins

```ts
createHttp(); // axios
createHttp({ adapter: "fetch" });
createHttp({ adapter: "ofetch" });
```

Native options use factories:

```ts
axiosAdapter({ withCredentials: true });
fetchAdapter({ init: { credentials: "include" } });
ofetchAdapter({ retry: 2, retryDelay: 250 });
```

Common baseURL/headers/timeout stay in `createHttp.defaults`.

Existing axios interceptors and wrappers MUST use the same instance:

```ts
createHttp({ adapter: axiosAdapter(instance) });
```

Register plugins before creating the envoi client. Pass per-request native/plugin fields through `meta.axios`. Response plugins MUST preserve the complete `AxiosResponse`; envelope extraction remains in envoi.

Framework bindings such as `vue-axios` MAY expose the raw instance for legacy callers, but MUST NOT register envoi under `$http`; the return contracts differ. Mokup request switching and `axios-mock-adapter` MUST attach to the instance passed to `axiosAdapter`. Use one mock transport unless rewritten Mokup URLs are intentionally matched by the in-process mock adapter.

## Custom adapters

Do not add ky/got/native-bridge conditionals to core. Implement the public contract and pass the object to `createHttp`.

A new built-in adapter is justified only when:

1. the library is actively maintained;
2. usage is broad enough to carry support cost;
3. it cannot be represented cleanly as a documented custom adapter;
4. it passes every adapter conformance test.

## Conformance

Every built-in MUST match behavior for:

- baseURL and absolute URL override;
- arrays/nested/null query values;
- JSON and native bodies;
- responseType text/blob/arrayBuffer/stream;
- timeout with and without external signal;
- 2xx and 4xx/5xx;
- response headers and raw response.
