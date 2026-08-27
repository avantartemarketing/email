import { describe, expect, it } from 'vitest';
import { daysBetween } from '../dates';
import { generateMilestonePlan } from '../plan';

const NOW = '2026-08-27';

function gaps(dates: string[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < dates.length; i++) out.push(daysBetween(dates[i - 1], dates[i]));
  return out;
}

describe('generateMilestonePlan', () => {
  it('returns nothing when the promise date is today or in the past', () => {
    expect(generateMilestonePlan(NOW, NOW, 'print')).toEqual([]);
    expect(generateMilestonePlan(NOW, '2026-08-01', 'print')).toEqual([]);
  });

  it('collapses a very short window to a single dispatch email', () => {
    const plan = generateMilestonePlan(NOW, '2026-09-05', 'print'); // 9 days out
    expect(plan).toHaveLength(1);
    expect(plan[0].templateRef).toBe('pp-dispatch');
    const d = plan[0].scheduledDate;
    expect(daysBetween(NOW, d)).toBeGreaterThanOrEqual(1);
    expect(daysBetween(d, '2026-09-05')).toBeGreaterThanOrEqual(0);
  });

  it('drops early milestones for a short window but always ends with dispatch', () => {
    const plan = generateMilestonePlan(NOW, '2026-09-24', 'print'); // 4 weeks out
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan.length).toBeLessThan(4);
    expect(plan[plan.length - 1].templateRef).toBe('pp-dispatch');
    // Last-n of the sequence: no printing email three weeks before delivery.
    expect(plan.map((s) => s.templateRef)).not.toContain('pp-printing');
  });

  it('uses the full print sequence for a comfortable window', () => {
    const plan = generateMilestonePlan(NOW, '2026-12-04', 'print'); // ~14 weeks
    expect(plan.map((s) => s.templateRef)).toEqual([
      'pp-printing',
      'pp-signing',
      'pp-framing',
      'pp-dispatch',
    ]);
    for (const gap of gaps(plan.map((s) => s.scheduledDate))) {
      expect(gap).toBeLessThanOrEqual(35);
      expect(gap).toBeGreaterThanOrEqual(7);
    }
  });

  it('inserts on-track fillers for long windows and never exceeds the max gap', () => {
    const plan = generateMilestonePlan(NOW, '2027-04-30', 'print'); // ~8 months
    const refs = plan.map((s) => s.templateRef);
    expect(refs).toContain('pp-ontrack');
    expect(refs[refs.length - 1]).toBe('pp-dispatch');
    // Milestones keep their order.
    const milestonesOnly = refs.filter((r) => r !== 'pp-ontrack');
    expect(milestonesOnly).toEqual(['pp-printing', 'pp-signing', 'pp-framing', 'pp-dispatch']);
    for (const gap of gaps(plan.map((s) => s.scheduledDate))) {
      expect(gap).toBeLessThanOrEqual(35);
    }
  });

  it('plans sculptures as on-track updates ending in dispatch', () => {
    const plan = generateMilestonePlan(NOW, '2027-02-27', 'sculpture'); // 6 months
    const refs = plan.map((s) => s.templateRef);
    expect(refs[refs.length - 1]).toBe('pp-dispatch');
    expect(refs.slice(0, -1).every((r) => r === 'pp-ontrack')).toBe(true);
    expect(refs.length).toBeGreaterThanOrEqual(5); // ~180 days / 35 max gap
    for (const gap of gaps(plan.map((s) => s.scheduledDate))) {
      expect(gap).toBeLessThanOrEqual(35);
    }
  });

  it('schedules the dispatch email shortly before the promise date', () => {
    const plan = generateMilestonePlan(NOW, '2026-12-04', 'print');
    const last = plan[plan.length - 1].scheduledDate;
    expect(daysBetween(last, '2026-12-04')).toBe(5);
  });

  it('keeps all dates strictly in the future', () => {
    for (const promise of ['2026-08-30', '2026-10-01', '2027-06-01']) {
      const plan = generateMilestonePlan(NOW, promise, 'print');
      for (const step of plan) {
        expect(daysBetween(NOW, step.scheduledDate)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
