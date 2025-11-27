// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import eslintComments from "eslint-plugin-eslint-comments";

export default [
  // Ignore patterns
  {
    ignores: ["node_modules/**", "main.js", "__tests__/**", "*.test.ts", "esbuild.config.mjs", "version-bump.mjs", "vitest.config.ts"]
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript recommended rules (type-checked rules disabled for non-TS files)
  ...tseslint.configs.recommendedTypeChecked.map(config => ({
    ...config,
    files: ["**/*.ts"],
  })),

  // Project-specific configuration
  {
    files: ["**/*.ts"],
    plugins: {
      obsidianmd: obsidianmd,
      "eslint-comments": eslintComments,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        sourceType: "module"
      },
      globals: {
        console: "readonly",
        AsyncGenerator: "readonly",
        require: "readonly",
        process: "readonly",
        createEl: "readonly",
        join: "readonly",
        __dirname: "readonly",
        document: "readonly",
        window: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        NodeJS: "readonly",
        Fuzzysort: "readonly",
      }
    },
    rules: {
      // Obsidian plugin recommended rules
      ...obsidianmd.configs.recommended,

      // Enable additional TypeScript rules for PR issues
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-explicit-any": "error",

      // ESLint directive comment rules
      "eslint-comments/require-description": "error",
      "eslint-comments/no-unused-disable": "error",
      "eslint-comments/no-restricted-disable": [
        "error",
        "@typescript-eslint/no-explicit-any",
        "no-restricted-globals"
      ],

      // Console usage (allow warn, error, debug only)
      "no-console": ["error", { allow: ["warn", "error", "debug"] }],

      // Restricted globals
      // Note: fetch is intentionally not restricted here because this plugin legitimately needs
      // fetch for streaming and AbortSignal support, which requestUrl doesn't provide
      "no-restricted-globals": [
        "error",
        {
          name: "app",
          message: "Avoid using the global app object. Instead use the reference provided by your plugin instance.",
        },
        {
          name: "localStorage",
          message: "Prefer `App#saveLocalStorage` / `App#loadLocalStorage` functions to write / read localStorage data that's unique to a vault."
        }
      ],

      // Restricted imports
      "no-restricted-imports": [
        "error",
        {
          name: "axios",
          message: "Use the built-in `requestUrl` function instead of `axios`.",
        },
        {
          name: "superagent",
          message: "Use the built-in `requestUrl` function instead of `superagent`.",
        },
        {
          name: "got",
          message: "Use the built-in `requestUrl` function instead of `got`.",
        },
        {
          name: "node-fetch",
          message: "Use the built-in `requestUrl` function instead of `node-fetch`.",
        },
        {
          name: "moment",
          message: "The 'moment' package is bundled with Obsidian. Please import it from 'obsidian' instead.",
        },
      ],
    }
  }
];