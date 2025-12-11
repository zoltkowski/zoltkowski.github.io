import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
   server: {
    proxy: {
      "/api": {
        target: "http://localhost:8788",
        changeOrigin: true
      }
    }
  }
});
