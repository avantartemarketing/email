import type {
  BatchFulfilment,
  ImageSlot,
  ProductKind,
  Release,
  TemplateRef,
} from '../types';
import { generateMilestonePlan } from './plan';
import { emptyProductMatch } from './intake';
import {
  PRINT_SEQUENCE,
  SCULPTURE_SEQUENCE,
  imageSlotsForPlan,
  releaseFillerTemplate,
  requiredImageSlots,
  sequenceForBatch,
  slotLabel,
} from './templates';

/**
 * The pane-three preview: what Create is about to do.
 *
 * The owner, 7 Sep 2026: *"When you import a release, it should ask you for
 * the initial batching and promise dates … it determines how many email
 * templates initially need to be populated by an image."*
 *
 * Everything here is the SAME arithmetic the app runs after Create —
 * `generateMilestonePlan` over each dated batch, `requiredImageSlots` for the
 * image bill — run over batches that do not exist yet. That is what lets the
 * pane promise a number the release page's "N emails have no image" band will
 * then repeat: they are one calculation, not two answers.
 */

/** Which batch a promise date at the door addresses. `single` is the one
    batch of a sculpture or an everything-ships-together print release. */
export type ImportBatchKey = BatchFulfilment | 'single';

export interface ImportBatchPreview {
  key: ImportBatchKey;
  /** "Framed" / "Unframed", or the release's own name when it has one batch. */
  name: string;
  orders: number;
  promiseDate: string | null;
}

/** Milestones the operator can include or exclude at setup, per product
    kind. Dispatch anchors every plan and the delay notice is not a milestone,
    so neither is ever on this list. */
export const OPTIONAL_MILESTONES: Record<ProductKind, TemplateRef[]> = {
  print: ['pp-printing', 'pp-signing', 'pp-framing', 'pp-ontrack'],
  sculpture: ['pp-ontrack'],
};

export interface ImportPlanRow {
  /** Row identity — the image slot, so the pane's rows are the emails tab's. */
  slot: ImageSlot;
  ref: TemplateRef;
  label: string;
  /** Queued sends across every dated batch. 0 while no date covers it. */
  sends: number;
  /** The earliest of those sends. */
  firstDate: string | null;
  /** Switched off — never sends, owes no image, kept so it can come back. */
  off: boolean;
  canToggle: boolean;
}

export interface ImportPlanPreview {
  rows: ImportPlanRow[];
  /** Sends Create will draft, across every batch that has a date. */
  emailsQueued: number;
  /** Distinct image slots the release will owe a picture for. */
  imagesToPick: number;
  firstSend: string | null;
}

/** The release as Create will make it, for the pure helpers that read one. */
function draftRelease(kind: ProductKind, disabledTemplates: TemplateRef[]): Release {
  return {
    id: 'draft',
    title: '',
    artist: '',
    productMatch: emptyProductMatch(),
    editionSize: null,
    status: 'active',
    productKind: kind,
    disabledTemplates,
    templateOverrides: {},
    templateImages: {},
    approverId: '',
    createdAt: '',
  };
}

export function previewImportPlan(
  kind: ProductKind,
  disabledTemplates: TemplateRef[],
  batches: ImportBatchPreview[],
  todayIso: string,
): ImportPlanPreview {
  const release = draftRelease(kind, disabledTemplates);
  const shapes = batches.map((b) => ({
    promiseDate: b.promiseDate,
    fulfilment: b.key === 'single' ? undefined : b.key,
  }));

  /* The real generator, per dated batch — never a re-derivation. */
  const bySlot = new Map<ImageSlot, { sends: number; first: string }>();
  let emailsQueued = 0;
  let firstSend: string | null = null;
  for (const shape of shapes) {
    if (!shape.promiseDate) continue;
    const steps = generateMilestonePlan(todayIso, shape.promiseDate, kind, {
      sequence: sequenceForBatch(release, shape),
      fillerTemplate: releaseFillerTemplate(release),
    });
    const slots = imageSlotsForPlan(steps.map((s) => s.templateRef));
    steps.forEach((step, idx) => {
      emailsQueued += 1;
      if (!firstSend || step.scheduledDate < firstSend) firstSend = step.scheduledDate;
      const tally = bySlot.get(slots[idx]);
      if (!tally) bySlot.set(slots[idx], { sends: 1, first: step.scheduledDate });
      else {
        tally.sends += 1;
        if (step.scheduledDate < tally.first) tally.first = step.scheduledDate;
      }
    });
  }

  /* The slots the release will owe a picture for — the emails tab's own list,
     so the pane's "images to pick" is the band the release page will draw. */
  const owed = requiredImageSlots(release, shapes, [], todayIso);

  const row = (slot: ImageSlot, ref: TemplateRef): ImportPlanRow => ({
    slot,
    ref,
    label: slotLabel(slot),
    sends: bySlot.get(slot)?.sends ?? 0,
    firstDate: bySlot.get(slot)?.first ?? null,
    off: disabledTemplates.includes(ref),
    canToggle: OPTIONAL_MILESTONES[kind].includes(ref),
  });

  /* Sequence order, with the on-track slots before dispatch — the emails
     tab's order — and switched-off milestones kept in place: a row that
     vanished when switched off could never be switched back on. */
  const base = kind === 'sculpture' ? SCULPTURE_SEQUENCE : PRINT_SEQUENCE;
  const rows: ImportPlanRow[] = [];
  for (const ref of base) {
    if (ref === 'pp-dispatch') continue;
    rows.push(row(ref as ImageSlot, ref));
  }
  for (const slot of owed) {
    if (/^pp-ontrack-\d+$/.test(slot)) rows.push(row(slot, 'pp-ontrack'));
  }
  rows.push(row('pp-dispatch', 'pp-dispatch'));

  return {
    rows,
    emailsQueued,
    imagesToPick: owed.length,
    firstSend,
  };
}
