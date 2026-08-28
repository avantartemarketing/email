import { describe, expect, it } from 'vitest';
import { APPROVAL_HORIZON_DAYS, isOverdueApproval, needsApprovingNow } from '../approvals';
import { addDays } from '../dates';

const T = '2026-08-28';
const pending = (scheduledDate: string) => ({ status: 'pending_approval' as const, scheduledDate });

describe('needsApprovingNow', () => {
  it('takes everything inside the horizon, the boundary day included', () => {
    expect(needsApprovingNow(pending(T), T)).toBe(true);
    expect(needsApprovingNow(pending(addDays(T, APPROVAL_HORIZON_DAYS)), T)).toBe(true);
    expect(needsApprovingNow(pending(addDays(T, APPROVAL_HORIZON_DAYS + 1)), T)).toBe(false);
  });

  it('takes overdue sends too — the latest thing is the most urgent thing', () => {
    expect(needsApprovingNow(pending(addDays(T, -30)), T)).toBe(true);
  });

  it('takes nothing that is not waiting on an approver', () => {
    /* The page's promise is that its rows are work you owe. An approved send
       scheduled for tomorrow is somebody else's problem now. */
    for (const status of ['draft', 'approved', 'sent', 'cancelled'] as const) {
      expect(needsApprovingNow({ status, scheduledDate: T }, T)).toBe(false);
    }
  });

  it('every pending send lands in exactly one half', () => {
    const dates = [-30, -1, 0, 1, 7, 8, 60, 400].map((d) => addDays(T, d));
    for (const date of dates) {
      const now = needsApprovingNow(pending(date), T);
      const coming = !needsApprovingNow(pending(date), T);
      expect(now === coming).toBe(false);
    }
  });
});

describe('isOverdueApproval', () => {
  it('is yesterday and earlier, never today', () => {
    expect(isOverdueApproval(pending(addDays(T, -1)), T)).toBe(true);
    expect(isOverdueApproval(pending(T), T)).toBe(false);
    expect(isOverdueApproval(pending(addDays(T, 1)), T)).toBe(false);
  });

  it('is a subset of what needs approving now', () => {
    const late = pending(addDays(T, -5));
    expect(isOverdueApproval(late, T)).toBe(true);
    expect(needsApprovingNow(late, T)).toBe(true);
  });
});
