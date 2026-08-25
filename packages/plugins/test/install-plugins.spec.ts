import { beforeAll, describe, expect, test, vi } from "vitest";
import nock from "nock";
import axiosRuntime, {
  all,
  Axios,
  AxiosError,
  create as createAxios,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  AxiosInstanceExtension,
  IHooksShareOptions,
  ILifecycleHookObject,
  IPlugin,
  ISharedCache,
} from "../src/intf";
import { IGNORE_COVERAGE, installPlugins } from "../src/install-plugins";
import { type AbortChainController, SlientError } from "../src/utils/create-abort-chain";

type CompletedHook = (
  options: IHooksShareOptions,
  controller: AbortChainController,
) => void | Promise<void>;

const completedHookMock = () => vi.fn<CompletedHook>();

const passRequest = (config: InternalAxiosRequestConfig) => config;
const passResponse = (response: AxiosResponse) => response;
const passError = (error: unknown) => error;

const expectOriginalConfig = (origin: AxiosRequestConfig): void => {
  expect(origin.url).toBe("/success");
  expect(origin.data).toEqual({ a: 1 });
};

const expectOriginCopy = (config: AxiosRequestConfig, origin: AxiosRequestConfig): void => {
  expect(config).not.toBe(origin);
  expect(config).toEqual(origin);
};

describe("测试 `installPlugins()`", () => {
  const BASE_URL: string = "http://test";

  beforeAll(() => {
    const server = nock(BASE_URL);
    server.get("/case").reply(200).persist();
    server.post("/case").reply(200).persist();
    server.put("/case").reply(200).persist();
    server.head("/case").reply(200).persist();
    server.patch("/case").reply(200).persist();
    server.merge("/case").reply(200).persist();
    server.delete("/case").reply(200).persist();
    server.options("/case").reply(200).persist();
    server.get("/success").reply(200, { result: "success" }).persist();
    server.get("/failure").reply(500).persist();
    axiosRuntime.defaults.baseURL = BASE_URL;
  });

  test("case -  调用 `installPlugins()` 后, 映射的 `AxiosException` 扩展实例应继承原有实例的配置", () => {
    const request = createAxios({
      baseURL: "http://haha",
      method: "post",
    });
    request.interceptors.request.use(passRequest, passError);
    request.interceptors.response.use(passResponse, passError);
    const oldInterceptors = { ...request.interceptors };
    installPlugins(request, []);
    expect(request.defaults.baseURL).toBe("http://haha");
    expect(request.defaults.method).toBe("post");
    expect(oldInterceptors).toEqual(request.interceptors);
  });

  test("case -  调用 `installPlugins()` 后, Axios 实例除了禁止覆盖属性外, 其他属性应映射到扩展类", () => {
    const request = createAxios({});
    installPlugins(request, []);
    const refer = new Axios({});
    for (const key of Object.getOwnPropertyNames(refer)) {
      // 检查映射的属性是否存在
      expect(Reflect.get(request, key)).not.toBeUndefined();
      // ? 如果忽略映射的属性, 应保持原样
      if (IGNORE_COVERAGE.includes(key)) {
        expect(Object.getOwnPropertyDescriptor(request, key)?.writable).toBeTruthy();
      } else {
        // 否则, 检查属性是否是映射过的属性
        expect(Object.getOwnPropertyDescriptor(request, key)?.writable).toBeUndefined();
        expect(Object.getOwnPropertyDescriptor(request, key)?.get).toBeTruthy();
      }
    }
  });

  test("case - `installPlugins()` 调用后, axios 扩展属性类型应当是正确的", async () => {
    const request = createAxios({});
    installPlugins(request, []);
    // installPlugins establishes the extension fields before this domain cast.
    const extension = request as AxiosInstanceExtension;
    expect(extension.__plugins__).toEqual([]);
    expect(extension.__shared__).toEqual({});
    // 校验 getter/setter 方法是否齐全
    const __plugins__ = Object.getOwnPropertyDescriptor(request, "__plugins__");
    const __shared__ = Object.getOwnPropertyDescriptor(request, "__shared__");
    expect(__plugins__?.get).toBeTruthy();
    expect(__plugins__?.set).toBeTruthy();
    expect(__shared__?.get).toBeTruthy();
    expect(__shared__?.set).toBeTruthy();
  });

  test("case - `installPlugins()` 可以声明式注册多个插件", () => {
    const request = createAxios({});
    const plug1: IPlugin = { name: "plug1" };
    const plug2: IPlugin = { name: "plug2" };
    installPlugins(request, [plug1, plug2]);
    const extension = request as AxiosInstanceExtension;
    expect(extension.__plugins__).toEqual([plug1, plug2]);
  });

  test("case - 当插件注册后, `beforeRegister()` 将被触发一次", () => {
    const request = createAxios({});
    const plug: IPlugin = {
      name: "plug",
      beforeRegister: vi.fn<NonNullable<IPlugin["beforeRegister"]>>(),
    };
    installPlugins(request, [plug]);
    expect(plug.beforeRegister).toHaveBeenCalled();
  });
  test("case - 如果插件指定了不允许重复注册, 那么当重复注册时抛出异常", () => {
    const request = createAxios({});
    const plug: IPlugin = {
      name: "plug",
      beforeRegister(axios) {
        if (axios.__plugins__.includes(plug)) {
          throw new Error("插件被重复注册了");
        }
      },
    };
    expect(() => installPlugins(request, [plug, plug])).toThrowError("插件被重复注册了");
  });

  test("case - `enforce` 分组排序时保留组内声明顺序", () => {
    const request = createAxios({});
    const normal1: IPlugin = { name: "normal1" };
    const pre1: IPlugin = { name: "pre1", enforce: "pre" };
    const post1: IPlugin = { name: "post1", enforce: "post" };
    const pre2: IPlugin = { name: "pre2", enforce: "pre" };
    const normal2: IPlugin = { name: "normal2" };
    const post2: IPlugin = { name: "post2", enforce: "post" };

    installPlugins(request, [normal1, pre1, post1, pre2, normal2, post2]);

    const extension = request as AxiosInstanceExtension;
    expect(extension.__plugins__).toEqual([pre1, pre2, normal1, normal2, post1, post2]);
  });

  test("valid - 验证发起一次请求, 插件是否被触发(任意lifecycle钩子被调用)", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        completed: completedHookMock(),
      },
    };
    const request = createAxios({});
    installPlugins(request, [plug]);
    expect(plug.lifecycle).toHaveProperty("completed");
    await request.request({ url: "/case" });
    expect(plug.lifecycle?.completed).toHaveBeenCalled();
  });

  test("valid - 验证发起多次请求, 插件触发次数是否正确", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        completed: completedHookMock(),
      },
    };
    const request = createAxios({});
    installPlugins(request, [plug]);
    await request.request({ url: "/case" });
    await request.request({ url: "/case" });
    expect(plug.lifecycle?.completed).toBeCalledTimes(2);
  });

  test("valid - 验证请求失败情况下, 插件是否被正确触发", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        completed: completedHookMock(),
      },
    };
    const request = createAxios({});
    installPlugins(request, [plug]);
    let capture: boolean = false;
    try {
      await request.request({ url: "/failure" });
    } catch {
      capture = true;
    } finally {
      expect(capture).toBeTruthy();
      expect(plug.lifecycle?.completed).toBeCalledTimes(1);
    }
  });

  test("valid - 验证多种方式发起请求, 插件是否被正确触发", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        completed: completedHookMock(),
      },
    };
    const request = createAxios({});
    installPlugins(request, [plug]);
    await request.request({ url: "/case" });
    await request.get("/case");
    await request.delete("/case");
    await request.head("/case");
    await request.options("/case");
    await request.post("/case");
    await request.put("/case");
    await request.patch("/case");
    await request.postForm("/case");
    await request.putForm("/case");
    await request.patchForm("/case");
    expect(plug.lifecycle?.completed).toBeCalledTimes(11);
  });

  test("valid - 验证请求过程中, 插件的钩子是否被正确触发", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        preRequestTransform: vi.fn((config: AxiosRequestConfig) => config),
        postResponseTransform: vi.fn((response: AxiosResponse) => response),
        completed: completedHookMock(),
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    await request.get("/success");
    expect(plug.lifecycle?.preRequestTransform).toBeCalledTimes(1);
    expect(plug.lifecycle?.postResponseTransform).toBeCalledTimes(1);
    expect(plug.lifecycle?.completed).toBeCalledTimes(1);
  });

  test("valid - 当钩子函数为 ILifecycleHookObject<D> 类型时, 可以被正常触发", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        preRequestTransform: {
          runWhen: vi.fn(() => false),
          handler: vi.fn((config) => config),
        },
        postResponseTransform: {
          runWhen: vi.fn(() => true),
          handler: vi.fn((config) => config),
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    // 捕获请求异常
    await request.get("/success");
    // runWhen() return False
    expect(
      (plug.lifecycle!.preRequestTransform as ILifecycleHookObject<AxiosRequestConfig>).runWhen,
    ).toBeCalled();
    expect(
      (plug.lifecycle!.preRequestTransform as ILifecycleHookObject<AxiosRequestConfig>).handler,
    ).not.toBeCalled();
    // runWhen() return True
    expect(
      (plug.lifecycle!.postResponseTransform as ILifecycleHookObject<AxiosResponse>).runWhen,
    ).toBeCalled();
    expect(
      (plug.lifecycle!.postResponseTransform as ILifecycleHookObject<AxiosResponse>).handler,
    ).toBeCalled();
  });

  test("valid - 验证请求过程中, 插件的钩子触发顺序是否正确", async () => {
    let step: number = 0;
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        preRequestTransform: (config) => {
          step++;
          expect(step).toBe(1);
          return config;
        },
        postResponseTransform: (response) => {
          step++;
          expect(step).toBe(2);
          return response;
        },
        completed: () => {
          step++;
          expect(step).toBe(3);
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    await request.get("/success");
  });

  test("valid - 验证请求过程中, 插件的钩子获取到的参数是否正确", async () => {
    let ss: Array<unknown> = [];
    /** 验证共享内存指针唯一性 */
    const checkShared = (shared: ISharedCache): void => {
      for (const s of ss) expect(s).toBe(shared);
      ss.push(shared);
    };
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        preRequestTransform: (config, { shared, origin }) => {
          expectOriginalConfig(config);
          expectOriginalConfig(origin);
          expectOriginCopy(config, origin);
          checkShared(shared);
          return config;
        },
        postResponseTransform: (response, { shared, origin }) => {
          expectOriginalConfig(origin);
          checkShared(shared);
          expect(response.config.url).toBe("/success");
          return response;
        },
        completed: ({ shared, origin }) => {
          expectOriginalConfig(origin);
          checkShared(shared);
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    await request.get("/success", { data: { a: 1 } });
  });

  test("valid - 验证请求失败情况下, `captureException` 钩子函数是否被正确触发", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        captureException: vi.fn((e) => {
          throw e;
        }),
        completed: completedHookMock(),
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    // 捕获请求异常
    await expect(request.get("/failure")).rejects.toThrow(AxiosError);
    expect(plug.lifecycle?.captureException).toBeCalledTimes(1);
    expect(plug.lifecycle?.completed).toBeCalledTimes(1);
  });
  test("valid - 验证请求失败情况下, `captureException` 钩子异常处理行为是否符合预期", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        captureException: (e, { origin }) => {
          const { n } = origin.params;
          switch (n) {
            case 1:
              return e;
            case 2:
              throw e;
            case 3:
              break;
          }
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    // 捕获请求异常
    await expect(request.get("/failure", { params: { n: 1 } })).resolves.toBeInstanceOf(AxiosError);
    await expect(request.get("/failure", { params: { n: 2 } })).rejects.toThrow(AxiosError);
    await expect(request.get("/failure", { params: { n: 3 } })).resolves.toBeUndefined();
  });

  test("valid - 验证插件执行过程出错, `captureException` 钩子能否正确捕获异常", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        captureException: (e, { origin }) => {
          const { n } = origin.params;
          switch (n) {
            case 1:
              return e;
            case 2:
              throw e;
            case 3:
              break;
          }
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    // 捕获请求异常
    await expect(request.get("/failure", { params: { n: 1 } })).resolves.toBeInstanceOf(AxiosError);
    await expect(request.get("/failure", { params: { n: 2 } })).rejects.toThrow(AxiosError);
    await expect(request.get("/failure", { params: { n: 3 } })).resolves.toBeUndefined();
  });

  test("valid - 验证多插件重复触发 `captureException`, 钩子能否正确捕获异常", async () => {
    let captures = 0;
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        captureException: () => ++captures,
      },
    };
    const plug2: IPlugin = {
      name: "plug2",
      lifecycle: {
        captureException: (error, { origin }) => {
          const mode = origin.params.n;
          switch (mode) {
            case 1:
              return error;
            case 2:
              throw error;
            case 3:
              break;
          }
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug, plug2]);

    await expect(request.get("/failure", { params: { n: 1 } })).resolves.toBe(1);
    await expect(request.get("/failure", { params: { n: 2 } })).rejects.toThrow(AxiosError);
    await expect(request.get("/failure", { params: { n: 3 } })).resolves.toBe(2);
  });

  test("valid - 验证 transformRequest 阶段的 `abort`, `abortError`, `slient` 的阻塞是否符合预期", async () => {
    let n: number = 0;
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        transformRequest(config, _, { abort, abortError, slient }) {
          n++;
          if (n === 1) abort("abort");
          if (n === 2) abortError("abort error");
          if (n === 3) {
            try {
              slient();
            } catch (error) {
              expect(error).toBeInstanceOf(SlientError);
            }
          }
          return config;
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);

    await expect(request.get("/success")).resolves.toBe("abort");
    await expect(request.get("/success")).rejects.toBe("abort error");
    void request.get("/success");
  });

  test("other - 重复调用 `installPlugins()` 仅触发一次能力注入", () => {
    const request = createAxios({});
    const plug: IPlugin = { name: "plug" };
    installPlugins(request, [plug]);
    const extension = request as AxiosInstanceExtension;
    expect(extension.__plugins__).toEqual([plug]);
    installPlugins(request, []);
    expect(extension.__plugins__).toEqual([plug]);
  });

  test("other - `installPlugins()` 的扩展属性不会被 `axios.create()` 继承", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        completed: completedHookMock(),
      },
    };
    installPlugins(axiosRuntime, [plug]);
    const request = createAxios({});
    // 1. 扩展属性不应存在
    expect("__plugins__" in request).toBe(false);
    expect("__shared__" in request).toBe(false);
    // 2. 类成员变量应保持原样, 而不是扩展的 getter/setter (用 request 方法实验)
    expect(Object.getOwnPropertyDescriptor(request, "request")?.writable).toBeTruthy();
    await request.get("/case");
    // 3. 检查插件生命周期时间有没有被触发
    expect(plug.lifecycle?.completed).not.toHaveBeenCalled();
  });

  test("other - `installPlugins()` 的扩展属性不影响新的 Axios 类实例", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        completed: completedHookMock(),
      },
    };
    installPlugins(axiosRuntime, [plug]);
    const request = new Axios({ baseURL: BASE_URL });
    // 1. 扩展属性不应存在
    expect("__plugins__" in request).toBe(false);
    expect("__shared__" in request).toBe(false);
    await request.get("/case");
    // 2. 检查插件生命周期时间有没有被触发
    // 新实例不会继承默认 axios 上安装的插件。
    // 这里通过插件的钩子是否被处罚, 来验证是否存在影响
    expect(plug.lifecycle?.completed).not.toHaveBeenCalled();
  });
});

describe("测试 `IPlugin` 钩子组合特性", () => {
  const BASE_URL: string = "http://test";
  beforeAll(() => {
    const server = nock(BASE_URL);
    server.post("/case1").delay(200).reply(200, { result: "success" }).persist();
    server.post("/case2").query({ a: 123 }).reply(200, { result: "success" }).persist();
    server.post("/case3").reply(200, { result: "failure", message: "请求出错" }).persist();
    axiosRuntime.defaults.baseURL = BASE_URL;
  });
  test("case - 组合锁机制", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        preRequestTransform(config, { origin, shared }) {
          if (!shared["plug"]) {
            shared.plug = {};
          }
          const key: string = origin.url as string;
          if (shared.plug[key]) {
            throw new Error("lock");
          }
          shared.plug[key] = true;
          return config;
        },
        completed({ origin, shared }) {
          const key: string = origin.url as string;
          delete shared.plug[key];
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);

    const firstRequest = request.post("/case1");
    await expect(request.post("/case1")).rejects.toThrowError("lock");
    await firstRequest;
    await expect(request.post("/case1")).resolves.toHaveProperty("status", 200);
  });

  test("case - 累加、累减", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        preRequestTransform(config, { shared }) {
          if (!shared["plug"]) {
            shared.plug = 0;
          }
          shared.plug++;
          return config;
        },
        completed({ shared }) {
          shared.plug--;
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    const extension = request as AxiosInstanceExtension;
    await all([
      //
      request.post("/case1"),
      request.post("/case1"),
      request.post("/case1"),
    ]);
    expect(extension.__shared__.plug).toBe(0);
  });

  test("case - 修改请求参数", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        preRequestTransform(config) {
          // 修改请求参数使请求成功
          config.params = { a: 123 } as any;
          return config;
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    const res = await request.post("/case2");
    expect(res).toHaveProperty("data", { result: "success" });
  });
  test("case - 修改响应结果", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        postResponseTransform(res) {
          return {
            ...res,
            data: {
              replaced: true,
            },
          };
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    const res = await request.post("/case1");
    expect(res.data).toEqual({ replaced: true });
  });
  test("case - 根据响应内容判断响应结果", async () => {
    const plug: IPlugin = {
      name: "plug",
      lifecycle: {
        postResponseTransform(res) {
          if (res.data.result === "failure") {
            throw new Error("请求出错");
          }
          return res;
        },
      },
    };
    const request = createAxios({ baseURL: BASE_URL });
    installPlugins(request, [plug]);
    await expect(request.post("/case3")).rejects.toThrow(new Error("请求出错"));
  });
});
