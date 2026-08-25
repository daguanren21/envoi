import type { IPlugin } from "../intf";
import { klona } from "klona/json";
import qs from "qs";

/** String-keyed request data passed to serializers and signing algorithms. */
export interface IData {
  [key: string]: unknown;
}

/** Options for sorting, filtering, serializing, and signing request data. */
export interface ISignOptions {
  /** 签名字段
   *
   * @default "sign"
   */
  key?: "sign" | "signature" | string;

  /**
   * 业务提供的签名算法。
   *
   * @description 浏览器包不内置共享密钥。调用方应通过安全的会话材料实现 HMAC
   * 或使用非对称签名，并由服务端验证。
   */
  algorithm: (serialized: string) => string | Promise<string>;

  /** 自定义参数排序规则，设置 `false` 保留原始顺序。 */
  sort?: boolean | ((key1: string, key2: string) => number);

  /** 自定义字段过滤规则，设置 `false` 保留空值。 */
  filter?: boolean | ((key: string, value: unknown) => boolean);

  /**
   * 加盐。
   *
   * 对象会在序列化前追加到数据；字符串会在序列化后追加。
   */
  salt?: string | Record<string, unknown>;

  /** 自定义参数序列化，默认使用 `qs.stringify`。 */
  serialize?: (data: IData) => string;
}

/**
 * 插件: 请求签名
 *
 * @description 对排序、过滤和序列化后的请求数据调用业务提供的签名算法。
 *
 * 签名算法为必填项。浏览器包不内置共享密钥或不安全的摘要默认值。
 */
export const sign = (options: ISignOptions): IPlugin => {
  if (typeof options?.algorithm !== "function") {
    throw new TypeError("`sign()` requires an `algorithm` function");
  }

  return {
    name: "sign",
    enforce: "post",
    lifecycle: {
      async transformRequest(config) {
        if (config.data === null || typeof config.data !== "object" || Array.isArray(config.data)) {
          throw new TypeError("`sign()` requires request data to be a plain object");
        }

        const data = klona(config.data) as IData;
        let entries = Object.entries(data);
        if (options.sort !== false) {
          entries.sort(([left], [right]) => {
            return typeof options.sort === "function"
              ? options.sort(left, right)
              : left.localeCompare(right);
          });
        }
        if (options.filter !== false) {
          entries = entries.filter(([key, value]) => {
            if (typeof options.filter === "function") {
              return options.filter(key, value);
            }
            return (
              value !== null &&
              value !== undefined &&
              !(typeof value === "string" && value.trim() === "")
            );
          });
        }

        const signData: IData = Object.fromEntries(entries);
        if (options.salt !== null && typeof options.salt === "object") {
          Object.assign(signData, options.salt);
        }

        let serialized = options.serialize
          ? options.serialize(signData)
          : qs.stringify(signData, { arrayFormat: "brackets" });
        if (typeof options.salt === "string") {
          serialized += options.salt;
        }

        signData[options.key ?? "sign"] = await options.algorithm(serialized);
        config.data = signData;
        return config;
      },
    },
  };
};
