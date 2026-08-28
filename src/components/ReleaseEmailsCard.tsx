import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { ImageSlot, Release, TemplateRef } from '../types';
import { IMAGE_OPTIONS, MASTER_TEMPLATES, effectiveTemplate } from '../logic/templates';
import { TEMPLATE_LABELS } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Cap, Card, CardHead, Dialog, None, Pill, RowAct } from '../ui/rd';
import Menu from '../rd/components/Menu';
import Field from '../rd/components/Field';
import { EmailPreview } from './EmailPreview';

/**
 * The release's email set, its own tab on the release page.
 *
 * Emails are templated by default: the routine per-release work is picking the
 * hero image for each slot (the on-track email gets three, cycled across a
 * plan's fillers). Custom copy is the exception — an artist photo to talk
 * about, a delay — and lives behind "Edit copy". Copy changes apply to every
 * batch; image picks update upcoming sends without resetting approvals.
 *
 * The image cell is a `Menu` rather than a form select: it has to live in a
 * 34px row inside a card that scrolls, and the kit's menu is a portal, which
 * is the one shape that survives a scrollport.
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

export function ReleaseEmailsPanel({
  release,
  onChanged,
}: {
  release: Release;
  onChanged: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [editingRef, setEditingRef] = useState<TemplateRef | null>(null);
  const [openSlot, setOpenSlot] = useState<string | null>(null);

  const rows = rowsFor(release);

  const pickImage = async (slot: ImageSlot, value: string) => {
    try {
      await data.setReleaseEmailImage(release.id, slot, value === MASTER_IMAGE ? null : value);
      showToast('Image set — upcoming sends updated, approvals kept');
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };

  const toggle = async (ref: TemplateRef, enabled: boolean) => {
    try {
      const result = await data.updateReleaseEmail(release.id, ref, { enabled });
      showToast(
        enabled
          ? `${TEMPLATE_LABELS[ref]} switched on — future plans will include it`
          : `${TEMPLATE_LABELS[ref]} switched off${
              result.cancelledSendCount > 0
                ? ` — ${result.cancelledSendCount} upcoming send${
                    result.cancelledSendCount === 1 ? '' : 's'
                  } cancelled`
                : ''
            }`,
      );
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };

  const imageChoices = [
    { key: MASTER_IMAGE, label: 'Master default' },
    ...IMAGE_OPTIONS.map((name) => ({ key: name, label: name })),
  ];

  return (
    <Card>
      <CardHead title="Emails for this release" />
      <div className="rd-scroll">
        <table className="rd-t rd-t27 rd-fit rd-tpad">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Image</th>
              <th scope="col">Copy</th>
              <th scope="col">Subject</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const disabled = release.disabledTemplates.includes(row.ref);
              const customised = Boolean(release.templateOverrides[row.ref]);
              const template = effectiveTemplate(release, row.ref);
              const canToggle = row.ref !== 'pp-dispatch' && row.ref !== 'pp-delay';
              const picked = release.templateImages[row.slot];
              return (
                <tr key={row.slot} className={disabled ? 'rd-mut' : undefined}>
                  <td className={disabled ? undefined : 'rd-ink'}>{row.label}</td>
                  <td>
                    {disabled ? (
                      <None />
                    ) : (
                      <Menu
                        chipClass="rd-chip rd-chip-sm"
                        chip={picked ?? 'Master default'}
                        open={openSlot === row.slot}
                        setOpen={(v) => setOpenSlot(v ? row.slot : null)}
                        heading={`Image for ${row.label}`}
                        items={imageChoices.map((c) => ({
                          key: c.key,
                          label: c.label,
                          on: (picked ?? MASTER_IMAGE) === c.key,
                        }))}
                        onPick={(value) => void pickImage(row.slot, value)}
                      />
                    )}
                  </td>
                  <td>
                    {!row.copyRow ? (
                      <span className="rd-none">Shares On track copy</span>
                    ) : disabled ? (
                      <Pill tone="violet">Off</Pill>
                    ) : customised ? (
                      <Pill tone="blue">Customised</Pill>
                    ) : (
                      <Pill tone="grey">Default</Pill>
                    )}
                  </td>
                  <td>
                    {disabled || !row.copyRow ? (
                      <None />
                    ) : (
                      <Cap>{template.subject}</Cap>
                    )}
                  </td>
                  <td>
                    {row.copyRow ? (
                      <div className="rd-rowacts">
                        {!disabled ? (
                          <RowAct onClick={() => setEditingRef(row.ref)}>Edit copy</RowAct>
                        ) : null}
                        {canToggle ? (
                          <RowAct onClick={() => void toggle(row.ref, disabled)}>
                            {disabled ? 'Switch on' : 'Switch off'}
                          </RowAct>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
          : `${TEMPLATE_LABELS[templateRef]} updated${
              result.updatedSendCount > 0
                ? ` — ${result.updatedSendCount} upcoming send${
                    result.updatedSendCount === 1 ? '' : 's'
                  } re-rendered`
                : ''
            }`,
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
      open={templateRef !== null}
      size="lg"
      onClose={onClose}
      title={
        templateRef
          ? `${TEMPLATE_LABELS[templateRef]} — release copy (${MASTER_TEMPLATES[templateRef].name})`
          : ''
      }
      primary={{
        label: 'Save for this release',
        onClick: () => void save(),
        disabled: saving || !subject.trim() || !body.trim(),
      }}
      secondary={[
        ...(customised ? [{ label: 'Reset to default', onClick: () => void save(true) }] : []),
        { label: 'Cancel', onClick: onClose },
      ]}
    >
      <Bar tone="note">
        {isDelay ? (
          <>
            <b>Pre-fills every future delay email for this release.</b> Delay notices are written
            per reschedule; this copy is their starting point.
          </>
        ) : (
          <>
            <b>Applies to every batch of this release.</b> Upcoming sends built from this email are
            re-rendered; approved ones return to the approval queue. Sends someone edited by hand
            keep their words, and tokens like {'{{ship_window}}'} are filled per batch.
          </>
        )}
      </Bar>
      <div className="rd-fields">
        <Field label="Subject" value={subject} onChange={setSubject} />
        <Field label="Headline" value={headline} onChange={setHeadline} />
        <Field label="Body" value={body} onChange={setBody} multiline deep />
      </div>
      <EmailPreview subject={subject} headline={headline} body={body} imageName={previewImage} />
    </Dialog>
  );
}
