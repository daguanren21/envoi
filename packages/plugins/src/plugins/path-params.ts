import type { IPlugin } from "../intf";

/** Options selecting where REST path placeholder values are read from. */
export interface IPathParamsOptions {
  /**
   * Restricts placeholder lookup to request `data` or `params`.
   *
   * Omit to merge both sources, with `params` taking precedence.
   */
  form?: "data" | "params";
}

/**
 * Replaces `${name}` URL placeholders with values from request data or query params.
 *
 * - url 格式需满足: `/api/${query}` 特征
 */
export const pathParams = (options: IPathParamsOptions = {}): IPlugin => {
  return {
    name: "pathParams",
    lifecycle: {
      transformRequest(config) {
        if (!config.url) return config;
        const pattern = /\$\{([^{}]+)\}/g;
        const source: unknown = options.form
          ? config[options.form]
          : { ...config.data, ...config.params };
        if (source === null || typeof source !== "object") return config;

        config.url = config.url.replace(pattern, (placeholder, key: string) => {
          const value: unknown = Reflect.get(source, key);
          return value === undefined ? placeholder : String(value);
        });
        return config;
      },
    },
  };
};
