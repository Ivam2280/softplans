import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "coverage/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["*.js", "scripts/**/*.{js,mjs}", "tests/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
];
