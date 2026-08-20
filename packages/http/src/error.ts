/**
 * Where a {@link BizError} was produced.
 *
 * - `'http'` — transport status was 4xx/5xx (REST backends with no `code` field).
 * - `'body'` — HTTP was 2xx but the business envelope was not ok.
 */
export type ErrorSource = "http" | "body";

/**
 * Coarse outcome used by hooks. Numeric codes stay in the app preset.
 */
export type ResultKind = "ok" | "unauthorized" | "error" | "warning";

/**
 * Thrown on the failure path. Query libraries must see a throw, never a
 * half-failed `{ code, msg }` object.
 *
 * @example
 * ```ts
 * try {
 *   await http.get<User>('/users/1')
 * } catch (e) {
 *   if (e instanceof BizError) {
 *     e.code    // 401 | 'UNAUTHORIZED' | …
 *     e.source  // 'http' | 'body'
 *     e.body    // original parsed payload
 *   }
 * }
 * ```
 */
export class BizError<TBody = unknown> extends Error {
  readonly name = "BizError";

  constructor(
    /** Business or HTTP status code. */
    readonly code: number | string,
    /** Human-readable message from the envelope or status text. */
    readonly msg: string,
    /** Raw parsed body (or HTTP error payload). */
    readonly body: TBody,
    readonly source: ErrorSource,
    readonly kind: Exclude<ResultKind, "ok"> = "error",
  ) {
    super(msg);
  }
}
