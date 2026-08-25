export type MaybePromise<T> = T | Promise<T>;

export type EncryptHash = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export type EncryptEncoding = "base64" | "hex";

export type EncryptPadding = "OAEP" | "PKCS1_V1_5";

export interface EncryptAlgorithm {
  padding: EncryptPadding;
  hash: EncryptHash;
}

/** Response body returned by the built-in `/api/rsa/public-key` request. */
export interface EncryptPublicKeyInfo {
  publicKey: string;
  algorithm?: string;
}

export interface EncryptPluginOptions {
  /** Fields encrypted automatically whenever they are present in a request data object. */
  fields?: readonly string[];
  /** Default cipher encoding for requests installed with this plugin instance. */
  encoding?: EncryptEncoding;
}

export interface EncryptRequestOptions {
  /** Top-level request data fields encrypted for this request. */
  fields: readonly string[];
  /** Cipher encoding override for this request. */
  encoding?: EncryptEncoding;
}

/** `false` disables encryption; an array is shorthand for `{ fields: [...] }`. */
export type EncryptRequestConfig = false | readonly string[] | EncryptRequestOptions;

export type EncryptErrorCode =
  | "UNSUPPORTED_ENVIRONMENT"
  | "UNSUPPORTED_ALGORITHM"
  | "INVALID_OPTIONS"
  | "NO_PUBLIC_KEY"
  | "INVALID_PUBLIC_KEY"
  | "INVALID_REQUEST_DATA"
  | "ENCRYPT_FAILED";

export interface EncryptorOptions {
  publicKey?: string;
  getPublicKey?: () => MaybePromise<unknown>;
  algorithm?: string;
  hash?: EncryptHash;
}
