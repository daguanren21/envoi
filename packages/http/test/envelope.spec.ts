import { describe, expect, it } from "vitest";
import { BizError } from "../src/error";
import { defineEnvelope, resolveEnvelope, throwIfNeeded } from "../src/envelope";
import type { HttpResponse } from "../src/types";

function res(status: number, body: unknown, statusText = ""): HttpResponse {
  return { status, statusText, body, headers: {} };
}

describe("resolveEnvelope policies", () => {
  it("peels body.data when code is present and ok", () => {
    const resolved = resolveEnvelope(res(200, { code: 200, msg: "ok", data: { id: 1 } }), {});
    expect(resolved.kind).toBe("ok");
    expect(resolved.value).toEqual({ id: 1 });
    expect(resolved.body).toEqual({ code: 200, msg: "ok", data: { id: 1 } });
  });

  it("uses HTTP-only behavior when no envelope is configured", () => {
    const body = { code: 500, msg: "business failure", data: { id: 1 } };
    const resolved = resolveEnvelope(res(200, body), undefined);
    expect(resolved.kind).toBe("ok");
    expect(resolved.value).toBe(body);
    expect(resolved.source).toBe("http");
  });

  it("does not peel .data when the body has no code key", () => {
    const body = { id: 1, data: "must-not-peel" };
    const resolved = resolveEnvelope(res(200, body), undefined);
    expect(resolved.kind).toBe("ok");
    expect(resolved.value).toEqual(body);
    expect(resolved.source).toBe("http");
  });

  it("maps HTTP 404 to BizError source http", () => {
    const resolved = resolveEnvelope(res(404, { path: "/x" }, "Not Found"), undefined);
    expect(resolved.kind).toBe("error");
    expect(resolved.source).toBe("http");
    expect(resolved.code).toBe(404);
    expect(() => throwIfNeeded(resolved)).toThrow(BizError);
  });

  it("never lets a successful business code override HTTP 500", () => {
    const resolved = resolveEnvelope(
      res(500, { code: 200, msg: "not really ok", data: { id: 1 } }, "Internal Server Error"),
      undefined,
    );
    expect(resolved.kind).toBe("error");
    expect(resolved.source).toBe("http");
    expect(resolved.code).toBe(500);
  });

  it("maps envelope code 500 to BizError source body", () => {
    const resolved = resolveEnvelope(res(200, { code: 500, msg: "boom", data: null }), {});
    expect(resolved.kind).toBe("error");
    expect(resolved.source).toBe("body");
    expect(resolved.code).toBe(500);
    try {
      throwIfNeeded(resolved);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BizError);
      expect((e as BizError).msg).toBe("boom");
    }
  });

  it("envelope: false never reads code", () => {
    const resolved = resolveEnvelope(res(200, { code: 500, data: { id: 1 } }), false);
    expect(resolved.kind).toBe("ok");
    expect(resolved.value).toEqual({ code: 500, data: { id: 1 } });
  });

  it("preserves a custom envelope error and skips value on failure", () => {
    class DomainError extends Error {}
    let valueCalls = 0;
    const envelope = defineEnvelope<{ ok: boolean }, boolean>({
      read: (response) => response.body as { ok: boolean },
      kind: (body) => (body.ok ? "ok" : "error"),
      value: (body) => {
        valueCalls += 1;
        return body.ok;
      },
      error: () => new DomainError("domain failed"),
    });

    const resolved = resolveEnvelope(res(200, { ok: false }), envelope);
    expect(valueCalls).toBe(0);
    expect(() => throwIfNeeded(resolved)).toThrow(DomainError);
  });
});
