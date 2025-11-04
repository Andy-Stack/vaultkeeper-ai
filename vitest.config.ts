import { defineConfig } from "vitest/config";
import * as path from "path-browserify";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [],
	resolve: {
		alias: {
			"obsidian": path.resolve(__dirname, "__mocks__/obsidian.ts"),
			// Support TypeScript path mapping from tsconfig
			"Helpers": path.resolve(__dirname, "Helpers"),
			"Enums": path.resolve(__dirname, "Enums"),
			"Services": path.resolve(__dirname, "Services"),
			"Conversations": path.resolve(__dirname, "Conversations"),
			"AIClasses": path.resolve(__dirname, "AIClasses"),
			"Components": path.resolve(__dirname, "Components"),
			"Stores": path.resolve(__dirname, "Stores"),
			"Views": path.resolve(__dirname, "Views"),
			"Modals": path.resolve(__dirname, "Modals")
		}
	},
	test: {
		// Use happy-dom for faster DOM simulation
		environment: "happy-dom",

		// Test file patterns
		include: ["__tests__/**/*.{test,spec}.{js,ts}"],

		// Setup files to run before each test file
		setupFiles: ["__tests__/setup.ts"],

		// Coverage configuration
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: [
				"Services/**/*.ts",
				"AIClasses/**/*.ts",
				"Helpers/**/*.ts",
				"Conversations/**/*.ts",
				"Components/**/*.svelte",
				"Enums/**/*.ts",
				"Stores/**/*.ts"
			],
			exclude: [
				"**/*.test.ts",
				"**/*.spec.ts",
				"node_modules/**",
				"__tests__/**",
				"main.ts",
				"Views/**",
				"Modals/**"
			],
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 65,
				statements: 70
			}
		},

		// Global test timeout (10 seconds for most tests)
		testTimeout: 10000,

		// Enable global test APIs (describe, it, expect, etc.) without imports
		globals: true,

		// Clear mocks between tests
		clearMocks: true,

		// Restore mocks between tests
		restoreMocks: true,

		// Mock reset between tests
		mockReset: true
	}
});
