import { beforeEach, describe, expect, test } from "vitest";
import nock from "nock";
import { create as createAxios } from "axios";
import type { AxiosInstanceExtension } from "../../src/intf";
import { installPlugins } from "../../src/install-plugins";
import { merge } from "../../src";
import { delay } from "../../src/utils/delay";

describe("测试 `merge()` 插件", () => {
  const BASE_URL: string = "http://test";
  let request!: AxiosInstanceExtension;
  beforeEach(() => {
    const server = nock(BASE_URL);
    let a: number = 0;
    let b: number = 0;
    let c: number = 0;
    server.post("/case").delay(200).reply(200, { result: "success" }).persist();
    server
      .post("/case2")
      .reply(200, () => (a++, { a }))
      .persist();
    server
      .post("/case3")
      .reply(200, () => (b++, { b }))
      .persist();
    server
      .post("/case4")
      .reply(200, () => (c++, { c }))
      .persist();
    const instance = createAxios({ baseURL: BASE_URL });
    installPlugins(instance, [merge({ includes: true, delay: 200 })]);
    // installPlugins establishes the extension fields on the same instance.
    request = instance as AxiosInstanceExtension;
  });

  test("case - 正常请求", async () => {
    const res = await request.post("/case");
    expect(res.data.result).toBe("success");
    expect(Object.keys(request["__shared__"].merge).length).toBe(1);
    await delay(300);
    expect(Object.keys(request["__shared__"].merge).length).toBe(0);
  });

  test("case - 顺序请求(合并)", async () => {
    const res = await request.post("/case2");
    expect(res.data.a).toBe(1);
    const res2 = await request.post("/case2");
    expect(res2.data.a).toBe(1);
  });

  test("case - 顺序请求(不合并)", async () => {
    const res = await request.post("/case3");
    expect(res.data.b).toBe(1);
    await delay(300);
    const res2 = await request.post("/case3");
    expect(res2.data.b).toBe(2);
  });

  test("case - 并发请求合并", async () => {
    const [res1, res2] = await Promise.all([request.post("/case4"), request.post("/case4")]);
    expect(res1.data.c).toBe(1);
    expect(res2.data.c).toBe(1);
  });
});
