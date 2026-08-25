import {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosRequestConfig,
  type AxiosInterceptorManager,
  type InternalAxiosRequestConfig,
  Axios,
  type AxiosDefaults,
} from "axios";
import { DEFER_EXCEPTION_OBSERVATION } from "./intf";
import type {
  AxiosInstanceExtension,
  IHooksShareOptions,
  ILifecycleHookObject,
  IPlugin,
  IPluginLifecycle,
  ISharedCache,
} from "./intf";
import type { AxiosPluginInput } from "./plugin";
import { klona } from "klona/json";
import {
  type AbortChainController,
  AbortError,
  SlientError,
  createAbortChain,
} from "./utils/create-abort-chain";

/**
 * Axios 实例扩展
 *
 * @description
 *  由于 axios 实例由 `function wrap()` 包裹, 无法直接修改对象属性。
 *  所有这里想了一个hacker的方法, 通过继承的方式, 扩展 Axios 类, 然后通过 `Object.defineProperties` 映射当前axios实例到插件扩展的实例上,
 *  从而实现扩展 axios 属性的效果
 */
class AxiosExtension extends Axios {
  /** 添加的插件集合 */
  __plugins__: Array<IPlugin> = [];
  /** 插件共享内存空间 */
  __shared__: ISharedCache = {};

  constructor(
    defaults: AxiosDefaults,
    interceptors: {
      request: AxiosInterceptorManager<InternalAxiosRequestConfig>;
      response: AxiosInterceptorManager<AxiosResponse>;
    },
  ) {
    super(defaults as AxiosRequestConfig);
    // 继承原实例的适配器
    this.interceptors = interceptors;
    // 覆盖(扩展) `request` 成员方法
    // Binding preserves the original instance while the domain type keeps Axios's generic request signature.
    const originRequest = this.request.bind(this) as AxiosInstance["request"];

    /** 获取钩子函数 */
    const getHook = <K extends keyof IPluginLifecycle>(
      hookName: K,
    ): Array<ILifecycleHookObject<any>> => {
      return this.__plugins__
        .map((plug) => {
          const hook: IPluginLifecycle[K] | undefined = plug.lifecycle?.[hookName];
          if (typeof hook === "function") {
            return {
              runWhen: () => true,
              handler: hook,
            } as ILifecycleHookObject<any>;
          } else if (hook) {
            return hook as ILifecycleHookObject<any>;
          }
        })
        .filter((hook) => !!hook) as Array<ILifecycleHookObject<any>>;
    };

    /** 是否存在钩子 */
    const hasHook = <K extends keyof IPluginLifecycle>(hookName: K): boolean => {
      return getHook(hookName).length > 0;
    };

    /**
     * 触发钩子函数
     * @description 遵循先进先出原则触发插件钩子
     */
    const runHook = async <K extends keyof IPluginLifecycle, T>(
      hookName: K,
      reverse: boolean,
      arg1: T,
      arg2: unknown,
      arg3: AbortChainController,
    ): Promise<T> => {
      const hooks = getHook(hookName);
      const start = reverse ? hooks.length - 1 : 0;
      const end = reverse ? -1 : hooks.length;
      const step = reverse ? -1 : 1;
      for (let index = start; index !== end; index += step) {
        const hook = hooks[index]!;
        if (!hook.runWhen(arg1, arg2 as IHooksShareOptions)) continue;
        if (arg2 === undefined) {
          const completedHandler = hook.handler as unknown as (
            value: T,
            controller: AbortChainController,
          ) => T | Promise<T>;
          arg1 = await completedHandler(arg1, arg3);
        } else {
          arg1 = await hook.handler(arg1, arg2 as IHooksShareOptions, arg3);
        }
      }
      return arg1;
    };

    // 包装 request
    this.request = async <T = unknown, R = AxiosResponse<T>, D = unknown>(
      requestConfig: AxiosRequestConfig<D>,
    ) => {
      const origin: AxiosRequestConfig<D> = klona(requestConfig);
      const share: IHooksShareOptions = {
        origin,
        shared: this.__shared__,
        axios: this as unknown as AxiosInstance,
      };
      const runCaptureHooks = async (
        reason: unknown,
        controller: AbortChainController,
      ): Promise<{ handled: boolean; value: unknown }> => {
        let value: unknown = reason;
        let handled = false;
        const hooks = getHook("captureException");
        for (let index = hooks.length - 1; index >= 0; index--) {
          const hook = hooks[index]!;
          if (hook.runWhen(value, share)) {
            handled = true;
            value = await hook.handler(value, share, controller);
          }
        }
        return { handled, value };
      };

      const propagateObservedException = async (
        reason: unknown,
        controller: AbortChainController,
      ): Promise<never> => {
        const observedReason: unknown =
          reason instanceof AbortError && !reason.abort.success ? reason.abort.res : reason;
        const observationDeferred = (
          origin as AxiosRequestConfig & {
            [DEFER_EXCEPTION_OBSERVATION]?: boolean;
          }
        )[DEFER_EXCEPTION_OBSERVATION];
        if (!observationDeferred && hasHook("exceptionObserved")) {
          await runHook("exceptionObserved", true, observedReason, share, controller);
        }
        throw reason;
      };
      const result: unknown = await createAbortChain(requestConfig)
        .next((transformedConfig, controller) =>
          runHook("preRequestTransform", false, transformedConfig, share, controller),
        )
        .next((currentConfig) => originRequest<T, R, D>(currentConfig))
        .next((response, controller) =>
          runHook("postResponseTransform", true, response, share, controller),
        )
        .capture(async (reason, controller) => {
          let captureResult: { handled: boolean; value: unknown };
          try {
            captureResult = await runCaptureHooks(reason, controller);
          } catch (capturedReason) {
            return await propagateObservedException(capturedReason, controller);
          }
          if (!captureResult.handled) {
            return await propagateObservedException(reason, controller);
          }
          return captureResult.value;
        })
        .completed(
          (controller) =>
            runHook("completed", true, share, undefined, controller) as unknown as Promise<void>,
        )
        .abort((reason) => runHook("aborted", true, reason, share, undefined as any))
        .done();
      // Axios's public generic controls the recovery result type at this boundary.
      return result as R;
    };

    // > 添加请求拦截器
    this.interceptors.request.use((interceptorConfig) => {
      return runHook("transformRequest", false, interceptorConfig, this.__shared__, {
        abort(res: any) {
          throw new AbortError({ success: true, res });
        },
        abortError(reason: any) {
          throw new AbortError({ success: false, res: reason });
        },
        slient() {
          throw new SlientError();
        },
      });
    });
  }
}

/** 定义忽略映射的类属性 */
export const IGNORE_COVERAGE: ReadonlyArray<string> = ["prototype"];

/** 向 axios 实例注入插件生命周期钩子 */
const injectPluginHooks = (axios: AxiosInstanceExtension): void => {
  // ? 如果实例已安装过插件能力, 不需要重复注入
  if (axios["__plugins__"]) {
    return;
  }
  // @ 实例化扩展类
  const extension: AxiosExtension = new AxiosExtension(axios.defaults, axios.interceptors);
  // > 通过 `defineProperties` 将当前实例的请求映射到扩展类的方法上, 从而实现扩展的效果
  const properties = Object.getOwnPropertyNames(axios)
    .concat(["__shared__", "__plugins__"])
    .filter(
      (prop: string) =>
        extension[prop as unknown as keyof AxiosExtension] && !IGNORE_COVERAGE.includes(prop),
    )
    .reduce((descriptors: PropertyDescriptorMap, prop: string) => {
      descriptors[prop] = {
        get() {
          return extension[prop as unknown as keyof AxiosExtension];
        },
        set(v) {
          extension[prop as unknown as keyof AxiosExtension] = v;
        },
      };
      return descriptors;
    }, {});
  // 映射
  Object.defineProperties(axios, properties);
};

const ENFORCE_RANK: Record<NonNullable<IPlugin["enforce"]>, number> = {
  pre: -1,
  post: 1,
};

/** 插件能力注入 */
const injectPlugin = (axios: AxiosInstanceExtension, plugin: IPlugin): void => {
  if (!plugin.lifecycle) plugin.lifecycle = {};
  if (!axios.__plugins__) return;

  axios.__plugins__.push(plugin);
  axios.__plugins__.sort((left, right) => {
    const leftRank = left.enforce ? ENFORCE_RANK[left.enforce] : 0;
    const rightRank = right.enforce ? ENFORCE_RANK[right.enforce] : 0;
    return leftRank - rightRank;
  });
};

/**
 * Install plugins into an existing Axios instance.
 *
 * Plugin objects and zero-argument plugin factories are registered in declaration order.
 * The instance is mutated in place; use `instance.request(...)` or an HTTP method rather
 * than Axios's callable shorthand.
 */
export const installPlugins = (
  instance: AxiosInstance,
  plugins: readonly AxiosPluginInput[],
): void => {
  // injectPluginHooks establishes the extension fields before plugins observe the instance.
  const extension = instance as AxiosInstanceExtension;
  injectPluginHooks(extension);

  for (const input of plugins) {
    const plugin = typeof input === "function" ? input() : input;
    plugin.beforeRegister?.(extension);
    injectPlugin(extension, plugin);
  }
};
