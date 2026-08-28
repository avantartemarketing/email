import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProductKind, TemplateRef } from '../types';
import { TEMPLATE_LABELS } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Dialog } from '../ui/rd';
import Field from '../rd/components/Field';
import { SelectField } from '../rd/components/Picker';

/** Milestones the operator can include/exclude at setup, per product kind.
 *  On-track is listed for prints too — long plans use it as a gap filler. */
const OPTIONAL_MILESTONES: Record<ProductKind, TemplateRef[]> = {
  print: ['pp-printing', 'pp-signing', 'pp-framing', 'pp-ontrack'],
  sculpture: ['pp-ontrack'],
};

/**
 * A rule the field obeys silently, on the "?" the kit keeps for exactly this
 * (`redesign.css`, "a field's own footnote"). It is where a sentence goes when
 * the sentence is a rule rather than a caption: the button's own name carries
 * the words, so nothing is lost to a reader who cannot hover.
 */
function Ask({ says }: { says: string }): ReactElement {
  return (
    <span className="rd-why">
      <button type="button" className="rd-ask" aria-label={says}>
        ?
      </button>
      <span className="rd-tip rd-tip-wrap" role="tooltip">
        {says}
      </span>
    </span>
  );
}

export function NewReleaseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const navigate = useNavigate();
  const editionId = useId();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [editionSize, setEditionSize] = useState('');
  const [productKind, setProductKind] = useState<ProductKind>('print');
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>(
    OPTIONAL_MILESTONES.print,
  );
  const [saving, setSaving] = useState(false);

  const optional = OPTIONAL_MILESTONES[productKind];

  const save = async () => {
    setSaving(true);
    try {
      const release = await data.createRelease({
        title,
        artist,
        editionSize: editionSize ? Number.parseInt(editionSize, 10) : null,
        productKind,
        disabledTemplates: optional.filter((ref) => !selectedMilestones.includes(ref)),
      });
      showToast(`${release.title} created — review its emails, then import the Shopify order export`);
      onClose();
      navigate(`/releases/${release.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="New release"
      size="md"
      onClose={onClose}
      primary={{
        label: 'Create release',
        onClick: () => void save(),
        disabled: saving || !title.trim() || !artist.trim(),
      }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      <div className="rd-fields">
        <Field
          label="Title"
          value={title}
          onChange={setTitle}
          note={
            <Ask says="Must match the Shopify product title — the CSV importer filters line items by it." />
          }
        />
        <Field label="Artist" value={artist} onChange={setArtist} />
        <div className="rd-fieldrow">
          <Field label="Edition size" value={editionSize} numeric controlId={editionId}>
            <input
              id={editionId}
              type="number"
              value={editionSize}
              onChange={(e) => setEditionSize(e.target.value)}
            />
          </Field>
          <SelectField
            label="Product type"
            value={productKind}
            options={[
              { label: 'Print', value: 'print' },
              { label: 'Sculpture', value: 'sculpture' },
            ]}
            onChange={(value) => {
              const kind = value as ProductKind;
              setProductKind(kind);
              setSelectedMilestones(OPTIONAL_MILESTONES[kind]);
            }}
          />
        </div>

        {/* A switch and not a tick: a tick says "this one, for what I am about
            to do", where each of these is a state the RELEASE keeps — whether
            it sends that email at all. */}
        <div className="rd-grouphd">
          Emails this release sends{' '}
          <Ask says="“Preparing for dispatch” and the delay notice are always available." />
        </div>
        {optional.map((ref) => {
          const on = selectedMilestones.includes(ref);
          return (
            <button
              key={ref}
              type="button"
              role="switch"
              aria-checked={on}
              className={on ? 'rd-sw on' : 'rd-sw'}
              onClick={() =>
                setSelectedMilestones((prev) =>
                  prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref],
                )
              }
            >
              {/* The word first and the track after (`20a`), and the word
                  takes the row — four tracks in a ragged column is four
                  states nobody can read down. */}
              <span className="rd-swlab" style={{ flex: 1, textAlign: 'left' }}>
                {TEMPLATE_LABELS[ref]}
              </span>
              <span className="rd-swt" aria-hidden>
                <span className="rd-swk" />
              </span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
