import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "localhost",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true
      }
    }
  },
  preview: {
    host: "localhost",
    port: 3000
  }
});
