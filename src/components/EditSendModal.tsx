import { useEffect, useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { ScheduledSend, SendStep } from '../types';
import { addDays, today } from '../logic/dates';
import { EmailPreview } from './EmailPreview';
import { useApp } from '../ui/AppContext';
import { Bar, Dialog } from '../ui/rd';
import Field from '../rd/components/Field';

export function EditSendModal({
  send,
  onClose,
  onSaved,
  ceiling,
}: {
  send: ScheduledSend | null;
  onClose: () => void;
  onSaved: () => void;
  /** The latest day this email may land, and why — the same ceiling Change
      email date enforces. Without it, Edit was an unguarded back door for
      the one move that rule exists to police. */
  ceiling?: { date: string; says: string } | null;
}): ReactElement {
  const { data, showToast } = useApp();
  const [subject, setSubject] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [steps, setSteps] = useState<SendStep[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [saving, setSaving] = useState(false);
  const dateId = useId();

  useEffect(() => {
    if (send) {
      setSubject(send.subject);
      setHeadline(send.headline ?? '');
      setBody(send.body);
      setSteps(send.nextSteps ?? []);
      setScheduledDate(send.scheduledDate);
    }
  }, [send]);

  const pastCeiling = !!ceiling && !!scheduledDate && scheduledDate > ceiling.date;

  const save = async () => {
    if (!send || pastCeiling) return;
    setSaving(true);
    try {
      await data.updateSend(send.id, {
        subject,
        ...(send.headline !== undefined || headline ? { headline } : {}),
        body,
        ...(send.nextSteps ? { nextSteps: steps } : {}),
        scheduledDate,
      });
      showToast(
        send.status === 'approved'
          ? 'Send updated — approval reset, back in the queue'
          : 'Send updated',
      );
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
      open={send !== null}
      size="lg"
      onClose={onClose}
      title={send ? `Edit — ${send.subject}` : 'Edit send'}
      primary={{
        label: 'Save',
        onClick: () => void save(),
        disabled: saving || !subject.trim() || !body.trim() || !scheduledDate || pastCeiling,
      }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      {send?.status === 'approved' ? (
        <Bar tone="warn" title="This send is already approved">
          Saving moves it back to pending approval.
        </Bar>
      ) : null}
      {pastCeiling && ceiling ? (
        <Bar tone="fail" title="That date does not fit this batch's promise">
          {ceiling.says} A date past it is a promise problem, not an email-timing one — use
          Change delivery date on the batch instead.
        </Bar>
      ) : null}
      <div className="rd-fields">
        <Field label="Scheduled date" value={scheduledDate} controlId={dateId}>
          <input
            id={dateId}
            type="date"
            min={addDays(today(), 0)}
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </Field>
        <Field label="Subject" value={subject} onChange={setSubject} />
        <Field
          label="Headline"
          value={headline}
          onChange={setHeadline}
          note="under the hero image"
        />
        <Field
          label="Body"
          value={body}
          onChange={setBody}
          multiline
          deep
          note="{{first_name}} is personalised per collector"
        />
        {steps.map((step, idx) => (
          <Field
            key={step.templateRef}
            label={step.title}
            value={step.text}
            onChange={(value) =>
              setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, text: value } : s)))
            }
            multiline
            note="what happens next"
          />
        ))}
      </div>
      <EmailPreview
        subject={subject}
        headline={headline || undefined}
        body={body}
        nextSteps={steps}
        imageName={send?.imageName}
      />
    </Dialog>
  );
}
