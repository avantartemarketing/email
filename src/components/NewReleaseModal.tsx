import { useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Claim } from '../data';
import type { ProductKind } from '../types';
import type { ParsedLineItem, ParseResult } from '../logic/importer';
import { orderDedupeKey } from '../logic/importer';
import type { FileProduct } from '../logic/intake';
import {
  fulfilmentOf,
  planIntake,
  proposeRelease,
  shopifyOrderCount,
  skusFor,
} from '../logic/intake';
import type { ImportBatchKey, ImportBatchPreview } from '../logic/importPlan';
import { OPTIONAL_MILESTONES, previewImportPlan } from '../logic/importPlan';
import { artworksInFile } from '../logic/artworks';
import { shipWindowShort } from '../logic/templates';
import { addDays, formatDayShort, today } from '../logic/dates';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Facts, None, Pill, RowAct } from '../ui/rd';
import Field from '../rd/components/Field';
import { SelectField } from '../rd/components/Picker';
import {
  FileProductsTable,
  OrderIntakeDialog,
  batchTagFor,
  tickedItems,
} from './OrderIntakeDialog';
import { IntakeNotes } from './IntakeNotes';

/**
 * Creating a release, from the file.
 *
 * The owner, 30 Aug 2026: *"in the short term it will be a CSV download from
 * Shopify per release of all the Orders."*
 *
 * It used to be a form. You typed a title that had to equal the Shopify
 * product title exactly — a rule that lived in a `?` tooltip — then landed on
 * an empty release and went looking for the importer. Get the title wrong and
 * the import succeeded with nothing in it and called your orders somebody
 * else's products.
 *
 * So the file leads. The export is read first, the products in it are listed,
 * and the operator TICKS which ones are this release. Those exact strings
 * become the stored match, so the one thing that must be right is a thing
 * nobody typed — and it is the same string the Shopify sync will match on,
 * which is what lets the title go back to being a display name.
 *
 * ## Pane three — batches and dates
 *
 * The owner, 7 Sep 2026: *"When you import a release, it should ask you for
 * the initial batching and promise dates … it determines how many email
 * templates initially need to be populated by an image."* So after the
 * release's identity comes a third pane: confirm the batching the file
 * justified (or collapse it — everything ships together), set each batch's
 * promise date, and read off exactly what Create is about to queue — the
 * emails, the first send, and the image bill. The numbers are the plan
 * generator's real output, so the release page's "N emails have no image"
 * band opens saying the same thing this pane promised. Dates are asked for,
 * never demanded: a blank one keeps today's flow, where the batch screen's
 * Set promise date drafts the plan later.
 *
 * The whole thing is still one press: the release, its product match, the
 * batches, the orders and the dated plans, together. That is one decision,
 * and splitting it would leave a release with no orders that nothing can
 * tell apart from a deliberately empty one. The cost is that a mis-dropped
 * file is expensive, which is why `undoIntake` ships with this and not
 * after it.
 */
export function NewReleaseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const navigate = useNavigate();
  const editionId = useId();
  const dateId = useId();

  const [parse, setParse] = useState<{
    result: ParseResult;
    products: FileProduct[];
    fileName: string;
  } | null>(null);
  const [pane, setPane] = useState<'details' | 'dates'>('details');
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [editionSize, setEditionSize] = useState('');
  const [productKind, setProductKind] = useState<ProductKind>('print');
  const [milestones, setMilestones] = useState<string[]>(OPTIONAL_MILESTONES.print);
  const [shipTogether, setShipTogether] = useState(false);
  const [dates, setDates] = useState<Partial<Record<ImportBatchKey, string>>>({});
  const [claims, setClaims] = useState<Claim[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = (): void => {
    setParse(null);
    setPane('details');
    setTicked(new Set());
    setTitle('');
    setArtist('');
    setEditionSize('');
    setShipTogether(false);
    setDates({});
    setClaims([]);
  };

  const close = (): void => {
    reset();
    onClose();
  };

  const onRead = (result: ParseResult, products: FileProduct[], fileName: string): void => {
    const proposal = proposeRelease(products);
    setParse({ result, products, fileName });
    setTicked(new Set(proposal.lineItemTitles));
    setTitle(proposal.title);
    setProductKind(proposal.productKind);
    setMilestones(OPTIONAL_MILESTONES[proposal.productKind]);
    /* Asked the moment the file is read, not at the press: the answer changes
       what the primary says, and finding out after typing an artist's name is
       finding out too late. */
    void data
      .claimantsOf(products.map((p) => p.lineItemTitle))
      .then(setClaims)
      .catch(() => setClaims([]));
  };

  const toggle = (lineItemTitle: string): void =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(lineItemTitle)) next.delete(lineItemTitle);
      else next.add(lineItemTitle);
      return next;
    });

  const artworks = useMemo(() => (parse ? artworksInFile(parse.products) : []), [parse]);
  const items: ParsedLineItem[] = parse ? tickedItems(parse.result.items, ticked) : [];
  const plan = useMemo(
    () => (parse ? planIntake(parse.result.items, [...ticked], [], productKind) : null),
    [parse, ticked, productKind],
  );

  /* A release is one ARTIST, not one product. It used to be one product, and
     that was wrong on every real release: Ai Weiwei's Guardian is three
     colourways and Murakami's release is four prints, so the guard refused to
     create the very thing it was meant to protect. What it now refuses is the
     case that really is two releases — two artists in one tick. */
  const tickedArtworks = artworks.filter((a) =>
    a.lineItemTitles.some((t) => ticked.has(t)),
  );
  const artists = [...new Set(tickedArtworks.map((a) => a.artistCode).filter(Boolean))].sort();
  const twoArtists =
    artists.length > 1
      ? tickedArtworks.filter((a) => a.artistCode === artists[0] || a.artistCode === artists[1])
      : [];
  const clash = claims.find((c) => ticked.has(c.lineItemTitle));

  const why =
    ticked.size === 0
      ? 'Tick at least one product.'
      : artists.length > 1
        ? 'Two artists ticked.'
        : clash
          ? `“${clash.lineItemTitle}” already belongs to ${clash.releaseTitle}.`
          : !artist.trim()
            ? 'Artist is required.'
            : !title.trim()
              ? 'A release needs a title.'
              : undefined;

  /* ---- pane three: the batches the arrival will create ------------------ */

  const fulfilmentCounts = useMemo(() => {
    const counts = { framed: 0, unframed: 0 };
    if (!plan || productKind !== 'print') return counts;
    for (const item of plan.create) {
      const f =
        plan.fulfilmentByOrder.get(orderDedupeKey(item.shopifyOrderName, item.lineItemTitle)) ??
        fulfilmentOf(item.lineItemTitle);
      counts[f] += 1;
    }
    return counts;
  }, [plan, productKind]);

  const splits = productKind === 'print' && plan !== null && plan.fulfilments.length > 1;
  const previews: ImportBatchPreview[] = !plan
    ? []
    : splits && !shipTogether
      ? [
          {
            key: 'framed',
            name: 'Framed',
            orders: fulfilmentCounts.framed,
            promiseDate: dates.framed || null,
          },
          {
            key: 'unframed',
            name: 'Unframed',
            orders: fulfilmentCounts.unframed,
            promiseDate: dates.unframed || null,
          },
        ]
      : productKind === 'print' && plan.fulfilments.length === 1
        ? [
            {
              /* One flow in the file: the one batch keeps its real fulfilment
                 (an all-framed release still sends the framing email), and the
                 pane shows no batch language at all — same rule as the app. */
              key: plan.fulfilments[0],
              name: 'This release',
              orders: plan.create.length,
              promiseDate: dates[plan.fulfilments[0]] || null,
            },
          ]
        : [
            {
              key: 'single',
              name: 'This release',
              orders: plan.create.length,
              promiseDate: dates.single || null,
            },
          ];

  const disabledTemplates = OPTIONAL_MILESTONES[productKind].filter(
    (ref) => !milestones.includes(ref),
  );
  /* Cheap enough to run per render: two batches at most, and memoising it
     would mean keeping a dependency list honest about two derived arrays. */
  const preview = plan
    ? previewImportPlan(productKind, disabledTemplates, previews, today())
    : null;

  const tomorrow = addDays(today(), 1);
  const badDate = previews.some((b) => b.promiseDate && b.promiseDate < tomorrow);
  const undated = previews.filter((b) => !b.promiseDate);

  const save = async (): Promise<void> => {
    if (!parse) return;
    setSaving(true);
    try {
      const promiseDates: Partial<Record<'framed' | 'unframed' | 'single', string>> = {};
      for (const b of previews) {
        if (b.promiseDate) promiseDates[b.key] = b.promiseDate;
      }
      const anyDates = Object.keys(promiseDates).length > 0;
      const { release } = await data.createRelease(
        {
          title,
          artist,
          editionSize: editionSize ? Number.parseInt(editionSize, 10) : null,
          productKind,
          productMatch: {
            lineItemTitles: [...ticked],
            skus: skusFor(parse.products, [...ticked]),
          },
          disabledTemplates,
          batching:
            (splits && shipTogether) || anyDates
              ? {
                  shipTogether: splits && shipTogether ? true : undefined,
                  promiseDates: anyDates ? promiseDates : undefined,
                }
              : undefined,
        },
        { items, source: { kind: 'csv_upload', label: parse.fileName } },
      );
      /* A report, not an instruction — and it counts what pane three showed,
         because the preview and the write run the same generator over the
         same dates. */
      const drafted =
        preview && preview.emailsQueued > 0
          ? ` · ${plural(preview.emailsQueued, 'email')} drafted`
          : '';
      showToast(
        plan && previews.length > 1
          ? `${release.title} created — ${plural(plan.create.length, 'order')} in ${plural(
              previews.length,
              'batch',
              'batches',
            )}${drafted}`
          : `${release.title} created — ${plural(plan?.create.length ?? 0, 'order')}${drafted}`,
      );
      reset();
      onClose();
      navigate(`/releases/${release.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  const onDates = pane === 'dates';

  const dateFieldFor = (b: ImportBatchPreview): ReactElement => (
    <Field
      key={b.key}
      label={previews.length > 1 ? `${b.name} — dispatch date` : 'Dispatch date'}
      value={dates[b.key] ?? ''}
      controlId={`${dateId}-${b.key}`}
      note={
        /* Facts, not help: the batch's size, and — once a date lands — the
           window a collector will read. */
        b.promiseDate && b.promiseDate >= tomorrow
          ? `${plural(b.orders, 'order')} · ${shipWindowShort(b.promiseDate)}`
          : plural(b.orders, 'order')
      }
    >
      <input
        id={`${dateId}-${b.key}`}
        type="date"
        min={tomorrow}
        value={dates[b.key] ?? ''}
        onChange={(e) => setDates((prev) => ({ ...prev, [b.key]: e.target.value }))}
      />
    </Field>
  );

  return (
    <OrderIntakeDialog
      open={open}
      title="New release"
      onClose={close}
      onRead={onRead}
      parse={parse ? { fileName: parse.fileName } : null}
      primary={
        onDates
          ? {
              label: 'Create',
              onClick: () => void save(),
              disabled: saving || badDate || why !== undefined,
              why: saving
                ? 'Creating…'
                : badDate
                  ? 'The promise date must be in the future.'
                  : why,
            }
          : {
              label: 'Next',
              onClick: () => setPane('dates'),
              disabled: why !== undefined,
              why,
            }
      }
      secondary={
        onDates
          ? { label: 'Back', onClick: () => setPane('details') }
          : { label: 'Back', onClick: () => setParse(null) }
      }
    >
      {parse && plan && !onDates ? (
        <>
          {clash ? (
            <Bar tone="fail" title={`“${clash.lineItemTitle}” is already claimed`}>
              {clash.releaseTitle} — {plural(clash.orderCount, 'order')}
              <div className="rd-baracts">
                <button
                  type="button"
                  className="rd-chip"
                  onClick={() => {
                    navigate(`/releases/${clash.releaseId}`);
                    close();
                  }}
                >
                  Open
                </button>
              </div>
            </Bar>
          ) : artists.length > 1 ? (
            <Bar tone="fail" title="Two artists are ticked">
              {twoArtists[0]?.name} and{' '}
              {twoArtists.find((a) => a.artistCode === artists[1])?.name}
            </Bar>
          ) : null}

          <div className="rd-grouphd">In this file</div>
          <FileProductsTable
            products={parse.products}
            ticked={ticked}
            onToggle={toggle}
            fulfilmentTagOf={(p) => batchTagFor(p, productKind)}
            /* Two different quantities, both stated. An order here is one row
               per print, so one Shopify order buying a framed and an unframed
               is two of ours — and a reader left to guess which number a
               screen meant is the fault this one exists to end. */
            foot={`${plural(plan.create.length, 'order')} from ${plural(
              shopifyOrderCount(parse.result.items, [...ticked]),
              'Shopify order',
            )}`}
          />

          <div className="rd-fields">
            <Field
              label="Title"
              value={title}
              onChange={setTitle}
              suggested
            />
            <div className="rd-fieldrow">
              <Field
                label="Artist"
                value={artist}
                onChange={setArtist}
              />
              <Field
                label="Edition size"
                value={editionSize}
                numeric
                controlId={editionId}
                /* Never prefilled from the order count: in every real export
                   the orders exceed the stated edition, so "294 on an edition
                   of 150" is ordinary and must not be validated as an error. */
              >
                <input
                  id={editionId}
                  type="number"
                  value={editionSize}
                  onChange={(e) => setEditionSize(e.target.value)}
                />
              </Field>
            </div>
            <SelectField
              label="Product type"
              value={productKind}
              options={[
                { label: 'Print', value: 'print' },
                { label: 'Sculpture', value: 'sculpture' },
              ]}
              onChange={(value) => {
                const kind = value as ProductKind;
                setProductKind(kind);
                setMilestones(OPTIONAL_MILESTONES[kind]);
              }}
            />
          </div>

          <div className="rd-after">
            <div className="rd-after-t">What this creates</div>
            <Facts
              items={[
                { label: 'Orders', value: plan.create.length },
                { label: 'Collectors', value: plan.collectors },
                /* Drawn only when the file justifies more than one — a release
                   with a single flow has no batch language anywhere else. */
                ...(plan.fulfilments.length > 1
                  ? [{ label: 'Batches', value: plan.fulfilments.length }]
                  : []),
                {
                  label: 'Newest order',
                  value: plan.newestOrderDate ? formatDayShort(plan.newestOrderDate) : '—',
                },
              ]}
            />
          </div>

          <IntakeNotes notes={plan.notes} />
        </>
      ) : parse && plan && preview ? (
        <>
          {/* The file proposes the batching; the person confirms it or
              collapses it. A file with one flow skips the question — one
              date field, nothing to choose. */}
          {splits ? (
            <div className="rd-fields">
              <SelectField
                label="Shipping"
                value={shipTogether ? 'together' : 'split'}
                options={[
                  {
                    label: `Separately — Framed ${fulfilmentCounts.framed} · Unframed ${fulfilmentCounts.unframed}`,
                    value: 'split',
                  },
                  {
                    label: `Together — one batch of ${plan.create.length}`,
                    value: 'together',
                  },
                ]}
                onChange={(value) => setShipTogether(value === 'together')}
              />
            </div>
          ) : null}

          <div className="rd-fields">
            {previews.length > 1 ? (
              <div className="rd-fieldrow">{previews.map(dateFieldFor)}</div>
            ) : (
              previews.map(dateFieldFor)
            )}
          </div>
          {badDate ? <Bar tone="fail" title="The date must be in the future" /> : null}

          <div className="rd-grouphd">What this will send</div>
          {preview.emailsQueued > 0 ? (
            <>
              <Facts
                items={[
                  { label: 'Emails queued', value: preview.emailsQueued },
                  { label: 'Images to pick', value: preview.imagesToPick },
                  {
                    label: 'First send',
                    value: preview.firstSend ? formatDayShort(preview.firstSend) : '—',
                  },
                ]}
              />
              {undated.length > 0 ? (
                /* The state alone — the owner, 8 Sep 2026: "Remove ALL helper
                   copy." What a missing date means is the batch screen's to
                   say when somebody gets there. */
                <Bar tone="warn" title={`${undated[0].name} has no date`} />
              ) : null}
            </>
          ) : (
            <Bar tone="note" title="No dates yet — nothing is queued" />
          )}

          {/* The emails tab's own rows, before the release exists: one row
              per image slot, so the table answers the owner's question — how
              many templates need populating — rather than listing eight
              near-identical sends. Switch off sits beside the row it
              removes, and a switched-off row stays, or it could never be
              switched back on. */}
          <table className="rd-t rd-t27 rd-fit">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col" className="n">
                  Sends
                </th>
                <th scope="col">First date</th>
                <th scope="col">Image</th>
                <th scope="col" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.slot}>
                  <td className="rd-ink">
                    <span className="rd-cellflex">
                      <span className="rd-ellip">{row.label}</span>
                      {row.off ? (
                        <Pill tone="grey" small>
                          Off
                        </Pill>
                      ) : null}
                    </span>
                  </td>
                  <td className="n">{row.off || row.sends === 0 ? <None /> : row.sends}</td>
                  <td>
                    {row.off || !row.firstDate ? <None /> : formatDayShort(row.firstDate)}
                  </td>
                  <td>
                    {row.off ? (
                      <None />
                    ) : (
                      <Pill tone="amber" small>
                        Needed
                      </Pill>
                    )}
                  </td>
                  <td>
                    {row.canToggle ? (
                      <div className="rd-rowacts">
                        <RowAct
                          onClick={() =>
                            setMilestones((prev) =>
                              row.off ? [...prev, row.ref] : prev.filter((r) => r !== row.ref),
                            )
                          }
                        >
                          {row.off ? 'Switch on' : 'Switch off'}
                        </RowAct>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </OrderIntakeDialog>
  );
}
