import { describe, expect, test, vi } from "vitest";
import { create as createAxios, type AxiosAdapter } from "axios";
import type { KeyObject } from "node:crypto";
import { Buffer } from "node:buffer";
import { constants, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { installPlugins } from "../../src/install-plugins";
import { encrypt, EncryptError, refreshEncryptPublicKey } from "../../src/plugins/encrypt";

const PUBLIC_KEY_URL = "/api/rsa/public-key";

interface RsaKeyPair {
  publicKey: string;
  privateKey: KeyObject;
}

interface CapturedRequestData {
  [field: string]: unknown;
}

type PublicKeyResponder = () => unknown | Promise<unknown>;

function createKeyPair(): RsaKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    publicKey: publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKey,
  };
}

function createAdapter(
  publicKeyResponse: unknown | PublicKeyResponder,
  captured: CapturedRequestData[] = [],
): AxiosAdapter {
  return async (config) => {
    if (config.url === PUBLIC_KEY_URL) {
      const data =
        typeof publicKeyResponse === "function" ? await publicKeyResponse() : publicKeyResponse;
      return { data, status: 200, statusText: "OK", headers: {}, config };
    }
    const data: unknown = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Expected serialized object request data.");
    }
    captured.push(data as CapturedRequestData);
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
}

function decryptOaep(
  privateKey: KeyObject,
  cipher: string,
  encoding: BufferEncoding = "base64",
): string {
  return privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(cipher, encoding),
  ).toString("utf8");
}

function decryptPkcs1(privateKey: KeyObject, cipher: string): string {
  return privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(cipher, "base64"),
  ).toString("utf8");
}

function readCipher(data: CapturedRequestData, field: string): string {
  const cipher = data[field];
  if (typeof cipher !== "string") throw new Error(`Expected encrypted field "${field}".`);
  return cipher;
}

describe("encrypt plugin", () => {
  test("automatically encrypts matching global fields without mutating caller data", async () => {
    const keys = createKeyPair();
    const captured: CapturedRequestData[] = [];
    const request = createAxios({ adapter: createAdapter(keys.publicKey, captured) });
    installPlugins(request, [encrypt({ fields: ["password"] })]);
    const data = { account: "user", password: "secret" };

    await request.post("/login", data);
    await request.post("/debug-login", { password: "plain" }, { encrypt: false });

    expect(data).toEqual({ account: "user", password: "secret" });
    expect(captured[0].account).toBe("user");
    expect(decryptOaep(keys.privateKey, readCipher(captured[0], "password"))).toBe("secret");
    expect(captured[1]).toEqual({ password: "plain" });
  });

  test("skips global encryption and key loading when no configured field is present", async () => {
    const keys = createKeyPair();
    const captured: CapturedRequestData[] = [];
    const publicKeyResponse = vi.fn(async () => keys.publicKey);
    const request = createAxios({ adapter: createAdapter(publicKeyResponse, captured) });
    installPlugins(request, [encrypt({ fields: ["password"] })]);

    await request.post("/profile", { displayName: "demo" });

    expect(publicKeyResponse).not.toHaveBeenCalled();
    expect(captured[0]).toEqual({ displayName: "demo" });
  });

  test("request fields replace global fields while inheriting global encoding", async () => {
    const keys = createKeyPair();
    const captured: CapturedRequestData[] = [];
    const request = createAxios({ adapter: createAdapter(keys.publicKey, captured) });
    installPlugins(request, [encrypt({ encoding: "hex", fields: ["password"] })]);

    await request.post(
      "/payment",
      { password: "plain", cvv: "123" },
      {
        encrypt: ["cvv"],
      },
    );

    expect(captured[0].password).toBe("plain");
    expect(readCipher(captured[0], "cvv")).toMatch(/^[0-9a-f]+$/);
    expect(decryptOaep(keys.privateKey, readCipher(captured[0], "cvv"), "hex")).toBe("123");
  });

  test("applies the plugin encoding default, request overrides, key caching, and refresh", async () => {
    const keys = createKeyPair();
    const captured: CapturedRequestData[] = [];
    const publicKeyResponse = vi.fn(async () => keys.publicKey);
    const request = createAxios({ adapter: createAdapter(publicKeyResponse, captured) });
    installPlugins(request, [encrypt({ encoding: "hex", fields: ["pin"] })]);

    await request.post("/first", { pin: "1234" });
    await request.post("/second", { pin: "5678" });
    await refreshEncryptPublicKey(request);
    await request.post(
      "/third",
      { pin: "9012" },
      { encrypt: { fields: ["pin"], encoding: "base64" } },
    );

    expect(publicKeyResponse).toHaveBeenCalledTimes(2);
    expect(decryptOaep(keys.privateKey, readCipher(captured[0], "pin"), "hex")).toBe("1234");
    expect(decryptOaep(keys.privateKey, readCipher(captured[1], "pin"), "hex")).toBe("5678");
    expect(decryptOaep(keys.privateKey, readCipher(captured[2], "pin"))).toBe("9012");
  });

  test("accepts the zero-argument factory and stays inactive without global or request fields", async () => {
    const keys = createKeyPair();
    const captured: CapturedRequestData[] = [];
    const publicKeyResponse = vi.fn(async () => keys.publicKey);
    const request = createAxios({ adapter: createAdapter(publicKeyResponse, captured) });
    installPlugins(request, [encrypt]);

    await request.post("/plain", { password: "plain" });

    expect(publicKeyResponse).not.toHaveBeenCalled();
    expect(captured[0]).toEqual({ password: "plain" });
  });

  test("rejects missing fields and non-object request data before sending", async () => {
    const keys = createKeyPair();
    const adapter = vi.fn(createAdapter(keys.publicKey));
    const request = createAxios({ adapter });
    installPlugins(request, [encrypt({})]);

    await expect(
      request.post("/missing", { account: "user" }, { encrypt: ["password"] }),
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST_DATA",
    } satisfies Partial<EncryptError>);
    await expect(
      request.post("/string", "secret", { encrypt: ["password"] }),
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST_DATA",
    } satisfies Partial<EncryptError>);
    expect(adapter).not.toHaveBeenCalled();
  });

  test.each([null, [], { publicKey: "key", algorithm: 42 }])(
    "wraps invalid public key response %# as INVALID_PUBLIC_KEY",
    async (response) => {
      const request = createAxios({ adapter: createAdapter(response) });
      installPlugins(request, [encrypt({})]);

      await expect(
        request.post("/login", { password: "secret" }, { encrypt: ["password"] }),
      ).rejects.toMatchObject({
        code: "INVALID_PUBLIC_KEY",
      } satisfies Partial<EncryptError>);
    },
  );

  test("wraps public key request failures as NO_PUBLIC_KEY", async () => {
    const request = createAxios({
      adapter: createAdapter(() => {
        throw new Error("network down");
      }),
    });
    installPlugins(request, [encrypt({})]);

    await expect(
      request.post("/login", { password: "secret" }, { encrypt: ["password"] }),
    ).rejects.toMatchObject({
      code: "NO_PUBLIC_KEY",
    } satisfies Partial<EncryptError>);
  });

  test("rejects explicit unsupported OAEP hashes instead of downgrading", async () => {
    const keys = createKeyPair();
    const request = createAxios({
      adapter: createAdapter({
        publicKey: keys.publicKey,
        algorithm: "RSA/ECB/OAEPWithSHA-224AndMGF1Padding",
      }),
    });
    installPlugins(request, [encrypt({})]);

    await expect(
      request.post("/login", { password: "secret" }, { encrypt: ["password"] }),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_ALGORITHM",
    } satisfies Partial<EncryptError>);
  });

  test("does not let an older in-flight key request overwrite a refreshed key", async () => {
    const oldKeys = createKeyPair();
    const newKeys = createKeyPair();
    const captured: CapturedRequestData[] = [];
    const keyResolvers: Array<(value: unknown) => void> = [];
    const request = createAxios({
      adapter: createAdapter(() => {
        const { promise, resolve } = Promise.withResolvers<unknown>();
        keyResolvers.push(resolve);
        return promise;
      }, captured),
    });
    installPlugins(request, [encrypt({})]);

    const oldRequest = request.post("/old", { password: "old" }, { encrypt: ["password"] });
    await vi.waitFor(() => expect(keyResolvers).toHaveLength(1));
    const refresh = refreshEncryptPublicKey(request);
    await vi.waitFor(() => expect(keyResolvers).toHaveLength(2));
    keyResolvers[1](newKeys.publicKey);
    await refresh;
    keyResolvers[0](oldKeys.publicKey);
    await oldRequest;
    await request.post("/after-refresh", { password: "new" }, { encrypt: ["password"] });

    expect(decryptOaep(newKeys.privateKey, readCipher(captured[1], "password"))).toBe("new");
  });

  test("supports Java RSA/ECB/PKCS1Padding without consumer providers", async () => {
    const keys = createKeyPair();
    const captured: CapturedRequestData[] = [];
    const request = createAxios({
      adapter: createAdapter(
        {
          publicKey: keys.publicKey,
          algorithm: "RSA/ECB/PKCS1Padding",
        },
        captured,
      ),
    });
    installPlugins(request, [encrypt({})]);

    await request.post("/login", { password: "secret" }, { encrypt: ["password"] });

    expect(decryptPkcs1(keys.privateKey, readCipher(captured[0], "password"))).toBe("secret");
  });
});
