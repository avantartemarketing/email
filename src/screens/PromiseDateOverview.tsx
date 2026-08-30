import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BatchListItem } from '../types';
import { formatDayShort } from '../logic/dates';
import { shipWindowShort } from '../logic/templates';
import { fulfilmentTag, plural, releaseStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { Card, None, Page, Skeleton } from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';

/**
 * Every promise the business has made, grouped under the release that made it.
 *
 * Named twice on 29 Aug 2026: Batches → Release overview → **Promise date
 * overview**. The rows never changed — they are batches — and each rename
 * moved the name closer to what the page is actually opened to find out. A
 * batch is not the unit of work; a release is not the question either; the
 * question is *what have we told people, and when*. The promised dispatch is
 * the only column here that anybody is ever chasing.
 *
 * ## The shape, from the reference the owner sent
 *
 * A grouped list read one group at a time: a banded heading naming what the
 * grouping IS over the value it took, an identity column in emphasis at the
 * left, and plain columns after it. Ruling 14 already draws that band, and its
 * chevron now folds the group behind it — a chevron with nothing behind it is
 * the exact fault the kit records having shipped once.
 *
 * The owner's one amendment to the reference: "The Grouped headings wouldn't
 * be in status lozenges." Right, and the system already says why. A lozenge is
 * a mark on a VALUE — a pill for a status, a tag for a category — and a
 * release title is neither: it is a name. Lozenging it would put a mark on the
 * one thing in the band that is not a state.
 *
 * The grouping is the page's definition, so it OPENS grouped by release
 * (`defaultView`) — but through the same view controls every table here has,
 * so it can be regrouped by dispatch window ("what ships in November?") or
 * flattened, and the choice is remembered like any other view.
 */
export function PromiseDateOverview(): ReactElement {
  const { data } = useApp();
  const navigate = useNavigate();
  const list = useAsync(() => data.listBatches(), []);

  const rows = list.data ?? [];
  const releaseCount = new Set(rows.map((r) => r.release.id)).size;

  const columns: Column<BatchListItem>[] = [
    {
      id: 'release',
      title: 'Release',
      locked: true,
      /* The cell is the bare title the band already prints, so grouped by
         release the column comes off the grid rather than repeating its own
         heading down every row. */
      bandReplaces: true,
      kind: 'choice',
      caption: 'RELEASE',
      value: (r) => r.release.title,
      cell: (r) => <span className="rd-ink">{r.release.title}</span>,
    },
    {
      id: 'batch',
      /* Same convention as the approval queue: one batch means the release
         never split, and "Batch 1" would introduce batch language to a
         release that has none anywhere else.

         Emphasis rather than a tag. Grouped by release this is the row's
         identity — the leftmost thing, the thing you read to know which row
         you are on — and the reference the owner sent sets an identity in
         weight, not in a lozenge. The taxonomy it used to carry has its own
         column, one click away in Fields. */
      title: 'Batch',
      kind: 'choice',
      caption: 'BATCH',
      value: (r) => (r.releaseBatchCount > 1 ? r.batch.name : null),
      cell: (r) =>
        r.releaseBatchCount > 1 ? <span className="rd-ink">{r.batch.name}</span> : <None />,
    },
    {
      id: 'fulfilment',
      title: 'Fulfilment',
      defaultHidden: true,
      kind: 'choice',
      caption: 'FULFILMENT',
      value: (r) => r.batch.fulfilment,
      cell: (r) => fulfilmentTag(r.batch.fulfilment) ?? <None />,
    },
    {
      id: 'collectors',
      title: 'Collectors',
      n: true,
      kind: 'number',
      value: (r) => r.collectorCount,
      cell: (r) => r.collectorCount,
    },
    {
      id: 'promise',
      /* The promise as the window it is, not a bare date with a silent week
         attached — the same reading the batch header settled on. Sorting and
         grouping still work off the ISO date underneath. */
      title: 'Promised dispatch',
      kind: 'date',
      caption: 'PROMISED DISPATCH',
      value: (r) => r.batch.promiseDate,
      groupLabel: (key) => (key ? formatDayShort(key) : 'Not set'),
      cell: (r) =>
        r.batch.promiseDate ? (
          shipWindowShort(r.batch.promiseDate)
        ) : (
          <span className="rd-none">Not set</span>
        ),
    },
    {
      id: 'status',
      /* The release's own state, not the batch's. Hidden by default because
         three of four releases are active and a column that says "Active"
         nine times is width spent on the exception nobody is looking for —
         but it is the one filter this page is worth having ("show me what is
         still live"), and a hidden column still filters and still groups. */
      title: 'Release status',
      defaultHidden: true,
      kind: 'choice',
      caption: 'RELEASE STATUS',
      order: ['active', 'completed'],
      value: (r) => r.release.status,
      groupLabel: (key) => (key === 'completed' ? 'Completed' : 'Active'),
      cell: (r) => releaseStatusBadge(r.release.status),
    },
  ];

  return (
    /* No subtitle. The owner, 29 Aug 2026: "Remove all helper text like
       'Every release in production, opened out into the batches it ships in
       — who has been promised what, and how many.'" A sentence under the
       title that describes the table under it is read once, by the person who
       already knows, and never again. */
    <Page title="Promise date overview">
      {list.data === null ? (
        <Card>
          <Skeleton rows={8} />
        </Card>
      ) : (
        <DataTable
          table="promise-overview"
          noun="batch"
          nounPlural="batches"
          searchPlaceholder="Search releases and batches"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.batch.id}
          onRowClick={(r) => navigate(`/releases/${r.release.id}`)}
          defaultView={{ group: 'release' }}
          empty="No releases yet — import a release's orders and its batches appear here."
          /* A count, and nothing else. What used to follow it — "a release
             with one batch never mentions it, the dash is that batch" — was
             the page explaining its own convention, which is the helper text
             the owner asked to be rid of. Nothing under an empty table
             either: the empty state is written for that. */
          foot={rows.length > 0 ? `across ${plural(releaseCount, 'release')}` : undefined}
        />
      )}
    </Page>
  );
}
