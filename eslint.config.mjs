import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "**/build/**",
      "lib/api-client-react/src/**",
      "lib/api-zod/src/**",
      "artifacts/sky-journal/server/**",
      "artifacts/sky-journal/scripts/**",
      ".local/**",
      "scripts/**",
      "**/*.js",
      "**/*.mjs",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "prefer-const": "warn",
      "no-empty": "warn",
      "@typescript-eslint/only-throw-error": "off",
    },
  },
);
