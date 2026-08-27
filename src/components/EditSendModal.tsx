import { Banner, BlockStack, Modal, Text, TextField } from '@shopify/polaris';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { ScheduledSend, SendStep } from '../types';
import { addDays, today } from '../logic/dates';
import { EmailPreview } from './EmailPreview';
import { useApp } from '../ui/AppContext';

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
    <Modal
      open={send !== null}
      onClose={onClose}
      size="large"
      title={send ? `Edit — ${send.subject}` : 'Edit send'}
      primaryAction={{
        content: 'Save',
        onAction: () => void save(),
        loading: saving,
        disabled: !subject.trim() || !body.trim() || !scheduledDate,
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {send?.status === 'approved' ? (
            <Banner tone="warning" title="This send is already approved">
              <p>Saving changes moves it back to pending approval.</p>
            </Banner>
          ) : null}
          <TextField
            label="Scheduled date"
            type="date"
            value={scheduledDate}
            onChange={setScheduledDate}
            min={addDays(today(), 0)}
            autoComplete="off"
          />
          <TextField label="Subject" value={subject} onChange={setSubject} autoComplete="off" />
          <TextField
            label="Headline"
            value={headline}
            onChange={setHeadline}
            autoComplete="off"
            helpText="The centered heading under the hero image."
          />
          <TextField
            label="Body"
            value={body}
            onChange={setBody}
            multiline={8}
            autoComplete="off"
            helpText="{{first_name}} is personalised per collector at send time."
          />
          {steps.length > 0 ? (
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                “What happens next?” steps
              </Text>
              {steps.map((step, idx) => (
                <TextField
                  key={step.templateRef}
                  label={step.title}
                  value={step.text}
                  onChange={(value) =>
                    setSteps((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, text: value } : s)),
                    )
                  }
                  multiline={2}
                  autoComplete="off"
                />
              ))}
            </BlockStack>
          ) : null}
          <EmailPreview
            subject={subject}
            headline={headline || undefined}
            body={body}
            nextSteps={steps}
            imageName={send?.imageName}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
