import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  dts: { generator: "oxc" },
  outExtensions() {
    return { js: ".js" };
  },
  deps: { neverBundle: ["axios", "ofetch", "ufo"] },
});
