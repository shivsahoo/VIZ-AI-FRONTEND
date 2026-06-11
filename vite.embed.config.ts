import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

/**
 * Standalone embed bundle — outputs to backend static dir for /api/v1/embed/assets.
 * Run: npm run build:embed
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../Viz-AI-Backend/app/static/embed"),
    emptyOutDir: true,
    manifest: false,
    rollupOptions: {
      input: path.resolve(__dirname, "embed.html"),
      output: {
        entryFileNames: "embed.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "embed.css";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
