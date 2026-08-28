import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import type {
  Batch,
  Order,
  OrderAllocation,
  ReleaseDetail as ReleaseDetailData,
  ScheduledSend,
} from '../types';
import { formatDay, formatDayShort, today } from '../logic/dates';
import { inheritedSentStory } from '../logic/reschedule';
import { missingOnTrackImages } from '../logic/templates';
import { plural, productKindTag, releaseStatusBadge } from '../ui/format';
import { useApp, useCrumb } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import {
  Bar,
  Btn,
  Cap,
  Card,
  CardHead,
  Dialog,
  Empty,
  Foot,
  None,
  Page,
  Pill,
  RowAct,
  Skeleton,
  Stack,
} from '../ui/rd';
import Tabs from '../rd/components/Tabs';
import BulkBar from '../rd/components/BulkBar';
import RowTick from '../rd/components/RowTick';
import usePicked from '../rd/components/usePicked';
import { useGridPin } from '../rd/components/useGridPin';
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
import { ReleaseOrdersTable } from '../components/ReleaseOrdersTable';
import { useColumns } from '../ui/useColumns';

export function ReleaseDetail(): ReactElement {
  const { releaseId } = useParams<{ releaseId: string }>();
  const { data } = useApp();
  const detail = useAsync(() => data.getRelease(releaseId!), [releaseId]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  /* A date change is the moment an extra on-track email can appear, so it is
     the moment to say so. The flag only survives until the reload lands; the
     BAND below is derived and stays until the images are actually picked. */
  const [dateJustChanged, setDateJustChanged] = useState(false);
  const [imageGapOpen, setImageGapOpen] = useState(false);
  // The shell's path ends at the record this screen is showing.
  useCrumb(detail.data?.release.title);

  const missingImages = detail.data
    ? missingOnTrackImages(detail.data.release, detail.data.batches, today())
    : [];
  useEffect(() => {
    if (!dateJustChanged) return;
    setDateJustChanged(false);
    if (missingImages.length > 0) setImageGapOpen(true);
  }, [dateJustChanged, missingImages.length]);

  if (detail.error) {
    return (
      <Page title="Release not found">
        <Bar tone="fail">{detail.error.message}</Bar>
      </Page>
    );
  }
  if (detail.data === null) {
    return (
      <Page title="Release">
        <Card>
          <Skeleton rows={10} />
        </Card>
      </Page>
    );
  }

  const d = detail.data;
  const batches = d.batches;
  /* The strip reads widest-first: everything on the release, then everything
     it sends, then each flow's own working screen. "All orders" is the
     warehouse's view (one row per print, every batch at once) and "All emails"
     the release's; a flow tab is where dates and plans are actually changed.

     Most releases never split, so one batch means "the release" and carries no
     batch name. Print releases show their framed/unframed flows. */
  const singleBatch = batches.length === 1;
  const batchTabs =
    batches.length > 1
      ? batches.map((b) => {
          const active = d.orders.filter((o) => o.batchId === b.id && !o.removed).length;
          return { key: b.id, label: `${b.name} (${active})` };
        })
      : [{ key: 'overview', label: 'Overview' }];
  const activeOrderCount = d.orders.filter((o) => !o.removed).length;
  const tabs = [
    { key: 'orders', label: `All orders (${activeOrderCount})` },
    { key: 'emails', label: 'All emails' },
    ...batchTabs,
  ];
  const tabIndex = Math.min(selectedTab, tabs.length - 1);
  const showingOrders = tabIndex === 0;
  const showingEmails = tabIndex === 1;
  const batch = showingOrders || showingEmails ? undefined : batches[tabIndex - 2];
  const flaggedNoEmail = d.orders.filter((o) => !o.removed && !o.email);
  const flaggedNoContact = d.orders.filter((o) => !o.removed && o.email && !o.hubspotContactId);

  return (
    <Page
      title={d.release.title}
      tag={releaseStatusBadge(d.release.status)}
      facts={
        <>
          <span>
            {d.release.artist}
            {d.release.editionSize ? ` · edition of ${d.release.editionSize}` : ''}
          </span>
          {productKindTag(d.release.productKind)}
        </>
      }
      actions={
        <>
          <Btn onClick={() => setImportOpen(true)}>Import orders</Btn>
          <Btn onClick={() => setAllocationOpen(true)}>Import warehouse allocation</Btn>
        </>
      }
    >
      <Stack>
        {flaggedNoEmail.length > 0 || flaggedNoContact.length > 0 ? (
          <Bar tone="warn">
            <b>Some orders can't receive email yet.</b>{' '}
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
            They stay in their batches and are flagged on every send until resolved in HubSpot, then
            re-imported.
          </Bar>
        ) : null}

        {missingImages.length > 0 ? (
          <Bar tone="warn">
            <b>
              {missingImages.length === 1
                ? 'One on-track email has no image.'
                : `${missingImages.length} on-track emails have no image.`}
            </b>{' '}
            This release's longest dispatch window needs{' '}
            {plural(missingImages.length, 'more update')} than there are pictures for, so{' '}
            {missingImages.length === 1 ? 'it goes' : 'they go'} out on the master's image.
            <button type="button" className="rd-inline-pill" onClick={() => setSelectedTab(1)}>
              Pick images
            </button>
          </Bar>
        ) : null}

        <Tabs
          tabs={tabs}
          value={tabs[tabIndex].key}
          onPick={(key) => setSelectedTab(tabs.findIndex((t) => t.key === key))}
          label="Release"
        />
      </Stack>

      {showingOrders ? (
        <ReleaseOrdersTable orders={d.orders} batches={d.batches} />
      ) : showingEmails ? (
        <ReleaseEmailsPanel
          release={d.release}
          batches={d.batches}
          onChanged={() => detail.reload()}
        />
      ) : d.orders.length === 0 ? (
        <Card>
          <CardHead
            title="No orders yet"
            actions={
              <Btn kind="pri" onClick={() => setImportOpen(true)}>
                Import orders
              </Btn>
            }
          />
          <Empty>
            Review the All emails tab (pick each send's image), then import the Shopify order export to
            create this release's orders
            {d.release.productKind === 'print'
              ? ' — framed and unframed prints land in their own batches with separate timelines'
              : ''}
            .
          </Empty>
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
            setSelectedTab(batches.length + 2);
          }}
          onDateChanged={() => setDateJustChanged(true)}
        />
      ) : null}
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
      <Dialog
        open={imageGapOpen}
        size="sm"
        title="This date needs another email"
        onClose={() => setImageGapOpen(false)}
        primary={{
          label: 'Pick the images',
          onClick: () => {
            setImageGapOpen(false);
            setSelectedTab(1);
          },
        }}
        secondary={{ label: 'Later', onClick: () => setImageGapOpen(false) }}
      >
        <p>
          The new window is long enough to need{' '}
          {plural(missingImages.length, 'more on-track update')} — collectors hear from us at
          least every five weeks, so a longer wait is more emails.
        </p>
        <p>
          {missingImages.length === 1 ? 'It has' : 'They have'} no image picked yet and would go
          out on the HubSpot master's own picture.
        </p>
      </Dialog>
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
  onDateChanged,
}: {
  detail: ReleaseDetailData;
  batch: Batch;
  singleBatch: boolean;
  onChanged: () => void;
  onBatchCreated: () => void;
  /** A date moved — the release may now need an on-track email it has no
      image for, which is the one thing worth interrupting somebody about. */
  onDateChanged: () => void;
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

  const picked = usePicked();
  // Ruling 9's bar replaces the header row; the grid is held still for as long
  // as a selection lasts so ticking a box moves nothing.
  const pin = useGridPin(picked.size > 0);

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
    picked.size > 0 ? activeOrders.filter((o) => picked.has(o.id)) : activeOrders;

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
    <>
      <Stack>
        {/* The card head's own row (`CardHead`'s markup), leading with the date
            as a figure rather than with a section name: the label under it is
            what the head would otherwise have said twice. */}
        <Card>
          <div className="rd-cardhead">
            <div>
              <div className="rd-lede">
                {batch.promiseDate ? `From ${formatDay(batch.promiseDate)}` : 'Not set'}
              </div>
              <div className="rd-ledelab">Promised dispatch</div>
            </div>
            <div className="rd-cardacts">
              {batch.promiseDate ? (
                <Btn
                  kind="pri"
                  onClick={() => setRescheduleOpen(true)}
                  disabled={activeOrders.length === 0}
                >
                  {picked.size > 0 && picked.size < activeOrders.length
                    ? `Change delivery date (${picked.size})`
                    : 'Change delivery date'}
                </Btn>
              ) : (
                <Btn kind="pri" onClick={() => setPromiseOpen(true)}>
                  Set promise date
                </Btn>
              )}
              {draftCount > 0 ? (
                <Btn onClick={() => void submitPlan()}>
                  {`Submit plan for approval (${draftCount})`}
                </Btn>
              ) : null}
              <Btn onClick={() => setAddSendOpen(true)} disabled={!batch.promiseDate}>
                Add send
              </Btn>
            </div>
          </div>
        </Card>

        <PlanTable
          sends={batchSends}
          inheritedSends={singleBatch ? [] : inheritedSends}
          batchActiveOrderCount={activeOrders.length}
          onEdit={(send) => setEditingSend(send)}
          onCancel={(send) => setCancellingSend(send)}
        />

        <Card>
          <CardHead
            title={
              <>
                Orders
                {hasAllocations ? (
                  <span className="rd-sub">
                    Warehouse allocation: {allocatedCount} of {activeOrders.length}
                    {allocatedCount < activeOrders.length
                      ? ' — re-import the sheet for the rest'
                      : ''}
                  </span>
                ) : null}
              </>
            }
            actions={orderColumns.menu}
          />
          <div className="rd-scroll">
            <table
              className="rd-t rd-t27 rd-fit rd-tpad rd-tsel"
              ref={pin.ref}
              style={pin.style}
            >
              {pin.cols}
              <thead>
                {picked.size > 0 ? (
                  <BulkBar
                    count={picked.size}
                    columns={orderColumns.count + 1}
                    actions={
                      batch.promiseDate
                        ? [
                            {
                              label: 'Change delivery date',
                              onClick: () => setRescheduleOpen(true),
                            },
                          ]
                        : []
                    }
                  />
                ) : (
                  <tr>
                    <th aria-hidden />
                    {orderColumns.head}
                  </tr>
                )}
              </thead>
              <tbody>
                {activeOrders.length === 0 ? (
                  <tr>
                    <td className="rd-prose" colSpan={orderColumns.count + 1}>
                      No orders yet
                    </td>
                  </tr>
                ) : (
                  activeOrders.map((order) => {
                    const edition = editionSummary(order.allocations);
                    const frame = allocationField(order.allocations, (a) => a.frameFinish);
                    const glass = allocationField(order.allocations, (a) => a.glass);
                    const mount = allocationField(order.allocations, (a) => a.mountingType);
                    return (
                      <tr key={order.id}>
                        <td>
                          <RowTick
                            id={order.id}
                            on={picked.has(order.id)}
                            label={order.shopifyOrderName}
                            onPress={picked.press}
                          />
                        </td>
                        <td className="rd-ink">{order.shopifyOrderName}</td>
                        {orderColumns.show('collector') ? (
                          <td>
                            <Cap>{order.collectorName}</Cap>
                          </td>
                        ) : null}
                        {orderColumns.show('contact') ? (
                          <td>
                            {order.email ? <Cap>{order.email}</Cap> : <None />}
                            {!order.email ? <Pill tone="red">No email</Pill> : null}
                            {order.email && !order.hubspotContactId ? (
                              <Pill tone="amber">No HubSpot contact</Pill>
                            ) : null}
                          </td>
                        ) : null}
                        {orderColumns.show('item') ? (
                          <td>
                            {order.variant ? (
                              <Cap>{order.variant}</Cap>
                            ) : (
                              <None />
                            )}
                          </td>
                        ) : null}
                        {orderColumns.show('frame') ? <td>{frame ?? <None />}</td> : null}
                        {orderColumns.show('glass') ? <td>{glass ?? <None />}</td> : null}
                        {orderColumns.show('mount') ? <td>{mount ?? <None />}</td> : null}
                        {orderColumns.show('edition') ? (
                          <td>
                            {edition ??
                              (hasAllocations ? (
                                <span className="rd-mut">Not allocated</span>
                              ) : (
                                <None />
                              ))}
                          </td>
                        ) : null}
                        {orderColumns.show('ordered') ? (
                          <td>{formatDayShort(order.orderDate)}</td>
                        ) : null}
                        <td>
                          <div className="rd-rowacts">
                            <RowAct danger onClick={() => setRemovingOrder(order)}>
                              Remove
                            </RowAct>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {removedOrders.length > 0 ? (
            <Foot>
              {removedOrders.map((order) => (
                <div key={order.id}>
                  <Pill tone="grey" small>
                    Removed
                  </Pill>{' '}
                  {order.shopifyOrderName} · {order.collectorName} —{' '}
                  {order.removedReason ?? 'removed'}
                  {order.removedBy ? ` (by ${userName(order.removedBy)})` : ''}
                </div>
              ))}
            </Foot>
          ) : null}
        </Card>

        <Card>
          <CardHead title={singleBatch ? 'History' : 'Batch history'} />
          <BatchHistoryTimeline events={batchEvents} />
        </Card>
      </Stack>

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
          picked.clear();
          showToast(message);
          if (selectedOrders.length < activeOrders.length) onBatchCreated();
          else onChanged();
          onDateChanged();
        }}
      />
      <PromiseDateModal
        open={promiseOpen}
        release={release}
        batch={batch}
        batchLabel={batchLabel}
        onClose={() => setPromiseOpen(false)}
        onSaved={() => {
          onChanged();
          onDateChanged();
        }}
      />
      <AddSendModal
        open={addSendOpen}
        batch={batch}
        batchLabel={batchLabel}
        onClose={() => setAddSendOpen(false)}
        onSaved={onChanged}
      />
      <EditSendModal send={editingSend} onClose={() => setEditingSend(null)} onSaved={onChanged} />
      <RemoveOrderModal
        order={removingOrder}
        onClose={() => setRemovingOrder(null)}
        onSaved={() => {
          // A removed order must not linger in the reschedule selection.
          picked.clear();
          onChanged();
        }}
      />
      <Dialog
        open={cancellingSend !== null}
        title={cancellingSend ? `Cancel “${cancellingSend.subject}”?` : ''}
        onClose={() => setCancellingSend(null)}
        primary={{
          label: 'Cancel send',
          destructive: true,
          onClick: () => void confirmCancelSend(),
        }}
        secondary={{ label: 'Keep it', onClick: () => setCancellingSend(null) }}
      >
        <p>
          The email will not go out and drops off the plan. This is recorded in the batch history.
          Scheduled for {cancellingSend ? formatDayShort(cancellingSend.scheduledDate) : ''}
          {cancellingSend && cancellingSend.scheduledDate < today() ? ' (overdue)' : ''}.
        </p>
      </Dialog>
    </>
  );
}
