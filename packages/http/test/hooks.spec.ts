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
      onSuccess: () => {
        order.push("first success");
      },
      onFinally: () => {
        order.push("first finally");
      },
    });
    const second = createMiddleware({
      onRequest: () => {
        order.push("second request");
      },
      onResponse: () => {
        order.push("second response");
      },
      onSuccess: () => {
        order.push("second success");
      },
      onFinally: () => {
        order.push("second finally");
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
      "first success",
      "second success",
      "first finally",
      "second finally",
    ]);
  });

  it("provides the classified BizError to response middleware", async () => {
    let captured: Error | undefined;
    let finalError: unknown;
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 200,
        statusText: "OK",
        headers: {},
        body: { code: 42_201, msg: "Plan limit reached", data: null },
      })),
      envelope: {},
      hooks: {
        onResponseError: (ctx) => {
          captured = ctx.error;
        },
        onFinally: (ctx) => {
          finalError = ctx.error;
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
    expect(finalError).toBe(captured);
  });

  it("allows response-error hooks to replace the classified error", async () => {
    const replacement = new Error("project business error");
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 200,
        statusText: "OK",
        headers: {},
        body: { code: 42_201, msg: "Plan limit reached", data: null },
      })),
      envelope: {},
      hooks: {
        onResponseError: (ctx) => {
          ctx.error = replacement;
        },
      },
    });

    await expect(http.get("/x")).rejects.toBe(replacement);
  });

  it("keeps the classified error visible when ignoreResponseError resolves", async () => {
    let responseError: Error | undefined;
    let successError: unknown;
    let finalError: unknown;
    const body = { reason: "maintenance" };
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 503,
        statusText: "Service Unavailable",
        headers: {},
        body,
      })),
      hooks: {
        onResponseError: (ctx) => {
          responseError = ctx.error;
        },
        onSuccess: (ctx) => {
          successError = ctx.error;
        },
        onFinally: (ctx) => {
          finalError = ctx.error;
        },
      },
    });

    await expect(http.get("/health", { ignoreResponseError: true })).resolves.toBe(body);
    expect(responseError).toBeInstanceOf(BizError);
    expect(successError).toBe(responseError);
    expect(finalError).toBe(responseError);
  });

  it("runs success and finally hooks in global then request order", async () => {
    const order: string[] = [];
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 200,
        statusText: "OK",
        headers: {},
        body: { id: 1 },
      })),
      hooks: {
        onSuccess: (ctx) => {
          order.push("global success");
          ctx.value = { id: 2 };
        },
        onFinally: () => {
          order.push("global finally");
        },
      },
    });

    const result = await http.get<{ id: number }>("/x", {
      hooks: {
        onSuccess: (ctx) => {
          order.push("local success");
          ctx.value = { id: 3 };
        },
        onFinally: () => {
          order.push("local finally");
        },
      },
    });

    expect(result).toEqual({ id: 3 });
    expect(order).toEqual(["global success", "local success", "global finally", "local finally"]);
  });

  it("allows request-error hooks to replace the transport error before finally", async () => {
    const original = new Error("network failed");
    const replacement = new Error("project transport error");
    let finalError: unknown;
    const http = createHttp({
      adapter: mockAdapter(() => {
        throw original;
      }),
      hooks: {
        onRequestError: (ctx) => {
          ctx.error = replacement;
        },
        onFinally: (ctx) => {
          finalError = ctx.error;
        },
      },
    });

    await expect(http.get("/x")).rejects.toBe(replacement);
    expect(finalError).toBe(replacement);
  });

  it("aggregates request and finally-hook failures without skipping cleanup", async () => {
    const requestError = new Error("request failed");
    const firstFinalError = new Error("first cleanup failed");
    const secondFinalError = new Error("second cleanup failed");
    const http = createHttp({
      adapter: mockAdapter(() => {
        throw requestError;
      }),
      hooks: {
        onFinally: [
          () => {
            throw firstFinalError;
          },
          () => {
            throw secondFinalError;
          },
        ],
      },
    });

    try {
      await http.get("/x");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toEqual([
        requestError,
        firstFinalError,
        secondFinalError,
      ]);
    }
  });
});
