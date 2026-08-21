# 权限 Ability

Ability 实例保存 roles、permissions 等授权状态。它属于使用方应用，envoi 只负责拉取带类型的 profile。

## 拉取并更新

```ts
interface AuthProfile {
  roles: string[];
  permissions: string[];
}

function getAuthProfile(): Promise<AuthProfile> {
  return http.get<AuthProfile>("/auth/profile");
}

export async function refreshAuthorization(): Promise<AuthProfile> {
  const profile = await getAuthProfile();
  ability.update(profile);
  return profile;
}
```

## 在 session 生命周期中调用

登录成功写入 session 后调用一次；应用启动时检测到已有 session，再调用一次：

```ts
export async function signIn(credentials: Credentials): Promise<AuthProfile> {
  await createSession(credentials);
  return refreshAuthorization();
}

export async function restoreSession(): Promise<void> {
  if (!hasSession()) return;
  await refreshAuthorization();
}

await restoreSession();
mountApplication();
```

调用点属于 auth service。组件只读取更新后的 ability 状态，不在 render 过程中刷新权限。

Pinia 或 Vuex 同时保存 profile 时，让一个 auth action 更新 store 和 ability，调用路径保持可见。

## 退出时清空

```ts
export function logout(): void {
  ability.reset();
  clearSession();
}
```

全局收到 HTTP 401 时也可以 reset，因为登录过期属于公共行为。

```ts
const http = createHttp({
  adapter: "fetch",
  hooks: {
    onResponseError: (ctx) => {
      if (ctx.response.status === 401) ability.reset();
    },
  },
});
```

## 避免隐式写入

不要在全局 `onResponse` 里判断 `/auth/profile`，再偷偷修改 ability。profile 更新放在 auth service 或 store action 中。

## 安全边界

前端 Ability 控制 UI 和路由展示，后端仍要校验每次请求的权限。

## 选择依赖

Ability/CASL 类库由使用方安装。引入前检查 npm 稳定版本、维护节奏、下载量、license、框架兼容和包体积。envoi 不依赖具体权限库。
