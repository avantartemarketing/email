import { Badge } from '@shopify/polaris';
import type { ReactElement } from 'react';
import type { ReleaseStatus, ScheduledSend, TemplateRef } from '../types';
import { today } from '../logic/dates';

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
      <Badge tone="critical">
        {send.status === 'pending_approval' ? 'Overdue — pending approval' : 'Overdue — queued'}
      </Badge>
    );
  }
  switch (send.status) {
    case 'draft':
      return <Badge>Draft</Badge>;
    case 'pending_approval':
      return <Badge tone="attention">Pending approval</Badge>;
    case 'approved':
      return <Badge tone="info">Approved — queued</Badge>;
    case 'sent':
      return <Badge tone="success">Sent</Badge>;
    case 'held':
      return <Badge tone="warning">Held</Badge>;
    case 'cancelled':
      return <Badge>Cancelled</Badge>;
  }
}

export function releaseStatusBadge(status: ReleaseStatus): ReactElement {
  return status === 'active' ? (
    <Badge tone="success">Active</Badge>
  ) : (
    <Badge tone="info">Completed</Badge>
  );
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
