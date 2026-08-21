# 协议实验台

这个页面直接在浏览器运行仓库里的 `createHttp`。场景数据经过真实 hooks、response policy 和 error pipeline。

<ProtocolLab lang="zh" />

## 每个场景验证什么

### Envelope 成功

HTTP 200 加明确配置的 `{ code, msg, data }` policy，最终 resolve 的值是 `User`。

### 业务错误

HTTP 请求成功，业务 code 失败，Promise reject 为 `BizError`。直接使用 axios 时，这类 response 会 resolve。

### HTTP-only body

省略 `envelope` 后返回解析完成的 body，成功与否只看 HTTP status。

### 字段改名

Envelope map 读取 `errno`、`errmsg` 和 `result`，API 函数不用跟着后端字段改名。

### HTTP 503

HTTP status 优先。body 里残留的 `code: 200` 不会把 HTTP 503 变成成功。

## Demo 使用的 adapter

Demo 注入一个小型 adapter，再交给配置的 hooks、response policy 和 error pipeline。

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

axios、native fetch、ofetch、native bridge 和测试 adapter 都遵守这份 contract。
