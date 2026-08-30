import { describe, expect, it } from 'vitest';
import { parseShopifyOrderExport } from '../importer';
import {
  fulfilmentOf,
  planIntake,
  productKeyOf,
  productsInFile,
  proposeRelease,
  shopifyOrderCount,
  skusFor,
} from '../intake';
import { FALLING_LIGHT_CSV, VESSEL_VIII_CSV } from '../../data/mock/fixtures';

const fl = parseShopifyOrderExport(FALLING_LIGHT_CSV);
const vessel = parseShopifyOrderExport(VESSEL_VIII_CSV);

describe('reading a file as products', () => {
  it('lists one row per distinct line-item name, biggest first', () => {
    const products = productsInFile(fl.items);
    expect(products.map((p) => p.lineItemTitle)).toEqual([
      'Falling Light - Framed',
      'Falling Light - Unframed',
      'Night Garden - Framed',
    ]);
    expect(products.map((p) => [p.product, p.variant])).toEqual([
      ['Falling Light', 'Framed'],
      ['Falling Light', 'Unframed'],
      ['Night Garden', 'Framed'],
    ]);
  });

  it('counts distinct Shopify orders per row, which cannot be summed', () => {
    /* The fault this whole screen exists to end. A per-release export contains
       WHOLE ORDERS, so one order buying a framed and an unframed print is
       counted in both rows: the rows total more than the file's own orders,
       and a reader left to add them up gets a number that is not true of
       anything. The screen states both totals instead. */
    const products = productsInFile(fl.items);
    const summed = products.reduce((n, p) => n + p.shopifyOrders, 0);
    const actual = new Set(fl.items.map((i) => i.shopifyOrderName)).size;
    expect(summed).toBeGreaterThan(actual);
    expect(actual).toBe(293);
  });

  it('reads the title three different ways, on purpose', () => {
    /* The live bug this replaced: `splitLineItemTitle` takes everything after
       the LAST separator, so a frame finish became the variant and the word
       "framed" was never seen. */
    expect(productKeyOf('Falling Light - Framed - Oak')).toBe('Falling Light');
    expect(fulfilmentOf('Falling Light - Framed - Oak')).toBe('framed');
    expect(fulfilmentOf('Falling Light - Unframed')).toBe('unframed');
    expect(productKeyOf('Vessel VIII')).toBe('Vessel VIII');
  });
});

describe('what the app proposes', () => {
  it('ticks a print’s framed and unframed rows, and nothing else in the file', () => {
    const proposal = proposeRelease(productsInFile(fl.items));
    expect(proposal.productKind).toBe('print');
    expect(proposal.title).toBe('Falling Light');
    /* The Night Garden line belongs to a collector who bought two editions in
       one order. It is drawn with its count and left unticked. */
    expect(proposal.lineItemTitles).toEqual([
      'Falling Light - Framed',
      'Falling Light - Unframed',
    ]);
  });

  it('proposes sculpture unless some row says framed', () => {
    expect(proposeRelease(productsInFile(vessel.items)).productKind).toBe('sculpture');
    /* The rule is this way round for a reason: a bronze sold in finishes has a
       separator in every title, so "any variant means a print" would give it
       the printing-and-framing sequence — and the mistake would not look like
       one, because both finishes route tidily to "Unframed". */
    const bronze = productsInFile([
      { ...vessel.items[0], lineItemTitle: 'Vessel VIII - Bronze' },
      { ...vessel.items[1], lineItemTitle: 'Vessel VIII - Patina' },
    ]);
    expect(proposeRelease(bronze).productKind).toBe('sculpture');
  });

  it('does not propose a lookalike second edition, because punctuation cannot tell', () => {
    /* "Falling Light - Study" shares its first segment with "Falling Light",
       so no guard can separate them. It is not proposed; ticking it is a
       deliberate act. */
    const products = productsInFile([
      { ...fl.items[0], lineItemTitle: 'Falling Light - Framed' },
      { ...fl.items[1], lineItemTitle: 'Falling Light - Study' },
    ]);
    expect(proposeRelease(products).lineItemTitles).toEqual(['Falling Light - Framed']);
  });

  it('keeps only SKUs that belong to one title', () => {
    const products = productsInFile(fl.items);
    const skus = skusFor(products, ['Falling Light - Framed', 'Falling Light - Unframed']);
    expect(skus).toContain('FL-FR');
    expect(skus).toContain('FL-UF');
    expect(skus).not.toContain('NG-FR');
    /* The fixture carries a placeholder "SKU" on a block of rows, which spans
       both framed and unframed and therefore identifies neither. */
    expect(skus).not.toContain('SKU');
  });
});

describe('planning what a file would do', () => {
  const ticked = ['Falling Light - Framed', 'Falling Light - Unframed'];

  it('creates one order per line item, from fewer Shopify orders', () => {
    const plan = planIntake(fl.items, ticked, [], 'print');
    expect(plan.create.length).toBe(294);
    expect(plan.shopifyOrders).toBe(293);
    expect(shopifyOrderCount(fl.items, ticked)).toBe(293);
  });

  it('re-stating the same file creates nothing', () => {
    const first = planIntake(fl.items, ticked, [], 'print');
    const existing = first.create.map((i) => ({
      shopifyOrderName: i.shopifyOrderName,
      lineItemTitle: i.lineItemTitle,
      removed: false,
    }));
    const again = planIntake(fl.items, ticked, existing, 'print');
    expect(again.create).toHaveLength(0);
    expect(again.alreadyHere).toBe(294);
  });

  it('does not resurrect an order cancelled here', () => {
    const first = planIntake(fl.items, ticked, [], 'print');
    const existing = first.create.map((i, n) => ({
      shopifyOrderName: i.shopifyOrderName,
      lineItemTitle: i.lineItemTitle,
      removed: n === 0,
    }));
    const again = planIntake(fl.items, ticked, existing, 'print');
    expect(again.create).toHaveLength(0);
    expect(again.stillCancelled).toBe(1);
  });

  it('notes the real mess in the real file, and blocks on none of it', () => {
    const plan = planIntake(fl.items, ticked, [], 'print');
    const kinds = new Set(plan.notes.map((n) => n.kind));
    // A collector with no email address at all.
    expect(kinds).toContain('no_email');
    // One order carrying a line item this release is not claiming.
    expect(kinds).toContain('other_release');
    const foreign = plan.notes.find((n) => n.kind === 'other_release')!;
    expect(foreign.detail).toBe('Night Garden - Framed');
    // Nothing here is a reason to stop: the plan still creates every order.
    expect(plan.create.length).toBe(294);
  });

  it('says nothing about batches when a release has one flow', () => {
    const plan = planIntake(vessel.items, ['Vessel VIII'], [], 'sculpture');
    expect(plan.fulfilments).toEqual([]);
    expect(plan.notes.some((n) => n.kind === 'both_batches')).toBe(false);
  });

  it('claims nothing when nothing is ticked', () => {
    const plan = planIntake(fl.items, [], [], 'print');
    expect(plan.create).toHaveLength(0);
    expect(plan.collectors).toBe(0);
  });
});
