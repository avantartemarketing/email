import { readFileSync, writeFileSync } from 'node:fs';
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
  const OUT = 'dist-artifact/index.html';
  return {
    name: 'inline-inter',
    /* On the WRITTEN file, not on the bundle.
       In the bundle the stylesheet exists twice by this point: the CSS asset,
       and the copy `vite-plugin-singlefile` has already inlined into the HTML.
       Rewriting the bundle hit the asset — which by then nothing referenced —
       and left the HTML asking for `/fonts/InterVariable.woff2`, a path that
       does not exist inside a single file. The build reported success and the
       page rendered in a system face, which is the silent failure the kit
       names: "every measurement in the system becomes a measurement of a
       different font". Found on 28 Aug 2026 by opening the built file and
       asking `document.fonts.check`. There is only one file at this point, so
       there is nothing left to patch the wrong copy of. */
    closeBundle() {
      const uri = `data:font/woff2;base64,${readFileSync(FONT).toString('base64')}`;
      const html = readFileSync(OUT, 'utf8');
      /* The WHOLE url, leading `./` included. Vite rewrites the stylesheet's
         absolute `/fonts/...` to a relative `./fonts/...` on the way out, so
         replacing the absolute form alone left the dot in front of the data
         URI — `url(.data:font/woff2;...)`, which is not a URL. The build
         succeeded, the file was the right size, and the page rendered in a
         system face. Found 28 Aug 2026 the same way as the first miss: by
         opening the built file and asking. */
      const url = /\.?\/fonts\/InterVariable\.woff2/g;
      if (!url.test(html)) throw new Error(`inline-inter: no font URL to replace in ${OUT}`);
      url.lastIndex = 0;
      const patched = html.replace(url, uri);
      if (patched.includes('/fonts/InterVariable.woff2')) {
        throw new Error('inline-inter: a font URL survived the replacement');
      }
      writeFileSync(OUT, patched);
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
