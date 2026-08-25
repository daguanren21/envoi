import type { IPlugin } from "../intf";

interface FilterRuleOptions {
  /** Removes properties whose value is `null`. */
  noNull?: boolean;
  /** Removes properties whose value is `undefined`. */
  noUndefined?: boolean;
  /** Removes numeric `NaN` properties without coercing other values. */
  noNaN?: boolean;
  /** Recursively applies the same rules to nested plain objects. */
  deep?: boolean;
}

type FilterRule = FilterRuleOptions | false;

const DEFAULT_FILTER_RULE: Required<FilterRuleOptions> = {
  noNull: false,
  noUndefined: true,
  noNaN: false,
  deep: false,
};

const normalizeRecord = (data: unknown, rule: Required<FilterRuleOptions>): void => {
  if (Object.prototype.toString.call(data) !== "[object Object]") return;
  const record = data as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (
      (rule.noUndefined && value === undefined) ||
      (rule.noNull && value === null) ||
      (rule.noNaN && typeof value === "number" && Number.isNaN(value))
    ) {
      delete record[key];
      continue;
    }
    if (rule.deep) normalizeRecord(value, rule);
  }
};

/** Options for removing invalid values from URLs, request data, and query params. */
export interface INormalizeOptions {
  /** URL normalization, or `true` to remove duplicate slashes. */
  url?:
    | {
        /** Removes repeated slashes while preserving the URL scheme delimiter. */
        noDuplicateSlash?: boolean;
      }
    | boolean;
  /** Invalid-value rules for request data; `false` disables data normalization. */
  data?: FilterRule;
  /** Invalid-value rules for query params; `false` disables params normalization. */
  params?: FilterRule;
}

/**
 * Normalizes duplicate URL slashes and removes configured invalid values from request objects.
 */
export const normalize = (options: INormalizeOptions = {}): IPlugin => {
  return {
    name: "normalize",
    lifecycle: {
      transformRequest(config) {
        if (
          config.url &&
          (options.url === true ||
            (typeof options.url === "object" && options.url.noDuplicateSlash === true))
        ) {
          const schema = config.url.match(/^([a-z][a-z\d+\-.]*:)?\/\//i)?.[0] ?? "";
          config.url = schema + config.url.replace(schema, "").replace(/[/]{2,}/g, "/");
        }

        if (options.data !== false) {
          normalizeRecord(config.data, {
            ...DEFAULT_FILTER_RULE,
            ...options.data,
          });
        }
        if (options.params !== false) {
          normalizeRecord(config.params, {
            ...DEFAULT_FILTER_RULE,
            ...options.params,
          });
        }
        return config;
      },
    },
  };
};
