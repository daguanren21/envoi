import { create } from "axios";
import { describe, expect, test, vi } from "vitest";
import { definePlugin, installPlugins, merge, retry, sentryCapture } from "../../src";
import { delay } from "../../src/utils/delay";

describe("exception observers", () => {
  test("reports through Sentry without resolving the failed request", async () => {
    const captureException = vi.fn();
    const request = create({
      adapter: async () => {
        throw new Error("transport failed");
      },
    });
    installPlugins(request, [sentryCapture({ sentry: { captureException } })]);

    await expect(request.get("/failure")).rejects.toThrow("transport failed");
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException.mock.calls[0][0]).toMatchObject({ message: "transport failed" });
  });

  test("observes only the final failure after retry is exhausted", async () => {
    const captureException = vi.fn();
    const adapter = vi.fn(async () => {
      throw new Error("still failing");
    });
    const request = create({ adapter });
    installPlugins(request, [retry({ max: 1 }), sentryCapture({ sentry: { captureException } })]);

    await expect(request.get("/retry-failure")).rejects.toThrow("still failing");
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(captureException).toHaveBeenCalledOnce();
  });

  test("rejects when every conditional recovery hook declines the error", async () => {
    const handler = vi.fn();
    const request = create({
      adapter: async () => {
        throw new Error("unhandled");
      },
    });
    installPlugins(request, [
      definePlugin({
        name: "conditional-recovery",
        lifecycle: {
          captureException: {
            runWhen: () => false,
            handler,
          },
        },
      }),
    ]);

    await expect(request.get("/unhandled")).rejects.toThrow("unhandled");
    expect(handler).not.toHaveBeenCalled();
  });

  test("rejects both merged callers when the shared request fails", async () => {
    const adapter = vi.fn(async () => {
      await delay(5);
      throw new Error("shared failure");
    });
    const request = create({ adapter });
    installPlugins(request, [merge()]);

    const results = await Promise.allSettled([
      request.get("/merged-failure"),
      request.get("/merged-failure"),
    ]);

    expect(adapter).toHaveBeenCalledOnce();
    expect(results).toEqual([
      expect.objectContaining({ status: "rejected" }),
      expect.objectContaining({ status: "rejected" }),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toMatchObject({ message: "shared failure" });
      }
    }
  });
});
