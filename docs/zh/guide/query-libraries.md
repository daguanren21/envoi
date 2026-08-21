# Query 库

Pinia Colada 和 TanStack Query 会缓存 query function resolve 的值。envoi 给它们提供稳定的 `Promise<T>`。

## Axios 直接接入需要包装

```ts
const getCurrentUserWithAxios = () => axios.get<ApiEnvelope<User>>("/users/me");
```

这个函数 resolve 的类型是 `AxiosResponse<ApiEnvelope<User>>`。HTTP 200 下的 `{ code: 500 }` 也会进入成功状态。

每个 axios API 都需要手工解构和抛错：

```ts
async function getCurrentUserWithAxios(): Promise<User> {
  const response = await axios.get<ApiEnvelope<User>>("/users/me");
  const packet = response.data;
  if (packet.code !== 200) throw new Error(packet.msg);
  return packet.data;
}
```

envoi 把这段规则放在统一客户端里：

```ts
const getCurrentUser = (): Promise<User> => http.get<User>("/users/me");
```

## Pinia Colada

```ts
import { defineQueryOptions, useQuery } from "@pinia/colada";

export const currentUserQuery = defineQueryOptions({
  key: ["current-user"],
  query: getCurrentUser,
});

const { data: user, status, asyncStatus } = useQuery(currentUserQuery);
```

## TanStack Query

```ts
import { useQuery } from "@tanstack/vue-query";

const { data: user, status } = useQuery({
  queryKey: ["current-user"],
  queryFn: getCurrentUser,
});
```

## 只保留一个数据归属

服务端数据需要 stale time、跨组件请求去重、失效刷新、hydration 或乐观更新时，直接放在 query cache。

登录会话、未保存流程和 UI 状态放在客户端 store。把同一份远程数据再复制到 store，会增加额外同步路径。

## 框架边界

envoi 不依赖 Vue、React 或状态库。应用继续使用已有 query library，把同一个
`Promise<T>` API 函数传给它。
