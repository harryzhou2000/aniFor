import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, ".", "").VITE_BASE || "/"
}));
