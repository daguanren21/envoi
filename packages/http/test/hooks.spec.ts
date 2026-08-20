import { describe, expect, it } from "vitest";
import { createHttp } from "../src/create-http";
import { auth } from "../src/middleware";
import type { Adapter, HttpRequest, HttpResponse } from "../src/types";

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
});
