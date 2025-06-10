import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // 🔹 Hace que las rutas sean relativas en producción
  plugins: [react()],
  server: {
    port: 3001, 
    proxy: {
      "/api": {
        target: "http://localhost:5000", 
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
