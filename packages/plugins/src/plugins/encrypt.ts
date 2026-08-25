import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { definePlugin } from "../plugin";
import type { AxiosInstanceExtension, IPlugin, ISharedCache } from "../intf";
import { EncryptError } from "./encrypt/error";
import { RsaEncryptor } from "./encrypt/rsa";
import type {
  EncryptEncoding,
  EncryptPluginOptions,
  EncryptRequestConfig,
  EncryptRequestOptions,
} from "./encrypt/types";

export { EncryptError } from "./encrypt/error";
export type {
  EncryptAlgorithm,
  EncryptEncoding,
  EncryptErrorCode,
  EncryptHash,
  EncryptPadding,
  EncryptPluginOptions,
  EncryptPublicKeyInfo,
  EncryptRequestConfig,
  EncryptRequestOptions,
} from "./encrypt/types";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Encrypt selected top-level `data` fields before this request is sent. */
    encrypt?: EncryptRequestConfig;
  }
}

const PUBLIC_KEY_URL = "/api/rsa/public-key";
const encryptorBySharedCache = new WeakMap<ISharedCache, RsaEncryptor>();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFieldList(value: readonly string[] | EncryptRequestOptions): value is readonly string[] {
  return Array.isArray(value);
}

function resolveRequestOptions(
  requestConfig: readonly string[] | EncryptRequestOptions,
  pluginOptions: EncryptPluginOptions,
): {
  fields: readonly string[];
  encoding: EncryptEncoding;
} {
  const fields = isFieldList(requestConfig) ? requestConfig : requestConfig.fields;
  if (fields.length === 0 || fields.some((field) => field.length === 0)) {
    throw new EncryptError(
      "At least one non-empty request data field must be configured.",
      "INVALID_OPTIONS",
    );
  }
  return {
    fields,
    encoding: isFieldList(requestConfig)
      ? (pluginOptions.encoding ?? "base64")
      : (requestConfig.encoding ?? pluginOptions.encoding ?? "base64"),
  };
}

async function encryptRequestData(
  config: AxiosRequestConfig,
  fields: readonly string[],
  encoding: EncryptEncoding,
  encryptor: RsaEncryptor,
): Promise<void> {
  if (!isPlainRecord(config.data)) {
    throw new EncryptError(
      "Encrypted request data must be a plain object.",
      "INVALID_REQUEST_DATA",
    );
  }

  const data = { ...config.data };
  const uniqueFields = [...new Set(fields)];
  const encryptedValues = await Promise.all(
    uniqueFields.map(async (field) => {
      if (!Object.prototype.hasOwnProperty.call(data, field)) {
        throw new EncryptError(
          `Encrypted request data is missing field "${field}".`,
          "INVALID_REQUEST_DATA",
        );
      }
      const value = data[field];
      if (typeof value !== "string") {
        throw new EncryptError(
          `Encrypted request field "${field}" must be a string.`,
          "INVALID_REQUEST_DATA",
        );
      }
      return await encryptor.encrypt(value, encoding);
    }),
  );

  for (let index = 0; index < uniqueFields.length; index++) {
    data[uniqueFields[index]] = encryptedValues[index];
  }
  config.data = data;
}

/**
 * Built-in RSA request-field encryption plugin.
 *
 * Global fields are encrypted whenever present. Requests may override fields and
 * encoding with `encrypt: { ... }`, or disable the global rule with `encrypt: false`.
 */
export const encrypt = (options: EncryptPluginOptions = {}): IPlugin => {
  if (options.fields?.some((field) => field.length === 0)) {
    throw new EncryptError("Global encrypt fields must be non-empty strings.", "INVALID_OPTIONS");
  }

  return definePlugin({
    name: "encrypt",
    beforeRegister(instance) {
      if (instance.__plugins__.some((plugin) => plugin.name === "encrypt")) {
        throw new EncryptError("The encrypt plugin is already installed.", "INVALID_OPTIONS");
      }
      encryptorBySharedCache.set(
        instance.__shared__,
        new RsaEncryptor({
          getPublicKey: async () => {
            const response = await instance.get<unknown>(PUBLIC_KEY_URL);
            return response.data;
          },
        }),
      );
    },
    lifecycle: {
      preRequestTransform: {
        runWhen(_config, { origin }) {
          if (origin.encrypt === false) return false;
          if (origin.encrypt !== undefined) return true;
          return (
            isPlainRecord(origin.data) &&
            Boolean(
              options.fields?.some((field) =>
                Object.prototype.hasOwnProperty.call(origin.data, field),
              ),
            )
          );
        },
        async handler(config, { origin, shared }) {
          const requestConfig = origin.encrypt;
          if (requestConfig === false) return config;

          let fields: readonly string[];
          let encoding: EncryptEncoding;
          if (requestConfig === undefined) {
            if (!isPlainRecord(config.data)) return config;
            fields = (options.fields ?? []).filter((field) =>
              Object.prototype.hasOwnProperty.call(config.data, field),
            );
            if (fields.length === 0) return config;
            encoding = options.encoding ?? "base64";
          } else {
            const requestOptions = resolveRequestOptions(requestConfig, options);
            fields = requestOptions.fields;
            encoding = requestOptions.encoding;
          }

          const encryptor = encryptorBySharedCache.get(shared);
          if (!encryptor) {
            throw new EncryptError(
              "The encrypt plugin is not installed on this Axios instance.",
              "INVALID_OPTIONS",
            );
          }
          await encryptRequestData(config, fields, encoding, encryptor);
          return config;
        },
      },
    },
  });
};

/** Clear the instance-scoped key cache and immediately fetch the current server key. */
export async function refreshEncryptPublicKey(instance: AxiosInstance): Promise<void> {
  if (!("__shared__" in instance)) {
    throw new EncryptError(
      "The encrypt plugin is not installed on this Axios instance.",
      "INVALID_OPTIONS",
    );
  }
  // installPlugins establishes this field before any plugin is registered.
  const extension = instance as AxiosInstanceExtension;
  const encryptor = encryptorBySharedCache.get(extension.__shared__);
  if (!encryptor) {
    throw new EncryptError(
      "The encrypt plugin is not installed on this Axios instance.",
      "INVALID_OPTIONS",
    );
  }
  await encryptor.refreshPublicKey();
}
