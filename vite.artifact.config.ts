import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Single-file build for sharing the prototype as a clickable HTML artifact:
 * everything (JS, CSS, fonts) inlined into one dist-artifact/index.html.
 * Uses hash routing since there is no server behind the file.
 *
 *   npm run build:artifact
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    'import.meta.env.VITE_HASH_ROUTER': JSON.stringify('1'),
  },
  build: {
    outDir: 'dist-artifact',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000,
  },
});
