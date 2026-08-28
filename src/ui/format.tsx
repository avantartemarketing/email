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

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
