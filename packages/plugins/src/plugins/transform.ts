import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import type { ILifecycleHook, IPlugin } from "../intf";

/** Request, response, and recovery hooks contributed by the transform plugin. */
export interface ITransformOptions {
  /** Runs in the injected Axios request interceptor. */
  request?: ILifecycleHook<InternalAxiosRequestConfig>;
  /** Runs after Axios returns a response. */
  response?: ILifecycleHook<AxiosResponse>;
  /** Recovers from or replaces a request failure. Throw to preserve rejection. */
  capture?: ILifecycleHook<Error | AxiosError | any>;
}

/**
 * Adds request, response, and exception-recovery transforms without separate interceptors.
 */
export const transform = (options: ITransformOptions = {}): IPlugin => {
  const lifecycle: NonNullable<IPlugin["lifecycle"]> = {};
  if (options.request !== undefined) {
    lifecycle.transformRequest = options.request;
  }
  if (options.response !== undefined) {
    lifecycle.postResponseTransform = options.response;
  }
  if (options.capture !== undefined) {
    lifecycle.captureException = options.capture;
  }

  return {
    name: "transform",
    lifecycle,
  };
};
