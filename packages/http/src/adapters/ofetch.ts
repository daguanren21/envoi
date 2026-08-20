import type { Adapter, HttpRequest, HttpResponse } from "../types";

export interface OfetchAdapterOptions {
  retry?: number | false;
  retryDelay?: number;
  retryStatusCodes?: number[];
}

/** Minimal ofetch.raw surface. Optional peer — dynamic import on purpose. */
interface OfetchRawResult {
  status: number;
  statusText: string;
  headers: { forEach: (cb: (value: string, key: string) => void) => void };
  _data: unknown;
}

interface OfetchModule {
  ofetch: {
    raw: (request: string, options?: Record<string, unknown>) => Promise<OfetchRawResult>;
  };
}

/** Optional peer adapter. Common URL/headers/timeout come from createHttp. */
export function ofetchAdapter(options: OfetchAdapterOptions = {}): Adapter {
  return {
    name: "ofetch",
    async request(req: HttpRequest): Promise<HttpResponse> {
      // Dynamic import is intentional: axios/fetch users must not install the
      // optional ofetch peer merely by importing @envoijs/http.
      let mod: OfetchModule;
      try {
        mod = (await import("ofetch")) as unknown as OfetchModule;
      } catch {
        throw new Error("[envoi] adapter 'ofetch' requires the optional peer `ofetch`");
      }

      const res = await mod.ofetch.raw(req.url, {
        ...options,
        method: req.method,
        headers: req.headers,
        body: req.body,
        timeout: req.timeout,
        signal: req.signal,
        responseType: req.responseType,
        ignoreResponseError: true,
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: res.status,
        statusText: res.statusText,
        headers,
        body: res._data,
        raw: res,
      };
    },
  };
}
