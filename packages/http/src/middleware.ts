import type { Hook } from "./hooks";
import type { HookContext } from "./types";

/**
 * Axios 1.x sets `Content-Type: application/json` on a string body that
 * `JSON.parse`s. 0.x kept the POST default (`x-www-form-urlencoded`).
 *
 * **Off by default.** Use as `hooks.onRequest`.
 */
export function legacyStringBody(): Hook<HookContext> {
  return (ctx) => {
    const { request } = ctx;
    const method = request.method.toLowerCase();
    if (!["post", "put", "patch"].includes(method)) return;
    if (typeof request.body !== "string") return;
    const hasCT = Object.keys(request.headers).some((k) => k.toLowerCase() === "content-type");
    if (hasCT) return;
    const looksJson = request.body.startsWith("{") || request.body.startsWith("[");
    request.headers["Content-Type"] = looksJson
      ? "application/json;charset=utf-8"
      : "application/x-www-form-urlencoded;charset=utf-8";
  };
}

/** Set `Authorization: Bearer <token>` when missing. Use as `hooks.onRequest`. */
export function auth(
  getToken: () => string | null | undefined | Promise<string | null | undefined>,
): Hook<HookContext> {
  return async (ctx) => {
    const hasAuth = Object.keys(ctx.request.headers).some(
      (k) => k.toLowerCase() === "authorization",
    );
    if (hasAuth) return;
    const token = await getToken();
    if (token) ctx.request.headers.Authorization = `Bearer ${token}`;
  };
}
