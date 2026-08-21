// @vitest-environment node
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create as createAxios } from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { withQuery } from "ufo";
import { axiosAdapter } from "../src/adapters/axios";
import { createHttp } from "../src/create-http";
import type { AdapterName } from "../src/types";

let server: Server;
let baseURL = "";

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString("utf8");

    if (req.url?.startsWith("/api/missing")) {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ path: req.url }));
      return;
    }

    if (req.url?.startsWith("/api/slow")) await delay(100);

    res.setHeader("content-type", "application/json");
    if (req.url?.startsWith("/api/text")) {
      res.end(JSON.stringify({ text: true }));
      return;
    }

    res.end(JSON.stringify({ url: req.url, method: req.method, body }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseURL = `http://127.0.0.1:${address.port}/api`;
});

afterAll(async () => {
  const closed = once(server, "close");
  server.close();
  await closed;
});

const adapters: AdapterName[] = ["axios", "fetch", "ofetch"];

describe.each(adapters)("%s adapter conformance", (adapter) => {
  it("uses the same baseURL and query serialization", async () => {
    const http = createHttp({ adapter, defaults: { baseURL }, envelope: false });
    const query = { tags: ["a", "b"], nested: { x: 1 }, omit: undefined };
    const result = await http.get<{ url: string }>("/echo", { query });
    expect(result.url).toBe(withQuery("/api/echo", query));
  });

  it("honors responseType text", async () => {
    const http = createHttp({ adapter, defaults: { baseURL }, envelope: false });
    const result = await http.get<string>("/text", { responseType: "text" });
    expect(result).toBe('{"text":true}');
  });

  it("sends an object body as JSON", async () => {
    const http = createHttp({ adapter, defaults: { baseURL }, envelope: false });
    const result = await http.post<{ body: string }>("/echo", { id: 1 });
    expect(JSON.parse(result.body)).toEqual({ id: 1 });
  });

  it("returns HTTP failures to the shared error pipeline", async () => {
    const http = createHttp({ adapter, defaults: { baseURL }, envelope: false });
    await expect(http.get("/missing")).rejects.toMatchObject({
      name: "BizError",
      code: 404,
      source: "http",
    });
  });

  it("applies timeout even when an external signal is present", async () => {
    const http = createHttp({ adapter, defaults: { baseURL }, envelope: false });
    const controller = new AbortController();
    await expect(
      http.get("/slow", { timeout: 10, signal: controller.signal }),
    ).rejects.toBeDefined();
  });
});
describe("axios adapter instance integration", () => {
  it("uses an existing instance without bypassing its interceptors", async () => {
    const instance = createAxios();
    let interceptorCalls = 0;
    let mergeEnabled = false;
    instance.interceptors.request.use((config) => {
      interceptorCalls += 1;
      mergeEnabled = (config as typeof config & { merge?: boolean }).merge === true;
      return config;
    });
    const http = createHttp({
      adapter: axiosAdapter(instance),
      defaults: { baseURL },
      envelope: false,
    });

    await http.get("/echo", { meta: { axios: { merge: true } } });
    expect(interceptorCalls).toBe(1);
    expect(mergeEnabled).toBe(true);
  });

  it("uses axios-mock-adapter installed on the same instance", async () => {
    const instance = createAxios();
    const mock = new AxiosMockAdapter(instance, { onNoMatch: "throwException" });
    mock.onGet("/api/users/42").reply(200, {
      code: 200,
      msg: "ok",
      data: { id: 42, name: "Ada" },
    });
    const http = createHttp({
      adapter: axiosAdapter(instance),
      defaults: { baseURL: "/api" },
    });

    try {
      await expect(http.get("/users/42")).resolves.toEqual({ id: 42, name: "Ada" });
      expect(mock.history.get).toHaveLength(1);
    } finally {
      mock.restore();
    }
  });
});
