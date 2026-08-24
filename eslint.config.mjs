import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scratch and harvest. `.data/` holds the embedded database, the server log, and the
    // third-party HTML/CSS/JS pulled down by scripts/harvest.mjs — including minified vendor
    // bundles, which linting reports 8,000 problems in. None of it is ours and none of it is
    // committed; it is in .gitignore for the same reason.
    ".data/**",
    "screenshots/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
