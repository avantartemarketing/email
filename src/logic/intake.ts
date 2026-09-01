import type {
  BatchFulfilment,
  IntakeNote,
  Order,
  ProductKind,
  ProductMatch,
} from '../types';
import type { ParsedLineItem } from './importer';
import { artworksInFile, proposeArtworks, releaseTitleFor } from './artworks';
import {
  artCodeOf,
  classifyFulfilment,
  isFrameLine,
  orderDedupeKey,
  splitLineItemTitle,
} from './importer';

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

/** What a line item's own title claims. Never the answer on its own — see
    `resolveFulfilments`, which joins a frame line to the print it frames. */
export function fulfilmentOf(lineItemTitle: string): BatchFulfilment {
  return classifyFulfilment(lineItemTitle);
}

/**
 * What a print line and its frame line have in common.
 *
 * The SKU's art code when there is one, the product key when there is not.
 * Both halves are needed: a real export has SKUs and the art code is the
 * stronger join, but a hand-written fixture may not, and a release must still
 * be importable from a file with the column missing.
 */
export function artworkKeyOf(item: Pick<ParsedLineItem, 'lineItemTitle' | 'sku'>): string {
  return artCodeOf(item.sku) ?? productKeyOf(item.lineItemTitle);
}

/** The join key a print line and its frame line share. Built in one place so
    the three readers below cannot drift apart on the separator. */
function artworkOrderKey(item: Pick<ParsedLineItem, 'shopifyOrderName' | 'lineItemTitle' | 'sku'>): string {
  return `${item.shopifyOrderName.trim().toLowerCase()}::${artworkKeyOf(item).toLowerCase()}`;
}

/**
 * Every print line's fulfilment, keyed by `orderDedupeKey`.
 *
 * This is the correction. Framing used to be read off the line item's own
 * title, which is a question that title cannot answer: the print line says
 * "- Draw" or "- Pre-order" — the sales channel — and the framing is a
 * SEPARATE line on the same order. So a print is framed when a frame line
 * exists beside it, on the same Shopify order, for the same artwork.
 *
 * Measured on the Ai Weiwei export, which is real: 439 framed and 631
 * unframed print lines, against 0 and 1,511 before.
 *
 * Two things it deliberately does not do:
 *   - it never demotes a title that says framed for itself. A fixture reading
 *     "Falling Light - Framed" has no frame line to find and is still framed;
 *   - a frame line with no print line beside it (two of the 441 on that
 *     export — a frame added to an order whose print sits elsewhere) is left
 *     alone rather than guessed at. `planIntake` reports it.
 */
export function resolveFulfilments(items: ParsedLineItem[]): Map<string, BatchFulfilment> {
  const framedArtworks = new Set<string>();
  for (const item of items) {
    if (isFrameLine(item)) {
      framedArtworks.add(artworkOrderKey(item));
    }
  }
  const out = new Map<string, BatchFulfilment>();
  for (const item of items) {
    if (isFrameLine(item)) continue;
    const framed =
      framedArtworks.has(artworkOrderKey(item)) ||
      fulfilmentOf(item.lineItemTitle) === 'framed';
    out.set(orderDedupeKey(item.shopifyOrderName, item.lineItemTitle), framed ? 'framed' : 'unframed');
  }
  return out;
}

/** Frame lines whose print is not in the file. Reported, never guessed at. */
export function orphanFrameLines(items: ParsedLineItem[]): ParsedLineItem[] {
  const prints = new Set(
    items
      .filter((i) => !isFrameLine(i))
      .map(artworkOrderKey),
  );
  return items.filter(
    (i) => isFrameLine(i) && !prints.has(artworkOrderKey(i)),
  );
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
  /** A frame line, not a print. It is an attribute of a print, not an order. */
  isFrame: boolean;
  /**
   * Does the TITLE itself say which batch this is — "Falling Light - Framed"?
   *
   * In a real export it never does: the suffix is the sales channel, and two
   * orders of one title can land in different batches depending on whether a
   * frame line sits beside them. So `fulfilment` above is the title's claim
   * and this says whether that claim means anything. A row that does not
   * declare must not be drawn wearing a batch's name — it would be right
   * about some of its orders and wrong about the rest.
   */
  declaresFulfilment: boolean;
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
  const byTitle = new Map<
    string,
    { lines: number; orders: Set<string>; skus: Set<string>; frame: boolean }
  >();
  for (const item of items) {
    const entry = byTitle.get(item.lineItemTitle) ?? {
      lines: 0,
      orders: new Set<string>(),
      skus: new Set<string>(),
      frame: false,
    };
    entry.lines += 1;
    entry.orders.add(item.shopifyOrderName);
    if (item.sku) entry.skus.add(item.sku);
    /* One title can carry both a print SKU and a frame SKU only in a broken
       export; if any row of it is a frame, the row is drawn as one. */
    if (isFrameLine(item)) entry.frame = true;
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
        isFrame: e.frame,
        declaresFulfilment: !e.frame && /framed/i.test(lineItemTitle),
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
 * The product kind proposes SCULPTURE unless the file carries a frame line or
 * some row says framed. The tempting rule is the other way round — any " - " means a variant means a
 * print — but a bronze sold in finishes ("Vessel VIII - Patina") would then
 * take the printing-and-framing sequence, and the mistake would not look like
 * one: both finishes route to "Unframed" and the batch column reads tidily.
 *
 * The SET of rows comes from `artworksInFile` now, not from a shared title
 * prefix: a release is one artist's, and the SKU states the artist. See
 * `src/logic/artworks.ts`.
 */
export function proposeRelease(products: FileProduct[]): {
  lineItemTitles: string[];
  title: string;
  productKind: ProductKind;
} {
  /* A frame line in the file is the strongest evidence there is that this is a
     print release. The old test — does some title say "framed" — called every
     real Avant Arte export a sculpture, because a real frame line reads
     "White Abachi wood frame" and the word framed is not in the shop's
     vocabulary. */
  const hasFrameLines = products.some((p) => p.isFrame);
  const saysFulfilment = (p: FileProduct) => /framed/i.test(p.lineItemTitle);
  const anyFramed =
    hasFrameLines ||
    products.some((p) => /framed/i.test(p.lineItemTitle) && !/unframed/i.test(p.lineItemTitle));
  const productKind: ProductKind = anyFramed ? 'print' : 'sculpture';

  /* The artworks the file states, and the ones worth proposing — the lead
     artwork's, plus everything by the same artist. A release is one artist's,
     and the SKU says which; the old rule took every variant of one product
     TITLE, which called Guardian (Purple) the whole release and then refused
     to let Green join it. */
  const artworks = artworksInFile(products);
  const proposedArtworks = proposeArtworks(artworks);
  const inProposal = new Set(proposedArtworks.flatMap((a) => a.lineItemTitles));
  const group = products.filter((p) => inProposal.has(p.lineItemTitle));
  /* Where the file carries frame lines, fulfilment is a JOIN and no title
     declares it, so the whole group is proposed. The filter below only means
     anything in the older shape, where a title says "- Framed" for itself. */
  const proposed =
    productKind === 'print' && !hasFrameLines ? group.filter(saysFulfilment) : group;

  return {
    lineItemTitles: (proposed.length > 0 ? proposed : group).map((p) => p.lineItemTitle),
    title: releaseTitleFor(proposedArtworks),
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
  /** Each created item's fulfilment, by `orderDedupeKey`. The write reads this
      rather than re-deriving from the title, so preview and write agree. */
  fulfilmentByOrder: Map<string, BatchFulfilment>;
  /** The frame line a print absorbed, by the print's `orderDedupeKey`. Kept as
      the FILE's facts — title and SKU — because the frame is not stored as an
      order and these two strings are all the edition allocator has to derive
      a finish and a glass from. */
  frameLineByOrder: Map<string, { lineItemTitle: string; sku: string | null }>;
  /** Frame lines folded into the print beside them instead of becoming orders. */
  framesAbsorbed: number;
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
  let framesAbsorbed = 0;

  /* Resolved once, over the WHOLE file. A frame line is not an order — it is
     how the print beside it becomes framed — so the join has to see every
     line, ticked or not, before anything is created. */
  const fulfilmentByOrder = resolveFulfilments(items);
  /* The frame line behind each framed print, keyed like the print itself.
     First frame wins where an order carries two for one artwork. */
  const frameByArtwork = new Map<string, { lineItemTitle: string; sku: string | null }>();
  for (const item of items) {
    if (!isFrameLine(item)) continue;
    const key = `${item.shopifyOrderName.trim().toLowerCase()}::${artworkKeyOf(item).toLowerCase()}`;
    if (!frameByArtwork.has(key)) {
      frameByArtwork.set(key, { lineItemTitle: item.lineItemTitle, sku: item.sku });
    }
  }
  const frameLineByOrder = new Map<string, { lineItemTitle: string; sku: string | null }>();
  const resolved = (item: ParsedLineItem): BatchFulfilment =>
    fulfilmentByOrder.get(orderDedupeKey(item.shopifyOrderName, item.lineItemTitle)) ??
    fulfilmentOf(item.lineItemTitle);

  /* An order spanning both fulfilments, and an order carrying a line item this
     release is not claiming — both computed over the WHOLE file, because both
     are facts about the order rather than about the ticked rows. */
  const byOrder = new Map<string, ParsedLineItem[]>();
  for (const item of items) {
    byOrder.set(item.shopifyOrderName, [...(byOrder.get(item.shopifyOrderName) ?? []), item]);
  }

  for (const item of items) {
    if (!claimed.has(item.lineItemTitle)) continue;
    /* A framed purchase is ONE thing to make and ship, carried on two Shopify
       lines. The frame line sets the print's fulfilment and stops there;
       creating an order for it too would double every framed collector in the
       counts, in the batches and in the allocation. */
    if (isFrameLine(item)) {
      framesAbsorbed += 1;
      continue;
    }
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
    const frame = frameByArtwork.get(
      `${item.shopifyOrderName.trim().toLowerCase()}::${artworkKeyOf(item).toLowerCase()}`,
    );
    if (frame) frameLineByOrder.set(key, frame);
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
        siblings
          .filter((s) => claimed.has(s.lineItemTitle) && !isFrameLine(s))
          .map(resolved),
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
    const foreign = siblings.find((s) => !claimed.has(s.lineItemTitle) && !isFrameLine(s));
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
    productKind === 'print' ? [...new Set(create.map(resolved))].sort() : [];
  const dates = create.map((i) => i.orderDate).filter(Boolean).sort();

  /* A frame with no print beside it in this file. Not blocked and not guessed
     at: it is usually a frame added to an order whose print sits in another
     release's export, and the operator is the one who knows. */
  for (const orphan of orphanFrameLines(items)) {
    if (!claimed.has(orphan.lineItemTitle)) continue;
    note({
      kind: 'frame_without_print',
      order: orphan.shopifyOrderName,
      what: 'Frame, no print',
      detail: orphan.lineItemTitle,
    });
  }

  return {
    create,
    alreadyHere,
    stillCancelled,
    shopifyOrders: new Set(create.map((i) => i.shopifyOrderName)).size,
    collectors: new Set(create.map((i) => i.email ?? `anon:${i.shopifyOrderName}`)).size,
    fulfilments,
    fulfilmentByOrder,
    frameLineByOrder,
    framesAbsorbed,
    newestOrderDate: dates.length > 0 ? dates[dates.length - 1] : null,
    notes: notes.sort((a, b) => a.order.localeCompare(b.order)),
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
