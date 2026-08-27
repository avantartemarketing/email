import { BlockStack, FormLayout, Modal, Select, TextField } from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProductKind } from '../types';
import { useApp } from '../ui/AppContext';

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
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const release = await data.createRelease({
        title,
        artist,
        editionSize: editionSize ? Number.parseInt(editionSize, 10) : null,
        productKind,
      });
      showToast(`${release.title} created — import the Shopify order export next`);
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
                onChange={(value) => setProductKind(value as ProductKind)}
                helpText="Drives the milestone sequence (sculptures get on-track updates instead of printing/signing/framing)."
              />
            </FormLayout.Group>
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
