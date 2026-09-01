import type { FileProduct } from './intake';
import { productKeyOf } from './intake';
import { artCodeOf } from './importer';

/**
 * Artworks — the concept the tool was missing, and the one the whole
 * edition-allocation workbook turns on.
 *
 * The tool modelled *release → order*. A release is really *release → artwork →
 * SKU → order line*: Ai Weiwei's "Guardian" is one release of three colourways,
 * Murakami's is one release of four prints, and a collector may buy several in
 * one order. Without the middle level the add-a-release flow proposed
 * "Guardian (Purple)" as the release title and then REFUSED to create it,
 * because Purple and Green read as two products that "cannot share a release".
 *
 * ## What groups a line item into an artwork
 *
 * The SKU's art code — `AWEI1-GUARP` — which is exactly what the workbook's
 * `Codes` tab is trying to derive, except it derives it by splitting a product
 * TITLE on commas and so invents an artwork called "2018". Reading the code the
 * shop already assigns needs no guessing at all.
 *
 * ## And what proposes a release
 *
 * The ARTIST half of that code. Measured on the real Guardian export: 1,067
 * print lines under `AWEI1` in three artworks, two stray `JALBE` lines and one
 * `ANTON` line riding along on shared orders. Proposing the lead artwork's
 * artist gives precisely the release and drops the hitchhikers — and it is a
 * fact the file states rather than a similarity between strings.
 *
 * Everything here is pure and everything it proposes is a PROPOSAL. An artwork
 * only exists once a person has ticked it, which is the rule that makes a
 * phantom impossible rather than merely unlikely.
 */

/** One artwork in a file: its print lines, its frame lines, its counts. */
export interface FileArtwork {
  /** Join key — the SKU art code where there is one, else the product key. */
  key: string;
  /** What it is called. The commonest product key among its PRINT lines. */
  name: string;
  /** `AWEI1`. Null when the file carries no usable SKUs. */
  artistCode: string | null;
  /** Every line-item title that belongs to it, prints and frames alike. */
  lineItemTitles: string[];
  printLines: number;
  frameLines: number;
  /** DISTINCT Shopify orders. Never summed across artworks — one order can
      buy several, so the column totals more than the file's own orders. */
  shopifyOrders: number;
  skus: string[];
}

/** `AWEI1` from `AWEI1-GUARP-FR-WHITERAMIN`. Null unless the SKU has the shape. */
export function artistCodeOf(sku: string | null | undefined): string | null {
  const code = artCodeOf(sku);
  return code ? (code.split('-')[0] ?? null) : null;
}

/**
 * The artworks a file contains, biggest first.
 *
 * A frame line joins the artwork it frames rather than becoming one of its own,
 * so "Guardian (Purple) - Purple Ramin Wood Frame" is not a fifth Guardian.
 */
export function artworksInFile(products: FileProduct[]): FileArtwork[] {
  const byKey = new Map<
    string,
    {
      titles: string[];
      printKeys: string[];
      artistCodes: Set<string>;
      printLines: number;
      frameLines: number;
      orders: number;
      skus: Set<string>;
    }
  >();

  for (const p of products) {
    /* The art code is preferred, and the product key is the fallback for a
       file with no SKU column. A frame with no SKU falls back to the product
       key too, which is why `productKeyOf` reads the FIRST " - " segment —
       print and frame share it. */
    const key = (p.skus.map(artCodeOf).find(Boolean) as string | undefined) ?? productKeyOf(p.lineItemTitle);
    const entry = byKey.get(key) ?? {
      titles: [],
      printKeys: [],
      artistCodes: new Set<string>(),
      printLines: 0,
      frameLines: 0,
      orders: 0,
      skus: new Set<string>(),
    };
    entry.titles.push(p.lineItemTitle);
    if (p.isFrame) entry.frameLines += p.lines;
    else {
      entry.printLines += p.lines;
      entry.printKeys.push(productKeyOf(p.lineItemTitle));
    }
    /* An upper bound, not a sum: `shopifyOrders` is distinct per TITLE and two
       titles of one artwork can share an order. The screen states the file's
       own order total separately, which is the number that is true. */
    entry.orders = Math.max(entry.orders, p.shopifyOrders);
    for (const sku of p.skus) {
      entry.skus.add(sku);
      const artist = artistCodeOf(sku);
      if (artist) entry.artistCodes.add(artist);
    }
    byKey.set(key, entry);
  }

  return [...byKey.entries()]
    .map(([key, e]): FileArtwork => ({
      key,
      name: commonest(e.printKeys) ?? commonest(e.titles.map(productKeyOf)) ?? key,
      /* Only when the artwork is unambiguous about it. A SKU block that spans
         two artist codes identifies neither, and must not seed a proposal. */
      artistCode: e.artistCodes.size === 1 ? [...e.artistCodes][0] : null,
      lineItemTitles: [...e.titles].sort(),
      printLines: e.printLines,
      frameLines: e.frameLines,
      shopifyOrders: e.orders,
      skus: [...e.skus].sort(),
    }))
    .sort((a, b) => b.printLines - a.printLines || a.name.localeCompare(b.name));
}

/**
 * The artworks worth proposing: the lead artwork's, and everything by the same
 * artist.
 *
 * Where the file states no artist code, only the lead is proposed. Ticking the
 * rest is then a deliberate act — which is the right cost, because the only
 * alternative is guessing from a shared prefix, and a shared prefix is exactly
 * what put "2018" in a warehouse pick-list.
 */
export function proposeArtworks(artworks: FileArtwork[]): FileArtwork[] {
  /* Only artworks with a PRINT. A frame whose print is somewhere else is a
     stray, not an artwork of this release — proposing it put a frame-only row
     in the claim and, because it shares nothing with the real artwork names,
     left the release with no title it could derive. */
  const real = artworks.filter((a) => a.printLines > 0);
  const lead = real[0];
  if (!lead) return [];
  if (!lead.artistCode) return [lead];
  return real.filter((a) => a.artistCode === lead.artistCode);
}

/**
 * What to call a release of these artworks.
 *
 * One artwork names itself. Several name the release by what they share —
 * "Guardian (Blue)", "(Green)" and "(Purple)" are a release called *Guardian* —
 * trimmed back to a word boundary so the field never offers "Guardian (".
 * Artworks that share nothing get no proposal at all: the operator names it,
 * and an empty title already stops the primary with a reason.
 */
export function releaseTitleFor(artworks: FileArtwork[]): string {
  const names = artworks.map((a) => a.name).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];

  let prefix = names[0];
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i += 1;
    prefix = prefix.slice(0, i);
  }
  /* Back off to a boundary that is a boundary in EVERY name, then trim the
     punctuation that led up to it.
     Caught on a render before it was ever tried on purpose: "Harbour Light
     (Dawn)" and "Harbour Light (Dusk)" share the prefix "Harbour Light (D",
     because both colourways happen to begin with a D. Stopping at the last
     whole word is not enough either — the fragment has to be one nobody's name
     continues through. */
  let cut = prefix.length;
  while (cut > 0) {
    const onBoundary = names.every((n) => cut >= n.length || !/[\p{L}\p{N}]/u.test(n[cut]));
    if (onBoundary && /[\p{L}\p{N})\]]$/u.test(prefix.slice(0, cut))) break;
    cut -= 1;
  }
  const title = prefix.slice(0, cut).replace(/[\s(,\-–—[:;]+$/u, '').trim();
  /* A single letter is not a name. Better to propose nothing and let the empty
     title stop the primary with a reason than to offer a confident wrong one. */
  return title.length >= 2 ? title : '';
}

function commonest(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}
