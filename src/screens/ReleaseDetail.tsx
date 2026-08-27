import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  IndexTable,
  InlineStack,
  Layout,
  Modal,
  Page,
  SkeletonBodyText,
  SkeletonPage,
  Tabs,
  Text,
  useIndexResourceState,
} from '@shopify/polaris';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Batch, Order, ReleaseDetail as ReleaseDetailData, ScheduledSend } from '../types';
import { formatDay, formatDayShort, today } from '../logic/dates';
import { plural, releaseStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { PlanTimeline } from '../components/PlanTimeline';
import { BatchHistoryTimeline } from '../components/BatchHistoryTimeline';
import { RescheduleModal } from '../components/RescheduleModal';
import { PromiseDateModal } from '../components/PromiseDateModal';
import { AddSendModal } from '../components/AddSendModal';
import { EditSendModal } from '../components/EditSendModal';
import { RemoveOrderModal } from '../components/RemoveOrderModal';
import { ImportCsvModal } from '../components/ImportCsvModal';

export function ReleaseDetail(): ReactElement {
  const { releaseId } = useParams<{ releaseId: string }>();
  const { data } = useApp();
  const navigate = useNavigate();
  const detail = useAsync(() => data.getRelease(releaseId!), [releaseId]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  if (detail.error) {
    return (
      <Page title="Release not found" backAction={{ content: 'Releases', onAction: () => navigate('/') }}>
        <Banner tone="critical" title={detail.error.message} />
      </Page>
    );
  }
  if (detail.data === null) {
    return (
      <SkeletonPage title="Release">
        <SkeletonBodyText lines={10} />
      </SkeletonPage>
    );
  }

  const d = detail.data;
  const batches = d.batches;
  const batchTab = Math.min(selectedTab, batches.length - 1);
  const batch = batches[batchTab];
  const flaggedNoEmail = d.orders.filter((o) => !o.removed && !o.email);
  const flaggedNoContact = d.orders.filter((o) => !o.removed && o.email && !o.hubspotContactId);

  return (
    <Page
      title={d.release.title}
      subtitle={`${d.release.artist}${d.release.editionSize ? ` · edition of ${d.release.editionSize}` : ''} · ${d.release.productKind}`}
      titleMetadata={releaseStatusBadge(d.release.status)}
      backAction={{ content: 'Releases', onAction: () => navigate('/') }}
      secondaryActions={[{ content: 'Import CSV', onAction: () => setImportOpen(true) }]}
    >
      <BlockStack gap="400">
        {flaggedNoEmail.length > 0 || flaggedNoContact.length > 0 ? (
          <Banner tone="warning" title="Some orders can't receive email yet">
            <p>
              {flaggedNoEmail.length > 0
                ? `${plural(flaggedNoEmail.length, 'order')} with no email address (${flaggedNoEmail
                    .map((o) => o.shopifyOrderName)
                    .join(', ')}). `
                : ''}
              {flaggedNoContact.length > 0
                ? `${plural(flaggedNoContact.length, 'order')} with no matching HubSpot contact (${flaggedNoContact
                    .map((o) => o.shopifyOrderName)
                    .join(', ')}).`
                : ''}{' '}
              They stay in their batches and are flagged on every send until resolved in HubSpot,
              then re-imported.
            </p>
          </Banner>
        ) : null}

        {d.orders.length === 0 ? (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                No orders yet
              </Text>
              <Text as="p" tone="subdued">
                Import the Shopify order export to create this release's orders in {batch?.name ?? 'the default batch'}.
              </Text>
              <InlineStack>
                <Button variant="primary" onClick={() => setImportOpen(true)}>
                  Import CSV
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        ) : (
          <>
            <Tabs
              tabs={batches.map((b) => {
                const active = d.orders.filter((o) => o.batchId === b.id && !o.removed).length;
                return { id: b.id, content: `${b.name} (${active})` };
              })}
              selected={batchTab}
              onSelect={setSelectedTab}
            />
            {batch ? (
              <BatchSection
                key={batch.id}
                detail={d}
                batch={batch}
                onChanged={() => detail.reload()}
                onBatchCreated={() => {
                  detail.reload();
                  // The new batch lands at the end (sorted by creation).
                  setSelectedTab(batches.length);
                }}
              />
            ) : null}
          </>
        )}
      </BlockStack>
      <ImportCsvModal
        open={importOpen}
        release={d.release}
        onClose={() => setImportOpen(false)}
        onImported={() => detail.reload()}
      />
    </Page>
  );
}

function BatchSection({
  detail,
  batch,
  onChanged,
  onBatchCreated,
}: {
  detail: ReleaseDetailData;
  batch: Batch;
  onChanged: () => void;
  onBatchCreated: () => void;
}): ReactElement {
  const { data, showToast, userName } = useApp();
  const release = detail.release;
  const batchOrders = useMemo(
    () => detail.orders.filter((o) => o.batchId === batch.id),
    [detail.orders, batch.id],
  );
  const activeOrders = useMemo(() => batchOrders.filter((o) => !o.removed), [batchOrders]);
  const removedOrders = useMemo(() => batchOrders.filter((o) => o.removed), [batchOrders]);
  const batchSends = useMemo(
    () => detail.sends.filter((s) => s.batchId === batch.id),
    [detail.sends, batch.id],
  );
  const batchEvents = useMemo(
    () => detail.events.filter((e) => e.batchId === batch.id),
    [detail.events, batch.id],
  );
  const draftCount = batchSends.filter((s) => s.status === 'draft').length;

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(activeOrders as unknown as { [key: string]: unknown }[]);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [addSendOpen, setAddSendOpen] = useState(false);
  const [editingSend, setEditingSend] = useState<ScheduledSend | null>(null);
  const [removingOrder, setRemovingOrder] = useState<Order | null>(null);
  const [cancellingSend, setCancellingSend] = useState<ScheduledSend | null>(null);

  const selectedOrders =
    selectedResources.length > 0
      ? activeOrders.filter((o) => selectedResources.includes(o.id))
      : activeOrders;

  const submitPlan = async () => {
    try {
      const count = await data.submitBatchPlanForApproval(batch.id);
      showToast(`${plural(count, 'send')} submitted for approval`);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };

  const confirmCancelSend = async () => {
    if (!cancellingSend) return;
    try {
      await data.cancelSend(cancellingSend.id);
      showToast('Send cancelled');
      setCancellingSend(null);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };

  return (
    <Layout>
      <Layout.Section>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <BlockStack gap="050">
                  <Text as="h2" variant="headingSm">
                    Promised delivery
                  </Text>
                  <Text as="p" variant="headingLg">
                    {batch.promiseDate ? formatDay(batch.promiseDate) : 'Not set'}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {plural(activeOrders.length, 'active order')}
                    {removedOrders.length > 0 ? ` · ${removedOrders.length} removed` : ''}
                    {selectedResources.length > 0
                      ? ` · ${selectedResources.length} selected for reschedule`
                      : ''}
                  </Text>
                </BlockStack>
                <InlineStack gap="200" wrap>
                  {batch.promiseDate ? (
                    <Button
                      variant="primary"
                      onClick={() => setRescheduleOpen(true)}
                      disabled={activeOrders.length === 0}
                    >
                      {selectedResources.length > 0 && selectedResources.length < activeOrders.length
                        ? `Change delivery date (${selectedResources.length})`
                        : 'Change delivery date'}
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setPromiseOpen(true)}>
                      Set promise date
                    </Button>
                  )}
                  {draftCount > 0 ? (
                    <Button onClick={() => void submitPlan()}>
                      {`Submit plan for approval (${draftCount})`}
                    </Button>
                  ) : null}
                  <Button onClick={() => setAddSendOpen(true)} disabled={!batch.promiseDate}>
                    Add send
                  </Button>
                </InlineStack>
              </InlineStack>
            </BlockStack>
          </Card>

          <Card padding="0">
            <div style={{ padding: 'var(--p-space-400) var(--p-space-400) var(--p-space-200)' }}>
              <Text as="h2" variant="headingSm">
                Orders
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Select some to split them onto a new delivery date; select none to reschedule the
                whole batch.
              </Text>
            </div>
            <IndexTable
              resourceName={{ singular: 'order', plural: 'orders' }}
              itemCount={activeOrders.length}
              selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: 'Order' },
                { title: 'Collector' },
                { title: 'Contact' },
                { title: 'Variant' },
                { title: 'Ordered' },
                { title: '' },
              ]}
              promotedBulkActions={[
                {
                  content: 'Change delivery date',
                  onAction: () => setRescheduleOpen(true),
                },
              ]}
            >
              {activeOrders.map((order, index) => (
                <IndexTable.Row
                  id={order.id}
                  key={order.id}
                  position={index}
                  selected={selectedResources.includes(order.id)}
                >
                  <IndexTable.Cell>
                    <Text as="span" fontWeight="semibold">
                      {order.shopifyOrderName}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{order.collectorName}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="100" blockAlign="center" wrap>
                      <Text as="span" variant="bodySm">
                        {order.email ?? '—'}
                      </Text>
                      {!order.email ? <Badge tone="critical">No email</Badge> : null}
                      {order.email && !order.hubspotContactId ? (
                        <Badge tone="warning">No HubSpot contact</Badge>
                      ) : null}
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{order.variant || '—'}</IndexTable.Cell>
                  <IndexTable.Cell>{formatDayShort(order.orderDate)}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="micro"
                        tone="critical"
                        variant="plain"
                        onClick={() => setRemovingOrder(order)}
                      >
                        Remove
                      </Button>
                    </div>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            {removedOrders.length > 0 ? (
              <div style={{ padding: 'var(--p-space-300) var(--p-space-400)' }}>
                <BlockStack gap="100">
                  {removedOrders.map((order) => (
                    <InlineStack key={order.id} gap="200" blockAlign="center" wrap>
                      <Badge>Removed</Badge>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {order.shopifyOrderName} · {order.collectorName} —{' '}
                        {order.removedReason ?? 'removed'}
                        {order.removedBy ? ` (by ${userName(order.removedBy)})` : ''}
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </div>
            ) : null}
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                Comms plan
              </Text>
              <PlanTimeline
                sends={batchSends}
                onEdit={(send) => setEditingSend(send)}
                onCancel={(send) => setCancellingSend(send)}
              />
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>

      <Layout.Section variant="oneThird">
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Batch history
            </Text>
            <BatchHistoryTimeline events={batchEvents} />
          </BlockStack>
        </Card>
      </Layout.Section>

      <RescheduleModal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        release={release}
        batch={batch}
        selectedOrders={selectedOrders}
        batchActiveOrderCount={activeOrders.length}
        batchSends={batchSends}
        onDone={(message) => {
          setRescheduleOpen(false);
          clearSelection();
          showToast(message);
          if (selectedOrders.length < activeOrders.length) onBatchCreated();
          else onChanged();
        }}
      />
      <PromiseDateModal
        open={promiseOpen}
        release={release}
        batch={batch}
        onClose={() => setPromiseOpen(false)}
        onSaved={onChanged}
      />
      <AddSendModal
        open={addSendOpen}
        batch={batch}
        onClose={() => setAddSendOpen(false)}
        onSaved={onChanged}
      />
      <EditSendModal
        send={editingSend}
        onClose={() => setEditingSend(null)}
        onSaved={onChanged}
      />
      <RemoveOrderModal
        order={removingOrder}
        onClose={() => setRemovingOrder(null)}
        onSaved={onChanged}
      />
      <Modal
        open={cancellingSend !== null}
        onClose={() => setCancellingSend(null)}
        title={cancellingSend ? `Cancel “${cancellingSend.subject}”?` : ''}
        primaryAction={{
          content: 'Cancel send',
          destructive: true,
          onAction: () => void confirmCancelSend(),
        }}
        secondaryActions={[{ content: 'Keep it', onAction: () => setCancellingSend(null) }]}
      >
        <Modal.Section>
          <Text as="p">
            The email will not go out and drops off the plan. This is recorded in the batch
            history. Scheduled for {cancellingSend ? formatDayShort(cancellingSend.scheduledDate) : ''}
            {cancellingSend && cancellingSend.scheduledDate < today() ? ' (overdue)' : ''}.
          </Text>
        </Modal.Section>
      </Modal>
    </Layout>
  );
}
