import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, TemplateRef } from '../types';
import { addDays, today } from '../logic/dates';
import { TEMPLATE_LABELS } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Dialog } from '../ui/rd';
import Field from '../rd/components/Field';
import { SelectField } from '../rd/components/Picker';

const TEMPLATE_OPTIONS = (Object.keys(TEMPLATE_LABELS) as TemplateRef[]).map((ref) => ({
  label: `${TEMPLATE_LABELS[ref]} (${ref})`,
  value: ref,
}));

export function AddSendModal({
  open,
  batch,
  batchLabel,
  onClose,
  onSaved,
}: {
  open: boolean;
  batch: Batch;
  /** Batch name for the title, or null when the release has no splits. */
  batchLabel?: string | null;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [templateRef, setTemplateRef] = useState<TemplateRef>('pp-ontrack');
  const [scheduledDate, setScheduledDate] = useState(addDays(today(), 7));
  const [saving, setSaving] = useState(false);
  const dateId = useId();

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
    <Dialog
      open={open}
      size="sm"
      onClose={onClose}
      title={batchLabel ? `Add send — ${batchLabel}` : 'Add send'}
      primary={{
        label: 'Add draft send',
        onClick: () => void save(),
        disabled: saving || !scheduledDate,
      }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      <div className="rd-fields">
        <SelectField
          label="Template"
          value={templateRef}
          options={TEMPLATE_OPTIONS}
          onChange={(value) => setTemplateRef(value as TemplateRef)}
        />
        <Field label="Scheduled date" value={scheduledDate} controlId={dateId}>
          <input
            id={dateId}
            type="date"
            min={today()}
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
