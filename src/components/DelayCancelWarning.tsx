import type { ReactElement } from 'react';
import type { ScheduledSend } from '../types';
import { shipWindowShort } from '../logic/templates';
import { Bar } from '../ui/rd';

/**
 * The one consequence a cancel dialog must not omit when the send is a delay
 * notice: the delivery date has ALREADY moved, and cancelling the email does
 * not move it back — it only means the collectors are never told.
 *
 * It used to live only in the /copy cancel dialog; the same act from My
 * approvals, Send detail or the batch tab showed the generic copy, and the
 * approver — the person most likely to cancel — was the one screen away from
 * the warning. One component now, everywhere a delay send can be cancelled.
 */
export function DelayCancelWarning({ send }: { send: ScheduledSend }): ReactElement | null {
  if (send.type !== 'delay') return null;
  return (
    <Bar
      tone="warn"
      title={`Delivery date already moved to ${
        send.brief ? shipWindowShort(send.brief.newPromiseDate) : 'a new date'
      }`}
    />
  );
}
