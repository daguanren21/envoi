import type { AxiosPromise, InternalAxiosRequestConfig } from "axios";
import type { IPlugin } from "../intf";
import { combineURLs, isAbsoluteURL } from "../utils/url";
/** Options for mini-program and cross-platform request runtimes. */
export interface IMpOptions<C extends Record<string, unknown> = Record<string, unknown>> {
  /** Runtime global name or a supported platform alias such as `wx`, `uni`, or `Taro`. */
  env:
    | "wx" // 微信
    | "alipay" // 支付宝
    | "baidu" // 百度
    | "tt" // 头条
    | "douyin" // 抖音
    | "feishu" // 飞书小程序
    | "dingTalk" // 钉钉小程序
    | "qq" // qq小程序
    | "uni" // uni-app
    | "Taro" // Taro
    | string; // 如果小程序平台不在上述预设, 那么可以使用自定义的预设名

  /** Platform-specific fields merged into the runtime's request options. */
  config?: C;
}

interface MpSuccessResult {
  data: unknown;
  statusCode: number;
  errMsg: string;
  cookies?: string[];
  header?: Record<string, string | string[]>;
}

interface MpFailure {
  errMsg: string;
  errno: number;
}

/** 小程序API前缀映射 */
const mapping = {
  alipay: "my",
  baidu: "swan",
  douyin: "tt",
  feishu: "tt",
  dingTalk: "dd",
};

/** Error returned by a mini-program runtime request failure. */
export class MpRequestError extends Error {
  type = "MpRequestError";

  /** 错误信息 */
  errMsg: string;
  /** 需要基础库： `2.24.0`
   *
   * errno 错误码，错误码的详细说明参考 [Errno错误码](https://developers.weixin.qq.com/miniprogram/dev/framework/usability/PublicErrno.html) */
  errno: number;

  constructor(err: { errMsg: string; errno: number }) {
    super(err.errMsg);
    this.errMsg = err.errMsg;
    this.errno = err.errno;
  }
}
/**
 * Replaces Axios transport with the selected mini-program or cross-platform request runtime.
 *
 * @support 微信/支付宝/百度/头条/飞书/QQ/快手/钉钉/淘宝/快应用/uni-app/Taro
 */
export const mp = (options: IMpOptions): IPlugin => {
  return {
    name: "mp",
    enforce: "post",
    lifecycle: {
      preRequestTransform(config) {
        if (typeof config.adapter === "function") {
          throw new Error("适配器已经配置过了, 重复添加将产生冲突, 请检查!");
        }
        config.adapter = (adapterConfig: InternalAxiosRequestConfig): AxiosPromise => {
          // The platform request API is callback-only, so the Promise executor is the adapter boundary.
          return new Promise((resolve, reject) => {
            const env: string = mapping[options.env as keyof typeof mapping] ?? options.env;
            const runtime: unknown = Reflect.get(globalThis, env);
            if (
              runtime === null ||
              typeof runtime !== "object" ||
              !("request" in runtime) ||
              typeof runtime.request !== "function"
            ) {
              return reject(new Error(`插件不可用, 未找到 '${env}' 全局变量`));
            }
            if (!adapterConfig.url) return reject(new Error("缺少必填参数 'url'"));
            // > 补全路径
            if (!isAbsoluteURL(adapterConfig.url) && adapterConfig.baseURL) {
              adapterConfig.url = combineURLs(adapterConfig.baseURL, adapterConfig.url);
            }
            runtime.request({
              method: adapterConfig.method?.toUpperCase(),
              url: adapterConfig.url,
              data: Object.assign({}, adapterConfig.data, adapterConfig.params),
              header: adapterConfig.headers,
              timeout: adapterConfig.timeout,
              // 合并公共参数
              ...options.config,
              success: (result: MpSuccessResult): void => {
                resolve({
                  data: result.data,
                  status: result.statusCode,
                  statusText: result.errMsg,
                  headers: {
                    ...result.header,
                    ...(result.cookies === undefined ? {} : { "set-cookie": result.cookies }),
                  },
                  config: adapterConfig,
                });
              },
              fail: (error: MpFailure) => {
                reject(new MpRequestError(error));
              },
            });
          });
        };
        return config;
      },
    },
  };
};
