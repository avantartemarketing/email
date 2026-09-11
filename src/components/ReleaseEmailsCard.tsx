import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type {
  Batch,
  ImageSlot,
  Release,
  ScheduledSend,
  TemplateRef,
} from '../types';
import {
  TEMPLATE_LABELS,
  buildTemplateFields,
  effectiveTemplate,
  missingImagesFor,
  patchTokens,
  requiredImageSlots,
  shipWindowShort,
  slotLabel,
} from '../logic/templates';
import { today } from '../logic/dates';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Cap, Dialog, None, NoneYet, Pill, RowAct, Why } from '../ui/rd';
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
 * One row per IMAGE SLOT, from the same list the count, the band and the
 * refusal to approve all read (`requiredImageSlots`).
 *
 * It used to hand-list the milestones here and take the on-track run as an
 * argument, which meant this file and the logic layer each held an opinion
 * about which emails a release sends. They agreed until a milestone was
 * switched off — then the row list still showed it and the count still nagged
 * about a picture for an email that would never go out. One list now.
 *
 * The owner's rule of 28 Aug 2026 still holds inside it: "the email tab should
 * populate depending on the number of emails required for the longest dispatch
 * date."
 */
function rowsFor(slots: ImageSlot[]): EmailRow[] {
  let seenOnTrack = false;
  return slots.map((slot) => {
    const onTrack = slot.startsWith('pp-ontrack-');
    const first = onTrack ? !seenOnTrack : true;
    if (onTrack) seenOnTrack = true;
    return {
      slot,
      ref: (onTrack ? 'pp-ontrack' : slot) as TemplateRef,
      label: slotLabel(slot),
      // The copy is one template, so it is edited once — on the first row.
      copyRow: first,
    };
  });
}

export function ReleaseEmailsPanel({
  release,
  batches,
  sends,
  onChanged,
}: {
  release: Release;
  /** The release's batches — their dates decide how many on-track slots. */
  batches: Batch[];
  /** Its sends — a queued one holds a slot open even after the dates shrink. */
  sends: ScheduledSend[];
  onChanged: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [editingRef, setEditingRef] = useState<TemplateRef | null>(null);
  const [pickingSlot, setPickingSlot] = useState<{ slot: ImageSlot; label: string } | null>(null);
  /** The template a switch-off confirm is open for. */
  const [switchingOff, setSwitchingOff] = useState<TemplateRef | null>(null);

  const slots = requiredImageSlots(release, batches, sends, today());
  const rows = rowsFor(slots);
  /* The subject is shown as it will ARRIVE, not as it is stored: a column of
     `{{artist}}` tells a reviewer nothing about what a collector reads. The
     dates come from the earliest batch that has one — a release-level screen
     has no single date, and the tokens that need one are the same shape
     whichever batch fills them. */
  const dated = batches.filter((b) => b.promiseDate).sort((a, b) =>
    (a.promiseDate ?? '').localeCompare(b.promiseDate ?? ''),
  );
  const previewBatch = dated[0] ?? null;
  const fields = buildTemplateFields(release, previewBatch?.promiseDate ?? today());
  const missing = missingImagesFor(release, batches, sends, today());

  const pickImage = async (slot: ImageSlot, imageName: string) => {
    try {
      await data.setReleaseEmailImage(release.id, slot, imageName);
      /* The last one is worth saying out loud: it is the moment the release
         stops being blocked, and nothing else on the screen announces it. */
      showToast(
        missing.length === 1 && missing[0] === slot
          ? 'All images picked'
          : 'Image set',
      );
      setPickingSlot(null);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };

  /** How far a switch-off reaches, said BEFORE it happens rather than in a toast. */
  const reachOf = (ref: TemplateRef): { sends: number; batches: number } => {
    const hit = sends.filter(
      (s) => s.templateRef === ref && s.status !== 'sent' && s.status !== 'cancelled',
    );
    return { sends: hit.length, batches: new Set(hit.map((s) => s.batchId)).size };
  };

  const toggle = async (ref: TemplateRef, enabled: boolean) => {
    try {
      const result = await data.updateReleaseEmail(release.id, ref, { enabled });
      showToast(
        enabled
          ? `${TEMPLATE_LABELS[ref]} switched on`
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
      /* Whether the release sends this email at all lives HERE, beside the
         name, because it is a fact about the row's identity. It used to be
         said four times — muted ink, two dashes and a violet "Off" pill in the
         Copy column — which put a lifecycle answer in a column that asks about
         copy, and cost a customised-but-switched-off template its "Customised"
         badge. One mark, in the column that owns the row. */
      cell: (row) => (
        <span className="rd-cellflex">
          <span className="rd-ellip">{row.label}</span>
          {release.disabledTemplates.includes(row.ref) ? (
            <Pill tone="grey" small>
              Off
            </Pill>
          ) : null}
        </span>
      ),
    },
    {
      id: 'image',
      title: 'Image',
      kind: 'choice',
      caption: 'IMAGE',
      /* Three readings, and the filter agrees with the cell in all three.
         It used to file a dashed switched-off cell under "Master default". */
      value: (row) =>
        release.disabledTemplates.includes(row.ref)
          ? null
          : (release.templateImages[row.slot] ?? 'Not chosen'),
      cell: (row) =>
        release.disabledTemplates.includes(row.ref) ? (
          /* A dash, not an invitation: this email never sends, so no picture
             is owed. That distinction is the whole reason `NoneYet` exists. */
          <None />
        ) : release.templateImages[row.slot] ? (
          <button
            type="button"
            className="rd-chip rd-chip-sm"
            onClick={() => setPickingSlot({ slot: row.slot, label: row.label })}
          >
            {release.templateImages[row.slot]}
          </button>
        ) : (
          <NoneYet onClick={() => setPickingSlot({ slot: row.slot, label: row.label })}>
            Not chosen
          </NoneYet>
        ),
    },
    {
      id: 'copy',
      title: 'Copy',
      locked: true,
      kind: 'choice',
      caption: 'COPY',
      /* Customised or Default, and nothing else. "Off" was never a copy state
         — it answered "does this email exist", displaced the answer this
         column owes, and hid a stored override until you switched the row back
         on. A switched-off row keeps showing what its copy IS, which is
         exactly what you want to know before switching it on again. */
      order: ['Customised', 'Default'],
      value: (row) =>
        !row.copyRow ? null : release.templateOverrides[row.ref] ? 'Customised' : 'Default',
      cell: (row) =>
        !row.copyRow ? (
          <span className="rd-none">Shared</span>
        ) : release.templateOverrides[row.ref] ? (
          <Pill tone="blue">Customised</Pill>
        ) : (
          <None />
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
            {canToggle ? (
              disabled ? (
                /* Switching back on is not the mirror of switching off: no
                   cancelled send returns, so the row says so rather than
                   letting somebody expect one. */
                <Why says="Cancelled sends do not come back.">
                  <RowAct onClick={() => void toggle(row.ref, true)}>Switch on</RowAct>
                </Why>
              ) : (
                <RowAct onClick={() => setSwitchingOff(row.ref)}>Switch off</RowAct>
              )
            ) : null}
            {!disabled ? <RowAct onClick={() => setEditingRef(row.ref)}>Edit</RowAct> : null}
          </div>
        );
      },
    },
  ];

  const offReach = switchingOff ? reachOf(switchingOff) : { sends: 0, batches: 0 };

  return (
    <>
      <DataTable
        table="release-emails"
        noun="email"
        searchPlaceholder="Search"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.slot}
        empty="No emails."
        /* Shown finished as well as unfinished. A caption that only appears
           while something is wrong never tells you the job is done. */
        headActions={
          <span className="rd-none">
            {`Images ${slots.length - missing.length} of ${slots.length}`}
          </span>
        }
      />
      <ReleaseEmailEditModal
        previewBatch={previewBatch}
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

      {/* Switching off reaches every batch at once and cancels queued sends.
          Cancelling ONE send already opens a dialogue naming it, so the bigger
          act had less friction than the smaller one, and its reach was stated
          only afterwards, in a toast that disappears. */}
      <Dialog
        open={switchingOff !== null}
        size="sm"
        title={switchingOff ? `Switch off “${TEMPLATE_LABELS[switchingOff]}”?` : ''}
        onClose={() => setSwitchingOff(null)}
        primary={{
          label: 'Switch off',
          destructive: true,
          onClick: () => {
            if (switchingOff) void toggle(switchingOff, false);
            setSwitchingOff(null);
          },
        }}
        secondary={{ label: 'Keep', onClick: () => setSwitchingOff(null) }}
      >
        <Bar
          tone="warn"
          title={
            offReach.sends > 0
              ? `${plural(offReach.sends, 'queued send')} cancelled`
              : 'No sends queued for it'
          }
        />
      </Dialog>
    </>
  );
}

function ReleaseEmailEditModal({
  release,
  templateRef,
  fields,
  previewBatch,
  onClose,
  onSaved,
}: {
  release: Release;
  templateRef: TemplateRef | null;
  /** Release-level token values, so the preview reads as it will arrive. */
  fields: Record<string, string | undefined>;
  /** The batch whose dates fill the preview — named on screen, because on a
      multi-batch release the windows differ and an unlabelled preview claims
      to be all of them. */
  previewBatch: Batch | null;
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

  /* What each token READS AS is the release's own current value — the same
     `fields` the preview below resolves with — so this table is a legend for
     that preview, not a second answer. */
  const tokenRows: { token: string; value: string }[] = [
    { token: 'first_name', value: "each collector's first name" },
    { token: 'artist', value: fields.artist ?? '' },
    { token: 'release_title', value: fields.release_title ?? '' },
    { token: 'promise_date', value: fields.promise_date ?? '' },
    { token: 'ship_window_short', value: fields.ship_window_short ?? '' },
    ...(isDelay
      ? [
          { token: 'old_promise_date', value: 'the date collectors were told before' },
          { token: 'reason_line', value: 'the generated delay sentence' },
        ]
      : [
          { token: 'closing_line', value: fields.closing_line ?? '' },
          { token: 'edition_noun', value: fields.edition_noun ?? '' },
          { token: 'next_destination', value: fields.next_destination ?? '' },
          { token: 'remaining_route', value: fields.remaining_route ?? '' },
        ]),
    ...(templateRef === 'pp-production'
      ? [{ token: 'craft_line', value: fields.craft_line ?? '' }]
      : []),
  ];

  /* Into the body, at the cursor — the dialogue has exactly one textarea.
     With no cursor to honour, the token lands at the end. */
  const insertToken = (token: string): void => {
    const tag = `{{${token}}}`;
    const area = document.querySelector<HTMLTextAreaElement>('.rd-dialog textarea');
    if (area) {
      const at = area.selectionStart ?? area.value.length;
      const end = area.selectionEnd ?? at;
      setBody((prev) => prev.slice(0, at) + tag + prev.slice(end));
      requestAnimationFrame(() => {
        area.focus();
        area.setSelectionRange(at + tag.length, at + tag.length);
      });
    } else {
      setBody((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };
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
          ? `${TEMPLATE_LABELS[templateRef]} — copy`
          : ''
      }
      primary={{
        label: 'Save',
        onClick: () => void save(),
        disabled: saving || !subject.trim() || !body.trim(),
      }}
      secondary={[
        ...(customised ? [{ label: 'Reset', onClick: () => void save(true) }] : []),
        { label: 'Cancel', onClick: onClose },
      ]}
    >
      <Bar
        tone="note"
        title={isDelay ? 'Pre-fills future delay emails' : 'Applies to every batch'}
      />
      <div className="rd-fields">
        <Field label="Subject" value={subject} onChange={setSubject} />
        <Field label="Headline" value={headline} onChange={setHeadline} />
        <Field label="Body" value={body} onChange={setBody} multiline deep />
      </div>
      {/* The tokens this template can use, each with the value it resolves to
          right now — a writer should never have to already know that
          {{ship_window_short}} exists to reach for it. A row click drops the
          token into the body at the cursor. Filtered per template: the delay
          email's two are meaningless on a milestone, and the craft line
          belongs to Production alone. */}
      <div className="rd-grouphd">Tokens</div>
      <table className="rd-t rd-t27 rd-fit">
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Reads as</th>
          </tr>
        </thead>
        <tbody>
          {tokenRows.map((row) => (
            <tr key={row.token} className="rd-rowlink" onClick={() => insertToken(row.token)}>
              <td className="rd-ink">{`{{${row.token}}}`}</td>
              <td>
                <Cap>{row.value}</Cap>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* The form keeps the tokens — they are patched per batch at send time —
          and the preview resolves them, so what is edited and what arrives are
          both on screen and neither pretends to be the other. The batch whose
          dates fill it is NAMED: on a five-batch release the windows differ,
          and an unlabelled preview claims to be all of them. */}
      {previewBatch ? (
        <div className="rd-previewas">
          Previewing as {previewBatch.name} · {shipWindowShort(previewBatch.promiseDate!)}
        </div>
      ) : null}
      <EmailPreview
        headline={patchTokens(headline, fields)}
        body={patchTokens(body, fields)}
        imageName={previewImage}
      />
    </Dialog>
  );
}
