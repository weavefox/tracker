import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: '../out',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@weavefox/tracker': resolve(__dirname, '../src/index.ts')
    }
  },
  server: {
    port: 3000,
    open: true
  }
});