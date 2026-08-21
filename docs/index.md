---
layout: home

title: envoi
titleTemplate: Typed HTTP response layer
description: A framework-free HTTP response layer for axios, fetch, ofetch, and custom transports.

hero:
  name: envoi
  text: Return T. Keep transport details out.
  tagline: A framework-free HTTP response layer for axios, fetch, and ofetch. Configure business codes, hooks, and adapters once; expose Promise<T> everywhere.
  image:
    src: /brand/hero-mark.svg
    alt: envoi's opened-envelope mark
  actions:
    - theme: brand
      text: Run the live demo
      link: /demo
    - theme: alt
      text: Install and configure
      link: /guide/getting-started

features:
  - title: Normalize once
    details: Move HTTP status, business codes, renamed fields, and custom errors into one typed response contract.
  - title: Keep transport portable
    details: No transport is implicit. Axios, fetch, ofetch, and custom adapters receive the same normalized request.
  - title: Debug explicitly
    details: Hooks expose lifecycle behavior; raw keeps status, headers, blobs, and the underlying response available.
---

<ProtocolLab lang="en" />

<div class="envoi-home-section">

## One client, four explicit layers

```ts
const instance = createAxiosInstance({ withCredentials: true });
const http = createHttp({
  adapter: axiosAdapter(instance),
  defaults: { baseURL: "/api", timeout: 15_000 },
  envelope: { code: "code", msg: "msg", data: "data" },
  hooks: { onRequest: auth(getToken), onResponseError: showError },
});
```

<RequestFlow />

Request hooks prepare the call, the adapter executes HTTP, and the selected response policy produces `Promise<T>`. Application state stays with the caller.

## Production paths, not isolated snippets

<div class="envoi-use-grid">
  <a href="./examples/production-client">
    <span>01 / Example</span>
    <strong>Build a production client</strong>
    <p>Auth, locale, business codes, query functions, downloads, and a migration path in one example.</p>
  </a>
  <a href="./guide/envelopes">
    <span>02 / Protocol</span>
    <strong>Model the response contract</strong>
    <p>HTTP-only defaults, explicit envelopes, renamed fields, custom errors, and expected failure bodies.</p>
  </a>
  <a href="./guide/adapters">
    <span>03 / Transport</span>
    <strong>Keep adapters interchangeable</strong>
    <p>Use native settings without leaking baseURL, query serialization, timeout, or error rules into each adapter.</p>
  </a>
</div>

## Use envoi when repetition has become behavior

A small project with two plain requests can keep native fetch or axios. envoi becomes useful when several endpoints or applications must agree on response extraction, business failures, shared headers, adapter behavior, and the value returned to callers.

</div>

<div class="envoi-cta">
  <div>
    <span class="envoi-cta__eyebrow">End-to-end example</span>
    <strong>Build the client you would actually ship.</strong>
  </div>
  <a href="./examples/production-client">Open the example →</a>
</div>
