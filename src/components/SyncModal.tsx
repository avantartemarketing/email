import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Release } from '../types';
import type { SyncResult } from '../data/DataLayer';
import { useApp } from '../ui/AppContext';
import { Facts } from '../ui/rd';
import { OrderIntakeDialog } from './OrderIntakeDialog';

/**
 * The Shopify integration's door, worked by hand until the integration is
 * live: a fresh export from the shop stands in for the API call, and
 * `syncRelease` behind it is the exact entry phase 2 wires up — so what the
 * sync WILL do is what this door already does. Additions land, statuses and
 * tags refresh, and every implied change becomes a proposal to review.
 */
export function SyncModal({
  open,
  release,
  onClose,
  onSynced,
}: {
  open: boolean;
  release: Release;
  onClose: () => void;
  onSynced: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [result, setResult] = useState<{ fileName: string; sync: SyncResult } | null>(null);

  const close = (): void => {
    setResult(null);
    onClose();
  };

  return (
    <OrderIntakeDialog
      open={open}
      title={`Sync — ${release.title}`}
      onClose={close}
      parse={result ? { fileName: result.fileName } : null}
      onRead={(parsed, _products, fileName) => {
        void data
          .syncRelease(release.id, parsed.items, fileName)
          .then((sync) => {
            setResult({ fileName, sync });
            onSynced();
          })
          .catch((err: unknown) =>
            showToast(err instanceof Error ? err.message : String(err), true),
          );
      }}
      primary={{ label: 'Done', onClick: close }}
    >
      {result ? (
        <Facts
          items={[
            { label: 'New orders', value: result.sync.added },
            { label: 'Refreshed', value: result.sync.refreshed },
            { label: 'To review', value: result.sync.newProposals },
          ]}
        />
      ) : null}
    </OrderIntakeDialog>
  );
}
