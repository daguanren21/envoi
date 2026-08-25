import { create } from "axios";
import { describe, expect, test, vi } from "vitest";
import { installPlugins, retry } from "../../src";

describe("retry plugin", () => {
  test("gives each sequential request its own retry budget", async () => {
    let calls = 0;
    const adapter = vi.fn(async (config) => {
      calls++;
      if (calls % 2 === 1) throw new Error("transient");
      return {
        config,
        data: calls,
        headers: {},
        status: 200,
        statusText: "OK",
      };
    });
    const request = create({ adapter });
    installPlugins(request, [retry({ max: 1 })]);

    await expect(request.get("/same")).resolves.toMatchObject({ data: 2 });
    await expect(request.get("/same")).resolves.toMatchObject({ data: 4 });
    expect(adapter).toHaveBeenCalledTimes(4);
  });

  test("isolates concurrent requests with the same URL", async () => {
    const callsByRequest = new Map<string, number>();
    const adapter = vi.fn(async (config) => {
      const requestId = String(config.headers.get("x-request-id"));
      const calls = (callsByRequest.get(requestId) ?? 0) + 1;
      callsByRequest.set(requestId, calls);
      if (calls === 1) throw new Error(`transient:${requestId}`);
      return {
        config,
        data: requestId,
        headers: {},
        status: 200,
        statusText: "OK",
      };
    });
    const request = create({ adapter });
    installPlugins(request, [retry({ max: 1 })]);

    const responses = await Promise.all([
      request.get("/same", { headers: { "x-request-id": "a" } }),
      request.get("/same", { headers: { "x-request-id": "b" } }),
    ]);

    expect(responses.map((response) => response.data)).toEqual(["a", "b"]);
    expect(callsByRequest).toEqual(
      new Map([
        ["a", 2],
        ["b", 2],
      ]),
    );
  });

  test("retry: 0 disables a global retry rule", async () => {
    const adapter = vi.fn(async () => {
      throw new Error("permanent");
    });
    const request = create({ adapter });
    installPlugins(request, [retry({ max: 3 })]);

    await expect(request.get("/disabled", { retry: 0 })).rejects.toThrow("permanent");
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
