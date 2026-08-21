import {
  create as createAxios,
  type AxiosInstance,
  type AxiosRequestConfig,
  type CreateAxiosDefaults,
  type ResponseType,
} from "axios";
import type { Adapter, HttpRequest, HttpResponse } from "../types";

export type AxiosAdapterOptions = Omit<
  CreateAxiosDefaults,
  "baseURL" | "headers" | "timeout" | "params" | "paramsSerializer" | "validateStatus"
>;

export type AxiosInstanceOptions = CreateAxiosDefaults;
export type { AxiosInstance } from "axios";

/** Create the shared axios instance without importing axios in application code. */
export function createAxiosInstance(options: AxiosInstanceOptions = {}): AxiosInstance {
  return createAxios(options);
}

function toAxiosResponseType(type: HttpRequest["responseType"]): ResponseType | undefined {
  if (type === "arrayBuffer") return "arraybuffer";
  if (type === "stream") return "stream";
  return type;
}

function configFromMeta(meta: HttpRequest["meta"]): AxiosRequestConfig {
  const config = meta.axios;
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  return config as AxiosRequestConfig;
}

/**
 * Axios adapter using the axios version owned by @envoijs/http, or an existing
 * instance whose interceptors and request wrappers must be preserved.
 * Common baseURL/headers/timeout belong to createHttp.defaults; native options
 * such as withCredentials belong here.
 */
export function axiosAdapter(instance: AxiosInstance): Adapter;
export function axiosAdapter(options?: AxiosAdapterOptions): Adapter;
export function axiosAdapter(input: AxiosInstance | AxiosAdapterOptions = {}): Adapter {
  const instance = typeof input === "function" ? input : createAxiosInstance(input);

  return {
    name: "axios",
    async request(req: HttpRequest): Promise<HttpResponse> {
      const config: AxiosRequestConfig = {
        ...configFromMeta(req.meta),
        url: req.url,
        method: req.method,
        headers: req.headers,
        data: req.body,
        validateStatus: () => true,
      };
      if (req.timeout !== undefined) config.timeout = req.timeout;
      if (req.signal) config.signal = req.signal;
      const responseType = toAxiosResponseType(req.responseType);
      if (responseType) config.responseType = responseType;

      const res = await instance.request(config);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(res.headers)) {
        if (typeof value === "string") headers[key] = value;
        else if (Array.isArray(value)) headers[key] = value.join(", ");
      }

      return {
        status: res.status,
        statusText: res.statusText,
        headers,
        body: res.data,
        raw: res,
      };
    },
  };
}
