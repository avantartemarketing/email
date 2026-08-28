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
import { formatDayShort, today } from '../logic/dates';
import { inheritedSentStory } from '../logic/reschedule';
import { missingImagesFor, missingOnTrackImages, shipWindowShort } from '../logic/templates';
import { TEMPLATE_LABELS, plural, productKindTag, releaseStatusBadge } from '../ui/format';
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
  None,
  Page,
  Pill,
  RowAct,
  Skeleton,
  Stack,
  Why,
} from '../ui/rd';
import Tabs from '../rd/components/Tabs';
import usePicked from '../rd/components/usePicked';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
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

  /* Two different questions, deliberately two different functions.
     The BAND asks "does this release owe any pictures at all", which is every
     slot it sends. The DIALOGUE asks "did the date I just changed ask for
     MORE", which is only the on-track run — the one thing a date change adds. */
  const missingImages = detail.data
    ? missingImagesFor(detail.data.release, detail.data.batches, detail.data.sends, today())
    : [];
  const missingFromDate = detail.data
    ? missingOnTrackImages(detail.data.release, detail.data.batches, today())
    : [];
  useEffect(() => {
    if (!dateJustChanged) return;
    setDateJustChanged(false);
    if (missingFromDate.length > 0) setImageGapOpen(true);
  }, [dateJustChanged, missingFromDate.length]);

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
          <Bar tone="warn" title="Some orders can't receive email yet">
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
          <Bar
            tone="warn"
            title={
              missingImages.length === 1
                ? 'One email has no image'
                : `${missingImages.length} emails have no image`
            }
          >
            There is no default — an email cannot be approved until its image is picked.
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
        <ReleaseOrdersTable detail={d} onChanged={() => detail.reload()} />
      ) : showingEmails ? (
        <ReleaseEmailsPanel
          release={d.release}
          batches={d.batches}
          sends={d.sends}
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
          {plural(missingFromDate.length, 'more on-track update')} — collectors hear from us at
          least every five weeks, so a longer wait is more emails.
        </p>
        <p>
          {missingFromDate.length === 1 ? 'It has' : 'They have'} no image yet, and an email with
          no image cannot be approved. The date is saved either way.
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
  const { data, showToast } = useApp();
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
  const draftsWithNoImage = batchSends.filter(
    (s) => s.status === 'draft' && !s.imageName,
  ).length;
  /* The soonest email this batch still owes somebody — the third question a
     batch raises, after when it ships and who is in it. */
  const nextSend = batchSends
    .filter((s) => s.status !== 'sent' && s.status !== 'cancelled')
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
  const allocatedCount = activeOrders.filter((o) => o.allocations && o.allocations.length > 0).length;
  const hasAllocations = detail.orders.some((o) => o.allocations && o.allocations.length > 0);
  // "This batch" in copy; the batch name only exists once there are several.
  const batchLabel = singleBatch ? null : batch.name;

  const picked = usePicked();

  const orderColumns: Column<Order>[] = [
    {
      id: 'order',
      title: 'Order',
      locked: true,
      kind: 'text',
      value: (o) => o.shopifyOrderName,
      cell: (o) => <span className="rd-ink">{o.shopifyOrderName}</span>,
    },
    {
      id: 'collector',
      title: 'Collector',
      kind: 'text',
      value: (o) => o.collectorName,
      cell: (o) => <Cap>{o.collectorName}</Cap>,
    },
    {
      id: 'contact',
      title: 'Contact',
      /* Locked: it carries the "no email" and "no HubSpot contact" flags, and
         a list you can hide the warnings on is a list that stops warning you. */
      locked: true,
      kind: 'text',
      value: (o) => o.email,
      cell: (o) => (
        <span className="rd-rowflags">
          {o.email ? <Cap>{o.email}</Cap> : <Pill tone="red">No email</Pill>}
          {o.email && !o.hubspotContactId ? <Pill tone="amber">No HubSpot contact</Pill> : null}
        </span>
      ),
    },
    {
      id: 'item',
      title: 'Item',
      kind: 'choice',
      caption: 'ITEM',
      value: (o) => o.variant,
      cell: (o) => o.variant || <None />,
    },
    {
      id: 'frame',
      title: 'Frame',
      kind: 'choice',
      caption: 'FRAME',
      value: (o) => allocationField(o.allocations, (a) => a.frameFinish),
      cell: (o) => allocationField(o.allocations, (a) => a.frameFinish) ?? <None />,
    },
    {
      id: 'glass',
      title: 'Glass',
      defaultHidden: true,
      kind: 'choice',
      caption: 'GLASS',
      value: (o) => allocationField(o.allocations, (a) => a.glass),
      cell: (o) => allocationField(o.allocations, (a) => a.glass) ?? <None />,
    },
    {
      id: 'mount',
      title: 'Mount',
      defaultHidden: true,
      kind: 'choice',
      caption: 'MOUNT',
      value: (o) => allocationField(o.allocations, (a) => a.mountingType),
      cell: (o) => allocationField(o.allocations, (a) => a.mountingType) ?? <None />,
    },
    {
      id: 'country',
      title: 'Country',
      defaultHidden: true,
      kind: 'choice',
      caption: 'COUNTRY',
      value: (o) => o.country,
      cell: (o) => o.country ?? <None />,
    },
    {
      id: 'edition',
      title: 'Edition',
      kind: 'text',
      value: (o) => editionSummary(o.allocations),
      cell: (o) =>
        editionSummary(o.allocations) ?? (
          <span className="rd-none">{hasAllocations ? 'Not allocated' : '–'}</span>
        ),
    },
    {
      id: 'ordered',
      title: 'Ordered',
      kind: 'date',
      value: (o) => o.orderDate,
      cell: (o) => formatDayShort(o.orderDate),
    },
    {
      id: 'actions',
      title: '',
      locked: true,
      cell: (o) => (
        <div className="rd-rowacts">
          <RowAct danger onClick={() => setRemovingOrder(o)}>
            Remove
          </RowAct>
        </div>
      ),
    },
  ];

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
        {/* ---------- What this batch has been promised ----------
            A band of three, not one figure in a wide card. The owner, 28 Aug:
            the old one "doesn't seem v well designed — we don't need 'From',
            and it feels cramped." Both faults had one cause: a card whose job
            was to hold ONE fact, so the fact sat alone at one end and the
            buttons at the other with a gulf between them.

            So it answers the three questions a batch actually raises — when it
            ships, who is in it, and what is queued — in the kit's own KPI band.
            "From" goes because the window is drawn as a window: a promise date
            is the START of a 7-day dispatch window, and a range says that
            without a preposition doing the work. */}
        <div className="rd-headrow">
          <div className="rd-kband">
            <div className="rd-kpi">
              <div className="rd-l">Dispatch window</div>
              <div className="rd-v">
                {batch.promiseDate ? shipWindowShort(batch.promiseDate) : 'Not set'}
              </div>
            </div>
            <div className="rd-kpi">
              <div className="rd-l">Collectors in this batch</div>
              <div className="rd-v">
                {activeOrders.length}
                {picked.size > 0 ? (
                  <span className="rd-vnote">{picked.size} selected</span>
                ) : removedOrders.length > 0 ? (
                  <span className="rd-vnote">{removedOrders.length} cancelled</span>
                ) : null}
              </div>
            </div>
            <div className="rd-kpi">
              <div className="rd-l">Next email</div>
              <div className="rd-v">
                {nextSend ? (
                  formatDayShort(nextSend.scheduledDate)
                ) : (
                  <span className="rd-none">Nothing queued</span>
                )}
                {nextSend ? (
                  <span className="rd-vnote">{TEMPLATE_LABELS[nextSend.templateRef]}</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="rd-headacts">
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
              /* Caught here as well as at approval. Approval is the gate, but
                 an operator who submits ten sends and then meets ten refusals
                 one at a time has been told the same thing ten times, late. */
              draftsWithNoImage > 0 ? (
                <Why
                  says={`${plural(draftsWithNoImage, 'of these emails has', 'of these emails have')} no image yet — pick them on the All emails tab.`}
                >
                  <Btn disabled>{`Submit plan for approval (${draftCount})`}</Btn>
                </Why>
              ) : (
                <Btn onClick={() => void submitPlan()}>
                  {`Submit plan for approval (${draftCount})`}
                </Btn>
              )
            ) : null}
            <Btn onClick={() => setAddSendOpen(true)} disabled={!batch.promiseDate}>
              Add send
            </Btn>
          </div>
        </div>

        <PlanTable
          sends={batchSends}
          inheritedSends={singleBatch ? [] : inheritedSends}
          batchActiveOrderCount={activeOrders.length}
          onEdit={(send) => setEditingSend(send)}
          onCancel={(send) => setCancellingSend(send)}
        />

        <DataTable
          table="batch-orders"
          title="Orders"
          noun="order"
          searchPlaceholder="Search orders, collectors, editions"
          columns={orderColumns}
          rows={activeOrders}
          rowKey={(o) => o.id}
          empty="No orders in this batch."
          headActions={
            hasAllocations ? (
              <span className="rd-none">
                Warehouse allocation: {allocatedCount} of {activeOrders.length}
                {allocatedCount < activeOrders.length ? ' — re-import the sheet for the rest' : ''}
              </span>
            ) : undefined
          }
          select={{
            picked,
            label: (o) => `${o.shopifyOrderName} — ${o.collectorName}`,
            actions: batch.promiseDate
              ? [{ label: 'Change delivery date', onClick: () => setRescheduleOpen(true) }]
              : [],
          }}
          foot={
            removedOrders.length > 0 ? (
              <>
                {removedOrders.length} removed:{' '}
                {removedOrders
                  .map((o) => `${o.shopifyOrderName} (${o.removedReason ?? 'removed'})`)
                  .join(', ')}
              </>
            ) : undefined
          }
        />

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
