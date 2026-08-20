import { BizError, type ResultKind } from "./error";
import type { EnvelopeFns, EnvelopeMap, EnvelopeOption, HttpResponse } from "./types";

const DEFAULT_KEYS = { code: "code", msg: "msg", data: "data" } as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFns<TBody, TValue>(
  option: EnvelopeOption<TBody, TValue>,
): option is EnvelopeFns<TBody, TValue> {
  return typeof option === "object" && option !== null && "read" in option;
}

export interface ResolvedEnvelope {
  kind: ResultKind;
  value: unknown;
  body: unknown;
  msg: string;
  code: number | string;
  source: "http" | "body";
  error?: Error;
}

function fromHttp(res: HttpResponse, body: unknown): ResolvedEnvelope {
  const status = res.status;
  const kind: ResultKind =
    status >= 200 && status < 300 ? "ok" : status === 401 ? "unauthorized" : "error";
  return {
    kind,
    value: body,
    body,
    msg: res.statusText || String(status),
    code: status,
    source: "http",
  };
}

function fromMap(res: HttpResponse, map: EnvelopeMap): ResolvedEnvelope {
  const keys = {
    code: map.code ?? DEFAULT_KEYS.code,
    msg: map.msg ?? DEFAULT_KEYS.msg,
    data: map.data ?? DEFAULT_KEYS.data,
  };
  const body = res.body;
  if (res.status < 200 || res.status >= 300) return fromHttp(res, body);
  const ok = map.ok ?? ((code: number | string) => code === 200);
  const unauthorized = map.unauthorized ?? ((code: number | string) => code === 401);
  const warning = map.warning;

  if (!isPlainObject(body) || !(keys.code in body)) {
    return fromHttp(res, body);
  }

  const code = body[keys.code] as number | string;
  const msg = String(body[keys.msg] ?? "");
  const value = keys.data in body ? body[keys.data] : body;

  let kind: ResultKind;
  if (ok(code)) kind = "ok";
  else if (unauthorized(code)) kind = "unauthorized";
  else if (warning?.(code)) kind = "warning";
  else kind = "error";

  return { kind, value, body, msg, code, source: "body" };
}

/**
 * Define a function envelope with complete contextual types.
 *
 * @example
 * ```ts
 * const envelope = defineEnvelope<PartnerBody<User>, User>({ ... })
 * ```
 */
export function defineEnvelope<TBody, TValue>(
  option: EnvelopeFns<TBody, TValue>,
): EnvelopeFns<TBody, TValue> {
  return option;
}

export function resolveEnvelope<TBody = unknown, TValue = unknown>(
  res: HttpResponse,
  option: EnvelopeOption<TBody, TValue> | undefined,
): ResolvedEnvelope {
  if (option === false) return fromHttp(res, res.body);

  if (option && isFns(option)) {
    const body = option.read(res);
    const kind = option.kind(body, res);
    if (kind === "ok") {
      return {
        kind,
        value: option.value(body, res),
        body,
        msg: res.statusText,
        code: res.status,
        source: "http",
      };
    }

    const error = option.error(body, res);
    return {
      kind,
      value: undefined,
      body,
      msg: error instanceof BizError ? error.msg : error.message,
      code: error instanceof BizError ? error.code : res.status,
      source: error instanceof BizError ? error.source : "http",
      error,
    };
  }
  return fromMap(res, option ?? {});
}

export function throwIfNeeded(resolved: ResolvedEnvelope): void {
  if (resolved.kind === "ok") return;
  if (resolved.error) throw resolved.error;
  throw new BizError(
    resolved.code,
    resolved.msg || "request failed",
    resolved.body,
    resolved.source,
    resolved.kind,
  );
}
