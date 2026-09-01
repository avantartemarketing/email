import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, Order, Release, ScheduledSend } from '../types';
import { addDays, daysBetween, formatDay, today } from '../logic/dates';
import { remainingSequence } from '../logic/reschedule';
import { generateMilestonePlan } from '../logic/plan';
import { releaseFillerTemplate, releaseSequenceFor } from '../logic/templates';
import { useApp } from '../ui/AppContext';
import { plural } from '../ui/format';
import { Bar, Dialog, Facts } from '../ui/rd';
import Field from '../rd/components/Field';

/**
 * The reschedule flow: the new promise date, the reason, and what that costs.
 *
 * It used to be two steps, and the second one was writing the delay email.
 * The owner, 29 Aug 2026: "When someone schedules a delay, the job of writing
 * the email goes to the CRM team." So the second step is gone — not moved
 * inside a tab or hidden behind a toggle, but handed to a different team on a
 * different screen, which is the only version of "handed over" that survives
 * a busy afternoon.
 *
 * What is left is one form, and the form got better for losing the other half:
 * the reason is no longer a field you fill in to unlock a text editor you are
 * about to override. It is the BRIEF, and it is the whole of what this person
 * knows and the copywriter does not. The note under it says so.
 *
 * The shape is ruling 20's: read-only context in boxes, "so the figures being
 * changed have something to be changed AGAINST", and the consequence under a
 * hairline reading like the form that caused it.
 */
export function RescheduleModal({
  open,
  onClose,
  release,
  batch,
  batchLabel,
  selectedOrders,
  batchActiveOrderCount,
  batchSends,
  inheritedSentSends = [],
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  release: Release;
  batch: Batch;
  /** Batch name for titles/copy, or null when the release has no splits. */
  batchLabel?: string | null;
  /** Active orders the operator selected (all active orders if none). */
  selectedOrders: Order[];
  batchActiveOrderCount: number;
  /** The batch's current sends — used to preview the regenerated plan. */
  batchSends: ScheduledSend[];
  /** Sent sends inherited from the batch this one was split from. */
  inheritedSentSends?: ScheduledSend[];
  onDone: (message: string) => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateId = useId();

  const isSubset = selectedOrders.length < batchActiveOrderCount;
  const tomorrow = addDays(today(), 1);
  const dateValid = newDate >= tomorrow;
  const dateError = newDate && !dateValid ? 'The new delivery date must be in the future' : null;
  const isLaterThanCurrent = !batch.promiseDate || !newDate || newDate > batch.promiseDate;

  const reset = () => {
    setNewDate('');
    setReason('');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await data.reschedule({
        releaseId: release.id,
        batchId: batch.id,
        orderIds: selectedOrders.map((o) => o.id),
        newPromiseDate: newDate,
        reason: reason.trim(),
        userId: '', // attributed to the signed-in user by the data layer
      });
      /* The toast names the handoff, because the handoff is the part that is
         easy to miss: the old flow ended with an email written and queued, and
         somebody who remembers that flow needs telling that this one ends with
         a job on somebody else's list. A never-split release has no batch
         language anywhere — the toast must not introduce "Batch 1" either. */
      const what = result.splitOccurred
        ? `${result.batch.name} created`
        : batchLabel
          ? `${result.batch.name} rescheduled`
          : 'Delivery rescheduled';
      reset();
      onDone(
        `${what} — CRM notified to write the delay email · ${plural(
          result.regeneratedSends.length,
          'milestone',
        )} pending approval`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      showToast(msg, true);
    } finally {
      setSaving(false);
    }
  };

  // A shape preview of the regenerated plan — the same functions the save path
  // uses, so the count shown is the count that will be created. Inherited sent
  // sends matter: a split batch must not re-promise stages its collectors
  // already received in the batch it came from.
  const previewPlan = dateValid
    ? generateMilestonePlan(today(), newDate, release.productKind, {
        sequence: remainingSequence(releaseSequenceFor(release), [
          ...inheritedSentSends,
          ...batchSends,
        ]),
        fillerTemplate: releaseFillerTemplate(release),
      })
    : [];

  const groupName = batchLabel ?? 'this release';

  /* No promise date means this is the wrong door, and the dialogue says so AT
     the door. It used to render the whole form — date, reason, a live "what
     happens when you save" — and only the save's refusal revealed that none of
     it could ever happen: the owner filled everything in and then met
     "set one first" over his own answers, 1 Sep 2026. A change needs something
     to change; the first date is a different act (no delay, no CRM email) and
     it lives on the batch. */
  if (!batch.promiseDate) {
    return (
      <Dialog
        open={open}
        size="md"
        onClose={close}
        title={batchLabel ? `Change delivery date — ${batchLabel}` : 'Change delivery date'}
        secondary={{ label: 'Close', onClick: close }}
      >
        <Bar tone="note" title={`${groupName} has no promise date yet`}>
          Nothing has been promised, so there is no date to change and no delay email for the
          CRM team to write. Set the first date with <b>Set promise date</b> on{' '}
          {batchLabel ? `the ${batchLabel} batch` : 'the Overview tab'} — the full comms plan
          is created from it.
        </Bar>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      size="md"
      onClose={close}
      title={batchLabel ? `Change delivery date — ${batchLabel}` : 'Change delivery date'}
      primary={{
        label: 'Save — CRM writes the email',
        onClick: () => void save(),
        disabled: saving || !dateValid || !reason.trim() || selectedOrders.length === 0,
      }}
      secondary={{ label: 'Cancel', onClick: close }}
    >
      {error ? <Bar tone="fail">{error}</Bar> : null}
      <Facts
        items={[
          {
            label: 'Moving',
            value: `${selectedOrders.length} of ${batchActiveOrderCount}`,
          },
          { label: 'Current dispatch', value: formatDay(batch.promiseDate) },
          { label: batchLabel ? 'Batch' : 'Release', value: batchLabel ?? release.title },
        ]}
      />
      {selectedOrders.length === 0 ? (
        <Bar tone="fail">No orders selected.</Bar>
      ) : isSubset ? (
        <Bar tone="note" title={`This selection splits ${groupName}`}>
          It gets its own promise date and comms plan; the{' '}
          {batchActiveOrderCount - selectedOrders.length} remaining order
          {batchActiveOrderCount - selectedOrders.length === 1 ? ' keeps' : 's keep'} the current
          plan.
        </Bar>
      ) : null}
      <div className="rd-fields">
        <Field
          label="New promised delivery date"
          value={newDate}
          controlId={dateId}
          note={batch.promiseDate ? `now ${formatDay(batch.promiseDate)}` : 'not set yet'}
        >
          <input
            id={dateId}
            type="date"
            min={tomorrow}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </Field>
        <Field
          label="Reason for the change"
          value={reason}
          onChange={setReason}
          multiline
          /* Short, and still load-bearing: it names who reads this, which is
             what makes somebody write a sentence rather than a word. */
          note="required — the CRM writer works from this"
          noteNear={!reason.trim()}
        />
      </div>
      {dateError ? <Bar tone="fail">{dateError}</Bar> : null}
      {!isLaterThanCurrent && dateValid ? (
        <Bar tone="warn" title="The new date is earlier than the current promise">
          That is allowed, but the delay template assumes bad news — say so in the reason, so
          whoever writes it does not send an apology for good news.
        </Bar>
      ) : null}
      {dateValid && reason.trim() ? (
        <div className="rd-after">
          <div className="rd-after-t">What happens when you save</div>
          <Facts
            items={[
              { label: 'Delay email to', value: plural(selectedOrders.length, 'collector') },
              /* Named, not "the CRM team": the row this creates lands in front
                 of people, and a handoff to a department is a handoff to
                 nobody. */
              { label: 'Written by', value: 'CRM — notified now' },
              {
                label: 'Milestones regenerated',
                value: `${previewPlan.length}${
                  daysBetween(today(), newDate) > 42 ? ' · on-track fillers' : ''
                }`,
              },
              { label: 'Against', value: formatDay(newDate) },
            ]}
          />
        </div>
      ) : null}
    </Dialog>
  );
}
