import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, Release } from '../types';
import { addDays, formatDay, today } from '../logic/dates';
import { generateMilestonePlan } from '../logic/plan';
import { releaseFillerTemplate, releaseSequenceFor } from '../logic/templates';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Dialog, Facts } from '../ui/rd';
import Field from '../rd/components/Field';

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
  const dateId = useId();
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
    <Dialog
      open={open}
      onClose={onClose}
      title={batchLabel ? `Set promise date — ${batchLabel}` : 'Set promise date'}
      primary={{
        label: 'Set date & draft plan',
        onClick: () => void save(),
        disabled: saving || !valid,
      }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      <div className="rd-fields">
        <Field label="Promised dispatch date" value={date} controlId={dateId}>
          <input
            id={dateId}
            type="date"
            min={tomorrow}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      {date && !valid ? <Bar tone="fail">The promise date must be in the future.</Bar> : null}
      {valid ? (
        <div className="rd-after">
          <div className="rd-after-t">What gets drafted</div>
          <Facts
            items={[
              { label: 'Milestone emails', value: preview.length },
              { label: 'Spaced', value: 'No more than 5 weeks apart' },
              { label: 'Ending', value: formatDay(date) },
              { label: 'Then', value: 'Yours to edit, then approve' },
            ]}
          />
        </div>
      ) : null}
    </Dialog>
  );
}
