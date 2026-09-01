import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { Release } from '../types';
import type { AllocationPlanView } from '../data';
import { useApp } from '../ui/AppContext';
import { plural } from '../ui/format';
import { Bar, Btn, Card, CardHead, Dialog, Facts, Stack, Why } from '../ui/rd';

/**
 * The Editions tab — the workbook, as a button.
 *
 * The rule it runs is the sheet's own, stated in that sheet's comment on
 * `Order Matrix!P1`: the largest set gets priority 1, oldest first inside a
 * group. What it fixes is the walk: numbers are handed out per ORDER, so a
 * collector who bought three artworks holds one number three times, which is
 * the property the workbook's dead validator was meant to police and 13 real
 * orders lost.
 *
 * Three states, one screen:
 *   - something to number → the facts, the artworks, and an Allocate primary;
 *   - numbers held (imported or committed) → they are PINS, drawn in the same
 *     table, with the export and the one eraser;
 *   - the audit found faults → a fail bar naming each one, and Allocate shut
 *     with the first as its Why. The workbook passed silently over exactly
 *     this; the whole point of the tab is that this tool cannot.
 */

/**
 * The published prototype runs inside the artifact viewer, which blocks every
 * page-initiated download — an anchor click there does NOTHING, silently. The
 * viewer instead mediates saves through its own confirm, reached via
 * `claude.use('downloads')`. The real app has no `window.claude`, so the
 * anchor path below stays what production uses; this is the prototype's door,
 * and without it the one button the owner most wants to press is inert
 * exactly where he presses it.
 */
async function handToViewer(
  fileName: string,
  csv: string,
): Promise<'saved' | 'declined' | 'no-viewer'> {
  const claude = (
    window as { claude?: { use?: (name: string) => Promise<unknown> } }
  ).claude;
  if (!claude?.use) return 'no-viewer';
  try {
    const downloads = (await claude.use('downloads')) as {
      save: (request: { filename: string; data: string }) => Promise<unknown>;
    } | null;
    if (!downloads) return 'no-viewer';
    await downloads.save({ filename: fileName, data: csv });
    return 'saved';
  } catch {
    /* Declined, rate-limited, or a lifecycle error — the viewer answered or
       cannot. Never fall through to an anchor the same viewer blocks. */
    return 'declined';
  }
}

export function EditionsPanel({
  release,
  activeOrders,
  onChanged,
}: {
  release: Release;
  activeOrders: number;
  onChanged: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [plan, setPlan] = useState<AllocationPlanView | null>(null);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(() => {
    let live = true;
    void data
      .previewAllocation(release.id)
      .then((view) => {
        if (live) setPlan(view);
      })
      .catch(() => {
        if (live) setPlan(null);
      });
    return () => {
      live = false;
    };
  }, [data, release.id]);
  useEffect(load, [load]);

  const allocate = async (): Promise<void> => {
    setBusy(true);
    try {
      const committed = await data.commitAllocation(release.id);
      showToast(
        `${plural(committed.numbered, 'order')} numbered` +
          (committed.kept > 0 ? ` — ${committed.kept} kept` : ''),
      );
      load();
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async (): Promise<void> => {
    const { fileName, csv } = await data.allocationCsv(release.id);
    const rows = plural(csv.split('\n').length - 1, 'row');
    const handed = await handToViewer(fileName, csv);
    if (handed === 'declined') return; // their answer; no toast, no second door
    if (handed === 'no-viewer') {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
    showToast(`${fileName} — ${rows}`);
  };

  const clear = async (): Promise<void> => {
    setBusy(true);
    try {
      const cleared = await data.undoAllocation(release.id);
      showToast(`Edition numbers cleared — ${plural(cleared, 'order')}`);
      setClearing(false);
      load();
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  };

  if (activeOrders === 0) {
    return (
      <Card>
        <CardHead title="Editions" />
        <Facts items={[{ label: 'Orders to number', value: 0 }]} />
      </Card>
    );
  }
  if (!plan) {
    return (
      <Card>
        <CardHead title="Editions" />
      </Card>
    );
  }

  /* What is actually WRITTEN — the preview's artwork counts include the
     numbers it would issue, and an export of numbers nobody has committed is
     a file that lies. */
  const held = plan.kept;
  const broken = plan.faults.length > 0;
  const allocateLabel = `Allocate editions — ${plural(plan.numbered, 'order')}`;

  return (
    <Stack>
      {broken ? (
        <Bar tone="fail" title="The numbering this release holds is broken">
          {plan.faults.map((f) => (
            <div key={f}>{f}</div>
          ))}
        </Bar>
      ) : null}

      <Card>
        <CardHead
          title="Editions"
          actions={
            <>
              {plan.numbered > 0 ? (
                broken ? (
                  /* Shut, and it says why — never drawn shut in silence, and
                     never absent: absence reads as "not built yet". */
                  <Why says={plan.faults[0]}>
                    <Btn kind="pri" disabled>
                      {allocateLabel}
                    </Btn>
                  </Why>
                ) : (
                  <Btn kind="pri" disabled={busy} onClick={() => void allocate()}>
                    {allocateLabel}
                  </Btn>
                )
              ) : null}
              {held > 0 && !broken ? (
                <Btn onClick={() => void exportCsv()}>Export warehouse CSV</Btn>
              ) : null}
              {held > 0 ? (
                <Btn kind="link-danger" disabled={busy} onClick={() => setClearing(true)}>
                  Clear all numbers
                </Btn>
              ) : null}
            </>
          }
        />
        <Facts
          items={[
            { label: 'Numbered', value: plan.kept },
            { label: 'To number', value: plan.numbered },
            { label: 'Artworks', value: plan.artworks.length || '—' },
            ...(release.editionSize !== null
              ? [{ label: 'Edition size', value: release.editionSize }]
              : []),
          ]}
        />
        {plan.artworks.length > 0 ? (
          <table className="rd-t rd-t27 rd-fit">
            <thead>
              <tr>
                <th scope="col">Artwork</th>
                <th scope="col" className="n">Numbers</th>
                <th scope="col" className="n">Runs to</th>
              </tr>
            </thead>
            <tbody>
              {plan.artworks.map((a) => (
                <tr key={a.artworkKey}>
                  <td className="rd-ink">{a.artworkName}</td>
                  <td className="n">{a.count}</td>
                  <td className="n">{a.highest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Card>

      {plan.notes.length > 0 ? (
        <Card>
          <CardHead title={`${plural(plan.notes.length, 'thing')} to know`} />
          <table className="rd-t rd-t27 rd-fit">
            <thead>
              <tr>
                <th scope="col">About</th>
                <th scope="col">What</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {plan.notes.map((n) => (
                <tr key={`${n.kind}-${n.about}-${n.what}`}>
                  <td>{n.about}</td>
                  <td className="rd-ink">{n.what}</td>
                  <td className="rd-mut">{n.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Dialog
        open={clearing}
        title="Clear all edition numbers?"
        onClose={() => setClearing(false)}
        primary={{
          label: `Clear ${plural(plan.kept, 'order')}`,
          onClick: () => void clear(),
          destructive: true,
          disabled: busy,
        }}
        secondary={{ label: 'Keep them', onClick: () => setClearing(false) }}
      >
        <Bar tone="warn" title="This is the only way a number moves">
          Numbers already sent to the warehouse stop matching what this release says. A fresh
          allocation starts from 1 and will number the same orders differently.
        </Bar>
      </Dialog>
    </Stack>
  );
}
