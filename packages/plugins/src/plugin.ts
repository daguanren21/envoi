import type { IPlugin } from "./intf";

export type {
  AxiosInstanceExtension,
  IHooksShareOptions,
  ILifecycleHook,
  ILifecycleHookFunction,
  ILifecycleHookObject,
  IPlugin,
  IPluginLifecycle,
  ISharedCache,
} from "./intf";

/** Declarative plugin object installed on one Axios instance. */
export type AxiosPlugin = IPlugin;
/** Zero-argument factory that creates a fresh plugin object during installation. */
export type AxiosPluginFactory = () => AxiosPlugin;

/** Plugin object or factory accepted by `installPlugins`. */
export type AxiosPluginInput = AxiosPlugin | AxiosPluginFactory;

/**
 * Defines a third-party plugin while preserving the object's inferred hooks and option types.
 */
export const definePlugin = <T extends IPlugin>(plugin: T): T => plugin;
