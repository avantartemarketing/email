import type { ScheduledSend } from '../types';
import { addDays, today } from './dates';

/**
 * When an approval stops being something to read and starts being something
 * to do.
 *
 * The owner, 28 Aug 2026: "a my approvals page, which shows both live
 * approvals that need making now, and all future approvals that are coming up
 * that you will have to approve."
 *
 * Those are two different readings of one list. Approving a send scheduled for
 * January does nothing today — it just queues it for January — so a queue that
 * shows a send four months out beside one going out tomorrow, sorted by date
 * and otherwise identical, makes the reader do the triage the screen should
 * have done. The split is the screen's whole job, so the rule is written once,
 * here, and the page, the two tables and the rail's badge all read it. It was
 * on its way to being typed in three places, which is how a boundary starts
 * disagreeing with itself.
 */

/**
 * How far ahead an approval is still "now": the week the approver is in.
 *
 * Not "today or earlier", which would make the working list mean "the things
 * already late" and quietly file tomorrow's send under Coming up. Not a month,
 * which puts work in front of somebody a fortnight before they can do anything
 * useful with it. A week is the unit this job is actually done in — you sit
 * down, clear what goes out before you next sit down, and read the rest.
 */
export const APPROVAL_HORIZON_DAYS = 7;

/** Waiting on an approver, and going out inside the week they are in. */
export function needsApprovingNow(
  send: Pick<ScheduledSend, 'status' | 'scheduledDate'>,
  todayDay = today(),
): boolean {
  return (
    send.status === 'pending_approval' &&
    send.scheduledDate <= addDays(todayDay, APPROVAL_HORIZON_DAYS)
  );
}

/**
 * Its date has passed and it still has not been approved.
 *
 * Inside "now" by construction rather than a third bucket: a past date is
 * necessarily inside the horizon, and it is the same work with more urgency,
 * not different work. The page draws the difference in a column instead.
 */
export function isOverdueApproval(
  send: Pick<ScheduledSend, 'status' | 'scheduledDate'>,
  todayDay = today(),
): boolean {
  return send.status === 'pending_approval' && send.scheduledDate < todayDay;
}
