/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", ["http", "repo", "ci", "deps", "release", "docs", "brand"]],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
  },
};
