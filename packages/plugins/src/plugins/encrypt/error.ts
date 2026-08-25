import type { EncryptErrorCode } from "./types";

export class EncryptError extends Error {
  readonly code: EncryptErrorCode;
  readonly cause: unknown;

  constructor(message: string, code: EncryptErrorCode, cause?: unknown) {
    super(message);
    this.name = "EncryptError";
    this.code = code;
    this.cause = cause;
  }
}
