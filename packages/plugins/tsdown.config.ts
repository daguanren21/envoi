import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "neutral",
  target: "es2020",
  clean: true,
  sourcemap: true,
  dts: {
    generator: "oxc",
    sourcemap: true,
  },
  outExtensions() {
    return { js: ".js" };
  },
  deps: {
    neverBundle: true,
    alwaysBundle: ["jsencrypt"],
    onlyBundle: ["jsencrypt"],
  },
});
