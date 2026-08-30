import { useEffect, useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { PendingSendItem, ReleaseDetail } from '../types';
import { daysBetween, formatDayShort, today } from '../logic/dates';
import { needsApprovingNow } from '../logic/approvals';
import { TEMPLATE_LABELS, UNSENT_STATUSES } from '../logic/templates';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Dialog, Facts } from '../ui/rd';
import Field from '../rd/components/Field';

/**
 * Move one send to a different day — "true, but not yet".
 *
 * This is half of what replaced Hold. The owner, 28 Aug 2026: "I don't think
 * someone should be able to click hold. They can reschedule a send, or they
 * can mark it as cancelled." Hold said "not yet" and parked the send in a tab
 * nobody visited; this says "not yet, and here is when". The queue itself is
 * the snooze: a moved email drops out of "To approve now" and re-enters it,
 * badge and all, when its new date comes inside the horizon.
 *
 * **It moves ONE EMAIL, not the promise.** A promise date is what the
 * collector was told, and changing it regenerates the plan and writes a delay
 * notice. Moving a single update does none of that and tells nobody, which is
 * right — a collector never knew when their next progress email was due.
 *
 * ## The guardrails, and the ceiling
 *
 * A hand-moved email can quietly break three plan rules, so the dialogue
 * checks the batch's other sends (fetched when it opens):
 *
 *   - ORDERING — landing on or after the next planned email, or on or before
 *     the previous one, tells the story out of order. Both directions, because
 *     moving a chapter earlier past its predecessor is the same fault
 *     mirrored. A warning, not a block.
 *   - CROWDING — the plan never sends the same collectors two emails inside
 *     seven days, and an email they ALREADY received counts: the floor is
 *     about the collector's inbox, not about our queue.
 *   - THE CEILING — no update can land after the dispatch email, and the
 *     dispatch email cannot go out after the promised window opens. This one
 *     BLOCKS, because a date that does not fit is not an email-timing problem:
 *     it is a promise problem, and the bar hands the approver across to Change
 *     delivery date. Picking an impossible date IS the diagnosis — nobody has
 *     to know which flow they needed in advance.
 *
 * Every advisory waits until the date actually CHANGES. A reschedule mints a
 * delay notice and the first milestone three days apart, so both are crowded
 * by construction — greeting their approver with a complaint about a date
 * nobody has touched teaches them to ignore the bar.
 *
 * The send stays `pending_approval`: moving a date is not approving it, and
 * `updateSend` does not pin the copy the way a hand edit does.
 */
export function ChangeSendDateModal({
  item,
  onClose,
  onMoved,
  onPivot,
}: {
  /** The send being moved, or null when the dialogue is shut. */
  item: PendingSendItem | null;
  onClose: () => void;
  onMoved: (message: string) => void;
  /** Opens Change delivery date for this batch — the ceiling's way out. */
  onPivot?: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [date, setDate] = useState('');
  /** What the field held when it opened — what "changed" is measured against. */
  const [opened, setOpened] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ReleaseDetail | null>(null);
  const dateId = useId();

  useEffect(() => {
    if (!item) return;
    /* An overdue send opens on TODAY, not on the date that has already passed.
       Seeding the field with a past value renders it invalid the moment it is
       drawn, which asks somebody to fix a complaint the app created. */
    const seed = item.send.scheduledDate < today() ? today() : item.send.scheduledDate;
    setDate(seed);
    setOpened(seed);
  }, [item]);

  /* The batch's other sends, for the guardrails. Fetched on open and advisory
     by design: if the fetch fails the move still works — a warning that cannot
     be computed is absent, not a lock on the door. (The ceiling is the one
     that blocks, and it needs this too; with no data there is no ceiling to
     breach, which is the same "cannot compute, do not claim" rule.) */
  useEffect(() => {
    if (!item) {
      setDetail(null);
      return;
    }
    let live = true;
    setDetail(null);
    void data
      .getRelease(item.release.id)
      .then((d) => {
        if (live) setDetail(d);
      })
      .catch(() => {
        /* Warnings only. The move is still bounded by the field's own floor
           and by the checks below, which simply have nothing to say. */
      });
    return () => {
      live = false;
    };
  }, [item, data]);

  const unchanged = Boolean(item && date === item.send.scheduledDate);
  /* A date already gone. `min` on the input stops the picker, not a typed or
     pasted value, and the layer validates nothing — it assigns the date it is
     given. */
  const past = Boolean(date && date < today());
  /* Advisories speak only about a change somebody made — measured against what
     the field OPENED with, not against the stored date. An overdue send seeds
     to today, so comparing with the stored date called it changed before
     anyone touched it, and greeted every overdue send with a complaint about
     a date the dialogue itself had just filled in. */
  const changed = Boolean(item && date && date !== opened);

  const batchSends =
    item && detail ? detail.sends.filter((s) => s.batchId === item.batch.id && s.id !== item.send.id) : [];
  /* Still movable, still ahead: what the ordering and ceiling rules read. */
  const others = batchSends.filter((s) => UNSENT_STATUSES.includes(s.status));

  const isDispatch = item?.send.templateRef === 'pp-dispatch';
  const dispatchSend = others.find((s) => s.templateRef === 'pp-dispatch');
  const promiseDate = item?.batch.promiseDate ?? null;

  /* The ceiling, TAGGED with the rule that produced it — the bar's copy names
     a specific thing, and naming the wrong one invents a fact. With no unsent
     dispatch send the limit is the promise itself, not "the dispatch email",
     which may already have gone out. */
  const ceiling: { date: string; source: 'dispatch' | 'promise' } | null =
    !isDispatch && dispatchSend
      ? { date: dispatchSend.scheduledDate, source: 'dispatch' }
      : promiseDate
        ? { date: promiseDate, source: 'promise' }
        : null;
  const breached = Boolean(
    date &&
      ceiling &&
      (ceiling.source === 'dispatch' ? date >= ceiling.date : date > ceiling.date),
  );

  /* Ordering, both ways. Only sends still genuinely ahead can be cited: an
     overdue sibling goes out when it is approved, so no truthful claim about
     its date can be made, and citing one greeted every overdue send with a
     warning naming a date in the past. */
  const ahead = others.filter((s) => s.scheduledDate >= today());
  const next = ahead
    .filter((s) => s.scheduledDate > (item?.send.scheduledDate ?? ''))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
  const prev = ahead
    .filter((s) => s.scheduledDate < (item?.send.scheduledDate ?? ''))
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))[0];
  const clashesWith =
    changed && next && date >= next.scheduledDate
      ? { send: next, after: true }
      : changed && prev && date <= prev.scheduledDate
        ? { send: prev, after: false }
        : null;

  /* Crowding is about the COLLECTOR'S inbox, so it counts what they have
     already had as well as what is queued: an update three days after the
     framing email they received on Tuesday is the fault this rule exists to
     stop. A cancelled send is not in anybody's inbox and is excluded. */
  const crowdingPool = batchSends
    .filter((s) => s.status !== 'cancelled')
    .map((s) => ({ subject: s.subject, day: s.sentAt ? s.sentAt.slice(0, 10) : s.scheduledDate }));
  const nearest = date
    ? crowdingPool.reduce<number | null>((min, s) => {
        const gap = Math.abs(daysBetween(date, s.day));
        return min === null || gap < min ? gap : min;
      }, null)
    : null;
  const crowded = changed && nearest !== null && nearest < 7;

  const move = async (): Promise<void> => {
    if (!item) return;
    setSaving(true);
    try {
      await data.updateSend(item.send.id, { scheduledDate: date });
      /* The owner's words: it "comes round for approval again". Say so when
         the move takes it out of this week's worklist — and only then, since
         an email still due inside the horizon never left. */
      onMoved(
        needsApprovingNow({ status: 'pending_approval', scheduledDate: date })
          ? `Moved to ${formatDayShort(date)} — still waiting for approval`
          : `Moved to ${formatDayShort(date)} — it comes back up for approval nearer the time`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={item !== null}
      size="sm"
      title="Change email date"
      onClose={onClose}
      primary={{
        label: 'Move send',
        onClick: () => void move(),
        disabled: saving || !date || unchanged || breached || past,
      }}
      secondary={{ label: 'Keep the date', onClick: onClose }}
    >
      {item ? (
        <>
          <Facts
            items={[
              { label: 'Email', value: TEMPLATE_LABELS[item.send.templateRef] },
              { label: 'Release', value: item.release.title },
              { label: 'Recipients', value: plural(item.recipientCount, 'collector') },
              { label: 'Currently', value: formatDayShort(item.send.scheduledDate) },
            ]}
          />
          <div className="rd-fields">
            <Field
              label="New date"
              value={date}
              controlId={dateId}
              note="moves this email only, not the delivery promise"
            >
              <input
                id={dateId}
                type="date"
                min={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          {/* One bar at a time, worst first: a date that cannot be saved does
              not also need to hear that it is out of order. Every one of these
              shuts or qualifies a control, which is the rule they exist for. */}
          {past ? (
            <Bar tone="warn" title="That date has already passed">
              Pick today or later. An email cannot be scheduled backwards — to send it as soon as
              possible, leave it on today and approve it.
            </Bar>
          ) : breached && ceiling ? (
            <Bar
              tone="warn"
              title={
                isDispatch
                  ? 'The dispatch email cannot go out after the window opens'
                  : ceiling.source === 'dispatch'
                    ? 'An update cannot land after the dispatch email'
                    : 'An update cannot land after the promised window opens'
              }
            >
              {ceiling.source === 'dispatch'
                ? `The dispatch email goes out ${formatDayShort(ceiling.date)}. `
                : `Collectors were promised dispatch from ${formatDayShort(ceiling.date)}. `}
              If dispatch itself is slipping, change the delivery date instead — collectors get a
              delay notice and the plan is rebuilt around the new date.
              {onPivot ? (
                <button type="button" className="rd-inline-pill" onClick={onPivot}>
                  Change delivery date
                </button>
              ) : null}
            </Bar>
          ) : clashesWith ? (
            <Bar tone="warn" title="This would arrive out of order">
              “{TEMPLATE_LABELS[clashesWith.send.templateRef]}” goes out{' '}
              {formatDayShort(clashesWith.send.scheduledDate)} — this email would land{' '}
              {date === clashesWith.send.scheduledDate
                ? 'the same day'
                : clashesWith.after
                  ? 'after it'
                  : 'before it'}
              , telling the story out of sequence. Allowed, but check that is what you mean.
            </Bar>
          ) : crowded && nearest !== null ? (
            <Bar tone="warn" title="Two emails close together">
              These collectors get another email within{' '}
              {nearest === 0 ? 'the same day' : plural(nearest, 'day')} of this one — the plan
              itself never sends two inside a week.
            </Bar>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}
