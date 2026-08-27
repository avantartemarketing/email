import {
  Badge,
  Banner,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  IndexTable,
  Modal,
  Text,
  TextField,
} from '@shopify/polaris';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { Release, TemplateRef } from '../types';
import {
  MASTER_TEMPLATES,
  SCULPTURE_SEQUENCE,
  PRINT_SEQUENCE,
  effectiveTemplate,
} from '../logic/templates';
import { TEMPLATE_LABELS } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { EmailPreview } from './EmailPreview';

/**
 * The release's email set as a table: which emails go out and with what
 * copy. Defaults come from the HubSpot masters; each can be customised or
 * (except dispatch and the delay notice) switched off for this release.
 * Edits here apply to every batch — upcoming sends are re-rendered, approved
 * ones return to the approval queue. Sends someone edited by hand keep
 * their words.
 */
export function ReleaseEmailsCard({
  release,
  onChanged,
}: {
  release: Release;
  onChanged: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [editingRef, setEditingRef] = useState<TemplateRef | null>(null);
  const [togglingRef, setTogglingRef] = useState<TemplateRef | null>(null);

  const sequence =
    release.productKind === 'sculpture' ? SCULPTURE_SEQUENCE : PRINT_SEQUENCE;
  const refs: TemplateRef[] = [...sequence, 'pp-delay'];

  const toggle = async (ref: TemplateRef, enabled: boolean) => {
    setTogglingRef(ref);
    try {
      const result = await data.updateReleaseEmail(release.id, ref, { enabled });
      showToast(
        enabled
          ? `${TEMPLATE_LABELS[ref]} switched on — future plans will include it`
          : `${TEMPLATE_LABELS[ref]} switched off${result.cancelledSendCount > 0 ? ` — ${result.cancelledSendCount} upcoming send${result.cancelledSendCount === 1 ? '' : 's'} cancelled` : ''}`,
      );
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setTogglingRef(null);
    }
  };

  return (
    <Card padding="0">
      <div style={{ padding: 'var(--p-space-400) var(--p-space-400) var(--p-space-200)' }}>
        <Text as="h2" variant="headingSm">
          Emails for this release
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Defaults from the HubSpot masters. Changes here apply to every batch.
        </Text>
      </div>
      <IndexTable
        resourceName={{ singular: 'email', plural: 'emails' }}
        itemCount={refs.length}
        selectable={false}
        headings={[
          { title: 'Email' },
          { title: 'Copy' },
          { title: 'Subject' },
          { title: 'Actions' },
        ]}
      >
        {refs.map((ref, index) => {
          const disabled = release.disabledTemplates.includes(ref);
          const customised = Boolean(release.templateOverrides[ref]);
          const template = effectiveTemplate(release, ref);
          const canToggle = ref !== 'pp-dispatch' && ref !== 'pp-delay';
          return (
            <IndexTable.Row id={ref} key={ref} position={index}>
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold" tone={disabled ? 'subdued' : undefined}>
                  {TEMPLATE_LABELS[ref]}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {disabled ? (
                  <Badge>Off</Badge>
                ) : customised ? (
                  <Badge tone="info">Customised</Badge>
                ) : (
                  <Badge tone="new">Default</Badge>
                )}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" variant="bodySm" tone="subdued" truncate>
                  {disabled ? '—' : template.subject}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <div onClick={(e) => e.stopPropagation()}>
                  <ButtonGroup>
                    {!disabled ? (
                      <Button size="slim" onClick={() => setEditingRef(ref)}>
                        Edit copy
                      </Button>
                    ) : null}
                    {canToggle ? (
                      <Button
                        size="slim"
                        variant="tertiary"
                        loading={togglingRef === ref}
                        onClick={() => void toggle(ref, disabled)}
                      >
                        {disabled ? 'Switch on' : 'Switch off'}
                      </Button>
                    ) : null}
                  </ButtonGroup>
                </div>
              </IndexTable.Cell>
            </IndexTable.Row>
          );
        })}
      </IndexTable>
      <ReleaseEmailEditModal
        release={release}
        templateRef={editingRef}
        onClose={() => setEditingRef(null)}
        onSaved={onChanged}
      />
    </Card>
  );
}

function ReleaseEmailEditModal({
  release,
  templateRef,
  onClose,
  onSaved,
}: {
  release: Release;
  templateRef: TemplateRef | null;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [subject, setSubject] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (templateRef) {
      const template = effectiveTemplate(release, templateRef);
      setSubject(template.subject);
      setHeadline(template.headline);
      setBody(template.body);
    }
  }, [release, templateRef]);

  const customised = templateRef ? Boolean(release.templateOverrides[templateRef]) : false;
  const isDelay = templateRef === 'pp-delay';

  const save = async (resetToDefault = false) => {
    if (!templateRef) return;
    setSaving(true);
    try {
      const result = await data.updateReleaseEmail(
        release.id,
        templateRef,
        resetToDefault ? { resetToDefault: true } : { subject, headline, body },
      );
      showToast(
        resetToDefault
          ? `${TEMPLATE_LABELS[templateRef]} reset to the default copy`
          : `${TEMPLATE_LABELS[templateRef]} updated${result.updatedSendCount > 0 ? ` — ${result.updatedSendCount} upcoming send${result.updatedSendCount === 1 ? '' : 's'} re-rendered` : ''}`,
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
      open={templateRef !== null}
      onClose={onClose}
      size="large"
      title={
        templateRef
          ? `${TEMPLATE_LABELS[templateRef]} — release copy (${MASTER_TEMPLATES[templateRef].name})`
          : ''
      }
      primaryAction={{
        content: 'Save for this release',
        onAction: () => void save(),
        loading: saving,
        disabled: !subject.trim() || !body.trim(),
      }}
      secondaryActions={[
        ...(customised
          ? [{ content: 'Reset to default', onAction: () => void save(true) }]
          : []),
        { content: 'Cancel', onAction: onClose },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Banner
            tone="info"
            title={
              isDelay
                ? 'Used to pre-fill every future delay email for this release'
                : 'Applies to every batch of this release'
            }
          >
            <p>
              {isDelay
                ? 'Delay notices are written per reschedule; this copy is their starting point.'
                : 'Upcoming sends built from this email are re-rendered with the new copy; approved ones return to the approval queue. Sends someone edited by hand keep their words. Tokens like {{ship_window}} are filled per batch.'}
            </p>
          </Banner>
          <TextField label="Subject" value={subject} onChange={setSubject} autoComplete="off" />
          <TextField
            label="Headline"
            value={headline}
            onChange={setHeadline}
            autoComplete="off"
          />
          <TextField
            label="Body"
            value={body}
            onChange={setBody}
            multiline={10}
            autoComplete="off"
            helpText="Tokens: {{artist}}, {{release_title}}, {{ship_window}}, {{promise_date}}, {{first_name}} — left intact here, patched per batch."
          />
          <EmailPreview subject={subject} headline={headline} body={body} />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
