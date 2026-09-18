import { defineConfig } from "vite";

// The root game is deployed at the site root. Local dev and preview use the
// same asset base, which keeps generated URLs consistent across environments.
export default defineConfig({
  base: "/",
  build: {
    target: "esnext",
  },
  server: {
    port: 5173,
  },
});
