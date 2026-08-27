import {
  Banner,
  BlockStack,
  Modal,
  Text,
  TextField,
} from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, Order, Release, ScheduledSend } from '../types';
import { addDays, daysBetween, formatDay, today } from '../logic/dates';
import { buildDefaultDelayEmail, remainingSequence } from '../logic/reschedule';
import { generateMilestonePlan } from '../logic/plan';
import { releaseFillerTemplate, releaseSequenceFor } from '../logic/templates';
import { EmailPreview } from './EmailPreview';
import { useApp } from '../ui/AppContext';
import { plural } from '../ui/format';

/**
 * The reschedule flow as a stepped modal:
 *   Step 1 — confirm the selection (subset → split into a new batch), enter
 *            the new promise date and the reason (required).
 *   Step 2 — review/edit the delay email, pre-filled from the delay master;
 *            shows what the regenerated plan will look like. Saving parks
 *            everything in the approval queue as pending.
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

  const isSubset = selectedOrders.length < batchActiveOrderCount;
  const tomorrow = addDays(today(), 1);
  const dateValid = newDate >= tomorrow;
  const dateError =
    newDate && !dateValid ? 'The new delivery date must be in the future' : undefined;
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
      const message = result.splitOccurred
        ? `${result.batch.name} created — ${plural(sendCount, 'send')} pending approval`
        : `${result.batch.name} rescheduled — ${plural(sendCount, 'send')} pending approval`;
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

  // A quick shape preview of the regenerated plan — same functions the save
  // path uses, so the count in the banner is the count that will be created.
  // Inherited sent sends matter: a split batch must not re-promise stages
  // its collectors already received in the batch it came from.
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

  return (
    <Modal
      open={open}
      onClose={close}
      title={batchLabel ? `Change delivery date — ${batchLabel}` : 'Change delivery date'}
      primaryAction={
        step === 1
          ? {
              content: 'Next: delay email',
              onAction: goToStep2,
              disabled: !dateValid || !reason.trim() || selectedOrders.length === 0,
            }
          : {
              content: 'Save — queue for approval',
              onAction: () => void save(),
              loading: saving,
              disabled: !subject.trim() || !body.trim(),
            }
      }
      secondaryActions={
        step === 1
          ? [{ content: 'Cancel', onAction: close }]
          : [
              { content: 'Back', onAction: () => setStep(1) },
              { content: 'Cancel', onAction: close },
            ]
      }
    >
      {step === 1 ? (
        <Modal.Section>
          <BlockStack gap="400">
            {selectedOrders.length === 0 ? (
              <Banner tone="critical" title="No orders selected" />
            ) : isSubset ? (
              <Banner tone="info" title={`${plural(selectedOrders.length, 'order')} of ${batchActiveOrderCount} selected`}>
                <p>
                  The selection is part of {groupName}, so it will be split into a batch with its
                  own promise date and comms plan. The {batchActiveOrderCount - selectedOrders.length}{' '}
                  remaining order{batchActiveOrderCount - selectedOrders.length === 1 ? ' keeps' : 's keep'} the
                  current plan.
                </p>
              </Banner>
            ) : (
              <Banner tone="info" title={`All ${plural(selectedOrders.length, 'active order')} in ${groupName} selected`}>
                <p>
                  {batchLabel ? 'The whole batch moves' : 'Everyone moves'} to the new date.
                  Unsent milestone emails will be replaced by a regenerated plan; everything
                  already sent stays in the history.
                </p>
              </Banner>
            )}
            <TextField
              label="New promised delivery date"
              type="date"
              value={newDate}
              onChange={setNewDate}
              min={tomorrow}
              error={dateError}
              autoComplete="off"
              helpText={
                batch.promiseDate
                  ? `Current dispatch window starts ${formatDay(batch.promiseDate)}`
                  : 'No promise date set yet'
              }
            />
            {!isLaterThanCurrent && dateValid ? (
              <Banner tone="warning" title="The new date is earlier than the current promise">
                <p>
                  That's allowed (bringing a batch forward), but the email copy assumes a delay —
                  check it in the next step.
                </p>
              </Banner>
            ) : null}
            <TextField
              label="Reason for the change"
              value={reason}
              onChange={setReason}
              multiline={2}
              autoComplete="off"
              requiredIndicator
              placeholder="e.g. Second framing run pushed back at the framers"
              helpText="Required. Recorded in the batch history and used to pre-fill the delay email."
            />
          </BlockStack>
        </Modal.Section>
      ) : (
        <>
          <Modal.Section>
            <BlockStack gap="300">
              {error ? <Banner tone="critical" title={error} /> : null}
              <Banner tone="info" title="What happens when you save">
                <p>
                  The delay email below goes to the front of the plan for{' '}
                  {plural(selectedOrders.length, 'collector')}, and{' '}
                  {plural(previewPlan.length, 'milestone email')} will be regenerated against{' '}
                  {formatDay(newDate)}
                  {daysBetween(today(), newDate) > 42
                    ? ' (long window — generic on-track updates fill the gaps)'
                    : ''}
                  . Nothing sends until an admin approves each email in the approval queue.
                </p>
              </Banner>
              <TextField
                label="Subject"
                value={subject}
                onChange={(value) => {
                  setSubject(value);
                  setCopyEdited(true);
                }}
                autoComplete="off"
              />
              <TextField
                label="Body"
                value={body}
                onChange={(value) => {
                  setBody(value);
                  setCopyEdited(true);
                }}
                multiline={10}
                autoComplete="off"
                helpText="{{first_name}} is personalised per collector at send time. The default copy is built from the pp-delay master and should usually ship untouched."
              />
            </BlockStack>
          </Modal.Section>
          <Modal.Section>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Preview
              </Text>
              <EmailPreview
                subject={subject}
                body={body}
                sampleRecipientName={selectedOrders[0]?.collectorName}
              />
            </BlockStack>
          </Modal.Section>
        </>
      )}
    </Modal>
  );
}
