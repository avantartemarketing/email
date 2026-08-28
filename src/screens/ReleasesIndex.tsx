/**
 * The releases list — the app's front door.
 *
 * A ticked table in the kit's vocabulary, drawn by `DataTable`: `usePicked`
 * owns the set and the shift-range, the bulk bar REPLACES the header row while
 * a selection is live (ruling 9), and the grid is pinned across that swap so
 * ticking a box moves nothing.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReleaseSummary, UpcomingSendInfo } from '../types';
import { formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, plural, releaseStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { Btn, Cap, Card, None, Page, Pill, Skeleton } from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import Menu from '../rd/components/Menu';
import usePicked from '../rd/components/usePicked';
import { NewReleaseModal } from '../components/NewReleaseModal';

/**
 * The next-send cell: just the date at rest; clicking it opens the next three
 * sends — which email, which batch, how many collectors — each a link into its
 * send detail.
 *
 * The kit's `Menu` and not a popover of our own: its panel is a portal, and a
 * panel drawn as a child of the chip is clipped the moment the chip sits in a
 * table's scrollport — full height, every item behind the clip.
 */
function NextSendCell({
  upcoming,
  onOpenSend,
}: {
  upcoming: UpcomingSendInfo[];
  onOpenSend: (sendId: string) => void;
}): ReactElement {
  if (upcoming.length === 0) return <None />;
  return (
    <Menu
      chipClass="rd-cellink"
      chip={formatDayShort(upcoming[0].scheduledDate)}
      items={upcoming.map((send, idx) => ({
        key: send.sendId,
        label: [
          `${idx === 0 ? 'Next · ' : ''}${formatDayShort(send.scheduledDate)}`,
          `${TEMPLATE_LABELS[send.templateRef]}${send.type === 'delay' ? ' (delay)' : ''}`,
          send.batchName,
          plural(send.recipientCount, 'collector'),
        ].join(' · '),
      }))}
      onPick={(sendId) => onOpenSend(sendId)}
    />
  );
}

export function ReleasesIndex(): ReactElement {
  const { data } = useApp();
  const navigate = useNavigate();
  const [newReleaseOpen, setNewReleaseOpen] = useState(false);
  const releases = useAsync(() => data.listReleases(), []);
  const picked = usePicked();

  const rows = releases.data ?? [];

  const columns: Column<ReleaseSummary>[] = [
    {
      id: 'release',
      title: 'Release',
      locked: true,
      kind: 'text',
      value: (r) => r.release.title,
      cell: (r) => <Cap>{r.release.title}</Cap>,
    },
    {
      id: 'artist',
      title: 'Artist',
      kind: 'choice',
      caption: 'ARTIST',
      value: (r) => r.release.artist,
      cell: (r) => <Cap>{r.release.artist}</Cap>,
    },
    {
      id: 'kind',
      title: 'Type',
      kind: 'choice',
      caption: 'PRODUCT TYPE',
      defaultHidden: true,
      value: (r) => r.release.productKind,
      groupLabel: (key) => (key === 'print' ? 'Print' : 'Sculpture'),
      cell: (r) => (r.release.productKind === 'print' ? 'Print' : 'Sculpture'),
    },
    {
      id: 'edition',
      title: 'Edition size',
      n: true,
      defaultHidden: true,
      kind: 'number',
      value: (r) => r.release.editionSize,
      cell: (r) => r.release.editionSize ?? <None />,
    },
    {
      id: 'status',
      title: 'Status',
      kind: 'choice',
      caption: 'STATUS',
      order: ['active', 'completed'],
      value: (r) => r.release.status,
      groupLabel: (key) => (key === 'active' ? 'Active' : 'Completed'),
      cell: (r) => releaseStatusBadge(r.release.status),
    },
    {
      id: 'orders',
      title: 'Orders',
      n: true,
      kind: 'number',
      value: (r) => r.orderCount,
      cell: (r) => r.orderCount,
    },
    {
      id: 'batches',
      title: 'Batches',
      n: true,
      kind: 'number',
      value: (r) => r.batchCount,
      cell: (r) => (r.batchCount > 1 ? r.batchCount : <None />),
    },
    {
      id: 'next',
      title: 'Next send',
      kind: 'date',
      value: (r) => r.upcomingSends[0]?.scheduledDate,
      cell: (r) => (
        <NextSendCell
          upcoming={r.upcomingSends}
          onOpenSend={(sendId) => navigate(`/sends/${sendId}`)}
        />
      ),
    },
    {
      id: 'overdue',
      title: 'Overdue',
      /* Locked: this is the column that says something is late, and a list you
         can hide the warnings on is a list that stops warning you. */
      locked: true,
      n: true,
      kind: 'number',
      value: (r) => r.overdueCount,
      cell: (r) => (r.overdueCount > 0 ? <Pill tone="red">{r.overdueCount}</Pill> : <None />),
    },
    {
      id: 'pending',
      title: 'Pending approval',
      n: true,
      kind: 'number',
      value: (r) => r.pendingApprovalCount,
      cell: (r) =>
        r.pendingApprovalCount > 0 ? <Pill tone="amber">{r.pendingApprovalCount}</Pill> : <None />,
    },
  ];

  return (
    <Page
      title="Releases"
      actions={
        <Btn kind="pri" onClick={() => setNewReleaseOpen(true)}>
          New release
        </Btn>
      }
    >
      {releases.data === null ? (
        <Card>
          <Skeleton rows={6} />
        </Card>
      ) : (
        <DataTable
          table="releases"
          noun="release"
          searchPlaceholder="Search releases and artists"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.release.id}
          onRowClick={(r) => navigate(`/releases/${r.release.id}`)}
          empty="No releases yet."
          select={{
            picked,
            label: (r) => r.release.title,
            /* Nothing acts on a selection of releases yet — the ticks are here
               because a list of releases is a list somebody counts. The bar
               says what is ticked and offers nothing it cannot do. */
            actions: [],
          }}
        />
      )}
      <NewReleaseModal open={newReleaseOpen} onClose={() => setNewReleaseOpen(false)} />
    </Page>
  );
}
