---
layout: home

title: envoi
titleTemplate: HTTP 返回契约
description: 为 axios、fetch、ofetch 和自定义 transport 提供统一的 TypeScript 返回层。

hero:
  name: envoi
  text: 调用方只拿 T。
  tagline: 一个与框架无关的 HTTP response layer。业务状态码、hooks 和 adapters 配置一次，所有 API 都暴露 Promise<T>。
  image:
    src: /brand/hero-mark.svg
    alt: envoi 打开的信封标记
  actions:
    - theme: brand
      text: 运行在线 Demo
      link: /zh/demo
    - theme: alt
      text: 安装与配置
      link: /zh/guide/getting-started

features:
  - title: 返回契约只写一次
    details: HTTP status、业务 code、字段改名和自定义 error 都放进带类型的 envelope。
  - title: Transport 可以替换
    details: transport 不做隐式选择，axios、fetch、ofetch 和自定义 adapter 接收相同的规范化请求。
  - title: 调试路径明确
    details: hooks 暴露生命周期，raw 保留 status、headers、blob 和底层 response。
---

<ProtocolLab lang="zh" />

<div class="envoi-home-section">

## 一个客户端，四层职责

```ts
const instance = createAxiosInstance({ withCredentials: true });
const http = createHttp({
  adapter: axiosAdapter(instance),
  defaults: { baseURL: "/api", timeout: 15_000 },
  envelope: { code: "code", msg: "msg", data: "data" },
  hooks: { onRequest: auth(getToken), onResponseError: showError },
});
```

<RequestFlow
  request="request hooks"
  adapter="adapter"
  policy="response policy"
  result="Promise<T>"
  label="请求处理流程"
/>

request hooks 准备请求，adapter 执行 HTTP，项目选择的 response policy 产出 `Promise<T>`。应用状态仍由调用方管理。

## 可以直接落到项目里的案例

<div class="envoi-use-grid">
  <a href="./examples/production-client">
    <span>01 / 完整案例</span>
    <strong>搭建生产客户端</strong>
    <p>一份代码串起认证、语言、业务状态码、query function、文件下载和渐进迁移。</p>
  </a>
  <a href="./guide/envelopes">
    <span>02 / 返回协议</span>
    <strong>定义 response contract</strong>
    <p>覆盖 HTTP-only 默认行为、显式 envelope、字段改名、自定义 error 和预期失败 body。</p>
  </a>
  <a href="./guide/adapters">
    <span>03 / Transport</span>
    <strong>保持 adapters 可替换</strong>
    <p>baseURL、query、timeout 和错误规则由统一层处理，adapter 只负责发送请求。</p>
  </a>
</div>

## 重复逻辑开始影响行为时再引入

只有两三个普通请求的项目可以继续使用 fetch 或 axios。多个接口或多个应用需要统一 response 解构、业务失败、公共 headers、adapter 行为和调用方返回值时，envoi 才开始节省维护成本。

</div>

<div class="envoi-cta">
  <div>
    <span class="envoi-cta__eyebrow">端到端案例</span>
    <strong>从一份可以上线的客户端开始。</strong>
  </div>
  <a href="./examples/production-client">查看完整案例 →</a>
</div>
