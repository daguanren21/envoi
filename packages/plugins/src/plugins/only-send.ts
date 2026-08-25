import { toFormData, type AxiosPromise, type InternalAxiosRequestConfig } from "axios";
import type { IPlugin } from "../intf";
import { combineURLs, isAbsoluteURL } from "../utils/url";
/** Options controlling fallback behavior when `navigator.sendBeacon` is unavailable. */
export interface IOnlySendOptions {
  /**
   * Behavior when `navigator.sendBeacon` is unavailable.
   *
   * `lower` keeps Axios's normal adapter; `error` aborts with `OnlySendError`.
   * @default "lower"
   */
  noSupport?: "lower" | "error";
}

/** Error thrown when sendBeacon support is required but unavailable. */
export class OnlySendError extends Error {
  type = "onlySend";
}

/**
 * Sends request data with `navigator.sendBeacon` for unload-safe, fire-and-forget delivery.
 */
export const onlySend = (options: IOnlySendOptions = {}): IPlugin => {
  return {
    name: "onlySend",
    enforce: "post",
    lifecycle: {
      preRequestTransform(config) {
        if (typeof config.adapter === "function") {
          throw new Error("适配器已经配置过了, 重复添加将产生冲突, 请检查!");
        }

        if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
          const message = "当前浏览器不支持 `navigator.sendBeacon`";
          if (options.noSupport === "error") {
            throw new OnlySendError(message);
          }
          console.error(message);
        } else {
          const payload = Object.assign({}, config.data, config.params);
          config.adapter = async (adapterConfig: InternalAxiosRequestConfig): AxiosPromise => {
            if (!adapterConfig.url) throw new Error("缺少必填参数 'url'");
            // > 补全路径
            if (!isAbsoluteURL(adapterConfig.url) && adapterConfig.baseURL) {
              adapterConfig.url = combineURLs(adapterConfig.baseURL, adapterConfig.url);
            }
            const form = new FormData();
            toFormData(payload, form);
            const success = navigator.sendBeacon(adapterConfig.url, form);
            return {
              config: adapterConfig,
              data: null,
              headers: {},
              status: success ? 200 : 500,
              statusText: "success",
            };
          };
        }

        return config;
      },
    },
  };
};
