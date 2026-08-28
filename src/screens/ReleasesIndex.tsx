/**
 * The releases list — the app's front door.
 *
 * A ticked table in the kit's vocabulary: `usePicked` owns the set and the
 * shift-range, `RowTick` owns the gesture, `BulkBar` REPLACES the header row
 * while a selection is live (ruling 9) and `useGridPin` holds the
 * content-sized grid still across that swap, so ticking a box moves nothing.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UpcomingSendInfo } from '../types';
import { formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, plural, releaseStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { useColumns } from '../ui/useColumns';
import { Btn, Cap, Card, Foot, None, Page, Pill, Skeleton } from '../ui/rd';
import Menu from '../rd/components/Menu';
import BulkBar from '../rd/components/BulkBar';
import RowTick from '../rd/components/RowTick';
import usePicked from '../rd/components/usePicked';
import useGridPin from '../rd/components/useGridPin';
import { NewReleaseModal } from '../components/NewReleaseModal';

/**
 * The next-send cell: just the date at rest; clicking it opens the next
 * three sends — which email, which batch, how many collectors — each a
 * link into its send detail.
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

  const columns = useColumns('releases', [
    { id: 'release', title: 'Release', locked: true },
    { id: 'artist', title: 'Artist' },
    { id: 'edition', title: 'Edition size', n: true, defaultHidden: true },
    { id: 'status', title: 'Status' },
    { id: 'orders', title: 'Orders', n: true },
    { id: 'batches', title: 'Batches', n: true },
    { id: 'next', title: 'Next send' },
    { id: 'overdue', title: 'Overdue' },
    { id: 'pending', title: 'Pending approval' },
  ]);

  const rows = releases.data ?? [];
  const picked = usePicked();
  const pin = useGridPin(picked.size > 0);

  return (
    <Page
      title="Releases"
      actions={
        <>
          {columns.menu}
          <Btn kind="pri" onClick={() => setNewReleaseOpen(true)}>
            New release
          </Btn>
        </>
      }
    >
      <Card>
        {releases.data === null ? (
          <Skeleton rows={6} />
        ) : (
          <>
            <div className="rd-scroll">
              <table
                className="rd-t rd-t27 rd-fit rd-tpad rd-tsel"
                ref={pin.ref}
                style={pin.style}
              >
                {pin.cols}
                <thead>
                  {picked.size > 0 ? (
                    <BulkBar count={picked.size} columns={columns.count + 1} actions={[]} />
                  ) : (
                    <tr>
                      <th aria-hidden />
                      {columns.head}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="rd-prose" colSpan={columns.count + 1}>
                        No releases yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((summary) => {
                      const { release } = summary;
                      return (
                        <tr
                          key={release.id}
                          className="rd-rowlink"
                          onClick={() => navigate(`/releases/${release.id}`)}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <RowTick
                              id={release.id}
                              on={picked.has(release.id)}
                              label={release.title}
                              onPress={picked.press}
                            />
                          </td>
                          <td className="rd-ink">
                            <Cap>{release.title}</Cap>
                          </td>
                          {columns.show('artist') ? (
                            <td>
                              <Cap>{release.artist}</Cap>
                            </td>
                          ) : null}
                          {columns.show('edition') ? (
                            <td className="n">{release.editionSize ?? <None />}</td>
                          ) : null}
                          {columns.show('status') ? (
                            <td>{releaseStatusBadge(release.status)}</td>
                          ) : null}
                          {columns.show('orders') ? (
                            <td className="n">{summary.orderCount}</td>
                          ) : null}
                          {columns.show('batches') ? (
                            <td className="n">
                              {summary.batchCount > 1 ? summary.batchCount : <None />}
                            </td>
                          ) : null}
                          {columns.show('next') ? (
                            <td onClick={(e) => e.stopPropagation()}>
                              <NextSendCell
                                upcoming={summary.upcomingSends}
                                onOpenSend={(sendId) => navigate(`/sends/${sendId}`)}
                              />
                            </td>
                          ) : null}
                          {columns.show('overdue') ? (
                            <td>
                              {summary.overdueCount > 0 ? (
                                <Pill tone="red">{summary.overdueCount}</Pill>
                              ) : (
                                <None />
                              )}
                            </td>
                          ) : null}
                          {columns.show('pending') ? (
                            <td>
                              {summary.pendingApprovalCount > 0 ? (
                                <Pill tone="amber">{summary.pendingApprovalCount}</Pill>
                              ) : (
                                <None />
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Foot>{plural(rows.length, 'release')}</Foot>
          </>
        )}
      </Card>
      <NewReleaseModal open={newReleaseOpen} onClose={() => setNewReleaseOpen(false)} />
    </Page>
  );
}
