# Authorization abilities

An ability instance owns derived authorization state such as roles and permissions. It stays in the consumer application; envoi only fetches the typed profile.

## Fetch and update

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

## Call it from the session lifecycle

Call the refresh after login creates a session and during application startup when a persisted session exists:

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

The auth service owns these calls. Components consume the updated ability state; they do not refresh authorization while rendering.

If Pinia or Vuex also stores the auth profile, one auth action should update both the store and the ability instance.

## Reset on logout

```ts
export function logout(): void {
  ability.reset();
  clearSession();
}
```

A globally observed HTTP 401 can reset the ability because session expiry is cross-cutting behavior.

```ts
const http = createHttp({
  hooks: {
    onResponseError: (ctx) => {
      if (ctx.response.status === 401) ability.reset();
    },
  },
});
```

## Avoid implicit endpoint writes

Do not add a global `onResponse` hook that looks for `/auth/profile` and mutates ability state. The auth service or store action should make the update visible in its own control flow.

## Security boundary

Frontend ability checks control UI and route behavior. The backend must still authorize every request.

## Choosing a library

Ability/CASL-style libraries remain consumer dependencies. Evaluate a package's npm release, maintenance cadence, adoption, license, framework support, and bundle cost before adding it. envoi does not depend on an authorization library.
