import { describe, expectTypeOf, it } from "vitest";
import {
  axiosAdapter,
  BizError,
  createHttp,
  createAxiosInstance,
  createMiddleware,
  fetchAdapter,
  mergeMiddleware,
  ofetchAdapter,
  type AxiosInstance,
  type DefaultEnvelope,
  type HttpHooks,
} from "../src";

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
    const instance = createAxiosInstance({ baseURL: "/api", withCredentials: true });
    expectTypeOf(instance).toEqualTypeOf<AxiosInstance>();
    expectTypeOf(axiosAdapter(instance).name).toEqualTypeOf<string>();
    expectTypeOf(fetchAdapter({ init: { credentials: "include" } }).name).toEqualTypeOf<string>();
    expectTypeOf(ofetchAdapter({ retry: 2, retryDelay: 100 }).name).toEqualTypeOf<string>();
  });

  it("types reusable middleware and classified response errors", () => {
    const middleware = createMiddleware({
      onResponseError: (ctx) => {
        expectTypeOf(ctx.error).toEqualTypeOf<Error>();
        expectTypeOf(ctx.response.status).toEqualTypeOf<number>();
        expectTypeOf(ctx.error).toMatchTypeOf<BizError | Error>();
      },
    });

    expectTypeOf(mergeMiddleware(middleware, undefined)).toEqualTypeOf<HttpHooks>();
  });
});
