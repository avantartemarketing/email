import { Banner, BlockStack, Modal, TextField } from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Order } from '../types';
import { useApp } from '../ui/AppContext';

/** Cancellations/refunds are marked by hand in v1 — never inferred from CSV. */
export function RemoveOrderModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order | null;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await data.removeOrder(order.id, reason);
      showToast(`${order.shopifyOrderName} removed — no further emails to ${order.collectorName}`);
      setReason('');
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
      open={order !== null}
      onClose={onClose}
      title={order ? `Remove ${order.shopifyOrderName} — ${order.collectorName}` : 'Remove order'}
      primaryAction={{
        content: 'Remove order',
        destructive: true,
        onAction: () => void save(),
        loading: saving,
        disabled: !reason.trim(),
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Banner tone="warning" title="The collector stops receiving updates">
            <p>
              The order drops out of its batch and out of every future send. Emails already sent
              stay in the log. This does not refund or cancel anything in Shopify.
            </p>
          </Banner>
          <TextField
            label="Reason"
            value={reason}
            onChange={setReason}
            autoComplete="off"
            requiredIndicator
            placeholder="e.g. Refunded in Shopify — collector cancelled"
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
