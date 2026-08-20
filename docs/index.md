---
layout: home

title: envoi
titleTemplate: Typed HTTP responses
description: Return Promise<T> from axios, fetch, or ofetch without repeated client wrappers.

hero:
  name: envoi
  text: One response contract for every HTTP adapter.
  tagline: Return Promise<T> from axios, fetch, or ofetch—without copying interceptors or leaking transport envelopes into query caches.
  image:
    src: /brand/hero-mark.svg
    alt: envoi's opened-envelope mark
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/daguanren21/envoi

features:
  - title: Typed output
    details: API functions resolve the business value your store or query cache expects.
  - title: Adapter-neutral
    details: Axios by default, with fetch, ofetch, and a small custom adapter contract.
  - title: Envelope-aware
    details: Handle code/msg/data, renamed fields, HTTP-only services, or an arbitrary protocol once.
  - title: Lifecycle hooks
    details: Share auth, locale, tracing, normalization, and errors globally or for one request.
  - title: Query-ready
    details: Pinia Colada and TanStack Query receive T and observe business failures as errors.
  - title: Raw when needed
    details: Keep headers, status, blobs, and transport details through the explicit raw response path.
---

<RequestFlow />

<div class="envoi-home-section">

## The contract a query cache expects

Axios can power a query function after every endpoint removes `AxiosResponse`, validates the backend envelope, and returns the inner value. envoi keeps that behavior in one client.

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");

const { data: user } = useQuery({
  key: ["current-user"],
  query: getCurrentUser,
});
```

`user` is `User | undefined`. HTTP failures and failed business codes reject.

## Choose the behavior at the right layer

- **Adapter** executes HTTP.
- **Hooks** own cross-cutting request and response behavior.
- **Envelope** maps the backend protocol to `T`.
- **Store or query cache** owns the data after the promise resolves.

</div>

<div class="envoi-cta">
  <div>
    <span class="envoi-cta__eyebrow">First request</span>
    <strong>Install the client and return a typed value.</strong>
  </div>
  <a href="./guide/getting-started">Read the guide →</a>
</div>
