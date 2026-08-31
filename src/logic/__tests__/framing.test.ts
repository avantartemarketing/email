import { describe, expect, it } from 'vitest';
import { artCodeOf, isFrameLine, parseShopifyOrderExport } from '../importer';
import {
  artworkKeyOf,
  orphanFrameLines,
  planIntake,
  productsInFile,
  proposeRelease,
  resolveFulfilments,
} from '../intake';
import { FALLING_LIGHT_CSV, HARBOUR_LIGHT_CSV } from '../../data/mock/fixtures';

const real = parseShopifyOrderExport(HARBOUR_LIGHT_CSV);
const invented = parseShopifyOrderExport(FALLING_LIGHT_CSV);

describe('telling a frame line from a print line', () => {
  it('reads the SKU’s third segment, because no title says “framed”', () => {
    /* The fault this file exists for. Measured over the first real exports the
       project saw — 3,668 orders across six releases, 42% of them framed —
       `/framed/i` on the title matched 0 of 1,760 frame line items. */
    const frame = 'Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic';
    expect(/framed/i.test(frame)).toBe(false);
    expect(isFrameLine({ lineItemTitle: frame, sku: 'RSTON-HARBD-FR-BLACKABACH' })).toBe(true);
    expect(isFrameLine({ lineItemTitle: 'Harbour Light (Dawn) - Public', sku: 'RSTON-HARBD-TL-PUBLIC' })).toBe(false);
  });

  it('will not call a two-segment fixture SKU a frame', () => {
    /* `FL-FR` is a framed PRINT in the invented fixture, not a frame line. A
       looser `-FR` test read every one of them as a frame and emptied the
       Framed batch — caught by the existing suite, kept here on purpose. */
    expect(isFrameLine({ lineItemTitle: 'Falling Light - Framed', sku: 'FL-FR' })).toBe(false);
    expect(artCodeOf('FL-FR')).toBeNull();
    expect(artCodeOf('RSTON-HARBD-FR-BLACKABACH')).toBe('RSTON-HARBD');
  });

  it('falls back to the title when the export has no SKU column', () => {
    expect(isFrameLine({ lineItemTitle: 'Harbour Light - Oak frame', sku: null })).toBe(true);
    expect(isFrameLine({ lineItemTitle: 'Harbour Light - Framed', sku: null })).toBe(false);
  });

  it('joins a print to its frame on the art code, which survives a comma', () => {
    /* Two real Albers frames were lost to a title join because the frame line
       said "Homage to the Square (Red)" and the print said
       "Homage to the Square, (Red)". The art code does not care. */
    expect(artworkKeyOf({ lineItemTitle: 'Homage to the Square, (Red) - Draw', sku: 'JALBE-WORKR-TL-DRAW' })).toBe(
      artworkKeyOf({ lineItemTitle: 'Homage to the Square (Red) - White frame', sku: 'JALBE-WORKR-FR-WHITEABACH' }),
    );
  });
});

describe('resolving fulfilment by the join', () => {
  it('frames the print that has a frame line beside it, and only that one', () => {
    const f = resolveFulfilments(real.items);
    // #RS2101 bought one print and framed it.
    expect(f.get('#rs2101::harbour light (dawn) - public')).toBe('framed');
    // #RS2102 bought the same print, unframed.
    expect(f.get('#rs2102::harbour light (dawn) - public')).toBe('unframed');
  });

  it('frames only the artwork the frame belongs to, within one order', () => {
    /* #RS2103 bought Dusk framed and Dawn unframed in a single order. Framing
       the whole order — or neither line — is the mistake this guards. */
    const f = resolveFulfilments(real.items);
    expect(f.get('#rs2103::harbour light (dusk) - public')).toBe('framed');
    expect(f.get('#rs2103::harbour light (dawn) - public')).toBe('unframed');
  });

  it('never demotes a title that declares its own fulfilment', () => {
    const f = resolveFulfilments(invented.items);
    expect(f.get('#aa10412::falling light - framed')).toBe('framed');
    expect(f.get('#aa10413::falling light - unframed')).toBe('unframed');
  });

  it('reports a frame whose print is not in the file rather than guessing', () => {
    const orphans = orphanFrameLines(real.items);
    expect(orphans.map((o) => o.shopifyOrderName)).toEqual(['#RS2107']);
    // And it is not silently counted as a framed print of something.
    expect(resolveFulfilments(real.items).has('#rs2107::night garden - white abachi wood frame - uv protective acrylic')).toBe(false);
  });
});

describe('what the file looks like to the operator', () => {
  it('calls a print release a print, on the evidence of a frame line', () => {
    /* Before the join this returned `sculpture` for every real export, which
       drops the printing, signing and framing emails from the whole release. */
    const proposal = proposeRelease(productsInFile(real.items));
    expect(proposal.productKind).toBe('print');
  });

  it('marks frame rows so they are not read as products in their own right', () => {
    const products = productsInFile(real.items);
    const frames = products.filter((p) => p.isFrame);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((p) => /frame/i.test(p.lineItemTitle))).toBe(true);
    // The lead product — the one the release is named after — is never a frame.
    expect(products.find((p) => !p.isFrame)?.isFrame).toBe(false);
  });
});

describe('what an intake would do', () => {
  const ticked = productsInFile(real.items).map((p) => p.lineItemTitle);

  it('creates one order per print and folds the frame into it', () => {
    const plan = planIntake(real.items, ticked, [], 'print');
    const frameLines = real.items.filter(isFrameLine).length;
    expect(plan.framesAbsorbed).toBe(frameLines);
    expect(plan.create.length).toBe(real.items.length - frameLines);
    // Nothing is lost: every line in the file is either an order or a frame.
    expect(plan.create.length + plan.framesAbsorbed).toBe(real.items.length);
    // And no created order is itself a frame.
    expect(plan.create.some(isFrameLine)).toBe(false);
  });

  it('justifies both batches, which the old reading never did', () => {
    const plan = planIntake(real.items, ticked, [], 'print');
    expect(plan.fulfilments).toEqual(['framed', 'unframed']);
    const routed = [...plan.fulfilmentByOrder.values()];
    expect(routed.filter((f) => f === 'framed').length).toBeGreaterThan(0);
    expect(routed.filter((f) => f === 'unframed').length).toBeGreaterThan(0);
  });

  it('notes the orphan frame, and blocks on none of it', () => {
    const plan = planIntake(real.items, ticked, [], 'print');
    const orphan = plan.notes.find((n) => n.kind === 'frame_without_print');
    expect(orphan?.order).toBe('#RS2107');
    expect(plan.create.length).toBeGreaterThan(0);
  });

  it('does not call a frame line another release’s product', () => {
    /* A frame is an attribute of the print beside it. Before frames were
       absorbed, every framed order also raised "Another release". */
    const printsOnly = productsInFile(real.items)
      .filter((p) => !p.isFrame)
      .map((p) => p.lineItemTitle);
    const plan = planIntake(real.items, printsOnly, [], 'print');
    const foreign = plan.notes.filter((n) => n.kind === 'other_release');
    expect(foreign.map((n) => n.detail)).not.toContain(
      'Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic',
    );
  });

  it('leaves the invented fixture exactly as it was', () => {
    /* The regression guard for everything above: the old shape still routes
       the way the rest of the suite expects. */
    const titles = ['Falling Light - Framed', 'Falling Light - Unframed'];
    const plan = planIntake(invented.items, titles, [], 'print');
    expect(plan.framesAbsorbed).toBe(0);
    expect(plan.create.length).toBe(294);
    expect(plan.fulfilments).toEqual(['framed', 'unframed']);
  });
});

describe('what a row may claim about a batch', () => {
  it('lets the invented shape declare its own batch, and the real one not', () => {
    /* The tag drawn beside a product row. In the real shape "Harbour Light
       (Dawn) - Public" has three orders, one of them framed, so no single
       batch name is true of the row; the invented "- Framed" is true of all
       of its orders and still says so. */
    const realRows = productsInFile(real.items);
    const dawn = realRows.find((p) => p.lineItemTitle === 'Harbour Light (Dawn) - Public')!;
    expect(dawn.declaresFulfilment).toBe(false);

    const inventedRows = productsInFile(invented.items);
    const framed = inventedRows.find((p) => p.lineItemTitle === 'Falling Light - Framed')!;
    expect(framed.declaresFulfilment).toBe(true);
    expect(framed.fulfilment).toBe('framed');

    // A frame row never declares a batch — it is not going into one.
    expect(realRows.filter((p) => p.isFrame).every((p) => !p.declaresFulfilment)).toBe(true);
  });

  it('proves the row would have lied: its orders split across batches', () => {
    const f = resolveFulfilments(real.items);
    const dawnOrders = real.items
      .filter((i) => i.lineItemTitle === 'Harbour Light (Dawn) - Public')
      .map((i) => f.get(`${i.shopifyOrderName.toLowerCase()}::${i.lineItemTitle.toLowerCase()}`));
    expect(new Set(dawnOrders).size).toBe(2);
  });
});
