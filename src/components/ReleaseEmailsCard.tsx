import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { Batch, ImageSlot, Release, TemplateRef } from '../types';
import {
  MASTER_TEMPLATES,
  buildTemplateFields,
  effectiveTemplate,
  onTrackSlotsFor,
  patchTokens,
} from '../logic/templates';
import { today } from '../logic/dates';
import { TEMPLATE_LABELS } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Cap, Dialog, None, Pill, RowAct } from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import Field from '../rd/components/Field';
import { EmailPreview } from './EmailPreview';
import { ImagePicker } from './ImagePicker';

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

/**
 * The emails this release sends, in order, with one row per IMAGE — so the
 * on-track email contributes as many rows as its longest window needs.
 *
 * The owner's rule of 28 Aug 2026: "the email tab should populate depending on
 * the number of emails required for the longest dispatch date." A release with
 * a five-month batch needs more on-track pictures than one with a two-month
 * batch, and the setup screen should ask for exactly that many rather than a
 * fixed three.
 */
function rowsFor(release: Release, onTrackSlots: ImageSlot[]): EmailRow[] {
  const onTrackRows: EmailRow[] = onTrackSlots.map((slot, i) => ({
    slot,
    ref: 'pp-ontrack',
    label: `On track ${i + 1}`,
    // The copy is one template, so it is edited once — on the first row.
    copyRow: i === 0,
  }));
  if (release.productKind === 'sculpture') {
    return [
      ...onTrackRows,
      { slot: 'pp-dispatch', ref: 'pp-dispatch', label: 'Preparing for dispatch', copyRow: true },
      { slot: 'pp-delay', ref: 'pp-delay', label: 'Delay notice', copyRow: true },
    ];
  }
  return [
    { slot: 'pp-printing', ref: 'pp-printing', label: 'Printing in progress', copyRow: true },
    { slot: 'pp-signing', ref: 'pp-signing', label: 'Signing', copyRow: true },
    { slot: 'pp-framing', ref: 'pp-framing', label: 'Framing', copyRow: true },
    ...onTrackRows,
    { slot: 'pp-dispatch', ref: 'pp-dispatch', label: 'Preparing for dispatch', copyRow: true },
    { slot: 'pp-delay', ref: 'pp-delay', label: 'Delay notice', copyRow: true },
  ];
}

export function ReleaseEmailsPanel({
  release,
  batches,
  onChanged,
}: {
  release: Release;
  /** The release's batches — their dates decide how many on-track slots. */
  batches: Batch[];
  onChanged: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [editingRef, setEditingRef] = useState<TemplateRef | null>(null);
  const [pickingSlot, setPickingSlot] = useState<{ slot: ImageSlot; label: string } | null>(null);

  const onTrackSlots = onTrackSlotsFor(release, batches, today());
  const rows = rowsFor(release, onTrackSlots);
  /* The subject is shown as it will ARRIVE, not as it is stored: a column of
     `{{artist}}` tells a reviewer nothing about what a collector reads. The
     dates come from the earliest batch that has one — a release-level screen
     has no single date, and the tokens that need one are the same shape
     whichever batch fills them. */
  const dated = batches.filter((b) => b.promiseDate).sort((a, b) =>
    (a.promiseDate ?? '').localeCompare(b.promiseDate ?? ''),
  );
  const fields = buildTemplateFields(release, dated[0]?.promiseDate ?? today());
  const unset = rows.filter((r) => !release.templateImages[r.slot]).length;

  const pickImage = async (slot: ImageSlot, imageName: string | null) => {
    try {
      await data.setReleaseEmailImage(release.id, slot, imageName);
      showToast(
        imageName
          ? 'Image set — upcoming sends updated, approvals kept'
          : 'Back to the master image for this email',
      );
      setPickingSlot(null);
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

  const columns: Column<EmailRow>[] = [
    {
      id: 'email',
      title: 'Email',
      locked: true,
      kind: 'text',
      value: (row) => row.label,
      cell: (row) => (
        <span className={release.disabledTemplates.includes(row.ref) ? 'rd-mut' : 'rd-ink'}>
          {row.label}
        </span>
      ),
    },
    {
      id: 'image',
      title: 'Image',
      kind: 'choice',
      caption: 'IMAGE',
      value: (row) => release.templateImages[row.slot] ?? 'Master default',
      cell: (row) =>
        release.disabledTemplates.includes(row.ref) ? (
          <None />
        ) : (
          <button
            type="button"
            className="rd-chip rd-chip-sm"
            onClick={() => setPickingSlot({ slot: row.slot, label: row.label })}
          >
            {release.templateImages[row.slot] ?? 'Master default'}
          </button>
        ),
    },
    {
      id: 'copy',
      title: 'Copy',
      locked: true,
      kind: 'choice',
      caption: 'COPY',
      order: ['Customised', 'Default', 'Off'],
      value: (row) =>
        !row.copyRow
          ? null
          : release.disabledTemplates.includes(row.ref)
            ? 'Off'
            : release.templateOverrides[row.ref]
              ? 'Customised'
              : 'Default',
      cell: (row) =>
        !row.copyRow ? (
          <span className="rd-none">Shares On track copy</span>
        ) : release.disabledTemplates.includes(row.ref) ? (
          <Pill tone="violet">Off</Pill>
        ) : release.templateOverrides[row.ref] ? (
          <Pill tone="blue">Customised</Pill>
        ) : (
          <Pill tone="grey">Default</Pill>
        ),
    },
    {
      id: 'subject',
      title: 'Subject',
      kind: 'text',
      value: (row) =>
        release.disabledTemplates.includes(row.ref) || !row.copyRow
          ? null
          : patchTokens(effectiveTemplate(release, row.ref).subject, fields),
      cell: (row) =>
        release.disabledTemplates.includes(row.ref) || !row.copyRow ? (
          <None />
        ) : (
          <Cap>{patchTokens(effectiveTemplate(release, row.ref).subject, fields)}</Cap>
        ),
    },
    {
      id: 'actions',
      title: '',
      locked: true,
      cell: (row) => {
        const disabled = release.disabledTemplates.includes(row.ref);
        const canToggle = row.ref !== 'pp-dispatch' && row.ref !== 'pp-delay';
        if (!row.copyRow) return null;
        return (
          <div className="rd-rowacts">
            {!disabled ? <RowAct onClick={() => setEditingRef(row.ref)}>Edit copy</RowAct> : null}
            {canToggle ? (
              <RowAct onClick={() => void toggle(row.ref, disabled)}>
                {disabled ? 'Switch on' : 'Switch off'}
              </RowAct>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        table="release-emails"
        title="Emails for this release"
        noun="email"
        searchPlaceholder="Search these emails"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.slot}
        empty="This release sends no emails."
        headActions={
          unset > 0 ? <span className="rd-none">{unset} still on the master image</span> : undefined
        }
      />
      <ReleaseEmailEditModal
        release={release}
        templateRef={editingRef}
        fields={fields}
        onClose={() => setEditingRef(null)}
        onSaved={onChanged}
      />
      <ImagePicker
        open={pickingSlot !== null}
        slotLabel={pickingSlot?.label ?? ''}
        picked={(pickingSlot && release.templateImages[pickingSlot.slot]) ?? null}
        onClose={() => setPickingSlot(null)}
        onPick={(name) => {
          if (pickingSlot) void pickImage(pickingSlot.slot, name);
        }}
      />
    </>
  );
}

function ReleaseEmailEditModal({
  release,
  templateRef,
  fields,
  onClose,
  onSaved,
}: {
  release: Release;
  templateRef: TemplateRef | null;
  /** Release-level token values, so the preview reads as it will arrive. */
  fields: Record<string, string | undefined>;
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
      <Bar
        tone="note"
        title={
          isDelay
            ? 'Pre-fills every future delay email for this release'
            : 'Applies to every batch of this release'
        }
      >
        {isDelay
          ? 'Delay notices are written per reschedule; this copy is their starting point.'
          : `Upcoming sends built from this email are re-rendered; approved ones return to the approval queue. Sends someone edited by hand keep their words, and tokens like {{ship_window}} are filled per batch.`}
      </Bar>
      <div className="rd-fields">
        <Field label="Subject" value={subject} onChange={setSubject} />
        <Field label="Headline" value={headline} onChange={setHeadline} />
        <Field label="Body" value={body} onChange={setBody} multiline deep />
      </div>
      {/* The form keeps the tokens — they are patched per batch at send time —
          and the preview resolves them, so what is edited and what arrives are
          both on screen and neither pretends to be the other. */}
      <EmailPreview
        subject={patchTokens(subject, fields)}
        headline={patchTokens(headline, fields)}
        body={patchTokens(body, fields)}
        imageName={previewImage}
      />
    </Dialog>
  );
}
