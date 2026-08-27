import { BlockStack, Modal, Select, TextField } from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, TemplateRef } from '../types';
import { addDays, today } from '../logic/dates';
import { TEMPLATE_LABELS } from '../ui/format';
import { useApp } from '../ui/AppContext';

const TEMPLATE_OPTIONS = (Object.keys(TEMPLATE_LABELS) as TemplateRef[]).map((ref) => ({
  label: `${TEMPLATE_LABELS[ref]} (${ref})`,
  value: ref,
}));

export function AddSendModal({
  open,
  batch,
  onClose,
  onSaved,
}: {
  open: boolean;
  batch: Batch;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [templateRef, setTemplateRef] = useState<TemplateRef>('pp-ontrack');
  const [scheduledDate, setScheduledDate] = useState(addDays(today(), 7));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await data.addSend(batch.id, templateRef, scheduledDate);
      showToast('Send added as a draft — submit the plan to queue it for approval');
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
      title={`Add send — ${batch.name}`}
      primaryAction={{
        content: 'Add draft send',
        onAction: () => void save(),
        loading: saving,
        disabled: !scheduledDate,
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Select
            label="Template"
            options={TEMPLATE_OPTIONS}
            value={templateRef}
            onChange={(value) => setTemplateRef(value as TemplateRef)}
            helpText="Copy is pre-filled from the HubSpot master and editable before approval."
          />
          <TextField
            label="Scheduled date"
            type="date"
            value={scheduledDate}
            onChange={setScheduledDate}
            min={today()}
            autoComplete="off"
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
