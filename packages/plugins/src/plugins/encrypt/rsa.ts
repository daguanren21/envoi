import { JSEncrypt } from "jsencrypt";
import { EncryptError } from "./error";
import type {
  EncryptAlgorithm,
  EncryptEncoding,
  EncryptHash,
  EncryptPublicKeyInfo,
  EncryptorOptions,
} from "./types";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const PEM_BLOCK_RE = /-----(BEGIN|END)[^-]+-----/gu;
const WHITESPACE_RE = /\s/gu;
const PKCS1_HEADER = "-----BEGIN RSA PUBLIC KEY-----";
const SPKI_HEADER = "-----BEGIN PUBLIC KEY-----";
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const RSA_ALGORITHM_IDENTIFIER_DER = [
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
];
const RSA_OID_DER = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
const BASE64_LOOKUP = (() => {
  const lookup = new Int16Array(128).fill(-1);
  for (let index = 0; index < BASE64_CHARS.length; index++) {
    lookup[BASE64_CHARS.charCodeAt(index)] = index;
  }
  return lookup;
})();

interface EncryptKeyContext {
  pem: string;
  algorithm: EncryptAlgorithm;
  oaepKey?: CryptoKey;
}

function base64Value(value: string): number {
  const code = value.charCodeAt(0);
  return code < BASE64_LOOKUP.length ? BASE64_LOOKUP[code] : -1;
}

function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(WHITESPACE_RE, "");
  if (normalized.length === 0 || normalized.length % 4 !== 0) {
    throw new EncryptError("Invalid base64 RSA public key.", "INVALID_PUBLIC_KEY");
  }

  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  const outputLength = (normalized.length / 4) * 3 - padding;
  const output = new Uint8Array(outputLength);
  let outputIndex = 0;

  for (let index = 0; index < normalized.length; index += 4) {
    const first = base64Value(normalized[index]);
    const second = base64Value(normalized[index + 1]);
    const third = normalized[index + 2] === "=" ? -1 : base64Value(normalized[index + 2]);
    const fourth = normalized[index + 3] === "=" ? -1 : base64Value(normalized[index + 3]);
    if (first < 0 || second < 0 || third < -1 || fourth < -1 || (third === -1 && fourth !== -1)) {
      throw new EncryptError("Invalid base64 RSA public key.", "INVALID_PUBLIC_KEY");
    }

    const combined =
      (first << 18) | (second << 12) | (Math.max(third, 0) << 6) | Math.max(fourth, 0);
    if (outputIndex < outputLength) output[outputIndex++] = (combined >> 16) & 0xff;
    if (outputIndex < outputLength) output[outputIndex++] = (combined >> 8) & 0xff;
    if (outputIndex < outputLength) output[outputIndex++] = combined & 0xff;
  }

  return output;
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : -1;
    const third = index + 2 < bytes.length ? bytes[index + 2] : -1;
    const combined = (first << 16) | (Math.max(second, 0) << 8) | Math.max(third, 0);
    output += BASE64_CHARS[(combined >> 18) & 0x3f];
    output += BASE64_CHARS[(combined >> 12) & 0x3f];
    output += second >= 0 ? BASE64_CHARS[(combined >> 6) & 0x3f] : "=";
    output += third >= 0 ? BASE64_CHARS[combined & 0x3f] : "=";
  }
  return output;
}

function bytesToHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function derLengthBytes(length: number): number[] {
  if (length < 0x80) return [length];
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

function containsRsaOid(der: Uint8Array): boolean {
  const limit = Math.min(der.length - RSA_OID_DER.length, 24);
  for (let offset = 0; offset <= limit; offset++) {
    if (RSA_OID_DER.every((byte, index) => der[offset + index] === byte)) return true;
  }
  return false;
}

function wrapPkcs1ToSpki(pkcs1Der: Uint8Array): Uint8Array {
  const bitStringBody = [0x00, ...pkcs1Der];
  const bitString = [0x03, ...derLengthBytes(bitStringBody.length), ...bitStringBody];
  const sequenceBody = [...RSA_ALGORITHM_IDENTIFIER_DER, ...bitString];
  return new Uint8Array([0x30, ...derLengthBytes(sequenceBody.length), ...sequenceBody]);
}

function pemToSpkiDer(publicKey: string): Uint8Array {
  const isPkcs1 = publicKey.includes(PKCS1_HEADER);
  const isSpki = publicKey.includes(SPKI_HEADER);
  if (!isPkcs1 && !isSpki) {
    const der = base64ToBytes(publicKey);
    return containsRsaOid(der) ? der : wrapPkcs1ToSpki(der);
  }
  const der = base64ToBytes(publicKey.replace(PEM_BLOCK_RE, ""));
  return isPkcs1 ? wrapPkcs1ToSpki(der) : der;
}

function toSpkiPem(publicKey: string): string {
  const der = pemToSpkiDer(publicKey);
  const body = bytesToBase64(der)
    .replace(/(.{64})/gu, "$1\n")
    .trimEnd();
  return `${SPKI_HEADER}\n${body}\n-----END PUBLIC KEY-----`;
}

function parseAlgorithmName(name: string | undefined, fallbackHash: EncryptHash): EncryptAlgorithm {
  if (!name) return { padding: "OAEP", hash: fallbackHash };
  const normalized = name.replace(/\s/gu, "").toUpperCase();
  if (normalized === "RSA/ECB/PKCS1PADDING") {
    return { padding: "PKCS1_V1_5", hash: fallbackHash };
  }
  if (normalized === "RSA/ECB/OAEPPADDING") {
    return { padding: "OAEP", hash: "SHA-1" };
  }
  const sha = normalized.match(/^RSA\/ECB\/OAEPWITHSHA[-_]?(1|256|384|512)ANDMGF1PADDING$/u)?.[1];
  const hashByName: Record<string, EncryptHash> = {
    "1": "SHA-1",
    "256": "SHA-256",
    "384": "SHA-384",
    "512": "SHA-512",
  };
  if (sha) return { padding: "OAEP", hash: hashByName[sha] };
  throw new EncryptError(`Unsupported RSA algorithm: ${name}`, "UNSUPPORTED_ALGORITHM");
}

function resolveSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.importKey !== "function" || typeof subtle.encrypt !== "function") {
    throw new EncryptError(
      "WebCrypto RSA encryption requires HTTPS or localhost.",
      "UNSUPPORTED_ENVIRONMENT",
    );
  }
  return subtle;
}

async function importRsaPublicKey(pem: string, hash: EncryptHash): Promise<CryptoKey> {
  try {
    return await resolveSubtleCrypto().importKey(
      "spki",
      pemToSpkiDer(pem) as BufferSource,
      { name: "RSA-OAEP", hash },
      false,
      ["encrypt"],
    );
  } catch (error) {
    throw new EncryptError("Failed to import RSA public key.", "INVALID_PUBLIC_KEY", error);
  }
}

function normalizePublicKey(result: unknown): EncryptPublicKeyInfo {
  if (typeof result === "string") {
    if (result.length === 0) {
      throw new EncryptError("Public key provider returned an empty key.", "INVALID_PUBLIC_KEY");
    }
    return { publicKey: result };
  }
  if (
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    !("publicKey" in result)
  ) {
    throw new EncryptError(
      "Public key provider returned an invalid response.",
      "INVALID_PUBLIC_KEY",
    );
  }
  const publicKey = result.publicKey;
  const algorithm = "algorithm" in result ? result.algorithm : undefined;
  if (typeof publicKey !== "string" || publicKey.length === 0) {
    throw new EncryptError("Public key provider returned an invalid key.", "INVALID_PUBLIC_KEY");
  }
  if (algorithm !== undefined && typeof algorithm !== "string") {
    throw new EncryptError(
      "Public key provider returned an invalid algorithm.",
      "INVALID_PUBLIC_KEY",
    );
  }
  return algorithm === undefined ? { publicKey } : { publicKey, algorithm };
}

export class RsaEncryptor {
  private readonly options: EncryptorOptions;
  private context: EncryptKeyContext | undefined;
  private contextPromise: Promise<EncryptKeyContext> | undefined;
  private generation = 0;

  constructor(options: EncryptorOptions) {
    if (!options.getPublicKey && options.publicKey === undefined) {
      throw new EncryptError("`getPublicKey` or `publicKey` is required.", "INVALID_OPTIONS");
    }
    this.options = options;
    if (!options.getPublicKey && options.publicKey !== undefined) {
      this.context = this.buildContext({ publicKey: options.publicKey });
    }
  }

  async encrypt(message: string, encoding: EncryptEncoding): Promise<string> {
    const context = await this.resolveContext();
    const data = TEXT_ENCODER.encode(message);
    const cipher =
      context.algorithm.padding === "OAEP"
        ? await this.encryptOaep(context, data)
        : this.encryptPkcs1(context.pem, data);
    return encoding === "hex" ? bytesToHex(cipher) : bytesToBase64(cipher);
  }

  async refreshPublicKey(): Promise<void> {
    this.generation++;
    this.context = undefined;
    this.contextPromise = undefined;
    if (this.options.getPublicKey) {
      await this.resolveContext();
    } else if (this.options.publicKey !== undefined) {
      this.context = this.buildContext({ publicKey: this.options.publicKey });
    }
  }

  private async encryptOaep(context: EncryptKeyContext, data: Uint8Array): Promise<Uint8Array> {
    context.oaepKey ??= await importRsaPublicKey(context.pem, context.algorithm.hash);
    try {
      const cipher = await resolveSubtleCrypto().encrypt(
        { name: "RSA-OAEP" },
        context.oaepKey,
        data as BufferSource,
      );
      return new Uint8Array(cipher);
    } catch (error) {
      throw new EncryptError("RSA-OAEP encryption failed.", "ENCRYPT_FAILED", error);
    }
  }

  private encryptPkcs1(publicKey: string, data: Uint8Array): Uint8Array {
    const message = TEXT_DECODER.decode(data);
    for (let index = 0; index < message.length; index++) {
      const codePoint = message.charCodeAt(index);
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
        throw new EncryptError(
          "PKCS#1 encryption does not support surrogate pairs.",
          "ENCRYPT_FAILED",
        );
      }
    }
    try {
      const encryptor = new JSEncrypt();
      encryptor.setPublicKey(publicKey);
      const cipher = encryptor.encrypt(message);
      if (cipher === false) throw new Error("Message is too long or the public key is invalid.");
      return base64ToBytes(cipher);
    } catch (error) {
      if (error instanceof EncryptError) throw error;
      throw new EncryptError("RSA PKCS#1 encryption failed.", "ENCRYPT_FAILED", error);
    }
  }

  private async resolveContext(): Promise<EncryptKeyContext> {
    if (this.context) return this.context;
    const generation = this.generation;
    const pending = this.contextPromise ?? this.fetchContext();
    this.contextPromise = pending;
    try {
      const context = await pending;
      if (this.generation === generation && this.contextPromise === pending) {
        this.context = context;
      }
      return context;
    } catch (error) {
      if (this.contextPromise === pending) this.contextPromise = undefined;
      throw error;
    }
  }

  private async fetchContext(): Promise<EncryptKeyContext> {
    if (!this.options.getPublicKey) {
      throw new EncryptError("No public key provider configured.", "NO_PUBLIC_KEY");
    }
    let result: unknown;
    try {
      result = await this.options.getPublicKey();
    } catch (error) {
      throw new EncryptError("Failed to fetch the RSA public key.", "NO_PUBLIC_KEY", error);
    }
    return this.buildContext(normalizePublicKey(result));
  }

  private buildContext(info: EncryptPublicKeyInfo): EncryptKeyContext {
    return {
      pem: toSpkiPem(info.publicKey),
      algorithm: parseAlgorithmName(
        info.algorithm ?? this.options.algorithm,
        this.options.hash ?? "SHA-256",
      ),
    };
  }
}
