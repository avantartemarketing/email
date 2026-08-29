import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BatchListItem } from '../types';
import { formatDayShort } from '../logic/dates';
import { shipWindowShort } from '../logic/templates';
import { fulfilmentTag, plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { Card, None, Page, Skeleton, Tag } from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';

/**
 * Every batch in the system, grouped under its release — the production
 * overview.
 *
 * The owner, 29 Aug 2026: "a table grouped by release that shows batches,
 * number of collectors and promise date grouped under each." The release
 * screens answer "how is THIS release doing"; this page answers the question
 * asked across all of them at once — who has been promised what, and how
 * many of them there are.
 *
 * The grouping is the page's definition, so it OPENS grouped by release
 * (`defaultView`) — but through the same view controls every table here has,
 * so it can be regrouped by dispatch window ("what ships in November?") or
 * flattened, and the choice is remembered like any other view.
 */
export function Batches(): ReactElement {
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
         release that has none anywhere else. */
      title: 'Batch',
      kind: 'choice',
      caption: 'BATCH',
      value: (r) => (r.releaseBatchCount > 1 ? r.batch.name : null),
      cell: (r) =>
        r.releaseBatchCount > 1 ? <Tag tone="teal">{r.batch.name}</Tag> : <None />,
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
  ];

  return (
    <Page
      title="Batches"
      facts={<span>Every batch in production — who has been promised what, and how many.</span>}
    >
      {list.data === null ? (
        <Card>
          <Skeleton rows={8} />
        </Card>
      ) : (
        <DataTable
          table="batches"
          noun="batch"
          nounPlural="batches"
          searchPlaceholder="Search releases and batches"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.batch.id}
          onRowClick={(r) => navigate(`/releases/${r.release.id}`)}
          defaultView={{ group: 'release' }}
          empty="No batches yet — import a release's orders and its batches appear here."
          /* Nothing to say under an empty table: the empty state is written
             for that, and "0 batches · across 0 releases" beside it is the
             count contradicting the sentence next to it. */
          foot={
            rows.length > 0
              ? `across ${plural(releaseCount, 'release')} · a release with one batch never mentions it — the dash is that batch`
              : undefined
          }
        />
      )}
    </Page>
  );
}
