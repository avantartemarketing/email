import { describe, expect, it } from 'vitest';
import { addDays, today } from '../dates';
import type { ImportBatchPreview } from '../importPlan';
import { previewImportPlan } from '../importPlan';

/**
 * The pane-three preview must be the SAME arithmetic the app runs after
 * Create — these tests hold it to the generator's real outputs, so the
 * number promised at the door is the number the release page then states.
 */

const T = today();

const split: ImportBatchPreview[] = [
  { key: 'framed', name: 'Framed', orders: 58, promiseDate: addDays(T, 120) },
  { key: 'unframed', name: 'Unframed', orders: 79, promiseDate: addDays(T, 40) },
];

const single = (promiseDate: string | null): ImportBatchPreview[] => [
  { key: 'single', name: 'This release', orders: 10, promiseDate },
];

describe('previewImportPlan', () => {
  it('counts the real plans: framing only for the framed batch, dispatch for both', () => {
    const p = previewImportPlan('print', [], split, T);
    const row = (slot: string) => p.rows.find((r) => r.slot === slot)!;
    expect(row('pp-framing').sends).toBe(1);
    expect(row('pp-dispatch').sends).toBe(2);
    /* The totals are the rows' totals — one calculation, not two answers. */
    expect(p.emailsQueued).toBe(p.rows.reduce((n, r) => n + r.sends, 0));
    expect(p.emailsQueued).toBeGreaterThan(0);
    /* First send is the generator's own lead time from today. */
    expect(p.firstSend).toBe(addDays(T, 3));
  });

  it('a switched-off milestone keeps its row but loses its sends and its image', () => {
    const on = previewImportPlan('print', [], split, T);
    const off = previewImportPlan('print', ['pp-printing'], split, T);
    const row = off.rows.find((r) => r.ref === 'pp-printing')!;
    expect(row.off).toBe(true);
    expect(row.sends).toBe(0);
    expect(off.imagesToPick).toBe(on.imagesToPick - 1);
  });

  it('no dates: nothing queued, but the image bill already lists the sequence', () => {
    const p = previewImportPlan('print', [], single(null), T);
    expect(p.emailsQueued).toBe(0);
    expect(p.firstSend).toBeNull();
    expect(p.imagesToPick).toBeGreaterThan(0);
    expect(p.rows.some((r) => r.slot === 'pp-dispatch')).toBe(true);
  });

  it('a long wait inserts on-track rows, one image slot each', () => {
    const p = previewImportPlan('print', [], single(addDays(T, 200)), T);
    const ontracks = p.rows.filter((r) => r.ref === 'pp-ontrack' && !r.off);
    expect(ontracks.length).toBeGreaterThan(0);
    expect(new Set(ontracks.map((r) => r.slot)).size).toBe(ontracks.length);
    /* Each filler needs its own picture, and the bill says so. */
    const shorter = previewImportPlan('print', [], single(addDays(T, 40)), T);
    expect(p.imagesToPick).toBeGreaterThan(shorter.imagesToPick);
  });

  it('sculpture previews the production sequence, not the print one', () => {
    const p = previewImportPlan('sculpture', [], single(addDays(T, 90)), T);
    const refs = p.rows.map((r) => r.ref);
    expect(refs).toContain('pp-production');
    expect(refs).not.toContain('pp-framing');
    expect(refs).not.toContain('pp-printing');
  });
});
