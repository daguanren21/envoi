import { createHttp } from "./create-http";
import { mergeMiddleware } from "./middleware-utils";
import type {
  CreateHttpOptions,
  HttpClientFactory,
  HttpClientOverrides,
  HttpDefaults,
} from "./types";

function mergeDefaults(
  base: HttpDefaults | undefined,
  overrides: HttpDefaults | undefined,
): HttpDefaults | undefined {
  if (!base && !overrides) return undefined;

  const merged: HttpDefaults = { ...base, ...overrides };
  if (base?.headers || overrides?.headers) {
    merged.headers = {
      ...base?.headers,
      ...overrides?.headers,
    };
  }
  return merged;
}

/**
 * Define a project-level client factory. Overrides replace adapter/envelope,
 * merge defaults and headers, and append hooks in declaration order.
 */
export function createHttpFactory<TBody = unknown, TValue = unknown>(
  base: CreateHttpOptions<TBody, TValue>,
): HttpClientFactory<TBody, TValue> {
  if (!base || base.adapter === undefined)
    throw new Error("[envoi] createHttpFactory requires an explicit adapter");
  return (overrides: HttpClientOverrides<TBody, TValue> = {}) => {
    const options: CreateHttpOptions<TBody, TValue> = {
      adapter: overrides.adapter ?? base.adapter,
    };
    const defaults = mergeDefaults(base.defaults, overrides.defaults);
    if (defaults) options.defaults = defaults;

    const envelope = overrides.envelope ?? base.envelope;
    if (envelope !== undefined) options.envelope = envelope;

    const hooks = mergeMiddleware(base.hooks, overrides.hooks);
    if (Object.keys(hooks).length > 0) options.hooks = hooks;

    return createHttp(options);
  };
}
