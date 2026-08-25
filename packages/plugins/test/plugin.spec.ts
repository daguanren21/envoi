import { describe, expect, test } from "vitest";
import {
  EncryptError,
  GiveUpRule,
  MpRequestError,
  OnlySendError,
  ThrottleError,
  auth,
  cache,
  cancel,
  cancelAll,
  clearAllCache,
  debounce,
  definePlugin,
  encrypt,
  envs,
  installPlugins,
  loading,
  merge,
  mock,
  mp,
  normalize,
  onlySend,
  pathParams,
  refreshEncryptPublicKey,
  removeCache,
  retry,
  sentryCapture,
  sign,
  throttle,
  transform,
} from "../src";

describe("third-party plugin API", () => {
  test("definePlugin preserves the plugin object", () => {
    const plugin = {
      name: "example",
      lifecycle: {},
    };

    expect(definePlugin(plugin)).toBe(plugin);
  });

  test("root entry exposes every plugin and helper", () => {
    const functions = [
      auth,
      cache,
      cancel,
      cancelAll,
      clearAllCache,
      debounce,
      definePlugin,
      encrypt,
      envs,
      installPlugins,
      loading,
      merge,
      mock,
      mp,
      normalize,
      onlySend,
      pathParams,
      refreshEncryptPublicKey,
      removeCache,
      retry,
      sentryCapture,
      sign,
      throttle,
      transform,
    ];

    expect(functions.every((value) => typeof value === "function")).toBe(true);
    expect(
      [EncryptError, MpRequestError, OnlySendError, ThrottleError].every(
        (value) => typeof value === "function",
      ),
    ).toBe(true);
    expect(GiveUpRule.throw).toBe("throw");
  });
});
