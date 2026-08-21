import type { Hook } from "./hooks";
import type { HookContext, HttpHooks } from "./types";

function asArray<C>(value: Hook<C> | Hook<C>[] | undefined): Hook<C>[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Define a reusable middleware bundle with complete hook context types.
 * Middleware in envoi is a named group of lifecycle hooks; it has no `next()`.
 */
export function createMiddleware(hooks: HttpHooks): HttpHooks {
  return hooks;
}

/**
 * Merge middleware bundles in declaration order. Earlier bundles run first in
 * every lifecycle phase.
 */
export function mergeMiddleware(...bundles: ReadonlyArray<HttpHooks | undefined>): HttpHooks {
  const onRequest = bundles.flatMap((bundle) => asArray(bundle?.onRequest));
  const onRequestError = bundles.flatMap((bundle) => asArray(bundle?.onRequestError));
  const onResponse = bundles.flatMap((bundle) => asArray(bundle?.onResponse));
  const onResponseError = bundles.flatMap((bundle) => asArray(bundle?.onResponseError));
  const onSuccess = bundles.flatMap((bundle) => asArray(bundle?.onSuccess));
  const onFinally = bundles.flatMap((bundle) => asArray(bundle?.onFinally));
  const merged: HttpHooks = {};

  if (onRequest.length > 0) merged.onRequest = onRequest as Hook<HookContext>[];
  if (onRequestError.length > 0) merged.onRequestError = onRequestError;
  if (onResponse.length > 0) merged.onResponse = onResponse;
  if (onResponseError.length > 0) merged.onResponseError = onResponseError;
  if (onSuccess.length > 0) merged.onSuccess = onSuccess;
  if (onFinally.length > 0) merged.onFinally = onFinally as Hook<HookContext>[];

  return merged;
}
