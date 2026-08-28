import type { BatchFulfilment, ImportRowIssue } from '../types';
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
  issues: ImportRowIssue[];
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
  if (rows.length === 0) {
    return { items: [], issues: [{ row: 0, reason: 'File is empty' }], rowsParsed: 0 };
  }

  const header = rows[0].map((h) => h.trim());
  const colIndex: Record<string, number> = {};
  header.forEach((name, idx) => {
    if (!(name in colIndex)) colIndex[name] = idx;
  });

  const missing = REQUIRED_COLUMNS.filter((c) => !(c in colIndex));
  if (missing.length > 0) {
    return {
      items: [],
      issues: [
        {
          row: 0,
          reason: `Missing required column(s): ${missing.join(', ')} — is this a Shopify order export?`,
        },
      ],
      rowsParsed: 0,
    };
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

    const ctx = orderContext.get(orderName) ?? {
      email: null,
      collectorName: null,
      orderDate: null,
      country: null,
      shopifyTags: null,
    };
    if (emailRaw) ctx.email = emailRaw;
    const nameHere = billingName || shippingName;
    if (nameHere) ctx.collectorName = nameHere;
    if (createdAt) ctx.orderDate = createdAt;
    if (countryHere) ctx.country = countryHere;
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

  return { items, issues, rowsParsed: rows.length - 1 };
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
  if (matchers.length === 0) return { matched: items, filteredOut: 0 };
  const matched = items.filter((item) => {
    const title = item.lineItemTitle.toLowerCase();
    // Exact title, or "Title - Variant". A bare prefix match is not enough:
    // "Falling Light" must not claim "Falling Light Tote Bag".
    return matchers.some((m) => title === m || title.startsWith(`${m} - `));
  });
  return { matched, filteredOut: items.length - matched.length };
}

/** Dedupe key shared by the importer and the data layer. */
export function orderDedupeKey(shopifyOrderName: string, lineItemTitle: string): string {
  return `${shopifyOrderName.trim().toLowerCase()}::${lineItemTitle.trim().toLowerCase()}`;
}

/**
 * Which print flow a line item belongs to. Framed and unframed prints ship
 * on separate timelines (framing adds weeks and its own email), so print
 * imports route into a Framed or Unframed batch by variant. Anything that
 * doesn't say "framed" — including "Print Only" and blank variants — is
 * treated as unframed: no framing promise is safer than a wrong one.
 */
export function classifyFulfilment(variant: string): BatchFulfilment {
  return /framed/i.test(variant) && !/unframed/i.test(variant) ? 'framed' : 'unframed';
}
