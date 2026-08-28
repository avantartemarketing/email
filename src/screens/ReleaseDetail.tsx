import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  IndexTable,
  InlineStack,
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
import type {
  Batch,
  Order,
  OrderAllocation,
  ReleaseDetail as ReleaseDetailData,
  ScheduledSend,
} from '../types';
import { formatDay, formatDayShort, today } from '../logic/dates';
import { inheritedSentStory } from '../logic/reschedule';
import { plural, releaseStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { PlanTable } from '../components/PlanTable';
import { BatchHistoryTimeline } from '../components/BatchHistoryTimeline';
import { RescheduleModal } from '../components/RescheduleModal';
import { PromiseDateModal } from '../components/PromiseDateModal';
import { AddSendModal } from '../components/AddSendModal';
import { EditSendModal } from '../components/EditSendModal';
import { RemoveOrderModal } from '../components/RemoveOrderModal';
import { ImportCsvModal } from '../components/ImportCsvModal';
import { AllocationImportModal } from '../components/AllocationImportModal';
import { ReleaseEmailsPanel } from '../components/ReleaseEmailsCard';
import { useColumns } from '../ui/useColumns';

export function ReleaseDetail(): ReactElement {
  const { releaseId } = useParams<{ releaseId: string }>();
  const { data } = useApp();
  const navigate = useNavigate();
  const detail = useAsync(() => data.getRelease(releaseId!), [releaseId]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);

  if (detail.error) {
    return (
      <Page title="Release not found" backAction={{ content: 'Releases', onAction: () => navigate('/') }}>
        <Banner tone="critical" title={detail.error.message} />
      </Page>
    );
  }
  if (detail.data === null) {
    return (
      <SkeletonPage fullWidth title="Release">
        <SkeletonBodyText lines={10} />
      </SkeletonPage>
    );
  }

  const d = detail.data;
  const batches = d.batches;
  // Most releases never split: one batch means "the release" — no batch
  // names. Print releases show their framed/unframed flows as tabs, and
  // every release gets an Emails tab as a peer of its flows.
  const singleBatch = batches.length === 1;
  const batchTabs =
    batches.length > 1
      ? batches.map((b) => {
          const active = d.orders.filter((o) => o.batchId === b.id && !o.removed).length;
          return { id: b.id, content: `${b.name} (${active})` };
        })
      : [{ id: 'overview', content: 'Overview' }];
  const tabs = [...batchTabs, { id: 'emails', content: 'Emails' }];
  const emailsIndex = tabs.length - 1;
  const tabIndex = Math.min(selectedTab, emailsIndex);
  const showingEmails = tabIndex === emailsIndex;
  const batchTab = Math.min(tabIndex, Math.max(batches.length - 1, 0));
  const batch = showingEmails ? undefined : batches[batchTab];
  const flaggedNoEmail = d.orders.filter((o) => !o.removed && !o.email);
  const flaggedNoContact = d.orders.filter((o) => !o.removed && o.email && !o.hubspotContactId);

  return (
    <Page
      fullWidth
      title={d.release.title}
      subtitle={`${d.release.artist}${d.release.editionSize ? ` · edition of ${d.release.editionSize}` : ''} · ${d.release.productKind}`}
      titleMetadata={releaseStatusBadge(d.release.status)}
      backAction={{ content: 'Releases', onAction: () => navigate('/') }}
      secondaryActions={[
        { content: 'Import orders', onAction: () => setImportOpen(true) },
        { content: 'Import warehouse allocation', onAction: () => setAllocationOpen(true) },
      ]}
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

        <Tabs tabs={tabs} selected={tabIndex} onSelect={setSelectedTab} />
        {showingEmails ? (
          <ReleaseEmailsPanel release={d.release} onChanged={() => detail.reload()} />
        ) : d.orders.length === 0 ? (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                No orders yet
              </Text>
              <Text as="p" tone="subdued">
                Review the Emails tab (pick each send's image), then import the Shopify order
                export to create this release's orders
                {d.release.productKind === 'print' ? ' — framed and unframed prints land in their own batches with separate timelines' : ''}.
              </Text>
              <InlineStack gap="200">
                <Button variant="primary" onClick={() => setImportOpen(true)}>
                  Import orders
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        ) : batch ? (
          <BatchSection
            key={batch.id}
            detail={d}
            batch={batch}
            singleBatch={singleBatch}
            onChanged={() => detail.reload()}
            onBatchCreated={() => {
              detail.reload();
              // The new batch lands at the end (sorted by creation).
              setSelectedTab(batches.length);
            }}
          />
        ) : null}
      </BlockStack>
      <ImportCsvModal
        open={importOpen}
        release={d.release}
        onClose={() => setImportOpen(false)}
        onImported={() => detail.reload()}
      />
      <AllocationImportModal
        open={allocationOpen}
        release={d.release}
        onClose={() => setAllocationOpen(false)}
        onImported={() => detail.reload()}
      />
    </Page>
  );
}

/** "12" / "12 · 4 prints" / "AP" — the Edition cell. */
function editionSummary(allocations: OrderAllocation[] | undefined): string | null {
  if (!allocations || allocations.length === 0) return null;
  const numbers = [...new Set(allocations.map((a) => a.editionNumber).filter(Boolean))];
  const label = numbers.length > 0 ? numbers.join(', ') : '—';
  return allocations.length > 1 ? `${label} · ${allocations.length} prints` : label;
}

/** One allocation field as a single-line cell value (distinct values joined). */
function allocationField(
  allocations: OrderAllocation[] | undefined,
  pick: (a: OrderAllocation) => string | null,
): string | null {
  if (!allocations || allocations.length === 0) return null;
  const values = [...new Set(allocations.map(pick).filter((v): v is string => Boolean(v)))];
  return values.length > 0 ? values.join(', ') : null;
}

function BatchSection({
  detail,
  batch,
  singleBatch,
  onChanged,
  onBatchCreated,
}: {
  detail: ReleaseDetailData;
  batch: Batch;
  singleBatch: boolean;
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
  const inheritedSends = useMemo(
    () => inheritedSentStory(batch, detail.batches, detail.sends),
    [batch, detail.batches, detail.sends],
  );
  const batchEvents = useMemo(
    () => detail.events.filter((e) => e.batchId === batch.id),
    [detail.events, batch.id],
  );
  const draftCount = batchSends.filter((s) => s.status === 'draft').length;
  const allocatedCount = activeOrders.filter((o) => o.allocations && o.allocations.length > 0).length;
  const hasAllocations = detail.orders.some((o) => o.allocations && o.allocations.length > 0);
  // "This batch" in copy; the batch name only exists once there are several.
  const batchLabel = singleBatch ? null : batch.name;

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(activeOrders as unknown as { [key: string]: unknown }[]);

  const orderColumns = useColumns('orders', [
    { id: 'order', title: 'Order', locked: true },
    { id: 'collector', title: 'Collector' },
    { id: 'contact', title: 'Contact' },
    { id: 'item', title: 'Item' },
    { id: 'frame', title: 'Frame' },
    { id: 'glass', title: 'Glass', defaultHidden: true },
    { id: 'mount', title: 'Mount', defaultHidden: true },
    { id: 'edition', title: 'Edition' },
    { id: 'ordered', title: 'Ordered' },
    { id: 'actions', title: '', locked: true },
  ]);

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
    <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <BlockStack gap="050">
                  <Text as="h2" variant="headingSm">
                    Promised dispatch
                  </Text>
                  <Text as="p" variant="headingLg">
                    {batch.promiseDate ? `From ${formatDay(batch.promiseDate)}` : 'Not set'}
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

          <PlanTable
            sends={batchSends}
            inheritedSends={singleBatch ? [] : inheritedSends}
            batchActiveOrderCount={activeOrders.length}
            onEdit={(send) => setEditingSend(send)}
            onCancel={(send) => setCancellingSend(send)}
          />

          <Card padding="0">
            <div style={{ padding: 'var(--p-space-400) var(--p-space-400) var(--p-space-200)' }}>
              <InlineStack align="space-between" blockAlign="center" wrap gap="200">
                <Text as="h2" variant="headingSm">
                  Orders
                </Text>
                <InlineStack gap="300" blockAlign="center" wrap>
                  {hasAllocations ? (
                    <Text as="span" variant="bodySm" tone="subdued">
                      Warehouse allocation: {allocatedCount} of {activeOrders.length}
                      {allocatedCount < activeOrders.length ? ' — re-import the sheet for the rest' : ''}
                    </Text>
                  ) : null}
                  {orderColumns.columnsButton}
                </InlineStack>
              </InlineStack>
            </div>
            <IndexTable
              resourceName={{ singular: 'order', plural: 'orders' }}
              itemCount={activeOrders.length}
              selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
              onSelectionChange={handleSelectionChange}
              headings={orderColumns.headings as [{ title: string }]}
              promotedBulkActions={
                batch.promiseDate
                  ? [
                      {
                        content: 'Change delivery date',
                        onAction: () => setRescheduleOpen(true),
                      },
                    ]
                  : []
              }
            >
              {activeOrders.map((order, index) => {
                const edition = editionSummary(order.allocations);
                return (
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
                    {orderColumns.show('collector') ? (
                      <IndexTable.Cell>{order.collectorName}</IndexTable.Cell>
                    ) : null}
                    {orderColumns.show('contact') ? (
                      <IndexTable.Cell>
                        <InlineStack gap="100" blockAlign="center" wrap={false}>
                          <Text as="span" variant="bodySm">
                            {order.email ?? '—'}
                          </Text>
                          {!order.email ? <Badge tone="critical">No email</Badge> : null}
                          {order.email && !order.hubspotContactId ? (
                            <Badge tone="warning">No HubSpot contact</Badge>
                          ) : null}
                        </InlineStack>
                      </IndexTable.Cell>
                    ) : null}
                    {orderColumns.show('item') ? (
                      <IndexTable.Cell>{order.variant || '—'}</IndexTable.Cell>
                    ) : null}
                    {orderColumns.show('frame') ? (
                      <IndexTable.Cell>
                        {allocationField(order.allocations, (a) => a.frameFinish) ?? '—'}
                      </IndexTable.Cell>
                    ) : null}
                    {orderColumns.show('glass') ? (
                      <IndexTable.Cell>
                        {allocationField(order.allocations, (a) => a.glass) ?? '—'}
                      </IndexTable.Cell>
                    ) : null}
                    {orderColumns.show('mount') ? (
                      <IndexTable.Cell>
                        {allocationField(order.allocations, (a) => a.mountingType) ?? '—'}
                      </IndexTable.Cell>
                    ) : null}
                    {orderColumns.show('edition') ? (
                      <IndexTable.Cell>
                        {edition ? (
                          <Text as="span">{edition}</Text>
                        ) : (
                          <Text as="span" variant="bodySm" tone="subdued">
                            {hasAllocations ? 'Not allocated' : '—'}
                          </Text>
                        )}
                      </IndexTable.Cell>
                    ) : null}
                    {orderColumns.show('ordered') ? (
                      <IndexTable.Cell>{formatDayShort(order.orderDate)}</IndexTable.Cell>
                    ) : null}
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
                );
              })}
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
                {singleBatch ? 'History' : 'Batch history'}
              </Text>
              <BatchHistoryTimeline events={batchEvents} />
            </BlockStack>
          </Card>

      <RescheduleModal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        release={release}
        batch={batch}
        batchLabel={batchLabel}
        selectedOrders={selectedOrders}
        batchActiveOrderCount={activeOrders.length}
        batchSends={batchSends}
        inheritedSentSends={inheritedSends}
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
        batchLabel={batchLabel}
        onClose={() => setPromiseOpen(false)}
        onSaved={onChanged}
      />
      <AddSendModal
        open={addSendOpen}
        batch={batch}
        batchLabel={batchLabel}
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
        onSaved={() => {
          // A removed order must not linger in the reschedule selection.
          clearSelection();
          onChanged();
        }}
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
    </BlockStack>
  );
}
