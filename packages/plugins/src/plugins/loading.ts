import type { IHooksShareOptions, IPlugin, ISharedCache } from "../intf";
import { createOrGetCache } from "../utils/create-cache";
import { type Filter, type FilterPattern, createUrlFilter } from "../utils/create-filter";

declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * 设置当前请求是否触发 loading 切换判断
     *
     * @default {true}
     */
    loading?: boolean;
  }
}

/** Options for coordinating one loading indicator across concurrent requests. */
export interface ILoadingOptions {
  /**
   * 指定哪些接口包含
   *
   * @description 未指定情况下, 所有接口均包含重复请求合并逻辑
   */
  includes?: FilterPattern;

  /**
   * 指定哪些接口应忽略
   */
  excludes?: FilterPattern;

  /**
   * 请求发起后, 延时多少毫秒显示loading
   *
   * @default 200ms
   */
  delay?: number;

  /**
   * 是否延时关闭, 当所有请求完成后, 延迟多少毫秒关闭loading
   *
   * @default 200ms
   */
  delayClose?: number;

  /**
   * 触发全局loading的切换事件
   *
   * @description 需要自行实现 loading 显示/隐藏的管理逻辑
   */
  onTrigger: (show: boolean) => void;
}

type TimerHandle = number | NodeJS.Timeout;

interface SharedCache extends ISharedCache {
  loading: {
    pending: number;
    status: boolean;
    timer: TimerHandle | undefined;
    closeTimer: TimerHandle | undefined;
  };
}

/**
 * Tracks matching in-flight requests and toggles a shared loading indicator.
 *
 * Register early when later request hooks may perform asynchronous work.
 */
export const loading = (options: ILoadingOptions): IPlugin => {
  const filter: Filter = createUrlFilter(options.includes, options.excludes);

  return {
    name: "loading",
    lifecycle: {
      preRequestTransform: {
        runWhen: (_, { origin }) => origin.loading ?? filter(origin.url),
        handler: (config, { shared }) => {
          const cache: SharedCache["loading"] = createOrGetCache(shared, "loading");
          cache.pending = (cache.pending ?? 0) + 1;

          if (cache.closeTimer !== undefined) {
            clearTimeout(cache.closeTimer);
            cache.closeTimer = undefined;
          }
          if (!cache.status && cache.pending === 1) {
            clearTimeout(cache.timer);
            cache.timer = setTimeout(
              () => {
                cache.timer = undefined;
                if (cache.pending > 0 && !cache.status) {
                  cache.status = true;
                  options.onTrigger(true);
                }
              },
              Math.max(0, options.delay ?? 0),
            );
          }
          return config;
        },
      },
      completed: {
        runWhen: ({ origin }: IHooksShareOptions) => origin.loading ?? filter(origin.url),
        handler: ({ shared }) => {
          const cache: SharedCache["loading"] = createOrGetCache(shared, "loading");
          cache.pending = Math.max(0, (cache.pending ?? 0) - 1);
          if (cache.pending > 0) return;

          if (cache.timer !== undefined) {
            clearTimeout(cache.timer);
            cache.timer = undefined;
          }
          if (!cache.status) return;

          const close = (): void => {
            cache.closeTimer = undefined;
            if (cache.pending === 0 && cache.status) {
              cache.status = false;
              options.onTrigger(false);
            }
          };
          const delayClose = Math.max(0, options.delayClose ?? 0);
          if (delayClose === 0) {
            close();
          } else {
            cache.closeTimer = setTimeout(close, delayClose);
          }
        },
      },
    },
  };
};
