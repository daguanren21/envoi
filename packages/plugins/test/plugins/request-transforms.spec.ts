import { create } from "axios";
import { afterEach, describe, expect, test, vi } from "vitest";
import { installPlugins, normalize, onlySend, pathParams, sign } from "../../src";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request transform plugins", () => {
  test("replaces path placeholders with the captured parameter name", async () => {
    const request = create({
      adapter: async (config) => ({
        config,
        data: config.url,
        headers: {},
        status: 200,
        statusText: "OK",
      }),
    });
    installPlugins(request, [pathParams({ form: "params" })]);

    const response = await request.get("/users/${id}", { params: { id: 42 } });

    expect(response.data).toBe("/users/42");
  });

  test("leaves a path placeholder intact when its value is missing", async () => {
    const request = create({
      adapter: async (config) => ({
        config,
        data: config.url,
        headers: {},
        status: 200,
        statusText: "OK",
      }),
    });
    installPlugins(request, [pathParams({ form: "params" })]);

    const response = await request.get("/users/${id}");

    expect(response.data).toBe("/users/${id}");
  });

  test("normalizes params recursively without mutating data", async () => {
    const request = create({
      adapter: async (config) => ({
        config,
        data: { body: config.data, params: config.params },
        headers: {},
        status: 200,
        statusText: "OK",
      }),
    });
    installPlugins(request, [
      normalize({
        data: false,
        params: { deep: true, noNaN: true, noNull: true },
      }),
    ]);

    const response = await request.post(
      "/normalize",
      { untouched: null },
      {
        params: {
          drop: undefined,
          keep: "value",
          nested: { nan: Number.NaN, nil: null, present: 1 },
        },
      },
    );

    expect(response.data.params).toEqual({
      keep: "value",
      nested: { present: 1 },
    });
    expect(JSON.parse(response.data.body)).toEqual({ untouched: null });
  });

  test("sends the original request data and params through sendBeacon", async () => {
    const sendBeacon = vi.fn((_url: string, form: FormData) => {
      expect(Array.from(form.entries())).toEqual(
        expect.arrayContaining([
          ["event", "open"],
          ["source", "checkout"],
        ]),
      );
      return true;
    });
    vi.stubGlobal("navigator", { sendBeacon });
    const request = create();
    installPlugins(request, [onlySend()]);

    const response = await request.post(
      "/events",
      { event: "open" },
      { params: { source: "checkout" } },
    );

    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  test("signs the sorted, filtered, salted, custom-serialized data", async () => {
    const algorithm = vi.fn(async (serialized: string) => `signed:${serialized}`);
    let serializedData: Record<string, unknown> | undefined;
    const serialize = vi.fn((data: Record<string, unknown>) => {
      serializedData = { ...data };
      return Object.entries(data)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join("&");
    });
    const request = create({
      adapter: async (config) => ({
        config,
        data: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
        headers: {},
        status: 200,
        statusText: "OK",
      }),
    });
    installPlugins(request, [
      sign({
        algorithm,
        salt: { nonce: "n" },
        serialize,
      }),
    ]);

    const response = await request.post("/signed", {
      z: "last",
      empty: " ",
      nil: null,
      a: "first",
    });

    expect(serializedData).toEqual({ a: "first", z: "last", nonce: "n" });
    expect(algorithm).toHaveBeenCalledWith("a=first&z=last&nonce=n");
    expect(response.data).toEqual({
      a: "first",
      z: "last",
      nonce: "n",
      sign: "signed:a=first&z=last&nonce=n",
    });
  });
});
