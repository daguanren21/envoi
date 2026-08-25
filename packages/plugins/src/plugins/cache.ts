import type { AxiosInstance, AxiosRequestConfig } from "axios";

import type { IPlugin } from "../intf";

declare module "axios" {
  interface CreateAxiosDefaults {
    /** 配置重复请求合并策略 */
    cache?: ICacheOptions;
  }

  interface AxiosRequestConfig {
    /**
     * 配置是否触发重复请求合并策略
     *
     * @description 在一段时间内发起的重复请求, 仅请求一次, 并将请求结果分别返回给不同的发起者.
     *
     *  - 需要注册 `merge()` 插件
     *  - 不建议与 `debounce`, `throttle` 插件同时使用
     */
    cache?: boolean | (Pick<ICacheOptions, "expires"> & { key: string });
  }
}

/** Options for instance-scoped response caching. */
export interface ICacheOptions {
  /**
   * 缓存版本号
   *
   * @description 设置此参数可以避免因数据结构差异, 导致后续逻辑错误
   */
  version?: string;
  /**
   * 过期时间
   *
   * @description 设置缓存有效期, 超过有效期将失效
   */
  expires?: number;

  /**
   * 缓存key
   *
   * @description 缓存key遵循两个规则, 可以参考 `calcRequestHash` 自定义缓存键
   * @default ``` f(url, data, params) => hash ```
   */
  key?: <D>(config: AxiosRequestConfig<D>) => string;

  /**
   * 响应缓存存储空间
   *
   * @default {sessionStorage}
   */
  storage?: Storage;

  /**
   * storage 中, 缓存cache的字段名
   * @default ``` envoi.plugins.cache ```
   */
  storageKey?: string;
}

interface ICache {
  [key: string]: {
    /** 时效时间 */
    expires: number;
    /** 响应内容 */
    res: any;
  };
}

const mapping: Array<{
  axios: AxiosInstance;
  patch: (patchCache: Partial<ICache>) => void;
  clear: () => void;
}> = [];

/** Removes one cache entry from the cache plugin installed on `axios`. */
export const removeCache = (axios: AxiosInstance, cacheKey: string): boolean => {
  for (const m of mapping) {
    if (m.axios === axios) {
      m.patch({ [cacheKey]: undefined });
      return true;
    }
  }
  return false;
};

/** Clears every response cached by the cache plugin installed on `axios`. */
export const clearAllCache = (axios: AxiosInstance): boolean => {
  for (const m of mapping) {
    if (m.axios === axios) {
      m.clear();
      return true;
    }
  }
  return false;
};

/**
 * Caches complete Axios responses and returns them for matching requests until expiration.
 *
 * Register before request-coalescing plugins so cache hits bypass transport consistently.
 */
export const cache = (options: ICacheOptions = {}): IPlugin => {
  // @ 获取 storage
  const storage: Storage = options.storage ?? sessionStorage;
  // @ 获取 storage 中, 存放缓存的字段名
  const storageKey: string = options.storageKey ?? "envoi.plugins.cache";

  const getCacheKey = (origin: AxiosRequestConfig, key: unknown): string | undefined => {
    if (typeof key === "string") return key;
    else if (typeof key === "function") return key(origin);
    else if (typeof key === "object") return getCacheKey(origin, (key as ICacheOptions).key);
    return undefined;
  };

  const getCache = (): ICache => {
    let str: string | null = storage.getItem(storageKey);
    // ? 如果没有缓存, 跳过
    if (!str) {
      return {};
    }
    const { version, cache: storedCache } = JSON.parse(str);
    if (version !== options.version) {
      return {};
    } else {
      return storedCache;
    }
  };

  const patch = (patchCache: Partial<ICache>): void => {
    const storedCache = getCache();
    Object.assign(storedCache, patchCache);
    for (const key of Object.keys(storedCache)) {
      if (!storedCache[key]?.expires || Date.now() > storedCache[key].expires) {
        delete storedCache[key];
      }
    }
    if (Object.keys(storedCache).length > 0) {
      storage.setItem(storageKey, JSON.stringify({ version: options.version, cache: storedCache }));
    } else {
      storage.removeItem(storageKey);
    }
  };
  const clear = (): void => {
    storage.removeItem(storageKey);
  };

  return {
    name: "cache",
    beforeRegister(axios) {
      // 参数合并
      Object.assign(options, axios.defaults["cache"]);
      mapping.push({ axios, patch, clear });
      // 清理失效缓存
      patch({});
    },
    lifecycle: {
      preRequestTransform: {
        runWhen: (_, { origin }) => Boolean(origin.cache),
        /**
         * 请求前, 创建请求缓存, 遇到重复请求时, 将重复请求放入缓存等待最先触发的请求执行完成
         */
        handler: async (config, { origin }, { abort }) => {
          // @ 计算缓存的 key
          const key: string | undefined =
            getCacheKey(origin, origin.cache) ?? getCacheKey(origin, options.key);
          // 获取缓存
          const storedCache: ICache = getCache();

          if (key && storedCache[key]) {
            // ? 如果在有效期内, 中断请求并退出
            if (Date.now() < storedCache[key].expires) {
              abort(storedCache[key].res);
            } else {
              delete storedCache[key];
            }
          }

          return config;
        },
      },
      postResponseTransform: {
        runWhen: (_, { origin }) => Boolean(origin.cache),
        handler: (response, { origin }) => {
          // @ 计算缓存的 key
          const key: string | undefined =
            getCacheKey(origin, origin.cache) ?? getCacheKey(origin, options.key);
          // patch to storage
          if (key) {
            patch({
              [key]: {
                expires:
                  (typeof origin.cache === "object" ? origin.cache.expires : undefined) ??
                  options.expires ??
                  0,
                res: response,
              },
            });
          }
          return response;
        },
      },
    },
  };
};
