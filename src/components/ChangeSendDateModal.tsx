import { useEffect, useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { PendingSendItem } from '../types';
import { formatDayShort, today } from '../logic/dates';
import { TEMPLATE_LABELS, plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Dialog, Facts } from '../ui/rd';
import Field from '../rd/components/Field';

/**
 * Move one send to a different day.
 *
 * This is half of what replaced Hold. The owner, 28 Aug 2026: "I don't think
 * someone should be able to click hold. They can reschedule a send, or they
 * can mark it as cancelled." Hold said "not yet" and parked the send in a tab
 * nobody visited; this says "not yet, and here is when", which is the same
 * intent with the missing half supplied.
 *
 * **It moves ONE EMAIL, not the promise.** That distinction is the reason this
 * is a separate dialogue from "Change delivery date" on the batch: a promise
 * date is what the collector was told, and changing it regenerates the plan
 * and writes a delay notice. Moving a single update does none of that and
 * tells nobody, which is right — a collector never knew when their next
 * progress email was due. The note under the field says so, because somebody
 * arriving from an approval queue could reasonably assume otherwise.
 *
 * The send stays `pending_approval`: moving a date is not approving it, and
 * `updateSend` does not pin the copy the way a hand edit does.
 */
export function ChangeSendDateModal({
  item,
  onClose,
  onMoved,
}: {
  /** The send being moved, or null when the dialogue is shut. */
  item: PendingSendItem | null;
  onClose: () => void;
  onMoved: (message: string) => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const dateId = useId();

  useEffect(() => {
    if (!item) return;
    /* An overdue send opens on TODAY, not on the date that has already passed.
       Seeding the field with a past value renders it invalid the moment it is
       drawn, which asks somebody to fix a complaint the app created. */
    setDate(item.send.scheduledDate < today() ? today() : item.send.scheduledDate);
  }, [item]);

  const unchanged = Boolean(item && date === item.send.scheduledDate);

  const move = async (): Promise<void> => {
    if (!item) return;
    setSaving(true);
    try {
      await data.updateSend(item.send.id, { scheduledDate: date });
      onMoved(`Moved to ${formatDayShort(date)} — still waiting for approval`);
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
      title="Change date"
      onClose={onClose}
      primary={{
        label: 'Move send',
        onClick: () => void move(),
        disabled: saving || !date || unchanged,
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
              note="moves this email only — the delivery promise and the rest of the plan do not change"
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
        </>
      ) : null}
    </Dialog>
  );
}
