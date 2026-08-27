import { Banner, BlockStack, Modal, TextField } from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, Release } from '../types';
import { addDays, formatDay, today } from '../logic/dates';
import { generateMilestonePlan } from '../logic/plan';
import { releaseFillerTemplate, releaseSequenceFor } from '../logic/templates';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';

/** First-time promise date → generates the draft milestone plan. */
export function PromiseDateModal({
  open,
  release,
  batch,
  batchLabel,
  onClose,
  onSaved,
}: {
  open: boolean;
  release: Release;
  batch: Batch;
  /** Batch name for the title, or null when the release has no splits. */
  batchLabel?: string | null;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const tomorrow = addDays(today(), 1);
  const valid = date >= tomorrow;

  const preview = valid
    ? generateMilestonePlan(today(), date, release.productKind, {
        sequence: releaseSequenceFor(release),
        fillerTemplate: releaseFillerTemplate(release),
      })
    : [];

  const save = async () => {
    setSaving(true);
    try {
      await data.setPromiseDate(batch.id, date);
      showToast(`Promise date set — ${plural(preview.length, 'milestone send')} drafted`);
      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={batchLabel ? `Set promise date — ${batchLabel}` : 'Set promise date'}
      primaryAction={{
        content: 'Set date & draft plan',
        onAction: () => void save(),
        loading: saving,
        disabled: !valid,
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <TextField
            label="Promised dispatch date"
            type="date"
            value={date}
            onChange={setDate}
            min={tomorrow}
            autoComplete="off"
            error={date && !valid ? 'The promise date must be in the future' : undefined}
          />
          {valid ? (
            <Banner tone="info" title={`${plural(preview.length, 'milestone email')} will be drafted`}>
              <p>
                Spaced no more than five weeks apart between now and{' '}
                {formatDay(date)}, ending with “preparing for dispatch”. You can edit, add or
                remove sends before submitting the plan for approval — nothing sends without an
                admin's approval.
              </p>
            </Banner>
          ) : null}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
