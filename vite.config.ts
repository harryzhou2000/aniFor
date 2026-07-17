import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, ".", "").VITE_BASE || "/",
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "tools/**",
      "vendor/**",
      "build/**",
      ".cache/**",
      "spikes/**"
    ]
  }
}));
