import { type AxiosInstance, CanceledError } from "axios";
import type { AxiosInstanceExtension, IPlugin, ISharedCache } from "../intf";
import { createOrGetCache } from "../utils/create-cache";

interface SharedCache extends ISharedCache {
  cancel: Array<AbortController>;
}

/**
 * Adds an `AbortController` to each request so active requests can be cancelled together.
 */
export const cancel = (): IPlugin => {
  return {
    name: "cancel",
    lifecycle: {
      preRequestTransform: {
        runWhen: (config) => !config.signal,
        handler: (config, { origin, shared }) => {
          const cache: SharedCache["cancel"] = createOrGetCache(shared, "cancel", []);
          const controller = new AbortController();
          config.signal = controller.signal;
          origin.signal = controller.signal;
          cache.push(controller);
          return config;
        },
      },
      captureException: {
        runWhen: (reason: unknown) => reason instanceof CanceledError,
        handler: (reason: unknown, _options, { abortError }) => {
          // ? 如果是 cancel 触发的请求, 那么终止执行, 并触发 `abortError`
          if (reason instanceof CanceledError) {
            abortError(reason);
          }
          return reason;
        },
      },
      completed({ origin, shared }) {
        // @ 从共享内存中创建或获取缓存对象
        const cache: SharedCache["cancel"] = createOrGetCache(shared, "cancel", []);
        const index: number = cache.findIndex((controller) => controller.signal === origin.signal);
        // clear
        if (index !== -1) cache.splice(index, 1);
      },
    },
  };
};

/** Aborts every active request tracked by the cancel plugin on `instance`. */
export const cancelAll = (instance: AxiosInstance, message?: string): void => {
  const shared = (instance as Partial<AxiosInstanceExtension>).__shared__ as
    | SharedCache
    | undefined;
  const sources = shared?.cancel;
  if (!Array.isArray(sources)) return;

  for (const controller of sources.splice(0)) {
    controller.abort(message ?? "请求终止");
  }
};
