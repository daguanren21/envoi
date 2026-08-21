import type { Adapter, AdapterOption } from "../types";
import { axiosAdapter } from "./axios";
import { fetchAdapter } from "./fetch";
import { ofetchAdapter } from "./ofetch";

export function resolveAdapter(option: AdapterOption): Adapter {
  if (option && typeof option === "object") return option;
  if (option === "axios") return axiosAdapter();
  if (option === "fetch") return fetchAdapter();
  if (option === "ofetch") return ofetchAdapter();
  throw new Error(`[envoi] unknown adapter '${String(option)}'`);
}
