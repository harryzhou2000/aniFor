import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    modulePreload: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) return 'preload-helper';
        },
      },
    },
  },
});
