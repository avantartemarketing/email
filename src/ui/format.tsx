/**
 * The words and the marks this app puts on a state.
 *
 * Two shapes and the shape carries the distinction (ruling 12): a PILL is a
 * status — a send that is drafted today and sent on Friday — and a TAG is a
 * category, which does not change because time passed. A release's product
 * kind and a batch's framed/unframed flow are taxonomy and take tags; every
 * status here takes a pill. Each tone is the role its token names, so nothing
 * is tinted by taste: blue is scheduled, amber wants somebody, green is done,
 * violet is waiting on something, red is late, grey is at rest.
 */
import type { ReactElement } from 'react';
import type {
  BatchFulfilment,
  ProductKind,
  ReleaseStatus,
  ScheduledSend,
  TemplateRef,
} from '../types';
import { today } from '../logic/dates';
import { Pill, Tag } from './rd';

export const TEMPLATE_LABELS: Record<TemplateRef, string> = {
  'pp-printing': 'Printing in progress',
  'pp-signing': 'Signing',
  'pp-framing': 'Framing',
  'pp-dispatch': 'Preparing for dispatch',
  'pp-ontrack': 'On track',
  'pp-delay': 'Delay notice',
};

export function isOverdue(send: ScheduledSend, todayDay = today()): boolean {
  return (
    (send.status === 'pending_approval' || send.status === 'approved') &&
    send.scheduledDate < todayDay
  );
}

export function sendStatusBadge(send: ScheduledSend): ReactElement {
  if (isOverdue(send)) {
    return (
      <Pill tone="red">
        {send.status === 'pending_approval' ? 'Overdue — to approve' : 'Overdue — queued'}
      </Pill>
    );
  }
  switch (send.status) {
    case 'draft':
      return <Pill tone="grey">Draft</Pill>;
    case 'pending_approval':
      return <Pill tone="amber">Pending approval</Pill>;
    case 'approved':
      return <Pill tone="blue">Queued</Pill>;
    case 'sent':
      return <Pill tone="green">Sent</Pill>;
    case 'held':
      return <Pill tone="violet">Held</Pill>;
    case 'cancelled':
      return <Pill tone="grey">Cancelled</Pill>;
  }
}

export function releaseStatusBadge(status: ReleaseStatus): ReactElement {
  return status === 'active' ? (
    <Pill tone="blue">Active</Pill>
  ) : (
    <Pill tone="green">Completed</Pill>
  );
}

/** What the thing IS — taxonomy, so a tag and never a pill. */
export function productKindTag(kind: ProductKind): ReactElement {
  return kind === 'print' ? (
    <Tag tone="violet">Print</Tag>
  ) : (
    <Tag tone="sand">Sculpture</Tag>
  );
}

/** Which flow a batch runs on. Also taxonomy: a framed order never unframes. */
export function fulfilmentTag(fulfilment: BatchFulfilment | undefined): ReactElement | null {
  if (!fulfilment) return null;
  return fulfilment === 'framed' ? (
    <Tag tone="steel">Framed</Tag>
  ) : (
    <Tag tone="stone">Unframed</Tag>
  );
}

/**
 * A frame finish, with the finish itself shown.
 *
 * The owner asked for "a little colour icon next to it (black, white, etc.)".
 * The swatch is the thing somebody scanning the column is actually after —
 * BLACK and DARK BROWN are two words that start differently and look almost
 * the same in a list, and two dots do not. The word stays: colour never
 * carries meaning alone, and a swatch on its own would be unreadable to
 * anyone who cannot separate them.
 *
 * The colours are the FINISHES, not this product's palette — the same
 * category as the flags, and for the same reason they are not tokens: they
 * are a picture of a physical thing. An unknown finish gets the word and no
 * swatch rather than a guessed colour.
 */
const FINISH: Record<string, string> = {
  BLACK: '#1b1b1b',
  WHITE: '#f4f2ee',
  'NATURAL OAK': '#c9a227',
  OAK: '#c9a227',
  'DARK BROWN': '#5a3a24',
  WALNUT: '#5a3a24',
  MAPLE: '#e0cba8',
  GREEN: '#2f4f3a',
  'FOREST GREEN': '#2f4f3a',
  NAVY: '#1f2a44',
  SILVER: '#c3c6c9',
  GOLD: '#b9962e',
  BRASS: '#b08d3f',
  ASH: '#d8cfc0',
};

export function frameFinishTag(finish: string | null | undefined): ReactElement | null {
  if (!finish) return null;
  const swatch = FINISH[finish.trim().toUpperCase()];
  return (
    <span className="rd-ctag rd-ctag-stone rd-swatchtag">
      {swatch ? (
        <span className="rd-swatch" style={{ background: swatch }} aria-hidden />
      ) : null}
      {finish}
    </span>
  );
}

/** What is physically being made — Framed, Print Only. Taxonomy, so a tag. */
export function fulfilmentValueTag(value: string | null | undefined): ReactElement | null {
  if (!value) return null;
  return /framed/i.test(value) && !/unframed/i.test(value) ? (
    <Tag tone="steel">{value}</Tag>
  ) : (
    <Tag tone="stone">{value}</Tag>
  );
}

/** A spec value that is one of a short fixed list — glass, mounting. */
export function specTag(value: string | null | undefined): ReactElement | null {
  if (!value) return null;
  return <Tag tone="slate">{value}</Tag>;
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
