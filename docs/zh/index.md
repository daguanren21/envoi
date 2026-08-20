---
layout: home

title: envoi
titleTemplate: 统一 HTTP 返回契约
description: 让 axios、fetch、ofetch 返回稳定的 Promise<T>。

hero:
  name: envoi
  text: 给每个 HTTP adapter 一套返回契约。
  tagline: axios、fetch、ofetch 都返回 Promise<T>；业务 envelope、状态码和公共 hooks 只配置一次。
  image:
    src: /brand/hero-mark.svg
    alt: envoi 打开的信封标记
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 查看 GitHub
      link: https://github.com/daguanren21/envoi

features:
  - title: 直接得到 T
    details: API resolve 的值可以直接交给组件、store 或 query cache。
  - title: Adapter 可替换
    details: 默认 axios，也支持 fetch、ofetch 和自定义 transport。
  - title: Envelope 统一处理
    details: code/msg/data、改名字段、HTTP-only 和任意协议都可以配置。
  - title: 生命周期 Hooks
    details: 认证、语言、追踪、归一化和错误处理可全局复用，也可只作用于一个请求。
  - title: 可直接接 Query
    details: Pinia Colada 和 TanStack Query 缓存 T，业务失败进入 error。
  - title: Raw 路径明确
    details: 需要 status、headers、blob 或 transport 细节时显式使用 raw。
---

<RequestFlow
  adapter="adapter"
  hooks="hooks"
  envelope="envelope"
  result="Promise<T>"
  label="请求处理流程"
/>

<div class="envoi-home-section">

## Query cache 需要的返回值

把 `axios.get()` 直接传给 query，缓存里会出现 `AxiosResponse<Envelope<T>>`。envoi 在统一客户端里完成解构和业务错误判断。

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");

const { data: user } = useQuery({
  key: ["current-user"],
  query: getCurrentUser,
});
```

`user` 的类型是 `User | undefined`。HTTP 错误和失败的业务状态码都会 reject。

## 每层只处理自己的任务

- **Adapter** 执行 HTTP。
- **Hooks** 处理公共请求和响应行为。
- **Envelope** 把后端协议映射成 `T`。
- **Store 或 query cache** 接管 Promise resolve 后的数据。

</div>

<div class="envoi-cta">
  <div>
    <span class="envoi-cta__eyebrow">第一个请求</span>
    <strong>安装客户端，返回带类型的业务数据。</strong>
  </div>
  <a href="./guide/getting-started">阅读指南 →</a>
</div>
