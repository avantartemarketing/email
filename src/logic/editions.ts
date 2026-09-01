import type { Order, OrderAllocation } from '../types';
import { artworkKeyOf, productKeyOf } from './intake';

/**
 * Edition allocation — which collector gets print 1 of 150.
 *
 * This replaces the Edition Allocation workbook's computation, whose output
 * tab is the CSV `allocation.ts` already imports. The tool was that sheet's
 * consumer; this makes it the producer. Everything here is pure: orders in,
 * numbered rows out, and the data layer decides what to write.
 *
 * ## The rule
 *
 * The sheet author's own words, in a comment on `Order Matrix!P1`: *"Ranks
 * each row by set size. The largest set size in column O gets priority 1,
 * smaller sets get progressively lower priority."* So: collectors who bought
 * the most artworks get the lowest numbers, oldest order first within a group.
 * That rule is kept, as data (`DEFAULT_RULE`), because it is the business's
 * rule and not this module's to change.
 *
 * ## The correction
 *
 * The workbook numbered each artwork independently by rank, so a collector's
 * position in one artwork depended on who else bought THAT artwork — a
 * different crowd per artwork — and 13 real multi-artwork orders came out
 * holding different numbers for different prints, while the sheet's validator
 * read the wrong column and printed "all consistent".
 *
 * Here the walk is per ORDER: each order takes the lowest number still free in
 * EVERY artwork it bought, so a set is matched by construction. That skips
 * numbers, and a numbered edition cannot have holes — which is why this was
 * simulated over the real 770-order Murakami census before being built:
 * every order matched, every sequence came out gapless 1..N (later
 * single-print buyers backfill completely), and the entire cost was 22 orders
 * sitting above their strict rank. The elaborate hole-reservation machinery
 * this seemed to need is not needed.
 *
 * ## The one hard rule
 *
 * **A number that exists never moves.** Anything already allocated — imported
 * from the warehouse sheet or committed here — enters as a PIN: its numbers
 * are taken, its order is not revisited, and a re-run numbers only the
 * unnumbered around it. Undo is the only eraser. That is what makes "add
 * orders, then allocate again" safe against every number already told to the
 * warehouse or a collector.
 *
 * ## And the audit
 *
 * The workbook's two self-checks were dead — one compared `#REF!`-zero to
 * zero, the other read Set_Size where it meant Edition No. — and both
 * reported a pass over broken data. `auditAllocation` is built not to be
 * able to do that: it re-derives every fact from the produced rows, it
 * refuses an EMPTY allocation rather than passing on it, and its faults are
 * sentences naming numbers.
 */

/** One print order, as the allocator sees it. One artwork per order — a
    framed purchase is one order since frames were absorbed at intake. */
export interface AllocationOrderInput {
  orderId: string;
  shopifyOrderName: string;
  /** `artworkKeyOf` — the SKU art code, or the product key without one. */
  artworkKey: string;
  /** What the warehouse sheet calls it — the Print Name column. */
  artworkName: string;
  quantity: number;
  /** Day precision, from the export. The tie-break. */
  orderDate: string;
  framed: boolean;
  /** The absorbed frame line's facts, for the finish and glass columns. */
  frameSku: string | null;
  frameLineItemTitle: string | null;
  /** Rows this order already holds. Non-empty means PINNED: kept verbatim,
      numeric numbers marked as taken, and the order never re-numbered. */
  existing: OrderAllocation[];
}

export interface AllocationRule {
  /** The only shipped value. Declared as data so a release could one day
      choose differently without this module changing. */
  priority: 'largest_set_first';
  tieBreak: 'oldest_order_first';
}

export const DEFAULT_RULE: AllocationRule = {
  priority: 'largest_set_first',
  tieBreak: 'oldest_order_first',
};

export type EditionNoteKind = 'kept' | 'over_edition' | 'pin_gap' | 'unparsed_pin';

/** Something worth knowing before the write. Evidence, never a blocker. */
export interface EditionNote {
  kind: EditionNoteKind;
  /** "#AA10412", or an artwork name for artwork-level notes. */
  about: string;
  what: string;
  detail: string;
}

export interface ArtworkSummary {
  artworkKey: string;
  artworkName: string;
  /** Numbers issued, pins included. */
  count: number;
  highest: number;
  /** Numbers below `highest` that nothing holds. Empty on a clean run. */
  gaps: number[];
}

export interface AllocationPlan {
  /** Every order's rows, pinned orders included, keyed by orderId. */
  byOrder: Map<string, OrderAllocation[]>;
  /** Orders numbered by THIS run (not pinned). */
  numbered: number;
  /** Orders whose existing rows were kept untouched. */
  kept: number;
  artworks: ArtworkSummary[];
  notes: EditionNote[];
  /** From `auditAllocation`, run on the finished plan. Empty or the plan is
      not fit to commit. */
  faults: string[];
}

/** "#AA10412" → sortable. Falls back to the string for odd names. */
function orderNumberRank(name: string): number {
  const m = /(\d+)/.exec(name);
  return m ? Number.parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Finish and glass, from the absorbed frame line.
 *
 * Both rules are the workbook's own, confirmed against its formulas: the
 * finish is the colour word the frame line's title leads with ("Black Abachi
 * wood frame" → BLACK, as the sheet spells it), and the glass is museum-grade
 * exactly when the SKU says UPGRADE (`SKU Map!H2`). Null when there is no
 * frame, or when a title has no recognisable colour — a blank cell over a
 * guessed one, always.
 */
export function frameSpecOf(input: {
  frameSku: string | null;
  frameLineItemTitle: string | null;
}): { frameFinish: string | null; glass: string | null } {
  if (!input.frameSku && !input.frameLineItemTitle) {
    return { frameFinish: null, glass: null };
  }
  const title = input.frameLineItemTitle ?? '';
  const colour = /(?:^|- )\s*([A-Za-z]+)[^-]*\bframe\b/i.exec(title)?.[1] ?? null;
  const finish = colour ? colour.toUpperCase() : null;
  const glass = /UPGRADE/i.test(input.frameSku ?? '')
    ? 'Museum-grade acrylic'
    : 'UV-protective acrylic';
  return { frameFinish: finish, glass };
}

/**
 * Number a release's orders. Pure; nothing is written.
 *
 * Pinned orders are honoured first, their numeric numbers marked as taken.
 * The rest are walked in the rule's priority order, each order-unit taking
 * the lowest number free in every artwork it bought.
 */
export function planAllocation(
  inputs: AllocationOrderInput[],
  rule: AllocationRule = DEFAULT_RULE,
  editionSize: number | null = null,
): AllocationPlan {
  const notes: EditionNote[] = [];
  const byOrder = new Map<string, OrderAllocation[]>();
  const used = new Map<string, Set<number>>();
  const take = (artworkKey: string, n: number): void => {
    const set = used.get(artworkKey) ?? new Set<number>();
    set.add(n);
    used.set(artworkKey, set);
  };

  const names = new Map<string, string>();
  for (const i of inputs) if (!names.has(i.artworkKey)) names.set(i.artworkKey, i.artworkName);

  /* Pins first: a number that exists never moves. Rows are kept VERBATIM —
     including "AP" and anything else that does not parse — but only numeric
     numbers can occupy the number space. */
  let kept = 0;
  const unnumbered: AllocationOrderInput[] = [];
  for (const input of inputs) {
    if (input.existing.length > 0) {
      byOrder.set(input.orderId, input.existing);
      kept += 1;
      for (const row of input.existing) {
        const n = row.editionNumber && /^\d+$/.test(row.editionNumber.trim())
          ? Number.parseInt(row.editionNumber, 10)
          : null;
        if (n !== null) take(input.artworkKey, n);
        else if (row.editionNumber) {
          notes.push({
            kind: 'unparsed_pin',
            about: input.shopifyOrderName,
            what: `Kept “${row.editionNumber}”`,
            detail: 'Not a number; not re-issued',
          });
        }
      }
      continue;
    }
    unnumbered.push(input);
  }
  if (kept > 0) {
    notes.push({
      kind: 'kept',
      about: `${kept} order${kept === 1 ? '' : 's'}`,
      what: 'Already numbered',
      detail: 'Kept — a number never moves',
    });
  }

  /* One Shopify order is one walk step: every artwork in it gets the same
     number, which is the whole correction over the workbook. */
  const byShopify = new Map<string, AllocationOrderInput[]>();
  for (const input of unnumbered) {
    byShopify.set(input.shopifyOrderName, [
      ...(byShopify.get(input.shopifyOrderName) ?? []),
      input,
    ]);
  }
  const steps = [...byShopify.values()];
  steps.sort((a, b) => {
    /* rule.priority — the only shipped value sorts biggest set first. */
    const size = new Set(b.map((i) => i.artworkKey)).size - new Set(a.map((i) => i.artworkKey)).size;
    if (size !== 0) return size;
    /* rule.tieBreak — oldest first; the order number settles a shared day. */
    const day = (a[0].orderDate || '9999').localeCompare(b[0].orderDate || '9999');
    if (day !== 0) return day;
    return orderNumberRank(a[0].shopifyOrderName) - orderNumberRank(b[0].shopifyOrderName);
  });
  void rule; // both fields have one value today; the sort above IS the rule

  let numbered = 0;
  for (const step of steps) {
    const artworkKeys = [...new Set(step.map((i) => i.artworkKey))];
    const setSize = artworkKeys.length;
    const maxQty = Math.max(...step.map((i) => i.quantity), 1);
    /* Unit u of a quantity-2 order is a second full SET: the real #77708 held
       editions 4 AND 5 of every print, and this reproduces that shape. */
    const unitNumbers: number[] = [];
    for (let u = 0; u < maxQty; u += 1) {
      const inUnit = step.filter((i) => i.quantity > u);
      if (inUnit.length === 0) break;
      let n = 1;
      while (inUnit.some((i) => used.get(i.artworkKey)?.has(n))) n += 1;
      for (const i of inUnit) take(i.artworkKey, n);
      unitNumbers.push(n);
    }
    for (const input of step) {
      const rows: OrderAllocation[] = [];
      const spec = frameSpecOf(input);
      for (let u = 0; u < input.quantity; u += 1) {
        rows.push({
          printName: input.artworkName,
          fulfilment: input.framed ? 'Framed' : 'Print Only',
          frameFinish: input.framed ? spec.frameFinish : null,
          glass: input.framed ? spec.glass : null,
          mountingType: null,
          setSize,
          editionNumber: String(unitNumbers[u]),
        });
      }
      byOrder.set(input.orderId, rows);
      numbered += 1;
    }
  }

  /* Summaries and evidence. `gaps` can only come from pinned numbering (an
     imported sheet with holes) — this walk backfills its own skips. */
  const artworks: ArtworkSummary[] = [...used.entries()]
    .map(([artworkKey, set]) => {
      const highest = Math.max(...set);
      const gaps: number[] = [];
      for (let n = 1; n < highest; n += 1) if (!set.has(n)) gaps.push(n);
      return {
        artworkKey,
        artworkName: names.get(artworkKey) ?? artworkKey,
        count: set.size,
        highest,
        gaps,
      };
    })
    .sort((a, b) => a.artworkName.localeCompare(b.artworkName));

  for (const a of artworks) {
    if (a.gaps.length > 0) {
      notes.push({
        kind: 'pin_gap',
        about: a.artworkName,
        what: `${a.gaps.length} unheld number${a.gaps.length === 1 ? '' : 's'}`,
        detail: `Below ${a.highest}, from kept numbering`,
      });
    }
    if (editionSize !== null && a.highest > editionSize) {
      /* Evidence, not an error: orders exceeding the stated edition size is
         ordinary in a pre-order world — the standing ruling from the
         add-a-release round — and the workbook numbered straight past its own
         edition sizes too. Somebody should still see it before exporting. */
      notes.push({
        kind: 'over_edition',
        about: a.artworkName,
        what: `Numbered to ${a.highest}`,
        detail: `Edition size says ${editionSize}`,
      });
    }
  }

  const plan: AllocationPlan = { byOrder, numbered, kept, artworks, notes, faults: [] };
  plan.faults = auditAllocation(inputs, plan);
  return plan;
}

/**
 * Re-derive every claim from the produced rows, and refuse to pass on
 * nothing. The workbook's validators failed by comparing zero to zero, so the
 * first assertion here is that there is something to audit at all.
 */
export function auditAllocation(inputs: AllocationOrderInput[], plan: AllocationPlan): string[] {
  const faults: string[] = [];
  if (inputs.length === 0 || plan.byOrder.size === 0) {
    return ['nothing was allocated — an empty allocation is not a passing one'];
  }

  // Every order got exactly its quantity of rows.
  for (const input of inputs) {
    const rows = plan.byOrder.get(input.orderId);
    if (!rows || rows.length === 0) {
      faults.push(`${input.shopifyOrderName}: no allocation rows`);
    } else if (input.existing.length === 0 && rows.length !== input.quantity) {
      faults.push(
        `${input.shopifyOrderName}: ${rows.length} rows for quantity ${input.quantity}`,
      );
    }
  }

  // Per artwork: numeric numbers are unique. Contiguity is asserted only over
  // what THIS run controls — rows this run issued are all numeric, and the
  // combined sequence may only have the gaps the notes already name.
  const perArtwork = new Map<string, { n: number; order: string }[]>();
  for (const input of inputs) {
    const rows = plan.byOrder.get(input.orderId) ?? [];
    for (const row of rows) {
      if (row.editionNumber && /^\d+$/.test(row.editionNumber.trim())) {
        perArtwork.set(input.artworkKey, [
          ...(perArtwork.get(input.artworkKey) ?? []),
          { n: Number.parseInt(row.editionNumber, 10), order: input.shopifyOrderName },
        ]);
      }
    }
  }
  const namedGaps = new Set(
    plan.notes.filter((n) => n.kind === 'pin_gap').map((n) => n.about),
  );
  for (const [key, held] of perArtwork) {
    const name = plan.artworks.find((a) => a.artworkKey === key)?.artworkName ?? key;
    /* Named, not counted: "a number was issued twice" sends somebody hunting
       through hundreds of rows. The fault IS the number and its holders. */
    const byNumber = new Map<number, string[]>();
    for (const h of held) byNumber.set(h.n, [...(byNumber.get(h.n) ?? []), h.order]);
    for (const [n, orders] of byNumber) {
      if (orders.length > 1) {
        /* One order holding a number twice is a different sentence from two
           orders sharing it — "#AA10418 and #AA10418" reads like a typo and
           sends the reader to look for a second order that does not exist. */
        const holders = [...new Set(orders)];
        faults.push(
          holders.length === 1
            ? `${name}: edition ${n} is held twice by ${holders[0]} — two prints, one number`
            : `${name}: edition ${n} is held twice — ${holders.join(' and ')}`,
        );
      }
    }
    const numbers = held.map((h) => h.n);
    const highest = Math.max(...numbers);
    if (new Set(numbers).size !== highest && !namedGaps.has(name)) {
      faults.push(
        `${name}: ${new Set(numbers).size} distinct numbers but the highest is ${highest} — an unreported gap`,
      );
    }
  }

  // Every multi-artwork Shopify order this run numbered holds a matched set.
  const byShopify = new Map<string, AllocationOrderInput[]>();
  for (const input of inputs) {
    if (input.existing.length > 0) continue;
    byShopify.set(input.shopifyOrderName, [
      ...(byShopify.get(input.shopifyOrderName) ?? []),
      input,
    ]);
  }
  for (const [name, group] of byShopify) {
    if (new Set(group.map((i) => i.artworkKey)).size <= 1) continue;
    const firsts = group.map((i) => plan.byOrder.get(i.orderId)?.[0]?.editionNumber ?? '?');
    if (new Set(firsts).size > 1) {
      faults.push(`${name}: different numbers across its artworks — ${firsts.join(', ')}`);
    }
  }

  return faults;
}

/**
 * A stored order as the allocator's input. `framed` comes from the order's
 * BATCH — the recorded routing decision — never re-derived from a string.
 */
export function toAllocationInput(
  order: Pick<
    Order,
    | 'id'
    | 'shopifyOrderName'
    | 'lineItemTitle'
    | 'sku'
    | 'quantity'
    | 'orderDate'
    | 'frameSku'
    | 'frameLineItemTitle'
    | 'allocations'
  >,
  framed: boolean,
): AllocationOrderInput {
  return {
    orderId: order.id,
    shopifyOrderName: order.shopifyOrderName,
    artworkKey: artworkKeyOf({ lineItemTitle: order.lineItemTitle, sku: order.sku }),
    artworkName: productKeyOf(order.lineItemTitle),
    quantity: Math.max(order.quantity, 1),
    orderDate: order.orderDate,
    framed,
    frameSku: order.frameSku ?? null,
    frameLineItemTitle: order.frameLineItemTitle ?? null,
    existing: order.allocations ?? [],
  };
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The file the warehouse gets — the exact eight columns of the workbook's
 * Edition Allocation tab, so nothing downstream has to move on day one. The
 * dead validator rows above the sheet's header are NOT reproduced: our own
 * `allocation.ts` scans for the header, so the export stays importable by the
 * tool that used to consume the sheet, which the round-trip test proves.
 */
export function warehouseCsv(inputs: AllocationOrderInput[], plan: AllocationPlan): string {
  const lines = [
    [
      'Order Number',
      'Print Name',
      'Fulfilment',
      'Frame Finish',
      'Glass',
      'Mounting Type',
      'Set_Size',
      'Edition No.',
    ].join(','),
  ];
  /* Sheet order: by artwork, then by edition number — how the warehouse reads
     it, one artwork's pile at a time. */
  const rows: { name: string; n: number; line: string }[] = [];
  for (const input of inputs) {
    for (const row of plan.byOrder.get(input.orderId) ?? []) {
      rows.push({
        name: row.printName,
        n: row.editionNumber && /^\d+$/.test(row.editionNumber) ? Number(row.editionNumber) : 0,
        line: [
          csvCell(input.shopifyOrderName),
          csvCell(row.printName),
          csvCell(row.fulfilment),
          csvCell(row.frameFinish),
          csvCell(row.glass),
          csvCell(row.mountingType),
          csvCell(row.setSize),
          csvCell(row.editionNumber),
        ].join(','),
      });
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.n - b.n);
  lines.push(...rows.map((r) => r.line));
  return lines.join('\n');
}
