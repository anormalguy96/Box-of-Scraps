import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(__dirname, "src/index.html"),
        neon: resolve(__dirname, "src/projects/neon-hand/index.html"),
        galaxy: resolve(__dirname, "src/projects/quantum-galaxy/index.html"),
        synth: resolve(__dirname, "src/projects/holo-synth/index.html"),
        airdeck: resolve(__dirname, "src/projects/airdeck/index.html"),
      },
    },
  },
});
