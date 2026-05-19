import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const WORKSPACE_PACKAGES = ["@elevator/shared", "@elevator/data"];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    build: {
      rollupOptions: {
        external: [/^@libsql\//, /^drizzle-orm/]
      }
    },
    resolve: {
      alias: {
        "@main": resolve("src/main"),
        "@elevator/shared": resolve("../../packages/shared/src/index.ts"),
        "@elevator/data": resolve("../../packages/data/src/index.ts")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_PACKAGES })],
    resolve: {
      alias: {
        "@preload": resolve("src/preload"),
        "@elevator/shared": resolve("../../packages/shared/src/index.ts")
      }
    }
  },
  renderer: {
    root: resolve("src/renderer"),
    plugins: [react()],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@elevator/shared": resolve("../../packages/shared/src/index.ts")
      }
    }
  }
});

