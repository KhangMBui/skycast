import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/windborne": {
        target: "https://a.windbornesystems.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/windborne/, ""),
      },
    },
  },
  plugins: [react()],
});
