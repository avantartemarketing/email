import { BlockStack, ChoiceList, FormLayout, Modal, Select, TextField } from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProductKind, TemplateRef } from '../types';
import { TEMPLATE_LABELS } from '../ui/format';
import { useApp } from '../ui/AppContext';

/** Milestones the operator can include/exclude at setup, per product kind.
 *  On-track is listed for prints too — long plans use it as a gap filler. */
const OPTIONAL_MILESTONES: Record<ProductKind, TemplateRef[]> = {
  print: ['pp-printing', 'pp-signing', 'pp-framing', 'pp-ontrack'],
  sculpture: ['pp-ontrack'],
};

export function NewReleaseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const navigate = useNavigate();
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
    <Modal
      open={open}
      onClose={onClose}
      title="New release"
      primaryAction={{
        content: 'Create release',
        onAction: () => void save(),
        loading: saving,
        disabled: !title.trim() || !artist.trim(),
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <FormLayout>
            <TextField
              label="Title"
              value={title}
              onChange={setTitle}
              autoComplete="off"
              requiredIndicator
              helpText="Must match the Shopify product title — the CSV importer filters line items by it."
            />
            <TextField
              label="Artist"
              value={artist}
              onChange={setArtist}
              autoComplete="off"
              requiredIndicator
            />
            <FormLayout.Group>
              <TextField
                label="Edition size"
                type="number"
                value={editionSize}
                onChange={setEditionSize}
                autoComplete="off"
              />
              <Select
                label="Product type"
                options={[
                  { label: 'Print', value: 'print' },
                  { label: 'Sculpture', value: 'sculpture' },
                ]}
                value={productKind}
                onChange={(value) => {
                  const kind = value as ProductKind;
                  setProductKind(kind);
                  setSelectedMilestones(OPTIONAL_MILESTONES[kind]);
                }}
                helpText="Drives the milestone sequence (sculptures get on-track updates instead of printing/signing/framing)."
              />
            </FormLayout.Group>
            <ChoiceList
              allowMultiple
              title="Emails this release sends"
              choices={optional.map((ref) => ({
                label: TEMPLATE_LABELS[ref],
                value: ref,
              }))}
              selected={selectedMilestones}
              onChange={setSelectedMilestones}
            />
          </FormLayout>
          <BlockStack gap="100">
            <ChoiceListFootnote />
          </BlockStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function ChoiceListFootnote(): ReactElement {
  return (
    <p style={{ color: 'var(--p-color-text-secondary)', fontSize: 'var(--p-font-size-300)' }}>
      “Preparing for dispatch” and the delay notice are always available. Copy for every email
      starts from the HubSpot master defaults and can be customised per release — or per send —
      from the release page.
    </p>
  );
}
