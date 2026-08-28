import {
  Badge,
  Button,
  Card,
  IndexTable,
  Page,
  Popover,
  SkeletonBodyText,
  Text,
  useIndexResourceState,
} from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UpcomingSendInfo } from '../types';
import { formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, releaseStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { useColumns } from '../ui/useColumns';
import { NewReleaseModal } from '../components/NewReleaseModal';

/**
 * The next-send cell: just the date at rest; clicking it opens the next
 * three sends — which email, which batch, how many collectors — each a
 * link into its send detail.
 */
function NextSendCell({
  upcoming,
  onOpenSend,
}: {
  upcoming: UpcomingSendInfo[];
  onOpenSend: (sendId: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  if (upcoming.length === 0) {
    return (
      <Text as="span" variant="bodySm" tone="subdued">
        —
      </Text>
    );
  }
  return (
    <Popover
      active={open}
      onClose={() => setOpen(false)}
      activator={
        <Button variant="plain" onClick={() => setOpen((v) => !v)}>
          {formatDayShort(upcoming[0].scheduledDate)}
        </Button>
      }
    >
      <div style={{ padding: 'var(--p-space-300) var(--p-space-400)', minWidth: 300 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--p-space-200)' }}>
          {upcoming.map((send, idx) => (
            <div key={send.sendId}>
              <Button variant="plain" onClick={() => onOpenSend(send.sendId)}>
                {`${formatDayShort(send.scheduledDate)} — ${TEMPLATE_LABELS[send.templateRef]}${send.type === 'delay' ? ' (delay)' : ''}`}
              </Button>
              <Text as="p" variant="bodySm" tone="subdued">
                {idx === 0 ? 'Next · ' : ''}
                {send.batchName} · {send.recipientCount} collector
                {send.recipientCount === 1 ? '' : 's'}
              </Text>
            </div>
          ))}
        </div>
      </div>
    </Popover>
  );
}

export function ReleasesIndex(): ReactElement {
  const { data } = useApp();
  const navigate = useNavigate();
  const [newReleaseOpen, setNewReleaseOpen] = useState(false);
  const releases = useAsync(() => data.listReleases(), []);

  const columns = useColumns('releases', [
    { id: 'release', title: 'Release', locked: true },
    { id: 'artist', title: 'Artist' },
    { id: 'edition', title: 'Edition size', defaultHidden: true },
    { id: 'status', title: 'Status' },
    { id: 'orders', title: 'Orders' },
    { id: 'batches', title: 'Batches' },
    { id: 'next', title: 'Next send' },
    { id: 'overdue', title: 'Overdue' },
    { id: 'pending', title: 'Pending approval' },
  ]);

  const rows = releases.data ?? [];
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(
      rows.map((r) => ({ id: r.release.id })) as unknown as { [key: string]: unknown }[],
    );

  return (
    <Page
      fullWidth
      title="Releases"
      subtitle="Every release with post-purchase comms, and what needs attention"
      primaryAction={{ content: 'New release', onAction: () => setNewReleaseOpen(true) }}
    >
      <Card padding="0">
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 'var(--p-space-300) var(--p-space-400) 0',
          }}
        >
          {columns.columnsButton}
        </div>
        {releases.data === null ? (
          <div style={{ padding: 'var(--p-space-400)' }}>
            <SkeletonBodyText lines={6} />
          </div>
        ) : (
          <IndexTable
            resourceName={{ singular: 'release', plural: 'releases' }}
            itemCount={rows.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={columns.headings as [{ title: string }]}
          >
            {rows.map((summary, index) => {
              const { release } = summary;
              return (
                <IndexTable.Row
                  id={release.id}
                  key={release.id}
                  position={index}
                  selected={selectedResources.includes(release.id)}
                  onClick={() => navigate(`/releases/${release.id}`)}
                >
                  <IndexTable.Cell>
                    <Text as="span" fontWeight="semibold">
                      {release.title}
                    </Text>
                  </IndexTable.Cell>
                  {columns.show('artist') ? (
                    <IndexTable.Cell>{release.artist}</IndexTable.Cell>
                  ) : null}
                  {columns.show('edition') ? (
                    <IndexTable.Cell>{release.editionSize ?? '—'}</IndexTable.Cell>
                  ) : null}
                  {columns.show('status') ? (
                    <IndexTable.Cell>{releaseStatusBadge(release.status)}</IndexTable.Cell>
                  ) : null}
                  {columns.show('orders') ? (
                    <IndexTable.Cell>{summary.orderCount}</IndexTable.Cell>
                  ) : null}
                  {columns.show('batches') ? (
                    <IndexTable.Cell>
                      {summary.batchCount > 1 ? (
                        summary.batchCount
                      ) : (
                        <Text as="span" variant="bodySm" tone="subdued">
                          —
                        </Text>
                      )}
                    </IndexTable.Cell>
                  ) : null}
                  {columns.show('next') ? (
                    <IndexTable.Cell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <NextSendCell
                          upcoming={summary.upcomingSends}
                          onOpenSend={(sendId) => navigate(`/sends/${sendId}`)}
                        />
                      </div>
                    </IndexTable.Cell>
                  ) : null}
                  {columns.show('overdue') ? (
                    <IndexTable.Cell>
                      {summary.overdueCount > 0 ? (
                        <Badge tone="critical">{String(summary.overdueCount)}</Badge>
                      ) : (
                        <Text as="span" variant="bodySm" tone="subdued">
                          —
                        </Text>
                      )}
                    </IndexTable.Cell>
                  ) : null}
                  {columns.show('pending') ? (
                    <IndexTable.Cell>
                      {summary.pendingApprovalCount > 0 ? (
                        <Badge tone="attention">{String(summary.pendingApprovalCount)}</Badge>
                      ) : (
                        <Text as="span" variant="bodySm" tone="subdued">
                          —
                        </Text>
                      )}
                    </IndexTable.Cell>
                  ) : null}
                </IndexTable.Row>
              );
            })}
          </IndexTable>
        )}
      </Card>
      <NewReleaseModal open={newReleaseOpen} onClose={() => setNewReleaseOpen(false)} />
    </Page>
  );
}
