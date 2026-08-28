import { readFileSync } from 'node:fs';
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

/**
 * Inter, inlined.
 *
 * `tokens.css` asks for `/fonts/InterVariable.woff2` by ABSOLUTE path, which is
 * the kit's own instruction and is right in a served app — Vite hands it
 * straight through from `public/`. In a single file there is no `public/` to
 * hand it through from, and the failure is silent: the type falls back to a
 * system face and, as the kit puts it, "every measurement in the system becomes
 * a measurement of a different font". The rows would still be 34px; nothing
 * else would be what it was drawn as.
 *
 * So the one absolute URL in the stylesheet becomes a data URI at build time.
 * Nothing else changes, and `tokens.css` stays exactly as the kit ships it.
 */
function inlineInter() {
  const FONT = 'public/fonts/InterVariable.woff2';
  const uri = `data:font/woff2;base64,${readFileSync(FONT).toString('base64')}`;
  let hit = false;
  return {
    name: 'inline-inter',
    enforce: 'post' as const,
    generateBundle(_options: unknown, bundle: Record<string, { type: string; source?: unknown }>) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || typeof file.source !== 'string') continue;
        if (!file.source.includes('/fonts/InterVariable.woff2')) continue;
        file.source = file.source.replaceAll('/fonts/InterVariable.woff2', uri);
        hit = true;
      }
    },
    closeBundle() {
      // A silent miss here is the whole fault this plugin exists to prevent.
      if (!hit) throw new Error('inline-inter: the font URL was never found in the built CSS');
    },
  };
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), inlineInter()],
  define: {
    'import.meta.env.VITE_HASH_ROUTER': JSON.stringify('1'),
  },
  build: {
    outDir: 'dist-artifact',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000,
  },
});
