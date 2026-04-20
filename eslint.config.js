// eslint.config.js
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import globals from "globals";

export default defineConfig([
  {
    ignores: [
      "node_modules/**",
      "main.js",
      "eslint.config.js",
      "**/__tests__/**",
      "**/*.test.ts",
      "esbuild.config.mjs",
      "version-bump.mjs",
      "vitest.config.ts",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.ts"],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      obsidianmd.configs.recommended,
    ],
    plugins: {
      "@eslint-community/eslint-comments": eslintComments,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        createEl: "readonly",
        Fuzzysort: "readonly",
        AsyncGenerator: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-explicit-any": "error",

      "@eslint-community/eslint-comments/require-description": "error",
      "@eslint-community/eslint-comments/no-unused-disable": "error",
      "@eslint-community/eslint-comments/no-restricted-disable": [
        "error",
        "@typescript-eslint/no-explicit-any",
        "no-restricted-globals",
      ],

      "no-console": ["error", { allow: ["warn", "error", "debug"] }],

      "no-restricted-globals": [
        "error",
        { name: "app", message: "Avoid using the global app object. Instead use the reference provided by your plugin instance." },
        { name: "localStorage", message: "Prefer `App#saveLocalStorage` / `App#loadLocalStorage` functions to write / read localStorage data that's unique to a vault." },
      ],

      "no-restricted-imports": [
        "error",
        { name: "axios", message: "Use the built-in `requestUrl` function instead of `axios`." },
        { name: "superagent", message: "Use the built-in `requestUrl` function instead of `superagent`." },
        { name: "got", message: "Use the built-in `requestUrl` function instead of `got`." },
        { name: "node-fetch", message: "Use the built-in `requestUrl` function instead of `node-fetch`." },
        { name: "moment", message: "The 'moment' package is bundled with Obsidian. Please import it from 'obsidian' instead." },
      ],
    },
  },

  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
]);