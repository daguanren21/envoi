import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: { generator: "oxc" },
  outExtensions({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
  deps: { neverBundle: ["axios", "ofetch", "ufo"] },
});
