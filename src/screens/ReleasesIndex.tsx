import {
  Badge,
  Card,
  IndexTable,
  InlineStack,
  Page,
  SkeletonBodyText,
  Text,
} from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, releaseStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { useColumns } from '../ui/useColumns';
import { NewReleaseModal } from '../components/NewReleaseModal';

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
    { id: 'next', title: 'Next scheduled send' },
    { id: 'attention', title: 'Attention', locked: true },
  ]);

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
            itemCount={releases.data.length}
            selectable={false}
            headings={columns.headings as [{ title: string }]}
          >
            {releases.data.map((summary, index) => {
              const { release } = summary;
              const next = summary.nextScheduledSend;
              return (
                <IndexTable.Row
                  id={release.id}
                  key={release.id}
                  position={index}
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
                      {next ? (
                        <Text as="span" variant="bodySm">
                          {formatDayShort(next.scheduledDate)} · {TEMPLATE_LABELS[next.templateRef]}
                        </Text>
                      ) : (
                        <Text as="span" variant="bodySm" tone="subdued">
                          —
                        </Text>
                      )}
                    </IndexTable.Cell>
                  ) : null}
                  <IndexTable.Cell>
                    <InlineStack gap="100" wrap>
                      {summary.overdueCount > 0 ? (
                        <Badge tone="critical">{`${summary.overdueCount} overdue`}</Badge>
                      ) : null}
                      {summary.pendingApprovalCount > 0 ? (
                        <Badge tone="attention">{`${summary.pendingApprovalCount} pending approval`}</Badge>
                      ) : null}
                      {summary.overdueCount === 0 && summary.pendingApprovalCount === 0 ? (
                        <Text as="span" variant="bodySm" tone="subdued">
                          —
                        </Text>
                      ) : null}
                    </InlineStack>
                  </IndexTable.Cell>
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
