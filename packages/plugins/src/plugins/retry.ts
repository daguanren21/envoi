import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { DEFER_EXCEPTION_OBSERVATION } from "../intf";
import type { IHooksShareOptions, IPlugin } from "../intf";
import { createUrlFilter, type Filter, type FilterPattern } from "../utils/create-filter";

declare module "axios" {
  interface CreateAxiosDefaults {
    /** 配置重试策略 */
    retry?: IRetryOptions;
  }
  interface AxiosRequestConfig {
    /**
     * 接口请求失败重试规则
     *
     * @description
     *  - 需要注册 `retry()` 插件, 指示接口请求失败后, 重试几次
     *  - 设置为 0 时, 禁用重试功能
     */
    retry?: number | Pick<IRetryOptions, "max" | "isExceptionRequest">;
  }
}

/** Options for retrying final transport or custom-classified response failures. */
export interface IRetryOptions {
  /**
   * 指定哪些接口包含
   *
   * @description 建议使用 `axios.request({ retry: 3 })` 方式对单个请求设置重试规则
   */
  includes?: FilterPattern;
  /**
   * 指定哪些接口应忽略
   */
  excludes?: FilterPattern;

  /**
   * 最大重试次数
   *
   * @description 如果请求时, 指定了失败重试次数, 那么根据请求上标识, 确认失败后重试几次
   */
  max: number;

  /**
   * 自定义异常请求检查方法
   *
   * @description 默认情况下, 仅在捕获到axios抛出异常时, 触发重试规则, 也可以通过此方法自定义重试检查
   */
  isExceptionRequest?: (response: AxiosResponse, options: IHooksShareOptions) => boolean;
}

const RETRY_ATTEMPT = "__envoiRetryAttempt";

type RetryRequestConfig = AxiosRequestConfig & {
  [RETRY_ATTEMPT]?: number;
  [DEFER_EXCEPTION_OBSERVATION]?: boolean;
};

/** 重试异常 */
class RetryError extends Error {
  type: string = "retry";
}

/**
 * Retries matching failures up to the request-local or plugin-level maximum.
 *
 * Retry budgets are isolated per request chain, including concurrent equivalent requests.
 */
export const retry = (initialOptions: IRetryOptions): IPlugin => {
  let options = initialOptions;
  let filter: Filter = createUrlFilter(options.includes, options.excludes);

  const resolveOptions = (
    origin: AxiosRequestConfig,
  ): Pick<IRetryOptions, "max" | "isExceptionRequest"> => {
    if (typeof origin.retry === "object") {
      return origin.retry;
    }
    if (typeof origin.retry === "number") {
      return { max: origin.retry };
    }
    return options;
  };

  const runWhen = <V>(_: V, { origin }: IHooksShareOptions): boolean => {
    const { max } = resolveOptions(origin);
    if (origin.retry !== undefined) {
      return max > 0;
    }
    return max > 0 && filter(origin.url);
  };

  return {
    name: "retry",
    beforeRegister(axios) {
      const defaults = axios.defaults.retry;
      options =
        defaults !== null && typeof defaults === "object"
          ? { ...(defaults as IRetryOptions), ...initialOptions }
          : { ...initialOptions };
      filter = createUrlFilter(options.includes, options.excludes);
    },
    lifecycle: {
      preRequestTransform(config) {
        delete (config as RetryRequestConfig)[RETRY_ATTEMPT];
        delete (config as RetryRequestConfig)[DEFER_EXCEPTION_OBSERVATION];
        return config;
      },
      postResponseTransform: {
        runWhen(_, opts) {
          return runWhen(_, opts) && resolveOptions(opts.origin).isExceptionRequest !== undefined;
        },
        handler(response, opts) {
          if (resolveOptions(opts.origin).isExceptionRequest?.(response, opts)) {
            throw new RetryError();
          }
          return response;
        },
      },
      captureException: {
        runWhen,
        async handler(reason, { origin, axios }, { abortError }) {
          const { max } = resolveOptions(origin);
          const attempt = (origin as RetryRequestConfig)[RETRY_ATTEMPT] ?? 0;
          if (attempt >= max) {
            abortError(reason);
          }
          const retryConfig: RetryRequestConfig = {
            ...origin,
            [RETRY_ATTEMPT]: attempt + 1,
            [DEFER_EXCEPTION_OBSERVATION]: true,
          };
          return await axios.request(retryConfig);
        },
      },
    },
  };
};
