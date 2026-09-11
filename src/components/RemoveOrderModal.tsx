import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Order } from '../types';
import { useApp } from '../ui/AppContext';
import { Bar, Dialog } from '../ui/rd';
import Field from '../rd/components/Field';

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
      showToast(`${order.shopifyOrderName} removed`);
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
    <Dialog
      open={order !== null}
      size="sm"
      onClose={onClose}
      title={order ? `Remove ${order.shopifyOrderName} — ${order.collectorName}` : 'Remove order'}
      primary={{
        label: 'Remove',
        destructive: true,
        onClick: () => void save(),
        disabled: saving || !reason.trim(),
      }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      <Bar tone="warn" title="The collector stops receiving updates" />
      <div className="rd-fields">
        <Field
          label="Reason"
          value={reason}
          onChange={setReason}
          noteNear={!reason.trim()}
        />
      </div>
    </Dialog>
  );
}
