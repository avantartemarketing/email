import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type {
  Batch,
  Intake,
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
  Facts,
  None,
  Page,
  Pill,
  RowAct,
  Skeleton,
  Stack,
  Why,
} from '../ui/rd';
import Tabs from '../rd/components/Tabs';
import SubTabs from '../rd/components/SubTabs';
import usePicked from '../rd/components/usePicked';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import { PlanTable } from '../components/PlanTable';
import { BatchHistoryTimeline } from '../components/BatchHistoryTimeline';
import { DelayCancelWarning } from '../components/DelayCancelWarning';
import { RescheduleModal } from '../components/RescheduleModal';
import { PromiseDateModal } from '../components/PromiseDateModal';
import { AddSendModal } from '../components/AddSendModal';
import { EditSendModal } from '../components/EditSendModal';
import { RemoveOrderModal } from '../components/RemoveOrderModal';
import { AddOrdersModal } from '../components/AddOrdersModal';
import { SyncModal } from '../components/SyncModal';
import { EditionsPanel } from '../components/EditionsPanel';
import { AllocationImportModal } from '../components/AllocationImportModal';
import { ReleaseEmailsPanel } from '../components/ReleaseEmailsCard';
import { ReleaseOrdersTable } from '../components/ReleaseOrdersTable';

export function ReleaseDetail(): ReactElement {
  const { releaseId } = useParams<{ releaseId: string }>();
  const { data, showToast, userName, users, refreshApprovals } = useApp();
  const detail = useAsync(() => data.getRelease(releaseId!), [releaseId]);
  const proposals = useAsync(() => data.listChangeProposals(releaseId!), [releaseId]);
  /* Handoffs are CREATED on this page (a reschedule, a submitted plan, a
     cancel), so the rail badges must move here too — not on the next
     navigation. */
  const reloadAll = () => {
    detail.reload();
    proposals.reload();
    refreshApprovals();
  };
  const pendingChanges = (proposals.data ?? []).filter((pr) => pr.status === 'pending');

  const decideChange = async (proposalId: string, apply: boolean): Promise<void> => {
    try {
      if (apply) await data.applyChangeProposal(proposalId);
      else await data.dismissChangeProposal(proposalId);
      showToast(apply ? 'Applied' : 'Dismissed');
      reloadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };
  /* Two levels, two pieces of state — the owner, 29 Aug 2026: "The batches is
     a tab and then the different batches is a sub level within that." It used
     to be one index into a flat list of seven, which is exactly the model the
     flat strip was drawing. */
  /* Deep links carry the tab (and batch) through navigation: the promise
     overview's rows are batches, and landing them on All orders made the
     reader re-find by hand the thing they had just clicked. */
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [top, setTop] = useState<'orders' | 'emails' | 'batches' | 'editions'>(
    urlTab === 'emails' || urlTab === 'batches' || urlTab === 'editions' ? urlTab : 'orders',
  );
  const [batchId, setBatchId] = useState<string | null>(searchParams.get('batch'));
  /* A reschedule that splits creates a batch this render has never seen, so it
     cannot be selected by id yet. The flag survives until the reload lands and
     then takes the newest batch — the one the split just made. */
  const [takeNewestBatch, setTakeNewestBatch] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  /* A date change is the moment an extra on-track email can appear, so it is
     the moment to say so. The flag only survives until the reload lands; the
     BAND below is derived and stays until the images are actually picked. */
  const [dateJustChanged, setDateJustChanged] = useState(false);
  const [imageGapOpen, setImageGapOpen] = useState(false);
  /* The remover ships WITH the flow, not after it. Creating a release from a
     file is now one press that makes a release, its batches and three hundred
     orders — and the file most likely to be dropped by mistake is named almost
     identically to the right one. */
  const [undoing, setUndoing] = useState<Intake | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [approverOpen, setApproverOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
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

  /* A split just made a batch, and the reload has now brought it. Newest by
     `createdAt`, which is the split's own stamp — not "the last in the array",
     because the array's order is the layer's business and this is a claim
     about time. */
  const loadedBatches = detail.data?.batches;
  useEffect(() => {
    if (!takeNewestBatch || !loadedBatches || loadedBatches.length === 0) return;
    const newest = [...loadedBatches].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
    if (!newest) return;
    setTakeNewestBatch(false);
    setTop('batches');
    setBatchId(newest.id);
  }, [takeNewestBatch, loadedBatches]);

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
  /* `<= 1`, not `=== 1`. A release with NO batches is a real state now — set
     up without a file, or emptied by an undo — and at `=== 1` its third tab
     read "Batches (0)", which is batch language on a release that has none.
     One batch and no batches are the same thing to a reader: there is nothing
     to choose between. */
  const singleBatch = batches.length <= 1;
  const activeOrderCount = d.orders.filter((o) => !o.removed).length;
  const toNumberCount = d.orders.filter(
    (o) => !o.removed && (!o.allocations || o.allocations.length === 0),
  ).length;
  const batchCount = (id: string) => d.orders.filter((o) => o.batchId === id && !o.removed).length;
  /* THREE, always. A release that splits eleven times still has three
     destinations here; which of its runs you are looking at is a level down.
     An unsplit release has no batch language anywhere, so its third tab is
     "Overview" and no sub-level is drawn — there is nothing to choose. */
  const tabs = [
    { key: 'orders' as const, label: `All orders (${activeOrderCount})` },
    /* The fourth destination, added 1 Sep 2026 when the allocation calculator
       moved in from the workbook — the "three, always" ruling above was about
       not multiplying tabs per batch, not a cap on destinations. The owner
       named it and seated it: "Call the tab Edition allocation, and put it
       after All orders." It reads orders and writes onto them, so sitting
       beside the orders is where it belongs. */
    {
      key: 'editions' as const,
      /* The count every other workload tab already carries — the owner's
         next step after import used to be the one tab with no number. */
      label:
        toNumberCount > 0 ? `Edition allocation (${toNumberCount})` : 'Edition allocation',
    },
    { key: 'emails' as const, label: 'All emails' },
    {
      key: 'batches' as const,
      label: singleBatch ? 'Overview' : `Batches (${batches.length})`,
    },
  ];
  const showingOrders = top === 'orders';
  const showingEmails = top === 'emails';
  const batch =
    top === 'batches' ? (batches.find((b) => b.id === batchId) ?? batches[0]) : undefined;
  /* The newest arrival, while it is still undoable: nothing on its batches has
     gone out. Sent history is the collector's inbox and cannot be unwound. */
  const newestIntake = d.intakes[0] ?? null;
  const undoable =
    newestIntake &&
    !d.sends.some(
      (s) =>
        s.status === 'sent' &&
        d.orders.some((o) => o.intakeId === newestIntake.id && o.batchId === s.batchId),
    )
      ? newestIntake
      : null;
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
          {/* The handover, worn on the release: the PM's list until
              dispatch, the warehouse's from Preparing for dispatch. Buttons,
              because the owners are set HERE — no settings page hides them. */}
          <button
            type="button"
            className="rd-linkbtn rd-linkbtn-mut"
            onClick={() => setApproverOpen(true)}
          >
            PM · {userName(d.release.pmOwnerId)}
          </button>
          <button
            type="button"
            className="rd-linkbtn rd-linkbtn-mut"
            onClick={() => setApproverOpen(true)}
          >
            Warehouse · {userName(d.release.warehouseOwnerId)}
          </button>
        </>
      }
      actions={
        <>
          <Btn onClick={() => setSyncOpen(true)}>Sync</Btn>
          <Btn onClick={() => setImportOpen(true)}>Add orders</Btn>
          <Btn onClick={() => setAllocationOpen(true)}>Import</Btn>
          {/* Only the newest, and only while nothing has sent — undoing an
              arrival two arrivals back is a diff nobody can hold in their
              head. `undoIntake` refuses the rest on its own. */}
          {undoable ? (
            <Btn kind="link-danger" onClick={() => setUndoing(undoable)}>
              Undo
            </Btn>
          ) : null}
        </>
      }
    >
      <Stack>
        {flaggedNoEmail.length > 0 || flaggedNoContact.length > 0 ? (
          <Bar
            tone="warn"
            title={[
              flaggedNoEmail.length > 0
                ? `${plural(flaggedNoEmail.length, 'order')} with no email`
                : '',
              flaggedNoContact.length > 0
                ? `${plural(flaggedNoContact.length, 'order')} with no HubSpot contact`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          />
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
            <div className="rd-baracts">
              <button type="button" className="rd-chip" onClick={() => setTop('emails')}>
                Pick images
              </button>
            </div>
          </Bar>
        ) : null}

        {pendingChanges.length > 0 ? (
          <Bar
            tone="warn"
            title={`${plural(pendingChanges.length, 'change')} from the shop`}
          >
            <div className="rd-baracts">
              <button type="button" className="rd-chip" onClick={() => setChangesOpen(true)}>
                Review
              </button>
            </div>
          </Bar>
        ) : null}

        {/* The two rows are one control between them, so they are one child of
            the stack — `.rd-subtabs` is pulled up into the strip's own bottom
            margin, and a stack gap dropped between them would undo that. */}
        <div>
          <Tabs tabs={tabs} value={top} onPick={setTop} label="Release" />
          {top === 'batches' && !singleBatch ? (
            <SubTabs
              caption="Batch"
              tabs={batches.map((b) => ({ key: b.id, label: b.name, n: batchCount(b.id) }))}
              value={batch?.id ?? batches[0].id}
              onPick={setBatchId}
            />
          ) : null}
        </div>
      </Stack>

      {showingOrders ? (
        <ReleaseOrdersTable detail={d} onChanged={reloadAll} />
      ) : top === 'editions' ? (
        <EditionsPanel
          release={d.release}
          activeOrders={activeOrderCount}
          onChanged={reloadAll}
          onOpenImport={() => setAllocationOpen(true)}
          onAddOrders={() => setImportOpen(true)}
        />
      ) : showingEmails ? (
        <ReleaseEmailsPanel
          release={d.release}
          batches={d.batches}
          sends={d.sends}
          onChanged={reloadAll}
        />
      ) : d.orders.length === 0 ? (
        <Card>
          <CardHead
            title="No orders yet"
            actions={
              <Btn kind="pri" onClick={() => setImportOpen(true)}>
                Add orders
              </Btn>
            }
          />
        </Card>
      ) : batch ? (
        <BatchSection
          key={batch.id}
          detail={d}
          batch={batch}
          singleBatch={singleBatch}
          onChanged={reloadAll}
          onBatchCreated={() => {
            detail.reload();
            /* Not an id yet — the split's batch is created server-side and
               arrives with the reload. `takeNewestBatch` hands it over when it
               does. */
            setTakeNewestBatch(true);
          }}
          onDateChanged={() => setDateJustChanged(true)}
        />
      ) : null}
      <Dialog
        open={undoing !== null}
        size="sm"
        title={undoing ? `Undo ${undoing.source.label}?` : ''}
        onClose={() => setUndoing(null)}
        primary={{
          label: 'Undo',
          destructive: true,
          disabled: undoBusy,
          onClick: () => {
            if (!undoing) return;
            setUndoBusy(true);
            void data
              .undoIntake(undoing.id)
              .then(() => {
                showToast(`${plural(undoing.summary.newOrders, 'order')} removed`);
                setUndoing(null);
                detail.reload();
              })
              .catch((err: unknown) =>
                showToast(err instanceof Error ? err.message : String(err), true),
              )
              .finally(() => setUndoBusy(false));
          },
        }}
        secondary={{ label: 'Keep', onClick: () => setUndoing(null) }}
      >
        {undoing ? (
          <>
            <Facts
              items={[
                { label: 'Orders', value: undoing.summary.newOrders },
                ...(undoing.summary.batchesCreated.length > 0
                  ? [{ label: 'Batches', value: undoing.summary.batchesCreated.length }]
                  : []),
                { label: 'Added', value: formatDayShort(undoing.at.slice(0, 10)) },
                { label: 'By', value: userName(undoing.by) },
              ]}
            />
            {/* Hard-deleted, and the reason is worth saying: a soft-removed
                order stays in the dedupe set — deliberately, so a cancelled
                order in a re-uploaded export stays gone — and "removing" 294
                of them would poison the import of the correct file. */}
            <Bar tone="warn" title="These orders are deleted, not cancelled" />
          </>
        ) : null}
      </Dialog>
      <Dialog
        open={approverOpen}
        size="sm"
        title="Owners"
        onClose={() => setApproverOpen(false)}
        secondary={{ label: 'Done', onClick: () => setApproverOpen(false) }}
      >
        {/* Admins only: the name on a list must be a person `approveSend`
            will actually let through. Naming is not gating — any admin can
            still cover — these decide whose list each send sits on. */}
        {(
          [
            { role: 'pmId' as const, current: d.release.pmOwnerId, says: 'PM' },
            {
              role: 'warehouseId' as const,
              current: d.release.warehouseOwnerId,
              says: 'Warehouse',
            },
          ]
        ).map((slot) => (
          <div key={slot.role}>
            <div className="rd-grouphd">{slot.says}</div>
            <div className="rd-fields">
              {users
                .filter((u) => u.role === 'admin')
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    role="radio"
                    aria-checked={u.id === slot.current}
                    className={u.id === slot.current ? 'rd-pickrow on' : 'rd-pickrow'}
                    onClick={() => {
                      void data
                        .setOwners(d.release.id, { [slot.role]: u.id })
                        .then(() => {
                          showToast(`${slot.role === 'pmId' ? 'PM' : 'Warehouse'} — ${u.name}`);
                          detail.reload();
                        })
                        .catch((err: unknown) =>
                          showToast(err instanceof Error ? err.message : String(err), true),
                        );
                    }}
                  >
                    <span className="rd-pickname">{u.name}</span>
                    <span className="rd-picknote">{u.email}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </Dialog>
      <Dialog
        open={changesOpen}
        size="lg"
        title="Changes from the shop"
        onClose={() => setChangesOpen(false)}
        secondary={{ label: 'Done', onClick: () => setChangesOpen(false) }}
      >
        {/* Review first — customer support does not always tag consistently,
            so nothing moves an order until a person applies it. Applied, it
            lands in batch history with who decided and the evidence. */}
        <table className="rd-t rd-t27 rd-fit">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Change</th>
              <th scope="col">Evidence</th>
              <th scope="col" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {pendingChanges.map((pr) => (
              <tr key={pr.id}>
                <td className="rd-ink">
                  {pr.shopifyOrderName} · {pr.collectorName}
                </td>
                <td>
                  <Cap>{pr.detail}</Cap>
                </td>
                <td>
                  <Cap>{pr.evidence}</Cap>
                </td>
                <td>
                  <div className="rd-rowacts">
                    <RowAct onClick={() => void decideChange(pr.id, true)}>Apply</RowAct>
                    <RowAct danger onClick={() => void decideChange(pr.id, false)}>
                      Dismiss
                    </RowAct>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Dialog>
      <SyncModal
        open={syncOpen}
        release={d.release}
        onClose={() => setSyncOpen(false)}
        onSynced={reloadAll}
      />
      <AddOrdersModal
        open={importOpen}
        release={d.release}
        existing={d.orders}
        onClose={() => setImportOpen(false)}
        onAdded={() => detail.reload()}
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
          label: 'Pick images',
          onClick: () => {
            setImageGapOpen(false);
            setTop('emails');
          },
        }}
        secondary={{ label: 'Later', onClick: () => setImageGapOpen(false) }}
      >
        <p>{plural(missingFromDate.length, 'on-track update')} with no image.</p>
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
  /* The failure that used to vanish: a cancelled delay notice with nothing
     newer means the date moved and these collectors were never told. */
  const delays = batchSends
    .filter((s) => s.type === 'delay')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cancelledDelay =
    delays[0] && delays[0].status === 'cancelled' ? delays[0] : null;
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
        {cancelledDelay ? (
          /* The date moved and the email telling collectors was cancelled —
             the one state that must not sit here silently. It clears when a
             newer delay notice exists (the sort above takes the newest). */
          <Bar tone="warn" title="Delay notice cancelled — these collectors have not been told" />
        ) : null}
        <div className="rd-headrow">
          <div className="rd-kband">
            <div className="rd-kpi">
              <div className="rd-l">Dispatch window</div>
              <div className="rd-v">
                {batch.promiseDate ? shipWindowShort(batch.promiseDate) : 'Not set'}
              </div>
            </div>
            <div className="rd-kpi">
              <div className="rd-l">Collectors</div>
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
                  ? `Change date (${picked.size})`
                  : 'Change date'}
              </Btn>
            ) : (
              <Btn kind="pri" onClick={() => setPromiseOpen(true)}>
                Set date
              </Btn>
            )}
            {draftCount > 0 ? (
              /* Caught here as well as at approval. Approval is the gate, but
                 an operator who submits ten sends and then meets ten refusals
                 one at a time has been told the same thing ten times, late. */
              draftsWithNoImage > 0 ? (
                <Why
                  says={`${plural(draftsWithNoImage, 'email', 'emails')} with no image`}
                >
                  <Btn disabled>{`Submit (${draftCount})`}</Btn>
                </Why>
              ) : (
                <Btn onClick={() => void submitPlan()}>
                  {`Submit (${draftCount})`}
                </Btn>
              )
            ) : null}
            {batch.promiseDate ? (
              <Btn onClick={() => setAddSendOpen(true)}>Add send</Btn>
            ) : (
              /* Shut, and it says why — the one control on this header that
                 used to be dark in silence. */
              <Why says="No promise date.">
                <Btn disabled>Add send</Btn>
              </Why>
            )}
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
          searchPlaceholder="Search"
          columns={orderColumns}
          rows={activeOrders}
          rowKey={(o) => o.id}
          empty="No orders in this batch."
          headActions={
            hasAllocations ? (
              <span className="rd-vnote">
                Allocation {allocatedCount} of {activeOrders.length}
              </span>
            ) : undefined
          }
          select={{
            picked,
            label: (o) => `${o.shopifyOrderName} — ${o.collectorName}`,
            actions: batch.promiseDate
              ? [{ label: 'Change date', onClick: () => setRescheduleOpen(true) }]
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
      <EditSendModal
        send={editingSend}
        onClose={() => setEditingSend(null)}
        onSaved={onChanged}
        ceiling={
          editingSend && batch.promiseDate
            ? editingSend.templateRef === 'pp-dispatch'
              ? {
                  date: batch.promiseDate,
                  says: `Window opens ${formatDayShort(batch.promiseDate)}.`,
                }
              : (() => {
                  const dispatch = batchSends.find(
                    (s) => s.templateRef === 'pp-dispatch' && s.status !== 'cancelled',
                  );
                  const date = dispatch?.scheduledDate ?? batch.promiseDate!;
                  return {
                    date,
                    says: `Dispatch email ${formatDayShort(date)}.`,
                  };
                })()
            : null
        }
      />
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
          label: 'Cancel',
          destructive: true,
          onClick: () => void confirmCancelSend(),
        }}
        secondary={{ label: 'Keep', onClick: () => setCancellingSend(null) }}
      >
        {cancellingSend ? <DelayCancelWarning send={cancellingSend} /> : null}
        <p>
          Scheduled for {cancellingSend ? formatDayShort(cancellingSend.scheduledDate) : ''}
          {cancellingSend && cancellingSend.scheduledDate < today() ? ' (overdue)' : ''}.
        </p>
      </Dialog>
    </>
  );
}
