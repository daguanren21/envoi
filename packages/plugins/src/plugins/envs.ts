import type { AxiosDefaults, AxiosHeaderValue, HeadersDefaults } from "axios";
import type { IPlugin } from "../intf";

/** Ordered environment rules and Axios defaults applied by the first matching rule. */
export type IEnvsOptions = Array<{
  /** Predicate evaluated during registration; the first `true` rule wins. */
  rule: () => boolean;
  /** Axios defaults merged into the target instance when this rule wins. */
  config: Omit<AxiosDefaults, "headers"> & {
    headers: HeadersDefaults & {
      [key: string]: AxiosHeaderValue;
    };
  };
}>;
/**
 * Applies the first matching environment-specific Axios defaults during plugin registration.
 */
export const envs = (options: IEnvsOptions = []): IPlugin => {
  return {
    name: "envs",
    beforeRegister(axios) {
      for (const { rule, config } of options) {
        if (rule()) {
          Object.assign(axios.defaults, config);
          break;
        }
      }
    },
    lifecycle: {},
  };
};
