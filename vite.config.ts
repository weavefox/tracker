import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WFTK',
      fileName: 'tracer',
      formats: ['umd', 'es', 'cjs']
    },
    rollupOptions: {
      output: {
        globals: {
          // UMD 模式下不需要 external
        }
      }
    },
    sourcemap: true,
    minify: 'esbuild'
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
});