import { defineConfig } from "vite";
import { resolve } from "path";

// Build core and react as separate library entries.
// React entry re-imports core modules, so shared code is duplicated
// between the two bundles — this is intentional for clean exports.
export default defineConfig({
  build: {
    lib: {
      entry: {
        "claws-sdk": resolve(__dirname, "src/index.ts"),
        "claws-sdk-react": resolve(__dirname, "src/react.ts"),
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "zod"],
      output: {
        globals: {
          react: "React",
          "react/jsx-runtime": "jsxRuntime",
          zod: "zod",
        },
        // Keep all shared code inlined into each entry
        inlineDynamicImports: false,
        chunkFileNames: "[name].[format].js",
      },
    },
    target: "es2022",
    minify: false,
    sourcemap: true,
  },
});
