import { describe, expect, it } from "vitest";
import { createHttpFactory } from "../src/http-factory";
import type { Adapter, HttpRequest } from "../src/types";

function adapter(
  name: string,
  handler: (request: HttpRequest) => unknown = () => ({ code: 200, data: true }),
): Adapter {
  return {
    name,
    async request(request) {
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: handler(request),
      };
    },
  };
}

describe("createHttpFactory", () => {
  it("requires the project policy to select an adapter", () => {
    expect(() => createHttpFactory({} as never)).toThrow(
      "[envoi] createHttpFactory requires an explicit adapter",
    );
  });

  it("merges defaults and appends project hooks before client hooks", async () => {
    const order: string[] = [];
    let request: HttpRequest | undefined;
    const createProjectHttp = createHttpFactory({
      adapter: adapter("base", (value) => {
        request = value;
        order.push("adapter");
        return { code: 200, data: { id: 1 } };
      }),
      defaults: {
        baseURL: "https://api.example.com/v1",
        timeout: 10_000,
        headers: { "x-base": "base", "x-shared": "base" },
      },
      envelope: {},
      hooks: {
        onRequest: () => {
          order.push("base request");
        },
        onSuccess: () => {
          order.push("base success");
        },
        onFinally: () => {
          order.push("base finally");
        },
      },
    });
    const http = createProjectHttp({
      defaults: {
        baseURL: "https://api.example.com/v2",
        headers: { "x-client": "client", "x-shared": "client" },
      },
      hooks: {
        onRequest: () => {
          order.push("client request");
        },
        onSuccess: () => {
          order.push("client success");
        },
        onFinally: () => {
          order.push("client finally");
        },
      },
    });

    await expect(http.get("/users")).resolves.toEqual({ id: 1 });
    expect(request).toMatchObject({
      url: "https://api.example.com/v2/users",
      timeout: 10_000,
      headers: {
        "x-base": "base",
        "x-client": "client",
        "x-shared": "client",
      },
    });
    expect(order).toEqual([
      "base request",
      "client request",
      "adapter",
      "base success",
      "client success",
      "base finally",
      "client finally",
    ]);
  });

  it("allows a specialized client to replace adapter and response policy", async () => {
    const packet = { code: 200, data: { id: 1 } };
    const createProjectHttp = createHttpFactory({
      adapter: adapter("base"),
      envelope: {},
    });
    const http = createProjectHttp({
      adapter: adapter("special", () => packet),
      envelope: false,
    });

    expect(http.adapter.name).toBe("special");
    await expect(http.get("/users")).resolves.toBe(packet);
  });
});
