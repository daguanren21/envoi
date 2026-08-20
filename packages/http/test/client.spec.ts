import { describe, expect, it } from "vitest";
import { createHttp } from "../src/create-http";
import type { Adapter, HttpRequest, HttpResponse } from "../src/types";

function mockAdapter(handler: (req: HttpRequest) => HttpResponse | Promise<HttpResponse>): Adapter {
  return {
    name: "mock",
    request: handler,
  };
}

describe("createHttp adapters", () => {
  it("defaults adapter to axios", () => {
    const http = createHttp();
    expect(http.adapter.name).toBe("axios");
  });

  it("accepts a custom adapter object", async () => {
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 200,
        statusText: "OK",
        headers: {},
        body: { code: 200, data: { id: 1 } },
      })),
    });
    await expect(http.get("/x")).resolves.toEqual({ id: 1 });
    expect(http.adapter.name).toBe("mock");
  });

  it("normalizes baseURL and query before a custom adapter", async () => {
    let seenURL = "";
    const http = createHttp({
      defaults: { baseURL: "https://api.example.com/v1" },
      adapter: mockAdapter((req) => {
        seenURL = req.url;
        return { status: 200, statusText: "OK", headers: {}, body: { ok: true } };
      }),
      envelope: false,
    });

    await http.get("/users", { query: { role: "admin" } });
    expect(seenURL).toBe("https://api.example.com/v1/users?role=admin");
  });

  it("onRequest can rewrite url and headers", async () => {
    const seen: string[] = [];
    const http = createHttp({
      adapter: mockAdapter((req) => {
        seen.push(req.url, req.headers.Authorization ?? "");
        return { status: 200, statusText: "OK", headers: {}, body: { ok: true } };
      }),
      hooks: {
        onRequest: (ctx) => {
          ctx.request.url = "/rewritten";
          ctx.request.headers.Authorization = "Bearer t";
        },
      },
      envelope: false,
    });
    await expect(http.get("/orig")).resolves.toEqual({ ok: true });
    expect(seen).toEqual(["/rewritten", "Bearer t"]);
  });

  it("runs global hooks before request-local hooks", async () => {
    const order: string[] = [];
    const http = createHttp({
      adapter: mockAdapter(() => {
        order.push("adapter");
        return {
          status: 200,
          statusText: "OK",
          headers: {},
          body: { code: 200, data: true },
        };
      }),
      hooks: {
        onRequest: () => {
          order.push("global request");
        },
        onResponse: () => {
          order.push("global response");
        },
      },
    });

    await http.get("/x", {
      hooks: {
        onRequest: () => {
          order.push("local request");
        },
        onResponse: () => {
          order.push("local response");
        },
      },
    });

    expect(order).toEqual([
      "global request",
      "local request",
      "adapter",
      "global response",
      "local response",
    ]);
  });

  it("onResponse can replace the body", async () => {
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 200,
        statusText: "OK",
        headers: {},
        body: { code: 200, data: 1 },
      })),
      hooks: {
        onResponse: (ctx) => {
          ctx.response.body = { code: 200, data: 2 };
        },
      },
    });
    await expect(http.get("/x")).resolves.toBe(2);
  });

  it("onResponse can replace the complete response object", async () => {
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 200,
        statusText: "OK",
        headers: {},
        body: { code: 200, data: 1 },
      })),
      hooks: {
        onResponse: (ctx) => {
          ctx.response = {
            status: 200,
            statusText: "OK",
            headers: {},
            body: { code: 200, data: 3 },
          };
        },
      },
    });

    await expect(http.get("/x")).resolves.toBe(3);
  });

  it("onResponseError runs on HTTP 404 when envelope is off", async () => {
    const statuses: number[] = [];
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 404,
        statusText: "Not Found",
        headers: {},
        body: { path: "/x" },
      })),
      envelope: false,
      hooks: {
        onResponseError: (ctx) => {
          statuses.push(ctx.response.status);
        },
      },
    });
    await expect(http.get("/x")).rejects.toMatchObject({
      name: "BizError",
      code: 404,
      source: "http",
    });
    expect(statuses).toEqual([404]);
  });

  it("raw still throws and runs onResponseError for HTTP 404", async () => {
    const statuses: number[] = [];
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 404,
        statusText: "Not Found",
        headers: {},
        body: { path: "/x" },
      })),
      hooks: {
        onResponseError: (ctx) => {
          statuses.push(ctx.response.status);
        },
      },
    });

    await expect(http.raw("/x")).rejects.toMatchObject({
      name: "BizError",
      code: 404,
      source: "http",
    });
    expect(statuses).toEqual([404]);
  });

  it("raw can explicitly return a non-ok response", async () => {
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 404,
        statusText: "Not Found",
        headers: {},
        body: { path: "/x" },
      })),
    });

    await expect(http.raw("/x", { ignoreResponseError: true })).resolves.toMatchObject({
      status: 404,
      body: { path: "/x" },
    });
  });

  it("blob responses still reject HTTP failures", async () => {
    const http = createHttp({
      adapter: mockAdapter(() => ({
        status: 500,
        statusText: "Internal Server Error",
        headers: {},
        body: new Blob(["failed"]),
      })),
    });

    await expect(http.get("/download", { responseType: "blob" })).rejects.toMatchObject({
      name: "BizError",
      code: 500,
    });
  });

  it.each([null, false, 0, ""])("preserves explicit body value %j", async (value) => {
    let seen: unknown = Symbol("missing");
    const http = createHttp({
      adapter: mockAdapter((req) => {
        seen = req.body;
        return {
          status: 200,
          statusText: "OK",
          headers: {},
          body: { code: 200, data: true },
        };
      }),
    });

    await http.post("/values", value);
    expect(seen).toBe(value);
  });
});
