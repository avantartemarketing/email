import { useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Claim } from '../data';
import type { ProductKind, TemplateRef } from '../types';
import type { ParsedLineItem, ParseResult } from '../logic/importer';
import type { FileProduct } from '../logic/intake';
import {
  planIntake,
  proposeRelease,
  shopifyOrderCount,
  skusFor,
} from '../logic/intake';
import { artworksInFile } from '../logic/artworks';
import { formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Facts } from '../ui/rd';
import Field from '../rd/components/Field';
import { SelectField } from '../rd/components/Picker';
import {
  FileProductsTable,
  OrderIntakeDialog,
  batchTagFor,
  tickedItems,
} from './OrderIntakeDialog';
import { IntakeNotes } from './IntakeNotes';

/** Milestones the operator can include/exclude at setup, per product kind. */
const OPTIONAL_MILESTONES: Record<ProductKind, TemplateRef[]> = {
  print: ['pp-printing', 'pp-signing', 'pp-framing', 'pp-ontrack'],
  sculpture: ['pp-ontrack'],
};

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
 * The whole thing is one press: the release, its product match, the batches
 * the file justified and the orders, together. That is one decision, and
 * splitting it would leave a release with no orders that nothing can tell
 * apart from a deliberately empty one. The cost is that a mis-dropped file is
 * expensive, which is why `undoIntake` ships with this and not after it.
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

  const [parse, setParse] = useState<{
    result: ParseResult;
    products: FileProduct[];
    fileName: string;
  } | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [editionSize, setEditionSize] = useState('');
  const [productKind, setProductKind] = useState<ProductKind>('print');
  const [milestones, setMilestones] = useState<string[]>(OPTIONAL_MILESTONES.print);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = (): void => {
    setParse(null);
    setTicked(new Set());
    setTitle('');
    setArtist('');
    setEditionSize('');
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
        ? `Tick one artist — ${twoArtists[0]?.name} and ${
            twoArtists.find((a) => a.artistCode === artists[1])?.name
          } are different artists.`
        : clash
          ? `“${clash.lineItemTitle}” already belongs to ${clash.releaseTitle}.`
          : !artist.trim()
            ? 'Artist is required.'
            : !title.trim()
              ? 'A release needs a title.'
              : undefined;

  const save = async (): Promise<void> => {
    if (!parse) return;
    setSaving(true);
    try {
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
          disabledTemplates: OPTIONAL_MILESTONES[productKind].filter(
            (ref) => !milestones.includes(ref),
          ),
        },
        { items, source: { kind: 'csv_upload', label: parse.fileName } },
      );
      /* A report, not an instruction. The old toast told you what to do next
         and vanished in five seconds — and stated the dependency backwards,
         since the image slots a release owes are a function of a promise date
         that is a function of this import. */
      showToast(
        plan && plan.fulfilments.length > 1
          ? `${release.title} created — ${plural(plan.create.length, 'order')} in ${plural(
              plan.fulfilments.length,
              'batch',
              'batches',
            )}`
          : `${release.title} created — ${plural(plan?.create.length ?? 0, 'order')}`,
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

  return (
    <OrderIntakeDialog
      open={open}
      title="New release"
      onClose={close}
      onRead={onRead}
      parse={parse ? { fileName: parse.fileName } : null}
      primary={{
        label: `Create release & add ${plural(plan?.create.length ?? 0, 'order')}`,
        onClick: () => void save(),
        disabled: saving || why !== undefined,
        why: saving ? 'Creating…' : why,
      }}
      secondary={{ label: 'Back', onClick: () => setParse(null) }}
    >
      {parse && plan ? (
        <>
          {clash ? (
            <Bar tone="fail" title={`“${clash.lineItemTitle}” is already claimed`}>
              {clash.releaseTitle} — {plural(clash.orderCount, 'order')}. Add these orders to it
              instead.
              <button
                type="button"
                className="rd-inline-pill"
                onClick={() => {
                  navigate(`/releases/${clash.releaseId}`);
                  close();
                }}
              >
                Open {clash.releaseTitle}
              </button>
            </Bar>
          ) : artists.length > 1 ? (
            <Bar tone="fail" title="Two artists are ticked">
              {twoArtists[0]?.name} and{' '}
              {twoArtists.find((a) => a.artistCode === artists[1])?.name}. A release is one
              artist — create one, then add the other from its own page.
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
              note="from the file"
              suggested
            />
            <div className="rd-fieldrow">
              <Field
                label="Artist"
                value={artist}
                onChange={setArtist}
                note="required — not in the export"
                noteNear={!artist.trim()}
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

          <div className="rd-grouphd">Emails this release sends</div>
          {/* In a column, in `.rd-fields` — `.rd-sw` is an inline-flex button,
              so outside a column container four of them run together on one
              line and the four states cannot be read down. */}
          <div className="rd-fields">
          {OPTIONAL_MILESTONES[productKind].map((ref) => {
            const on = milestones.includes(ref);
            return (
              <button
                key={ref}
                type="button"
                role="switch"
                aria-checked={on}
                className={on ? 'rd-sw on' : 'rd-sw'}
                onClick={() =>
                  setMilestones((prev) =>
                    prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref],
                  )
                }
              >
                <span className="rd-swlab" style={{ flex: 1, textAlign: 'left' }}>
                  {TEMPLATE_LABELS[ref]}
                </span>
                <span className="rd-swt" aria-hidden>
                  <span className="rd-swk" />
                </span>
              </button>
            );
          })}
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
      ) : null}
    </OrderIntakeDialog>
  );
}
