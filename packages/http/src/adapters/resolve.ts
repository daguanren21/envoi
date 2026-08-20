import type { Adapter, AdapterOption } from "../types";
import { axiosAdapter } from "./axios";
import { fetchAdapter } from "./fetch";
import { ofetchAdapter } from "./ofetch";

export function resolveAdapter(option: AdapterOption | undefined): Adapter {
  if (option && typeof option === "object") return option;
  const name = option ?? "axios";
  if (name === "axios") return axiosAdapter();
  if (name === "fetch") return fetchAdapter();
  if (name === "ofetch") return ofetchAdapter();
  throw new Error(`[envoi] unknown adapter '${String(name)}'`);
}
