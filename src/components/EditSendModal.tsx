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
}: {
  send: ScheduledSend | null;
  onClose: () => void;
  onSaved: () => void;
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

  const save = async () => {
    if (!send) return;
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
        disabled: saving || !subject.trim() || !body.trim() || !scheduledDate,
      }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      {send?.status === 'approved' ? (
        <Bar tone="warn">
          <b>This send is already approved.</b> Saving moves it back to pending approval.
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
