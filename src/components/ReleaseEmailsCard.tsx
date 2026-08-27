import {
  Badge,
  Banner,
  BlockStack,
  Button,
  ButtonGroup,
  IndexTable,
  Modal,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { ImageSlot, Release, TemplateRef } from '../types';
import {
  IMAGE_OPTIONS,
  MASTER_TEMPLATES,
  effectiveTemplate,
} from '../logic/templates';
import { TEMPLATE_LABELS } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { EmailPreview } from './EmailPreview';

/**
 * The release's email set, opened from the release page's "Release emails"
 * action so it stays out of the day-to-day flow. Emails are templated by
 * default: the routine per-release work is picking the hero image for each
 * slot (the on-track email gets three, cycled across a plan's fillers).
 * Custom copy is the exception — an artist photo to talk about, a delay —
 * and lives behind "Edit copy". Copy changes apply to every batch; image
 * picks update upcoming sends without resetting approvals.
 */

interface EmailRow {
  slot: ImageSlot;
  ref: TemplateRef;
  label: string;
  /** Copy actions render only on a template's first row. */
  copyRow: boolean;
}

const MASTER_IMAGE = '__master__';

function rowsFor(release: Release): EmailRow[] {
  if (release.productKind === 'sculpture') {
    return [
      { slot: 'pp-ontrack-1', ref: 'pp-ontrack', label: 'On track 1', copyRow: true },
      { slot: 'pp-ontrack-2', ref: 'pp-ontrack', label: 'On track 2', copyRow: false },
      { slot: 'pp-ontrack-3', ref: 'pp-ontrack', label: 'On track 3', copyRow: false },
      { slot: 'pp-dispatch', ref: 'pp-dispatch', label: 'Preparing for dispatch', copyRow: true },
      { slot: 'pp-delay', ref: 'pp-delay', label: 'Delay notice', copyRow: true },
    ];
  }
  return [
    { slot: 'pp-printing', ref: 'pp-printing', label: 'Printing in progress', copyRow: true },
    { slot: 'pp-signing', ref: 'pp-signing', label: 'Signing', copyRow: true },
    { slot: 'pp-framing', ref: 'pp-framing', label: 'Framing', copyRow: true },
    { slot: 'pp-ontrack-1', ref: 'pp-ontrack', label: 'On track 1', copyRow: true },
    { slot: 'pp-ontrack-2', ref: 'pp-ontrack', label: 'On track 2', copyRow: false },
    { slot: 'pp-ontrack-3', ref: 'pp-ontrack', label: 'On track 3', copyRow: false },
    { slot: 'pp-dispatch', ref: 'pp-dispatch', label: 'Preparing for dispatch', copyRow: true },
    { slot: 'pp-delay', ref: 'pp-delay', label: 'Delay notice', copyRow: true },
  ];
}

export function ReleaseEmailsModal({
  open,
  release,
  onClose,
  onChanged,
}: {
  open: boolean;
  release: Release;
  onClose: () => void;
  onChanged: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [editingRef, setEditingRef] = useState<TemplateRef | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const rows = rowsFor(release);

  const pickImage = async (slot: ImageSlot, value: string) => {
    setBusySlot(slot);
    try {
      await data.setReleaseEmailImage(release.id, slot, value === MASTER_IMAGE ? null : value);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusySlot(null);
    }
  };

  const toggle = async (ref: TemplateRef, enabled: boolean) => {
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
    }
  };

  const imageChoices = [
    { label: 'Master default', value: MASTER_IMAGE },
    ...IMAGE_OPTIONS.map((name) => ({ label: name, value: name })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      title={`Release emails — ${release.title}`}
      primaryAction={{ content: 'Done', onAction: onClose }}
    >
      <Modal.Section>
        <Text as="p" variant="bodySm" tone="subdued">
          Emails are templated — the routine setup here is picking the hero image for each
          send. Custom copy is the exception (an artist photo to talk about, a delay) and
          applies to every batch. Image picks update upcoming sends without resetting
          approvals.
        </Text>
      </Modal.Section>
      <IndexTable
        resourceName={{ singular: 'email', plural: 'emails' }}
        itemCount={rows.length}
        selectable={false}
        headings={[
          { title: 'Email' },
          { title: 'Image' },
          { title: 'Copy' },
          { title: 'Subject' },
          { title: 'Actions' },
        ]}
      >
        {rows.map((row, index) => {
          const disabled = release.disabledTemplates.includes(row.ref);
          const customised = Boolean(release.templateOverrides[row.ref]);
          const template = effectiveTemplate(release, row.ref);
          const canToggle = row.ref !== 'pp-dispatch' && row.ref !== 'pp-delay';
          return (
            <IndexTable.Row id={row.slot} key={row.slot} position={index}>
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold" tone={disabled ? 'subdued' : undefined}>
                  {row.label}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <div onClick={(e) => e.stopPropagation()} style={{ minWidth: 170 }}>
                  <Select
                    label={`Image for ${row.label}`}
                    labelHidden
                    options={imageChoices}
                    value={release.templateImages[row.slot] ?? MASTER_IMAGE}
                    disabled={disabled || busySlot === row.slot}
                    onChange={(value) => void pickImage(row.slot, value)}
                  />
                </div>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {!row.copyRow ? (
                  <Text as="span" variant="bodySm" tone="subdued">
                    Shares On track copy
                  </Text>
                ) : disabled ? (
                  <Badge>Off</Badge>
                ) : customised ? (
                  <Badge tone="info">Customised</Badge>
                ) : (
                  <Badge tone="new">Default</Badge>
                )}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" variant="bodySm" tone="subdued" truncate>
                  {disabled || !row.copyRow ? '—' : template.subject}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <div onClick={(e) => e.stopPropagation()}>
                  {row.copyRow ? (
                    <ButtonGroup>
                      {!disabled ? (
                        <Button size="slim" onClick={() => setEditingRef(row.ref)}>
                          Edit copy
                        </Button>
                      ) : null}
                      {canToggle ? (
                        <Button
                          size="slim"
                          variant="tertiary"
                          onClick={() => void toggle(row.ref, disabled)}
                        >
                          {disabled ? 'Switch on' : 'Switch off'}
                        </Button>
                      ) : null}
                    </ButtonGroup>
                  ) : null}
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
    </Modal>
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
  const previewImage = templateRef
    ? release.templateImages[templateRef === 'pp-ontrack' ? 'pp-ontrack-1' : templateRef]
    : undefined;

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
          <EmailPreview
            subject={subject}
            headline={headline}
            body={body}
            imageName={previewImage}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
