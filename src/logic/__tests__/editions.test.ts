import { describe, expect, it } from 'vitest';
import type { AllocationOrderInput } from '../editions';
import { auditAllocation, frameSpecOf, planAllocation } from '../editions';

let seq = 0;
function order(
  shopifyOrderName: string,
  artworkKey: string,
  over: Partial<AllocationOrderInput> = {},
): AllocationOrderInput {
  seq += 1;
  return {
    orderId: `o-${seq}`,
    shopifyOrderName,
    artworkKey,
    artworkName: artworkKey,
    quantity: 1,
    orderDate: '2026-05-01',
    framed: false,
    frameSku: null,
    frameLineItemTitle: null,
    existing: [],
    ...over,
  };
}

const first = (plan: ReturnType<typeof planAllocation>, input: AllocationOrderInput): string =>
  plan.byOrder.get(input.orderId)?.[0]?.editionNumber ?? '?';

describe('the rule: largest set first, oldest first inside it', () => {
  it('gives the full-set buyer number 1, even when they bought last', () => {
    const set = ['A', 'B', 'C'].map((a) => order('#903', a, { orderDate: '2026-05-09' }));
    const singles = [
      order('#901', 'A', { orderDate: '2026-05-01' }),
      order('#902', 'B', { orderDate: '2026-05-02' }),
    ];
    const plan = planAllocation([...singles, ...set]);
    for (const s of set) expect(first(plan, s)).toBe('1');
    expect(first(plan, singles[0])).toBe('2');
    expect(plan.faults).toEqual([]);
  });

  it('breaks a tie by date, and a shared day by order number', () => {
    const a = order('#12', 'A', { orderDate: '2026-05-03' });
    const b = order('#11', 'A', { orderDate: '2026-05-01' });
    const c = order('#10', 'A', { orderDate: '2026-05-03' });
    const plan = planAllocation([a, b, c]);
    expect(first(plan, b)).toBe('1'); // oldest
    expect(first(plan, c)).toBe('2'); // same day as #12, lower number
    expect(first(plan, a)).toBe('3');
  });
});

describe('matched sets — the workbook’s 13-order fault, made impossible', () => {
  it('gives a multi-artwork order one number across all its artworks', () => {
    const pair = ['A', 'B'].map((k) => order('#20', k));
    const crowdA = [order('#21', 'A'), order('#22', 'A')];
    const plan = planAllocation([...crowdA, ...pair]);
    expect(first(plan, pair[0])).toBe(first(plan, pair[1]));
    expect(plan.faults).toEqual([]);
  });

  it('backfills the numbers a matched set had to skip', () => {
    /* The property that had to be MEASURED before this was built: skipping is
       fine only if later buyers fill the holes. #31 takes 1 in A and B; #30
       (single, older, but smaller set) then takes A2; a B-only buyer must be
       handed B2, not B3. */
    const set = ['A', 'B'].map((k) => order('#31', k, { orderDate: '2026-05-02' }));
    const a2 = order('#30', 'A', { orderDate: '2026-05-01' });
    const b2 = order('#32', 'B', { orderDate: '2026-05-03' });
    const plan = planAllocation([...set, a2, b2]);
    expect(first(plan, b2)).toBe('2');
    for (const s of plan.artworks) expect(s.gaps).toEqual([]);
    expect(plan.faults).toEqual([]);
  });

  it('numbers a quantity-two order as two full matched sets', () => {
    /* The real #77708 held editions 4 AND 5 of every print in the set. */
    const pair = ['A', 'B'].map((k) => order('#40', k, { quantity: 2 }));
    const plan = planAllocation(pair);
    const aRows = plan.byOrder.get(pair[0].orderId)!.map((r) => r.editionNumber);
    const bRows = plan.byOrder.get(pair[1].orderId)!.map((r) => r.editionNumber);
    expect(aRows).toEqual(['1', '2']);
    expect(bRows).toEqual(['1', '2']);
    expect(plan.faults).toEqual([]);
  });
});

describe('pins — a number that exists never moves', () => {
  it('keeps existing rows verbatim and numbers around them', () => {
    const pinned = order('#50', 'A', {
      existing: [
        {
          printName: 'A',
          fulfilment: 'Print Only',
          frameFinish: null,
          glass: null,
          mountingType: null,
          setSize: 1,
          editionNumber: '2',
        },
      ],
    });
    const fresh = [order('#51', 'A'), order('#52', 'A')];
    const plan = planAllocation([pinned, ...fresh]);
    expect(first(plan, pinned)).toBe('2');
    expect([first(plan, fresh[0]), first(plan, fresh[1])].sort()).toEqual(['1', '3']);
    expect(plan.kept).toBe(1);
    expect(plan.numbered).toBe(2);
    expect(plan.faults).toEqual([]);
  });

  it('keeps “AP” untouched, says so, and never re-issues it as a number', () => {
    const ap = order('#60', 'A', {
      existing: [
        {
          printName: 'A',
          fulfilment: 'Print Only',
          frameFinish: null,
          glass: null,
          mountingType: null,
          setSize: 1,
          editionNumber: 'AP',
        },
      ],
    });
    const plan = planAllocation([ap, order('#61', 'A')]);
    expect(first(plan, ap)).toBe('AP');
    expect(plan.notes.some((n) => n.kind === 'unparsed_pin')).toBe(true);
  });

  it('names the holes an imported numbering leaves, and backfills them', () => {
    const imported = ['1', '2', '5'].map((n, i) =>
      order(`#7${i}`, 'A', {
        existing: [
          {
            printName: 'A',
            fulfilment: 'Print Only',
            frameFinish: null,
            glass: null,
            mountingType: null,
            setSize: 1,
            editionNumber: n,
          },
        ],
      }),
    );
    const fresh = [order('#75', 'A'), order('#76', 'A')];
    const plan = planAllocation([...imported, ...fresh]);
    expect([first(plan, fresh[0]), first(plan, fresh[1])].sort()).toEqual(['3', '4']);
    for (const s of plan.artworks) expect(s.gaps).toEqual([]);
  });

  it('is stable: running again over its own output changes nothing', () => {
    const inputs = [
      ...['A', 'B'].map((k) => order('#80', k)),
      order('#81', 'A'),
      order('#82', 'B'),
    ];
    const firstRun = planAllocation(inputs);
    const again = planAllocation(
      inputs.map((i) => ({ ...i, existing: firstRun.byOrder.get(i.orderId)! })),
    );
    expect(again.numbered).toBe(0);
    expect(again.kept).toBe(inputs.length);
    for (const i of inputs) {
      expect(again.byOrder.get(i.orderId)).toEqual(firstRun.byOrder.get(i.orderId));
    }
    expect(again.faults).toEqual([]);
  });
});

describe('what the rows carry', () => {
  it('derives finish and glass from the absorbed frame line, by the sheet’s own rules', () => {
    expect(
      frameSpecOf({
        frameSku: 'RSTON-HARBD-FR-BLACKABACH',
        frameLineItemTitle: 'Harbour Light (Dawn) - Black Abachi wood frame - UV protective acrylic',
      }),
    ).toEqual({ frameFinish: 'BLACK', glass: 'UV-protective acrylic' });
    // UPGRADE in the SKU means museum glass — `SKU Map!H2`, confirmed.
    expect(
      frameSpecOf({
        frameSku: 'AWEI1-GUARP-FR-PURPLERAMI-UPGRADE',
        frameLineItemTitle: 'Guardian (Purple) - Purple Ramin Wood Frame - Museum-grade acrylic',
      }),
    ).toEqual({ frameFinish: 'PURPLE', glass: 'Museum-grade acrylic' });
    expect(frameSpecOf({ frameSku: null, frameLineItemTitle: null })).toEqual({
      frameFinish: null,
      glass: null,
    });
  });

  it('writes the warehouse vocabulary: Framed / Print Only, and the set size', () => {
    const framed = order('#90', 'A', {
      framed: true,
      frameSku: 'X-Y-FR-BLACKABACH',
      frameLineItemTitle: 'A - Black Abachi wood frame - UV protective acrylic',
    });
    const other = order('#90', 'B');
    const plan = planAllocation([framed, other]);
    const row = plan.byOrder.get(framed.orderId)![0];
    expect(row.fulfilment).toBe('Framed');
    expect(row.frameFinish).toBe('BLACK');
    expect(row.setSize).toBe(2);
    expect(plan.byOrder.get(other.orderId)![0].fulfilment).toBe('Print Only');
  });

  it('states over-edition demand as evidence, and blocks nothing', () => {
    const plan = planAllocation([order('#95', 'A'), order('#96', 'A')], undefined, 1);
    expect(plan.notes.some((n) => n.kind === 'over_edition')).toBe(true);
    expect(plan.faults).toEqual([]);
  });
});

describe('the audit cannot pass vacuously', () => {
  it('refuses an empty allocation instead of passing on it', () => {
    /* The workbook's check compared #REF!-zero to zero and reported TRUE. */
    const plan = planAllocation([]);
    expect(plan.faults.length).toBeGreaterThan(0);
  });

  it('catches a duplicated number', () => {
    const inputs = [order('#1', 'A'), order('#2', 'A')];
    const plan = planAllocation(inputs);
    plan.byOrder.get(inputs[1].orderId)![0].editionNumber = '1';
    expect(auditAllocation(inputs, plan).some((f) => f.includes('twice'))).toBe(true);
  });

  it('catches a broken set — the exact fault the workbook missed 13 times', () => {
    const inputs = ['A', 'B'].map((k) => order('#3', k));
    const plan = planAllocation(inputs);
    plan.byOrder.get(inputs[1].orderId)![0].editionNumber = '9';
    const faults = auditAllocation(inputs, plan);
    expect(faults.some((f) => f.includes('different numbers across its artworks'))).toBe(true);
  });

  it('catches an unreported gap', () => {
    const inputs = [order('#4', 'A')];
    const plan = planAllocation(inputs);
    plan.byOrder.get(inputs[0].orderId)![0].editionNumber = '5';
    expect(auditAllocation(inputs, plan).some((f) => f.includes('gap'))).toBe(true);
  });
});

describe('the shape of the real release, in miniature', () => {
  it('keeps every sequence gapless and every set matched', () => {
    /* A deterministic scale model of the Murakami census: four artworks, a
       full-set order, pairs, quantity twos, and a tail of singles — the mix
       that was simulated over the real 770 orders before this was built. */
    const inputs: AllocationOrderInput[] = [];
    const arts = ['FLOWE', 'PANDA', 'LOLLI', 'TANBO'];
    inputs.push(...arts.map((k) => order('#100', k, { orderDate: '2026-04-09' })));
    for (let i = 0; i < 6; i += 1) {
      const pair = [arts[i % 4], arts[(i + 1) % 4]];
      inputs.push(...pair.map((k) => order(`#11${i}`, k, { orderDate: `2026-04-1${i}` })));
    }
    inputs.push(...['FLOWE', 'PANDA'].map((k) => order('#120', k, { quantity: 2 })));
    for (let i = 0; i < 12; i += 1) {
      inputs.push(order(`#13${i}`, arts[i % 4], { orderDate: `2026-04-2${i % 8}` }));
    }
    const plan = planAllocation(inputs);
    expect(plan.faults).toEqual([]);
    for (const s of plan.artworks) {
      expect(s.gaps).toEqual([]);
      expect(s.count).toBe(s.highest);
    }
    // And the full-set buyer holds number 1 of everything.
    for (const i of inputs.filter((x) => x.shopifyOrderName === '#100')) {
      expect(first(plan, i)).toBe('1');
    }
  });
});

describe('the warehouse file', () => {
  it('round-trips through the tool’s own importer', async () => {
    /* The export must stay importable by the code that used to consume the
       sheet — that is what "the warehouse sees no change" means, proven. */
    const { warehouseCsv } = await import('../editions');
    const { parseEditionAllocationCsv } = await import('../allocation');
    const inputs = [
      ...['A', 'B'].map((k) => order('#200', k)),
      order('#201', 'A', {
        framed: true,
        frameSku: 'X-Y-FR-BLACKABACH',
        frameLineItemTitle: 'A - Black Abachi wood frame - UV protective acrylic',
      }),
      order('#202', 'B, with a comma', { artworkKey: 'B, with a comma' }),
    ];
    const plan = planAllocation(inputs);
    const csv = warehouseCsv(inputs, plan);
    const back = parseEditionAllocationCsv(csv);
    expect(back.issues).toEqual([]);
    expect(back.rows).toHaveLength(4);
    const framedRow = back.rows.find((r) => r.orderNumber === '#201')!;
    expect(framedRow.allocation.fulfilment).toBe('Framed');
    expect(framedRow.allocation.frameFinish).toBe('BLACK');
    expect(framedRow.allocation.glass).toBe('UV-protective acrylic');
    const comma = back.rows.find((r) => r.orderNumber === '#202')!;
    expect(comma.allocation.printName).toBe('B, with a comma');
  });
});
