import type {
  BatchFulfilment,
  IntakeNote,
  Order,
  ProductKind,
  ProductMatch,
} from '../types';
import type { ParsedLineItem } from './importer';
import { classifyFulfilment, orderDedupeKey, splitLineItemTitle } from './importer';

/**
 * Reading a Shopify export as a set of PRODUCTS, and reconciling it against
 * what a release already has.
 *
 * The owner, 30 Aug 2026: *"Design the flow for adding a new release to the
 * dashboard. Medium term this will be through a sync with Shopify, but in the
 * short term it will be a CSV download from Shopify per release of all the
 * Orders."*
 *
 * The flow that answers it inverts the old one. Nobody types a release title
 * that must secretly equal the Shopify product title: the file is read first,
 * the products in it are listed, and the operator TICKS which ones are this
 * release. The ticked strings become the stored match — so the string that has
 * to be exactly right is one nobody typed, and it is the same string the sync
 * will match on later.
 *
 * Everything here is pure. It takes parsed line items and existing orders and
 * returns what would happen; the data layer decides to do it. That is what
 * makes the preview and the write agree by construction — they run the same
 * functions over the same array.
 *
 * ## Three reads of one string, and why they are three
 *
 * A line-item title is asked three different questions, and one function
 * answering all three is how an oak-framed print ended up on the unframed
 * timeline:
 *
 *   - **Display** — `splitLineItemTitle`, unchanged. Everything after the last
 *     " - " is the variant, which is right for a name and nothing hangs off it.
 *   - **Grouping**, and the one-release guard — the FIRST " - " segment.
 *     "Falling Light - Framed" and "Falling Light - Framed - Oak" are one
 *     product; "Night Garden - Framed" is not.
 *   - **Batch routing** — `classifyFulfilment` over the WHOLE title, so a
 *     frame finish in the last segment cannot hide the word "framed".
 */

/** What the grouping and the one-release guard read. Never the display split. */
export function productKeyOf(lineItemTitle: string): string {
  const i = lineItemTitle.indexOf(' - ');
  return (i === -1 ? lineItemTitle : lineItemTitle.slice(0, i)).trim();
}

/** What decides the batch. The whole title — see the note above. */
export function fulfilmentOf(lineItemTitle: string): BatchFulfilment {
  return classifyFulfilment(lineItemTitle);
}

/** One distinct `Lineitem name` in a file, with everything the row shows. */
export interface FileProduct {
  /** The exact string. This is the join key, and what gets ticked. */
  lineItemTitle: string;
  /** For grouping — "Falling Light" for every variant of it. */
  productKey: string;
  /** Display halves, from `splitLineItemTitle`. */
  product: string;
  variant: string;
  /** Line items in the file with this title. */
  lines: number;
  /** DISTINCT Shopify order names — not the same number, and never summed. */
  shopifyOrders: number;
  fulfilment: BatchFulfilment;
  skus: string[];
}

/**
 * The products a file contains, biggest first.
 *
 * `shopifyOrders` is distinct order names within this title, which is what the
 * row can honestly claim. It must never be summed across rows: one Shopify
 * order buying a framed and an unframed print is counted in both, so the three
 * rows of the real Falling Light export total 295 against 293 actual orders.
 * The two totals are different quantities and the screen states both.
 */
export function productsInFile(items: ParsedLineItem[]): FileProduct[] {
  const byTitle = new Map<string, { lines: number; orders: Set<string>; skus: Set<string> }>();
  for (const item of items) {
    const entry = byTitle.get(item.lineItemTitle) ?? {
      lines: 0,
      orders: new Set<string>(),
      skus: new Set<string>(),
    };
    entry.lines += 1;
    entry.orders.add(item.shopifyOrderName);
    if (item.sku) entry.skus.add(item.sku);
    byTitle.set(item.lineItemTitle, entry);
  }
  return [...byTitle.entries()]
    .map(([lineItemTitle, e]): FileProduct => {
      const { title, variant } = splitLineItemTitle(lineItemTitle);
      return {
        lineItemTitle,
        productKey: productKeyOf(lineItemTitle),
        product: title,
        variant,
        lines: e.lines,
        shopifyOrders: e.orders.size,
        fulfilment: fulfilmentOf(lineItemTitle),
        skus: [...e.skus].sort(),
      };
    })
    .sort((a, b) => b.lines - a.lines || a.lineItemTitle.localeCompare(b.lineItemTitle));
}

/** The distinct Shopify orders across a set of titles — the honest total. */
export function shopifyOrderCount(items: ParsedLineItem[], titles: string[]): number {
  const claimed = new Set(titles);
  const orders = new Set<string>();
  for (const item of items) {
    if (claimed.has(item.lineItemTitle)) orders.add(item.shopifyOrderName);
  }
  return orders.size;
}

/**
 * What the app proposes before anybody touches anything.
 *
 * Ticks are proposed only for rows whose title actually SAYS framed or
 * unframed. That is the answer to the case punctuation cannot decide: a second
 * edition off the same image — "Falling Light - Study" — shares its first
 * segment with "Falling Light", so no guard can separate them. It is drawn,
 * unticked, with its count, and ticking it is a deliberate act.
 *
 * The product kind proposes SCULPTURE unless some row says framed. The
 * tempting rule is the other way round — any " - " means a variant means a
 * print — but a bronze sold in finishes ("Vessel VIII - Patina") would then
 * take the printing-and-framing sequence, and the mistake would not look like
 * one: both finishes route to "Unframed" and the batch column reads tidily.
 */
export function proposeRelease(products: FileProduct[]): {
  lineItemTitles: string[];
  title: string;
  productKind: ProductKind;
} {
  const saysFulfilment = (p: FileProduct) => /framed/i.test(p.lineItemTitle);
  const anyFramed = products.some(
    (p) => /framed/i.test(p.lineItemTitle) && !/unframed/i.test(p.lineItemTitle),
  );
  const productKind: ProductKind = anyFramed ? 'print' : 'sculpture';

  /* The biggest product in the file is the one it is an export of. Its whole
     group comes with it — every variant of the same first segment. */
  const lead = products[0]?.productKey ?? '';
  const group = products.filter((p) => p.productKey === lead);
  const proposed = productKind === 'print' ? group.filter(saysFulfilment) : group;

  return {
    lineItemTitles: (proposed.length > 0 ? proposed : group).map((p) => p.lineItemTitle),
    title: lead,
    productKind,
  };
}

/** SKUs worth storing: dropped when blank, or when one SKU spans two titles. */
export function skusFor(products: FileProduct[], titles: string[]): string[] {
  const claimed = new Set(titles);
  const owners = new Map<string, Set<string>>();
  for (const p of products) {
    for (const sku of p.skus) {
      const set = owners.get(sku) ?? new Set<string>();
      set.add(p.lineItemTitle);
      owners.set(sku, set);
    }
  }
  const out = new Set<string>();
  for (const p of products) {
    if (!claimed.has(p.lineItemTitle)) continue;
    for (const sku of p.skus) {
      if ((owners.get(sku)?.size ?? 0) === 1) out.add(sku);
    }
  }
  return [...out].sort();
}

export function emptyProductMatch(): ProductMatch {
  return { lineItemTitles: [], skus: [], shopifyProductIds: [], confirmedAt: null, confirmedBy: null };
}

/** The order a line item would land on, if this release already has it. */
export function matchExistingOrder(
  existing: Pick<Order, 'shopifyOrderName' | 'lineItemTitle'>[],
  item: Pick<ParsedLineItem, 'shopifyOrderName' | 'lineItemTitle'>,
): number {
  const key = orderDedupeKey(item.shopifyOrderName, item.lineItemTitle);
  return existing.findIndex((o) => orderDedupeKey(o.shopifyOrderName, o.lineItemTitle) === key);
}

/** What adding these items to a release would do, without doing it. */
export interface IntakePlan {
  /** Items that become new orders, in file order. */
  create: ParsedLineItem[];
  /** Distinct existing orders this file re-states. */
  alreadyHere: number;
  /** Orders cancelled in this app that the file offers again. Not resurrected. */
  stillCancelled: number;
  /** Distinct Shopify order names behind `create`. */
  shopifyOrders: number;
  /** Distinct collectors behind `create` — people, not orders. */
  collectors: number;
  /** Fulfilments the new orders need. Empty for a sculpture. */
  fulfilments: BatchFulfilment[];
  newestOrderDate: string | null;
  notes: IntakeNote[];
}

/**
 * Reconcile a ticked set of line items against the orders a release already
 * has. The ITEMS are the write — no matcher is consulted, because the operator
 * has already decided which products are this release's.
 *
 * The notes are the point. Everything a file does that somebody would want to
 * know before pressing the button, said before anything is written: a row
 * repeated inside the file, an order spanning two batches, a collector with no
 * email, a line belonging to another release. None of it blocks.
 */
export function planIntake(
  items: ParsedLineItem[],
  ticked: string[],
  existing: Pick<Order, 'shopifyOrderName' | 'lineItemTitle' | 'removed'>[],
  productKind: ProductKind,
): IntakePlan {
  const claimed = new Set(ticked);
  const notes: IntakeNote[] = [];
  const create: ParsedLineItem[] = [];
  const seenInFile = new Set<string>();
  let alreadyHere = 0;
  let stillCancelled = 0;

  /* An order spanning both fulfilments, and an order carrying a line item this
     release is not claiming — both computed over the WHOLE file, because both
     are facts about the order rather than about the ticked rows. */
  const byOrder = new Map<string, ParsedLineItem[]>();
  for (const item of items) {
    byOrder.set(item.shopifyOrderName, [...(byOrder.get(item.shopifyOrderName) ?? []), item]);
  }

  for (const item of items) {
    if (!claimed.has(item.lineItemTitle)) continue;
    const key = orderDedupeKey(item.shopifyOrderName, item.lineItemTitle);
    if (seenInFile.has(key)) {
      /* A repeat WITHIN the file. Not a skip: on a first-ever import "already
         imported 1" would be a claim about a file nobody has imported. */
      notes.push({
        kind: 'duplicate_row',
        order: item.shopifyOrderName,
        what: 'Duplicate row',
        detail: 'Second skipped',
      });
      continue;
    }
    seenInFile.add(key);

    const at = matchExistingOrder(existing, item);
    if (at >= 0) {
      if (existing[at].removed) stillCancelled += 1;
      else alreadyHere += 1;
      continue;
    }
    create.push(item);
  }

  const noted = new Set<string>();
  const note = (n: IntakeNote) => {
    const k = `${n.kind}:${n.order}`;
    if (noted.has(k)) return;
    noted.add(k);
    notes.push(n);
  };

  for (const item of create) {
    const siblings = byOrder.get(item.shopifyOrderName) ?? [];
    if (productKind === 'print') {
      const fulfilments = new Set(
        siblings.filter((s) => claimed.has(s.lineItemTitle)).map((s) => fulfilmentOf(s.lineItemTitle)),
      );
      if (fulfilments.size > 1) {
        note({
          kind: 'both_batches',
          order: item.shopifyOrderName,
          what: 'Two batches',
          detail: 'Framed + Unframed',
        });
      }
    }
    const foreign = siblings.find((s) => !claimed.has(s.lineItemTitle));
    if (foreign) {
      note({
        kind: 'other_release',
        order: item.shopifyOrderName,
        what: 'Another release',
        detail: foreign.lineItemTitle,
      });
    }
    if (!item.email) {
      note({
        kind: 'no_email',
        order: item.shopifyOrderName,
        what: 'No email',
        detail: 'Imported, never sent to',
      });
    } else if (item.collectorName === item.email.split('@')[0]) {
      note({
        kind: 'no_collector_name',
        order: item.shopifyOrderName,
        what: 'No name',
        detail: `Greeted “${item.collectorName}”`,
      });
    }
    if (item.quantity > 1) {
      note({
        kind: 'quantity',
        order: item.shopifyOrderName,
        what: `Quantity ${item.quantity}`,
        detail: 'One collector, one email',
      });
    }
    if (item.financialStatus && item.financialStatus !== 'paid') {
      note({
        kind: 'not_paid',
        order: item.shopifyOrderName,
        what: cap(item.financialStatus),
        detail: 'Imported and active',
      });
    }
  }

  const fulfilments =
    productKind === 'print'
      ? [...new Set(create.map((i) => fulfilmentOf(i.lineItemTitle)))].sort()
      : [];
  const dates = create.map((i) => i.orderDate).filter(Boolean).sort();

  return {
    create,
    alreadyHere,
    stillCancelled,
    shopifyOrders: new Set(create.map((i) => i.shopifyOrderName)).size,
    collectors: new Set(create.map((i) => i.email ?? `anon:${i.shopifyOrderName}`)).size,
    fulfilments,
    newestOrderDate: dates.length > 0 ? dates[dates.length - 1] : null,
    notes: notes.sort((a, b) => a.order.localeCompare(b.order)),
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
