const js = require("@eslint/js");

/* 极简 lint：只开 recommended，抓未定义/未使用/语法陷阱；vendor 与产物不查 */
module.exports = [
  { ignores: ["vendor/**", "node_modules/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  {
    rules: { "no-empty": ["error", { allowEmptyCatch: true }] },
  },
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        window: "readonly", document: "readonly", echarts: "readonly",
        console: "readonly", sessionStorage: "readonly",
        setTimeout: "readonly", setInterval: "readonly",
        clearTimeout: "readonly", clearInterval: "readonly",
        fetch: "readonly", AbortController: "readonly",
      },
    },
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly", process: "readonly", URL: "readonly",
        window: "readonly", document: "readonly",
        setTimeout: "readonly",
      },
    },
  },
  {
    files: ["*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { console: "readonly", process: "readonly", URL: "readonly" },
    },
  },
];
