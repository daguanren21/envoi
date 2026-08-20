# 响应 Envelope

Envelope 层负责判断已解析的 HTTP response 是否成功，并决定哪个值成为 `T`。

## 默认字段

```ts
interface DefaultEnvelope<T> {
  code: number | string;
  msg?: string;
  data: T;
}
```

默认把 `code: 200` 识别为成功，把 `code: 401` 识别为未授权。HTTP status 优先，HTTP 500 不会因为 body 有 `code: 200` 就变成成功。

```ts
const user = await http.get<User>("/users/1");
const packet = await http.envelope<User>("/users/1");

// user: User
// packet: DefaultEnvelope<User>
```

## 只使用 HTTP status

```ts
const rest = createHttp({ envelope: false });
```

默认客户端遇到没有 `code` 的 body 时，也会直接按 HTTP status 处理。

## 映射不同字段名

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

## 定义任意协议

`defineEnvelope<TBody, TValue>()` 会给每个回调补全类型。

```ts
const envelope = defineEnvelope<PartnerBody<User>, User>({
  read: (response) => response.body as PartnerBody<User>,
  kind: (body) => (body.success ? "ok" : "error"),
  value: (body) => body.result,
  error: (body) => new PartnerError(body.message),
});
```

`value()` 只在成功时执行，`error()` 返回的错误会原样抛出。

## 读取预期中的失败 response

默认情况下，`raw()` 和 blob response 也会抛 HTTP 错误。接口契约明确需要读取失败 body 时再开启：

```ts
const response = await http.raw<HealthPayload>("/health", {
  ignoreResponseError: true,
});
```

Envelope 回调只做协议判断和数据转换。toast、路由、store 和 token 刷新放在 hooks 或调用方。
