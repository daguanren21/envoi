import {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { type AbortChainController, type AbortError } from "../utils/create-abort-chain";

export const DEFER_EXCEPTION_OBSERVATION = "__envoiDeferExceptionObservation";

/** Shared instance-local storage available to every installed plugin. */
export interface ISharedCache {
  [key: string]: any;
}

/** Runtime fields injected into an Axios instance by `installPlugins`. */
export interface IAxiosPluginExtension {
  /** Plugins registered on this Axios instance in effective execution order. */
  __plugins__: Array<IPlugin>;
  /** Mutable instance-local storage shared by plugin hooks. */
  __shared__: ISharedCache;
}

/** Axios instance after plugin lifecycle support has been installed. */
export type AxiosInstanceExtension = AxiosInstance & IAxiosPluginExtension;

/** Request-scoped context passed to lifecycle hooks. */
export type IHooksShareOptions = {
  /** Immutable copy of the request config received by the plugin wrapper. */
  readonly origin: AxiosRequestConfig;
  /** Instance-local storage shared by all installed plugins. */
  readonly shared: ISharedCache;
  /** Axios instance currently dispatching the request. */
  readonly axios: AxiosInstance;
};

/** Reserved lifecycle continuation marker for third-party plugin protocols. */
export enum ENext {
  next = "next",
}

/**
 * Lifecycle callback receiving the current value, request context, and abort controller.
 *
 * Returning a value passes it to the next hook in the same phase.
 */
export type ILifecycleHookFunction<V> = (
  value: V,
  options: IHooksShareOptions,
  controller: AbortChainController,
) => V | Promise<V>;

/** Conditional lifecycle callback with a predicate evaluated before its handler. */
export type ILifecycleHookObject<V> = {
  /** Returns true when the handler should run for the current value and request. */
  runWhen: (value: V, options: IHooksShareOptions) => boolean;
  /** Lifecycle callback executed after `runWhen` accepts the request. */
  handler: ILifecycleHookFunction<V>;
};

/** Lifecycle hook expressed as a callback or a conditional hook object. */
export type ILifecycleHook<V> = ILifecycleHookFunction<V> | ILifecycleHookObject<V>;

/** Lifecycle phases supported by an Axios plugin. */
export interface IPluginLifecycle {
  /** Runs before Axios request dispatch and before Axios request interceptors. */
  preRequestTransform?: ILifecycleHook<AxiosRequestConfig>;

  /** Runs inside the injected Axios request interceptor. */
  transformRequest?: ILifecycleHook<InternalAxiosRequestConfig>;
  /** Runs after Axios returns a response; response hooks unwind in reverse plugin order. */
  postResponseTransform?: ILifecycleHook<AxiosResponse>;
  /**
   * Recovers from or replaces a request failure.
   *
   * Return a value to fulfill the request, or throw to keep it rejected.
   */
  captureException?: ILifecycleHook<Error | AxiosError | any>;
  /**
   * Observes the final unrecovered exception without changing rejection state.
   *
   * Runs only after recovery hooks decline the exception or throw.
   */
  exceptionObserved?: ILifecycleHook<unknown>;
  /** Runs after a plugin aborts the request chain. */
  aborted?: ILifecycleHook<AbortError>;
  /** Runs exactly once after a fulfilled, rejected, or aborted request. */
  completed?:
    | ((options: IHooksShareOptions, controller: AbortChainController) => void | Promise<void>)
    | {
        /** Returns true when completion cleanup applies to this request. */
        runWhen: (options: IHooksShareOptions) => boolean;
        /** Performs request completion cleanup. */
        handler: (
          options: IHooksShareOptions,
          controller: AbortChainController,
        ) => void | Promise<void>;
      };
}

/** Plugin definition installed into an Axios instance. */
export interface IPlugin {
  /** Stable plugin name used for diagnostics and duplicate checks. */
  name: string;

  /** Places the plugin before (`pre`) or after (`post`) normally ranked plugins. */
  enforce?: "pre" | "post";
  /**
   * Validates or initializes the plugin immediately before registration.
   *
   * Throw here when the target instance cannot support the plugin.
   */
  beforeRegister?: (axios: AxiosInstanceExtension) => void;

  /** Lifecycle hooks contributed by this plugin. */
  lifecycle?: IPluginLifecycle;
}
