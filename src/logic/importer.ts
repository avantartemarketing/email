import type { BatchFulfilment, ImportRowIssue, ParseFault } from '../types';
import { parseCsv } from './csv';

/**
 * Shopify order-export parsing. Pure: CSV text in, structured line items and
 * issues out. Matching to a release, dedupe against existing orders, and
 * HubSpot contact resolution happen in the data layer, behind the same
 * interface a future Shopify API sync will implement.
 *
 * Export quirks this handles deliberately:
 *   - one row per line item; continuation rows of a multi-line-item order
 *     leave order-level columns (Email, Billing Name, ...) blank — those are
 *     carried forward from the order's first row;
 *   - collector names / line item titles containing commas and quotes;
 *   - missing emails (imported and flagged, never dropped);
 *   - files spanning multiple products (filtered later, per release).
 */

export interface ParsedLineItem {
  shopifyOrderName: string;
  lineItemTitle: string;
  variant: string;
  quantity: number;
  /** Line-level, so never carried forward. Blank in some exports. */
  sku: string | null;
  /** Order-level, so carried like Email — blank on a continuation row. Read,
      stored and reported; never acted on. Cancellations are marked by hand. */
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  email: string | null;
  collectorName: string;
  orderDate: string;
  /** Shipping country, falling back to billing. Order-level, so carried. */
  country: string | null;
  /** Shopify order tags. One comma-separated cell in the export. */
  shopifyTags: string[];
  /** 1-based data row (excluding header) for issue reporting. */
  row: number;
}

export interface ParseResult {
  items: ParsedLineItem[];
  /** Rows that could not be read. Per-ROW only — see `fault`. */
  issues: ImportRowIssue[];
  /**
   * Something wrong with the FILE, which is a different thing from something
   * wrong with a row in it and used to travel down the same channel.
   *
   * An empty file produced one pseudo-issue at row 0, which `ImportIssues`
   * drew as "1 row could not be read" over the body "Everything else was
   * imported." — a reassurance that is false in exactly the case where a
   * reassurance does damage. A fault is not a row and does not get counted
   * like one.
   */
  fault: ParseFault | null;
  rowsParsed: number;
}

const REQUIRED_COLUMNS = ['Name', 'Lineitem name'];

function col(row: Record<string, number>, cells: string[], name: string): string {
  const idx = row[name];
  return idx === undefined ? '' : (cells[idx] ?? '').trim();
}

/** "Falling Light - Framed" → { title: "Falling Light", variant: "Framed" }. */
export function splitLineItemTitle(lineItemTitle: string): { title: string; variant: string } {
  const sep = lineItemTitle.lastIndexOf(' - ');
  if (sep === -1) return { title: lineItemTitle.trim(), variant: '' };
  return {
    title: lineItemTitle.slice(0, sep).trim(),
    variant: lineItemTitle.slice(sep + 3).trim(),
  };
}

/** Shopify "2026-05-14 11:23:45 +0100" (or ISO) → "2026-05-14". */
function parseCreatedAt(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m ? m[1] : null;
}

export function parseShopifyOrderExport(csvText: string): ParseResult {
  const rows = parseCsv(csvText);
  const fault = (kind: ParseFault['kind'], detail: string, columnsFound?: string[]): ParseResult => ({
    items: [],
    issues: [],
    fault: { kind, detail, ...(columnsFound ? { columnsFound } : {}) },
    rowsParsed: Math.max(rows.length - 1, 0),
  });

  if (rows.length === 0 || (rows.length === 1 && rows[0].every((c) => !c.trim()))) {
    return fault('empty', 'Nothing was read, and nothing was created.');
  }

  const header = rows[0].map((h) => h.trim());
  const colIndex: Record<string, number> = {};
  header.forEach((name, idx) => {
    if (!(name in colIndex)) colIndex[name] = idx;
  });

  const missing = REQUIRED_COLUMNS.filter((c) => !(c in colIndex));
  if (missing.length > 0) {
    /* Diagnose on evidence rather than on the commonest guess. A genuine,
       unmodified Shopify export merely opened and re-saved in Excel under a
       European locale comes back semicolon-delimited: it parses as ONE column
       and lands here, and telling that operator "this is not an order export"
       sends them to the wrong door. If the header has no commas but does have
       a separator we recognise, say THAT. Otherwise say only what is true —
       these columns are missing — and name the columns found, which is what
       actually identifies the file they dropped by mistake. */
    const headerLine = header.join(',');
    const separator = header.length === 1 && /[;\t]/.test(headerLine)
      ? (headerLine.includes(';') ? 'semicolon' : 'tab')
      : null;
    if (separator) {
      return fault(
        'wrong_separator',
        separator === 'semicolon'
          ? 'Re-export from Shopify, or save it as CSV (comma-delimited).'
          : 'Re-export from Shopify as CSV rather than tab-separated.',
      );
    }
    return fault(
      'not_an_export',
      `No ${missing.join(' or ')} column.`,
      header.filter(Boolean),
    );
  }

  if (rows.length === 1) {
    return fault('no_rows', 'The columns are right and there are no rows under them.');
  }

  const items: ParsedLineItem[] = [];
  const issues: ImportRowIssue[] = [];

  // Order-level fields carried forward across continuation rows, keyed by order name.
  const orderContext = new Map<
    string,
    {
      email: string | null;
      collectorName: string | null;
      orderDate: string | null;
      country: string | null;
      shopifyTags: string[] | null;
      financialStatus: string | null;
      fulfillmentStatus: string | null;
    }
  >();
  let lastOrderName: string | null = null;

  rows.slice(1).forEach((cells, i) => {
    const rowNum = i + 1;
    let orderName = col(colIndex, cells, 'Name');
    if (!orderName) {
      // Continuation row with a blank Name column — belongs to the order above.
      if (!lastOrderName) {
        issues.push({ row: rowNum, reason: 'Row has no order name and no preceding order' });
        return;
      }
      orderName = lastOrderName;
    }
    lastOrderName = orderName;

    const lineItemTitle = col(colIndex, cells, 'Lineitem name');
    if (!lineItemTitle) {
      issues.push({ row: rowNum, reason: `Order ${orderName}: row has no line item name` });
      return;
    }

    const emailRaw = col(colIndex, cells, 'Email').toLowerCase();
    const billingName = col(colIndex, cells, 'Billing Name');
    const shippingName = col(colIndex, cells, 'Shipping Name');
    const createdAt = parseCreatedAt(col(colIndex, cells, 'Created at'));
    /* Country and tags are order-level like Email and Billing Name, so they
       are blank on a continuation row and carried forward the same way. Both
       columns are optional: an export cut down by hand may not have them, and
       an order with no tags is ordinary rather than a fault. */
    const countryHere =
      col(colIndex, cells, 'Shipping Country') || col(colIndex, cells, 'Billing Country');
    const tagsHere = col(colIndex, cells, 'Tags');
    /* Both order-level, so blank on a continuation row and carried exactly as
       Email is. Counted on the real Falling Light export: Financial Status is
       "paid" on 294 rows and blank on 2 — and the 2 ARE the continuation rows,
       so reading them without the carry-forward would store an empty status
       for the second line item of a two-item order. */
    const financialHere = col(colIndex, cells, 'Financial Status');
    const fulfillmentHere = col(colIndex, cells, 'Fulfillment Status');

    const ctx = orderContext.get(orderName) ?? {
      email: null,
      collectorName: null,
      orderDate: null,
      country: null,
      shopifyTags: null,
      financialStatus: null,
      fulfillmentStatus: null,
    };
    if (emailRaw) ctx.email = emailRaw;
    const nameHere = billingName || shippingName;
    if (nameHere) ctx.collectorName = nameHere;
    if (createdAt) ctx.orderDate = createdAt;
    if (countryHere) ctx.country = countryHere;
    if (financialHere) ctx.financialStatus = financialHere.toLowerCase();
    if (fulfillmentHere) ctx.fulfillmentStatus = fulfillmentHere.toLowerCase();
    if (tagsHere)
      ctx.shopifyTags = tagsHere
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    orderContext.set(orderName, ctx);

    const quantityRaw = col(colIndex, cells, 'Lineitem quantity');
    const quantity = quantityRaw ? Number.parseInt(quantityRaw, 10) : 1;

    const { variant } = splitLineItemTitle(lineItemTitle);

    items.push({
      shopifyOrderName: orderName,
      lineItemTitle,
      variant,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      sku: col(colIndex, cells, 'Lineitem sku') || null,
      financialStatus: ctx.financialStatus,
      fulfillmentStatus: ctx.fulfillmentStatus,
      email: ctx.email,
      collectorName: ctx.collectorName ?? '',
      orderDate: ctx.orderDate ?? '',
      country: ctx.country,
      shopifyTags: ctx.shopifyTags ?? [],
      row: rowNum,
    });
  });

  // Back-fill order context onto rows that appeared before the row carrying
  // the data (defensive — Shopify puts order fields on the first row, but a
  // hand-edited file might not).
  for (const item of items) {
    const ctx = orderContext.get(item.shopifyOrderName);
    if (!ctx) continue;
    if (!item.email && ctx.email) item.email = ctx.email;
    if (!item.collectorName && ctx.collectorName) item.collectorName = ctx.collectorName;
    if (!item.orderDate && ctx.orderDate) item.orderDate = ctx.orderDate;
    if (!item.country && ctx.country) item.country = ctx.country;
    if (!item.financialStatus && ctx.financialStatus) item.financialStatus = ctx.financialStatus;
    if (!item.fulfillmentStatus && ctx.fulfillmentStatus)
      item.fulfillmentStatus = ctx.fulfillmentStatus;
    if (item.shopifyTags.length === 0 && ctx.shopifyTags) item.shopifyTags = ctx.shopifyTags;
  }

  for (const item of items) {
    if (!item.collectorName) {
      item.collectorName = item.email ? item.email.split('@')[0] : 'Unknown collector';
    }
    if (!item.orderDate) {
      issues.push({
        row: item.row,
        reason: `Order ${item.shopifyOrderName}: missing or unparseable "Created at" date`,
      });
    }
  }

  return { items, issues, fault: null, rowsParsed: rows.length - 1 };
}

/**
 * Keep only line items belonging to the release: the line item title must
 * start with one of the matchers (case-insensitive). Shopify line item names
 * are "Product Title - Variant", so the release title is a prefix.
 */
export function filterItemsForRelease(
  items: ParsedLineItem[],
  titleMatchers: string[],
): { matched: ParsedLineItem[]; filteredOut: number } {
  const matchers = titleMatchers.map((m) => m.trim().toLowerCase()).filter(Boolean);
  /* No matchers claims NOTHING. It used to claim everything, which is safe
     only while the one caller always passes a title — and the moment a release
     can exist without a confirmed product match, "match everything" quietly
     welds another release's collectors into this one's plan, with a promise
     date and a printing email. An empty claim is a claim on nothing. */
  if (matchers.length === 0) return { matched: [], filteredOut: items.length };
  const matched = items.filter((item) => {
    const title = item.lineItemTitle.toLowerCase();
    /* Exact title, or "Title - Variant". A bare prefix match is not enough:
       "Night Garden" must not claim "Night Garden II".

       What this rule does NOT catch, measured 30 Aug 2026 rather than
       assumed: a second edition named with the separator — "Falling Light -
       Study" — IS claimed by "Falling Light", because it is indistinguishable
       from a variant. Punctuation cannot tell a variant from a sibling
       release, so nothing here can; the answer is for the operator to confirm
       which line-item titles a release claims, not for this to guess harder. */
    return matchers.some((m) => title === m || title.startsWith(`${m} - `));
  });
  return { matched, filteredOut: items.length - matched.length };
}

/** Dedupe key shared by the importer and the data layer. */
export function orderDedupeKey(shopifyOrderName: string, lineItemTitle: string): string {
  return `${shopifyOrderName.trim().toLowerCase()}::${lineItemTitle.trim().toLowerCase()}`;
}

/**
 * Which print flow a line item's own TITLE claims.
 *
 * Kept, and no longer the answer on its own. Measured against the first real
 * Shopify exports the project has seen — 3,668 orders across six releases,
 * 42% of them framed — this returns `unframed` for every single one of the
 * 1,760 frame line items in them, because a real Avant Arte line item reads
 * "Black Abachi Wood Frame - UV protective acrylic" and the word *framed*
 * never appears in the shop's vocabulary at all.
 *
 * So it is now the FALLBACK, under `isFrameLine`. It still earns its place:
 * a hand-written fixture, a re-export from another shop, or a title that does
 * say "Framed" is answered correctly and without a SKU.
 */
export function classifyFulfilment(variant: string): BatchFulfilment {
  return /framed/i.test(variant) && !/unframed/i.test(variant) ? 'framed' : 'unframed';
}

/**
 * Is this line item a FRAME rather than a print?
 *
 * The thing the tool had wrong. Framing is not a variant of the print — it is
 * its own line item on the same order, with its own SKU and its own price:
 *
 *     #82098  MURAK-FLOWE-PE-DRAW         Flowers of Heaven, 2018 - Draw
 *     #82098  MURAK-FLOWE-FR-WHITEABACH   Flowers of Heaven, 2018 - White Abachi wood frame - …
 *
 * The SKU is the reliable half: segment three is `FR` for a frame and `PE` or
 * `TL` for a print, across all six releases on file. The title fallback is for
 * an export with no SKU column, and is deliberately narrow — it wants the word
 * as its own token, so "Framed" (a print variant that says its own fulfilment)
 * is not mistaken for a frame line.
 */
export function isFrameLine(item: { lineItemTitle: string; sku?: string | null }): boolean {
  const kind = skuSegment(item.sku, 2);
  /* The THIRD segment, not any segment. `FL-FR` in a two-part hand-written SKU
     is a framed PRINT, not a frame line, and a looser `-FR` test read every
     one of them as a frame and emptied the fixture's framed batch. */
  if (kind) return kind === 'FR';
  return /\bframe\b/i.test(item.lineItemTitle);
}

/** One zero-based dash segment of a SKU, upper-cased. Null unless the SKU has
    the full `ARTIST-ARTWORK-KIND-…` shape, so a short SKU never answers. */
function skuSegment(sku: string | null | undefined, index: number): string | null {
  if (!sku) return null;
  const parts = sku.split('-');
  return parts.length >= 3 ? (parts[index]?.toUpperCase() ?? null) : null;
}

/**
 * `ARTIST-ARTWORK` from a SKU — what a print line and its frame line share.
 *
 * Preferred over the title for the join, and measurably so: on the Ai Weiwei
 * export, joining on the title leaves four frames unmatched and joining on the
 * art code leaves two. The two it recovers are Albers frames whose line-item
 * name differs from the print's by one comma —
 * "Homage to the Square (Red)" against "Homage to the Square, (Red)".
 *
 * Null when the SKU cannot supply one, which is what the title fallback in
 * `artworkKeyOf` is for. This reads a naming convention nobody in this repo
 * controls, so it is never the only way to join.
 */
export function artCodeOf(sku: string | null | undefined): string | null {
  if (!sku) return null;
  const parts = sku.split('-');
  return parts.length >= 3 ? parts.slice(0, 2).join('-').toUpperCase() : null;
}
