import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, Order, Release, ScheduledSend } from '../types';
import { addDays, daysBetween, formatDay, today } from '../logic/dates';
import { buildDefaultDelayEmail, remainingSequence } from '../logic/reschedule';
import { generateMilestonePlan } from '../logic/plan';
import {
  buildNextSteps,
  buildTemplateFields,
  effectiveTemplate,
  patchTokens,
  releaseFillerTemplate,
  releaseSequenceFor,
} from '../logic/templates';
import { EmailPreview } from './EmailPreview';
import { useApp } from '../ui/AppContext';
import { plural } from '../ui/format';
import { Bar, Dialog, Facts } from '../ui/rd';
import Field from '../rd/components/Field';

/**
 * The reschedule flow as a stepped dialogue:
 *   Step 1 — the facts as they stand, then the new promise date and the reason
 *            (required). A selection smaller than the batch splits it.
 *   Step 2 — the consequence, then the delay email pre-filled from the delay
 *            master, then the preview. Saving parks everything as pending.
 *
 * The shape of both steps is ruling 20's: read-only context in boxes, "so the
 * figures being changed have something to be changed AGAINST", and the
 * consequence under a hairline reading like the form that caused it — never as
 * prose and never as a bulleted diff.
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
  const [step, setStep] = useState<1 | 2>(1);
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copyEdited, setCopyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateId = useId();

  const isSubset = selectedOrders.length < batchActiveOrderCount;
  const tomorrow = addDays(today(), 1);
  const dateValid = newDate >= tomorrow;
  const dateError = newDate && !dateValid ? 'The new delivery date must be in the future' : null;
  const isLaterThanCurrent = !batch.promiseDate || !newDate || newDate > batch.promiseDate;

  const reset = () => {
    setStep(1);
    setNewDate('');
    setReason('');
    setSubject('');
    setBody('');
    setCopyEdited(false);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const goToStep2 = () => {
    // Pre-fill the delay email unless the operator already edited it.
    if (!copyEdited) {
      const draft = buildDefaultDelayEmail(release, batch.promiseDate, newDate, reason);
      setSubject(draft.subject);
      setBody(draft.body);
    }
    setStep(2);
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
        delaySubject: subject,
        delayBody: body,
        userId: '', // attributed to the signed-in user by the data layer
      });
      const sendCount = 1 + result.regeneratedSends.length;
      // A never-split release has no batch language anywhere — the toast must
      // not introduce "Batch 1" either.
      const message = result.splitOccurred
        ? `${result.batch.name} created — ${plural(sendCount, 'send')} pending approval`
        : `${
            batchLabel ? `${result.batch.name} rescheduled` : 'Delivery rescheduled'
          } — ${plural(sendCount, 'send')} pending approval`;
      reset();
      onDone(message);
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

  // The step-2 preview must show the email exactly as it will save: the saved
  // delay send also carries a headline and the regenerated plan as its "What
  // happens next?" card.
  const previewFields = dateValid ? buildTemplateFields(release, newDate) : {};
  const previewHeadline = dateValid
    ? patchTokens(effectiveTemplate(release, 'pp-delay').headline, previewFields)
    : undefined;
  const previewSteps = dateValid
    ? buildNextSteps(
        previewPlan.map((s) => s.templateRef),
        previewFields,
      )
    : [];

  const groupName = batchLabel ?? 'this release';

  return (
    <Dialog
      open={open}
      size="lg"
      onClose={close}
      title={batchLabel ? `Change delivery date — ${batchLabel}` : 'Change delivery date'}
      primary={
        step === 1
          ? {
              label: 'Next: delay email',
              onClick: goToStep2,
              disabled: !dateValid || !reason.trim() || selectedOrders.length === 0,
            }
          : {
              label: 'Save — queue for approval',
              onClick: () => void save(),
              disabled: saving || !subject.trim() || !body.trim(),
            }
      }
      secondary={
        step === 1
          ? { label: 'Cancel', onClick: close }
          : [
              { label: 'Back', onClick: () => setStep(1) },
              { label: 'Cancel', onClick: close },
            ]
      }
    >
      {step === 1 ? (
        <>
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
              {batchActiveOrderCount - selectedOrders.length === 1 ? ' keeps' : 's keep'} the
              current plan.
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
              note="required"
              noteNear={!reason.trim()}
            />
          </div>
          {dateError ? <Bar tone="fail">{dateError}</Bar> : null}
          {!isLaterThanCurrent && dateValid ? (
            <Bar tone="warn" title="The new date is earlier than the current promise">
              That is allowed, but the email copy assumes a delay — check it in the next step.
            </Bar>
          ) : null}
        </>
      ) : (
        <>
          {error ? <Bar tone="fail">{error}</Bar> : null}
          <div className="rd-after">
            <div className="rd-after-t">What happens when you save</div>
            <Facts
              items={[
                { label: 'Delay email to', value: plural(selectedOrders.length, 'collector') },
                {
                  label: 'Milestones regenerated',
                  value: `${previewPlan.length}${
                    daysBetween(today(), newDate) > 42 ? ' · on-track fillers' : ''
                  }`,
                },
                { label: 'Against', value: formatDay(newDate) },
                { label: 'Then', value: 'Pending approval' },
              ]}
            />
          </div>
          <div className="rd-fields">
            <Field
              label="Subject"
              value={subject}
              onChange={(value) => {
                setSubject(value);
                setCopyEdited(true);
              }}
            />
            <Field
              label="Body"
              value={body}
              onChange={(value) => {
                setBody(value);
                setCopyEdited(true);
              }}
              multiline
              deep
              note="{{first_name}} is personalised per collector"
            />
          </div>
          <EmailPreview
            subject={subject}
            headline={previewHeadline}
            body={body}
            nextSteps={previewSteps}
            imageName={release.templateImages['pp-delay']}
            sampleRecipientName={selectedOrders[0]?.collectorName}
          />
        </>
      )}
    </Dialog>
  );
}
