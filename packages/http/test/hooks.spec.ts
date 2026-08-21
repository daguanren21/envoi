import { describe, expect, it } from "vitest";
import { createHttp } from "../src/create-http";
import { BizError } from "../src/error";
import { auth } from "../src/middleware";
import { createMiddleware, mergeMiddleware } from "../src/middleware-utils";

function mockAdapter(handler: (req: HttpRequest) => HttpResponse): Adapter {
  return { name: "mock", request: handler };
}

describe("auth hook", () => {
  it("sets Bearer token when Authorization is missing", async () => {
    let authorization = "";
    const http = createHttp({
      adapter: mockAdapter((req) => {
        authorization = req.headers.Authorization ?? "";
        return { status: 200, statusText: "OK", headers: {}, body: { code: 200, data: true } };
      }),
      hooks: {
        onRequest: auth(() => "tok"),
      },
    });
    await http.get("/x");
    expect(authorization).toBe("Bearer tok");
  });

  it("merges reusable middleware bundles in declaration order", async () => {
    const order: string[] = [];
    const first = createMiddleware({
      onRequest: () => {
        order.push("first request");
      },
      onResponse: () => {
        order.push("first response");
      },
    });
    const second = createMiddleware({
      onRequest: () => {
        order.push("second request");
      },
      onResponse: () => {
        order.push("second response");
      },
    });
    const http = createHttp({
      adapter: mockAdapter(() => {
        order.push("adapter");
        return { status: 200, statusText: "OK", headers: {}, body: { code: 200, data: true } };
      }),
      hooks: mergeMiddleware(first, second),
    });

    await http.get("/x");
    expect(order).toEqual([
      "first request",
      "second request",
      "adapter",
      "first response",
      "second response",
    ]);
  });

  it("provides the classified BizError to response middleware", async () => {
    let captured: Error | undefined;
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 200,
        statusText: "OK",
        headers: {},
        body: { code: 42_201, msg: "Plan limit reached", data: null },
      })),
      hooks: {
        onResponseError: (ctx) => {
          captured = ctx.error;
        },
      },
    });

    await expect(http.get("/x")).rejects.toBeInstanceOf(BizError);
    expect(captured).toBeInstanceOf(BizError);
    expect(captured).toMatchObject({
      code: 42_201,
      kind: "error",
      source: "body",
    });
  });
});
