import {
  Badge,
  BlockStack,
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
import { NewReleaseModal } from '../components/NewReleaseModal';

export function ReleasesIndex(): ReactElement {
  const { data } = useApp();
  const navigate = useNavigate();
  const [newReleaseOpen, setNewReleaseOpen] = useState(false);
  const releases = useAsync(() => data.listReleases(), []);

  return (
    <Page
      fullWidth
      title="Releases"
      subtitle="Every release with post-purchase comms, and what needs attention"
      primaryAction={{ content: 'New release', onAction: () => setNewReleaseOpen(true) }}
    >
      <Card padding="0">
        {releases.data === null ? (
          <div style={{ padding: 'var(--p-space-400)' }}>
            <SkeletonBodyText lines={6} />
          </div>
        ) : (
          <IndexTable
            resourceName={{ singular: 'release', plural: 'releases' }}
            itemCount={releases.data.length}
            selectable={false}
            headings={[
              { title: 'Release' },
              { title: 'Status' },
              { title: 'Orders' },
              { title: 'Batches' },
              { title: 'Next scheduled send' },
              { title: 'Attention' },
            ]}
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
                    <BlockStack gap="050">
                      <Text as="span" fontWeight="semibold">
                        {release.title}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {release.artist}
                        {release.editionSize ? ` · edition of ${release.editionSize}` : ''}
                      </Text>
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{releaseStatusBadge(release.status)}</IndexTable.Cell>
                  <IndexTable.Cell>{summary.orderCount}</IndexTable.Cell>
                  <IndexTable.Cell>{summary.batchCount}</IndexTable.Cell>
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
