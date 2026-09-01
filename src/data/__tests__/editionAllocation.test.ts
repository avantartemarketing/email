import { beforeAll, describe, expect, it } from 'vitest';
import type { DataLayer } from '../DataLayer';
import { createSeededMockDataLayer } from '../mock/seed';
import { parseEditionAllocationCsv } from '../../logic/allocation';

/**
 * The allocation calculator through the public DataLayer interface — the
 * same calls the Editions tab makes, over the seeded world.
 */

let layer: DataLayer;
beforeAll(async () => {
  const mock = await createSeededMockDataLayer();
  mock.simulatedLatencyMs = 0;
  layer = mock;
});

async function releaseByTitle(title: string) {
  const summary = (await layer.listReleases()).find((s) => s.release.title === title);
  if (!summary) throw new Error(`Seed missing release: ${title}`);
  return summary.release;
}

describe('allocating Harbour Light — three artworks, nothing numbered yet', () => {
  it('previews a matched, gapless numbering and commits exactly it', async () => {
    const release = await releaseByTitle('Harbour Light');
    const preview = await layer.previewAllocation(release.id);
    expect(preview.faults).toEqual([]);
    expect(preview.kept).toBe(0);
    expect(preview.numbered).toBeGreaterThan(0);
    expect(preview.artworks.map((a) => a.artworkName)).toEqual([
      'Harbour Light (Dawn)',
      'Harbour Light (Dusk)',
      'Harbour Light (Tide)',
    ]);
    for (const a of preview.artworks) {
      expect(a.gaps).toEqual([]);
      expect(a.count).toBe(a.highest);
    }

    const committed = await layer.commitAllocation(release.id);
    expect(committed.numbered).toBe(preview.numbered);

    /* #RS2103 bought Dawn and Dusk in one order — the matched-set case the
       workbook got wrong 13 times. Both its rows carry ONE number. */
    const detail = await layer.getRelease(release.id);
    const rs2103 = detail.orders.filter((o) => o.shopifyOrderName === '#RS2103');
    expect(rs2103).toHaveLength(2);
    const numbers = rs2103.map((o) => o.allocations?.[0]?.editionNumber);
    expect(numbers[0]).toBeDefined();
    expect(numbers[0]).toBe(numbers[1]);
    /* And the whole-set buyer holds the LOWEST number of the ones issued to
       multi-artwork orders — largest set first is the rule. */
    expect(rs2103.every((o) => o.allocations?.[0]?.editionNumber === '1')).toBe(true);
  });

  it('re-running keeps every number and numbers nothing twice', async () => {
    const release = await releaseByTitle('Harbour Light');
    const again = await layer.previewAllocation(release.id);
    expect(again.numbered).toBe(0);
    expect(again.kept).toBeGreaterThan(0);
    expect(again.notes.some((n) => n.kind === 'kept')).toBe(true);
  });

  it('exports the warehouse file, and the tool can import its own export', async () => {
    const release = await releaseByTitle('Harbour Light');
    const { fileName, csv } = await layer.allocationCsv(release.id);
    expect(fileName).toBe('Harbour Light - Edition Allocation.csv');
    const back = parseEditionAllocationCsv(csv);
    expect(back.issues).toEqual([]);
    expect(back.rows.length).toBeGreaterThan(0);
    // The framed collector's row carries the finish the frame line stated.
    const framed = back.rows.filter((r) => r.allocation.fulfilment === 'Framed');
    expect(framed.length).toBeGreaterThan(0);
    expect(framed.some((r) => r.allocation.frameFinish === 'BLACK')).toBe(true);
  });

  it('undo clears the numbers, and a fresh run starts from 1', async () => {
    const release = await releaseByTitle('Harbour Light');
    const cleared = await layer.undoAllocation(release.id);
    expect(cleared).toBeGreaterThan(0);
    const fresh = await layer.previewAllocation(release.id);
    expect(fresh.kept).toBe(0);
    // Put the world back for any later test.
    await layer.commitAllocation(release.id);
  });
});

describe('over an imported warehouse sheet', () => {
  it('treats every imported number as a pin', async () => {
    const release = await releaseByTitle('Falling Light');
    const before = await layer.getRelease(release.id);
    const numbered = before.orders.filter((o) => !o.removed && (o.allocations?.length ?? 0) > 0);
    expect(numbered.length).toBeGreaterThan(0);
    const preview = await layer.previewAllocation(release.id);
    expect(preview.kept).toBe(numbered.length);
  });

  it('finds the corruption in the sheet, names it, and refuses to build on it', async () => {
    /* The seeded warehouse sheet carries one real-world fault on purpose:
       #AA10418 bought a framed and an unframed print, and the sheet numbered
       BOTH edition 5 — two physical prints holding one number. The workbook's
       own validators passed silently over exactly this class of fault, 13
       times, which is the reason this audit exists and the reason it blocks. */
    const release = await releaseByTitle('Falling Light');
    const preview = await layer.previewAllocation(release.id);
    expect(preview.faults.some((f) => f.includes('edition 5 is held twice by #AA10418'))).toBe(true);
    expect(preview.faults.some((f) => f.includes('#AA10418'))).toBe(true);

    await expect(layer.commitAllocation(release.id)).rejects.toThrow(/edition 5 is held twice/);

    // And nothing was written: refusal leaves the unnumbered unnumbered.
    const after = await layer.getRelease(release.id);
    const stillBare = after.orders.filter(
      (o) => !o.removed && (o.allocations?.length ?? 0) === 0,
    );
    expect(stillBare.length).toBeGreaterThan(0);
  });
});
