import type { IPlugin } from "../intf";

/** Sentry-compatible exception reporter used for final unrecovered request errors. */
export interface ISentryOptions {
  /** Reporter object exposing a Sentry-compatible `captureException` method. */
  sentry: {
    /** Receives the final error after retries and recovery hooks are exhausted. */
    captureException(exception: unknown): unknown;
  };
}

/**
 * Reports the final unrecovered request exception without changing rejection state.
 */
export const sentryCapture = (options: ISentryOptions): IPlugin => {
  return {
    name: "sentry-capture",
    lifecycle: {
      exceptionObserved: (reason) => {
        options.sentry.captureException(reason);
        return reason;
      },
    },
  };
};
