import { create } from "axios";
import { afterEach, describe, expect, test, vi } from "vitest";
import { installPlugins, loading } from "../../src";
import { delay } from "../../src/utils/delay";

afterEach(() => {
  vi.useRealTimers();
});

describe("loading plugin", () => {
  test("does not show loading after a fast request has completed", async () => {
    vi.useFakeTimers();
    const events: boolean[] = [];
    const request = create({
      adapter: async (config) => ({
        config,
        data: "ok",
        headers: {},
        status: 200,
        statusText: "OK",
      }),
    });
    installPlugins(request, [
      loading({
        delay: 30,
        delayClose: 0,
        onTrigger: (show) => events.push(show),
      }),
    ]);

    await request.get("/fast");
    await vi.advanceTimersByTimeAsync(60);

    expect(events).toEqual([]);
  });

  test("uses delayClose after the last tracked request", async () => {
    vi.useFakeTimers();
    const events: boolean[] = [];
    const request = create({
      adapter: async (config) => {
        await delay(10);
        return {
          config,
          data: "ok",
          headers: {},
          status: 200,
          statusText: "OK",
        };
      },
    });
    installPlugins(request, [
      loading({
        delay: 0,
        delayClose: 75,
        onTrigger: (show) => events.push(show),
      }),
    ]);

    const response = request.get("/slow");
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toEqual([true]);
    await vi.advanceTimersByTimeAsync(10);
    await response;
    await vi.advanceTimersByTimeAsync(74);
    expect(events).toEqual([true]);
    await vi.advanceTimersByTimeAsync(1);
    expect(events).toEqual([true, false]);
  });

  test("honors loading: false and preserves transport errors", async () => {
    vi.useFakeTimers();
    const events: boolean[] = [];
    const request = create({
      adapter: async () => {
        throw new Error("transport failed");
      },
    });
    installPlugins(request, [
      loading({
        onTrigger: (show) => events.push(show),
      }),
    ]);

    await expect(request.get("/disabled", { loading: false })).rejects.toThrow("transport failed");
    await vi.runAllTimersAsync();
    expect(events).toEqual([]);
  });
});
