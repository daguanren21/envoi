import { CanceledError, create } from "axios";
import { describe, expect, test, vi } from "vitest";
import { cancel, cancelAll, installPlugins } from "../../src";

describe("cancel plugin", () => {
  test("cancelAll ignores requests that already completed", async () => {
    const request = create({
      adapter: async (config) => ({
        config,
        data: "ok",
        headers: {},
        status: 200,
        statusText: "OK",
      }),
    });
    installPlugins(request, [cancel()]);

    await request.get("/completed");

    expect(() => cancelAll(request)).not.toThrow();
  });

  test("cancelAll aborts every active request", async () => {
    const adapter = vi.fn(
      (config) =>
        new Promise((_resolve, reject) => {
          config.signal?.addEventListener(
            "abort",
            () => reject(new CanceledError(String(config.signal?.reason), config)),
            { once: true },
          );
        }),
    );
    const request = create({ adapter });
    installPlugins(request, [cancel()]);

    const pending = request.get("/pending");
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledOnce());
    cancelAll(request, "stopped");

    await expect(pending).rejects.toBeInstanceOf(CanceledError);
  });

  test("cancelAll is a no-op when the plugin is not installed", () => {
    expect(() => cancelAll(create())).not.toThrow();
  });
});
