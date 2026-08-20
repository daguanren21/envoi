import { describe, expectTypeOf, it } from "vitest";
import { axiosAdapter } from "../src/adapters/axios";
import { fetchAdapter } from "../src/adapters/fetch";
import { ofetchAdapter } from "../src/adapters/ofetch";
import { createHttp } from "../src/create-http";
import type { DefaultEnvelope } from "../src/types";

interface User {
  id: number;
  name: string;
}

describe("public type contracts", () => {
  it("types envelope<TData>() as the complete default packet", () => {
    const http = createHttp();

    function assertTypes(): void {
      const packet = http.envelope<User>("/users/1");
      expectTypeOf(packet).toEqualTypeOf<Promise<DefaultEnvelope<User>>>();
    }

    expectTypeOf(assertTypes).toBeFunction();
  });

  it("provides typed native adapter options", () => {
    expectTypeOf(axiosAdapter({ withCredentials: true }).name).toEqualTypeOf<string>();
    expectTypeOf(fetchAdapter({ init: { credentials: "include" } }).name).toEqualTypeOf<string>();
    expectTypeOf(ofetchAdapter({ retry: 2, retryDelay: 100 }).name).toEqualTypeOf<string>();
  });
});
