import { create } from "axios";
import { describe, expect, test, vi } from "vitest";
import { cache, installPlugins } from "../../src";

describe("cache plugin", () => {
  test("returns the cached AxiosResponse instead of the internal cache record", async () => {
    const values = new Map<string, string>();
    const storage = {
      get length() {
        return values.size;
      },
      clear() {
        values.clear();
      },
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      key(index: number) {
        return Array.from(values.keys())[index] ?? null;
      },
      removeItem(key: string) {
        values.delete(key);
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    } satisfies Storage;
    const adapter = vi.fn(async (config) => ({
      config,
      data: "fresh",
      headers: {},
      status: 200,
      statusText: "OK",
    }));
    const request = create({ adapter });
    installPlugins(request, [
      cache({
        expires: Date.now() + 10_000,
        key: () => "orders",
        storage,
      }),
    ]);

    const first = await request.get("/orders", { cache: true });
    const second = await request.get("/orders", { cache: true });

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(first.data).toBe("fresh");
    expect(second.data).toBe("fresh");
    expect(second).toMatchObject({ status: 200, statusText: "OK" });
    expect(second).not.toHaveProperty("expires");
    expect(second).not.toHaveProperty("res");
  });
});
