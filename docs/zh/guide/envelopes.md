# 响应 Envelope

Envelope 层负责判断已解析的 HTTP response 是否成功，并决定哪个值成为 `T`。

## 默认只处理 HTTP

没有 envelope policy 时，core 只看 HTTP status，并原样返回解析后的 body：

```ts
const rest = createHttp({
  adapter: "fetch",
});
```

body 中即使存在 `code`、`status` 或 `success`，项目没有选择 policy 前都不会产生特殊含义。

## 标准字段映射

下面这种 packet 需要明确设置 `envelope: {}`：

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

`code: 200` 表示成功，`code: 401` 表示未授权。HTTP status 优先，HTTP 500 不会因为 body 有 `code: 200` 就变成成功。

## 映射不同字段名

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

## 定义任意协议

`defineEnvelope<TBody, TValue>()` 会给每个回调补全类型。

```ts
const envelope = defineEnvelope<PartnerBody<User>, User>({
  read: (response) => response.body as PartnerBody<User>,
  kind: (body) => (body.success ? "ok" : "error"),
  value: (body) => body.result,
  error: (body) => new PartnerError(body.message),
});

const partner = createHttp({ adapter: "fetch", envelope });
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
