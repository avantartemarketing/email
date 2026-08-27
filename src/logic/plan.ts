import type { ProductKind, TemplateRef } from '../types';
import { addDays, daysBetween } from './dates';
import { PRINT_SEQUENCE, SCULPTURE_SEQUENCE } from './templates';

/**
 * Comms plan generation.
 *
 * Given "today" and a promise date, produce an ordered list of milestone
 * sends spaced no more than ~5 weeks apart:
 *   - the final send is always the dispatch email, shortly before the
 *     promise date;
 *   - short windows drop earlier milestones (last-n of the sequence) —
 *     if delivery is three weeks out, the work is past printing;
 *   - long windows (sculptures) insert generic "on track" fillers between
 *     milestones so collectors never go silent for months.
 *
 * Pure function: no clock access, no IDs, no persistence. The data layer
 * turns PlannedSteps into ScheduledSends.
 */

export interface PlanOptions {
  /** Milestone sequence to draw from; defaults by product kind. */
  sequence?: TemplateRef[];
  /** Hard ceiling on the gap between consecutive sends (default 35 days = 5 weeks). */
  maxGapDays?: number;
  /** Don't stack sends closer than this (default 7 days). */
  minGapDays?: number;
  /** Earliest the first milestone may fire, counted from today (default 3 days). */
  firstLeadDays?: number;
  /** How far before the promise date the dispatch email lands (default 5 days). */
  dispatchLeadDays?: number;
  /**
   * Template used to fill long gaps (default pp-ontrack). Pass null for no
   * fillers at all — e.g. a release that switched the on-track email off.
   */
  fillerTemplate?: TemplateRef | null;
}

export interface PlannedStep {
  templateRef: TemplateRef;
  scheduledDate: string;
}

export function defaultSequenceFor(kind: ProductKind): TemplateRef[] {
  return kind === 'sculpture' ? SCULPTURE_SEQUENCE : PRINT_SEQUENCE;
}

export function generateMilestonePlan(
  nowDay: string,
  promiseDate: string,
  kind: ProductKind,
  options: PlanOptions = {},
): PlannedStep[] {
  const sequence = options.sequence ?? defaultSequenceFor(kind);
  const maxGap = options.maxGapDays ?? 35;
  const minGap = options.minGapDays ?? 7;
  const firstLead = options.firstLeadDays ?? 3;
  const dispatchLead = options.dispatchLeadDays ?? 5;
  const filler = options.fillerTemplate === undefined ? 'pp-ontrack' : options.fillerTemplate;

  if (sequence.length === 0) return [];

  const window = daysBetween(nowDay, promiseDate);
  // Promise date is today or already past — nothing sensible to generate;
  // the operator should reschedule instead.
  if (window < 1) return [];

  // The dispatch email lands a few days before the promise date, but never
  // in the past and always at least tomorrow.
  let dispatchDay = addDays(promiseDate, -dispatchLead);
  if (daysBetween(nowDay, dispatchDay) < 1) dispatchDay = addDays(nowDay, 1);

  const firstDay = addDays(nowDay, firstLead);
  const span = daysBetween(firstDay, dispatchDay);

  // Window too tight for more than the dispatch email.
  if (span < minGap) {
    return [{ templateRef: sequence[sequence.length - 1], scheduledDate: dispatchDay }];
  }

  // How many sends: enough that no gap exceeds maxGap, capped so no gap
  // falls under minGap, aiming for the full sequence when it fits. With no
  // filler available, the sequence is all there is — gaps may stretch.
  const minSends = Math.ceil(span / maxGap) + 1;
  const maxSends = Math.floor(span / minGap) + 1;
  let count = Math.max(minSends, Math.min(sequence.length, maxSends));
  if (filler === null) count = Math.min(count, sequence.length);

  // Pick templates for `count` slots. `filler` can only be null when count
  // was capped to the sequence length, i.e. `fillers` below is 0.
  let templates: TemplateRef[];
  if (count >= sequence.length) {
    // Whole sequence, with fillers distributed across the gaps between
    // consecutive milestones (never after dispatch).
    const fillers = count - sequence.length;
    const gaps = sequence.length - 1;
    templates = [];
    if (gaps === 0) {
      // Single-step sequence: fillers all precede the final step.
      for (let f = 0; f < fillers; f++) templates.push(filler as TemplateRef);
      templates.push(sequence[0]);
    } else {
      const base = Math.floor(fillers / gaps);
      const extra = fillers % gaps;
      sequence.forEach((step, idx) => {
        templates.push(step);
        if (idx < gaps) {
          // Bias extras toward the later gaps — the long quiet stretch is
          // usually near the end of production.
          const fillersHere = base + (idx >= gaps - extra ? 1 : 0);
          for (let f = 0; f < fillersHere; f++) templates.push(filler as TemplateRef);
        }
      });
    }
  } else {
    // Short window: keep the *last* `count` milestones — always ending in
    // dispatch — since the earlier stages are already behind us.
    templates = sequence.slice(sequence.length - count);
  }

  // Spread the sends evenly from firstDay to dispatchDay.
  const steps: PlannedStep[] = templates.map((templateRef, idx) => {
    const offset =
      templates.length === 1 ? span : Math.round((idx * span) / (templates.length - 1));
    return { templateRef, scheduledDate: addDays(firstDay, offset) };
  });
  // Guarantee the last send sits exactly on dispatch day (rounding safety).
  steps[steps.length - 1].scheduledDate = dispatchDay;
  return steps;
}
