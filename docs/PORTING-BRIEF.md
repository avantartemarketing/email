# Porting this app off Polaris and onto Workbench-rd

Read `.claude/skills/workbench-rd/SKILL.md` and `docs/workbench-rd/TOKEN-RULINGS.md`
before you touch a screen. This file is only the local contract: what the kit
lives at in THIS repo, what the app already wraps, and the shapes to copy.

The job is **transplantation, not interpretation**. Every screen keeps exactly
the behaviour it has today — same props, same exported names, same data calls,
same states. Only the view layer changes.

## Where things are

| | |
|---|---|
| `src/rd/css/tokens.css` | the kit's values. The only file allowed a literal. |
| `src/rd/css/redesign.css` | the kit's 65-section vocabulary. |
| `src/rd/css/app.css` | this product's own layer — rail, dialogue furniture, toast, the email artifact. Same rules: no literals. |
| `src/rd/components/`, `src/rd/lib/` | the kit's 21 components and 6 hooks, untouched. |
| `src/ui/rd.tsx` | **this app's primitives.** Reuse before writing anything. |
| `src/ui/format.tsx` | the pills and tags this app puts on a state. |
| `src/ui/useColumns.tsx` | show/hide columns, remembered, on the kit's `ColumnsMenu`. |
| `docs/workbench-rd/` | the rulings, with the arguments attached. |

## The rules that are not negotiable

- **Never type a value at the point of use.** No hex, no px, no `font:` — not
  in CSS, not in a `style=` prop. If the value you need is not a token, add it
  to `src/rd/css/tokens.css`, **named**, with the role it plays. `node
  checks/prove-tokens.mjs` fails the build otherwise. (Layout-only `style={{
  flex: 1 }}` and `display: 'contents'` are not values in this sense and are
  fine; a size or a colour is.)
- **Reuse before writing.** `src/ui/rd.tsx` first, then `src/rd/components/`.
  A second Dialog, a second pill, a second empty state is how two screens start
  disagreeing.
- **Colour never carries meaning alone**, and the SHAPE carries a distinction
  the colour does not: a pill (999px) is a **status**, a state that changes over
  time; a tag (6px, soft fill, no border) is a **category**, a fixed taxonomy
  value. Use `Pill` / `Tag` from `src/ui/rd.tsx` — never a bare class.
- **Rank comes from ink, then size. Weight is for the answer.** Nothing is bold
  below body size.
- **No two-line cells.** Tom's standing rule from round 2, and the kit's own:
  every field is its own column, and a column that would wrap gets `.rd-cap` or
  gets split. Rows are 34px and stay 34px.
- **A caption earns its place by changing what someone does next.** Tom has
  already had two removed. Do not reintroduce explanatory sentences.

## The primitives (`src/ui/rd.tsx`)

```tsx
<Page title tag? facts? actions? back?>          // the screen: title row, facts line, work
<Stack>                                           // cards down a page at one gap
<Card className?>  <CardHead title actions?>  <Foot>
<KV rows={[{k, v}]} />                            // a record's facts
<Pill tone="green|amber|blue|red|violet|grey">    // a STATUS
<Tag tone="slate|violet|moss|clay|stone|teal|sand|plum|steel">  // a CATEGORY
<None />                                          // the muted dash for an empty cell
<Btn kind="pri|chip|grey|link|link-danger|link-mut" small? disabled? onClick>
<RowAct danger? onClick>                          // a quiet action at a row's end
<CellLink onClick>                                // a word in a cell that opens something
<Bar tone="warn|fail|note">
<Facts items={[{label, value}]} />                // a dialogue's read-only context
<Dialog open title size="sm|md|lg" onClose primary? secondary? danger?>
<Empty>  <Skeleton rows? />
```

`useCrumb(name)` from `src/ui/AppContext` names the record in the shell's path.
A list screen does not call it; a record screen calls it with the record's name.

## A table, in full

Auto layout (`rd-fit`) — columns sized by their contents, the surplus going to
the right of them, and `.rd-scroll` carrying the overflow. Never declare a
column width.

```tsx
const cols = useColumns('orders', [
  { id: 'order', title: 'Order', locked: true },
  { id: 'collector', title: 'Collector' },
  { id: 'glass', title: 'Glass', defaultHidden: true },
  { id: 'count', title: 'Editions', n: true },     // n = a figure column
  { id: 'actions', title: '', locked: true },
]);

<Card>
  <CardHead title="Orders" actions={cols.menu} />
  <div className="rd-scroll">
    <table className="rd-t rd-t27 rd-fit rd-tpad">
      <thead><tr>{cols.head}</tr></thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td className="rd-prose" colSpan={cols.count}>Nothing here yet.</td></tr>
        ) : rows.map((r) => (
          <tr key={r.id} className="rd-rowlink" onClick={() => open(r)}>
            <td className="rd-ink">{r.name}</td>
            {cols.show('collector') ? <td>{r.collector}</td> : null}
            {cols.show('glass') ? <td>{r.glass ?? <None />}</td> : null}
            {cols.show('count') ? <td className="n">{r.count}</td> : null}
            <td><div className="rd-rowacts"><RowAct onClick={…}>Edit</RowAct></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  <Foot>{plural(rows.length, 'order')}</Foot>
</Card>
```

Cell vocabulary: `rd-ink` is the identity column (darker, 500); `rd-mut` is a
row that is present but not live; `className="n"` is a figure column, on the
`th` **and** the `td` both — a heading that disagrees with its figures is a
heading nobody can use to find them. `<span className="rd-cap">` caps a long
value at 27 characters and wraps inside the cap.

### A table whose rows can be ticked

Add `rd-tsel` to the table, a locked first column for the gutter, and
`usePicked` + `RowTick` + `BulkBar` + `useGridPin` from `src/rd/components/`.
The bar **replaces** the header row rather than stacking above it (ruling 9),
so ticking a box moves nothing:

```tsx
const picked = usePicked();
const pin = useGridPin(picked.size > 0);

<table className="rd-t rd-t27 rd-fit rd-tpad rd-tsel" ref={pin.ref} style={pin.style}>
  {pin.cols}
  <thead>
    {picked.size > 0 ? (
      <BulkBar count={picked.size} columns={cols.count + 1}
               actions={[{ label: 'Change delivery date', onClick: … }]} />
    ) : (
      <tr><th aria-hidden /> {cols.head}</tr>
    )}
  </thead>
  <tbody>
    {rows.map((r) => (
      <tr key={r.id}>
        <td><RowTick id={r.id} on={picked.has(r.id)} label={r.name} onPress={picked.press} /></td>
        …
      </tr>
    ))}
  </tbody>
</table>
```

## Other shapes

**Tabs** — `src/rd/components/Tabs.tsx`, `<Tabs tabs={[{key,label}]} value onPick label="…" />`.

**A menu on a chip** — `src/rd/components/Menu.tsx`. It portals, so it works
from inside a table's scrollport, which is the reason not to hand-roll one.

**A form field** — `src/rd/components/Field.tsx`: the label lives inside the
field and floats when it fills. Wrap several in `<div className="rd-fields">`,
side-by-side ones in `<div className="rd-fieldrow">`. A date is
`<Field label="…"><input type="date" id={id} … /></Field>` with `controlId`
passed, or the field's own input where free text is right.

**A select** — `src/rd/components/Picker.tsx`, or a `Menu` where the list is
short and the choice is an action.

## Finishing a screen

1. `npx tsc -b` clean.
2. `node checks/prove-tokens.mjs` and `node checks/prove-kit.mjs` clean.
3. **Render it and LOOK at it.** An unseen screen is a divergent screen — the
   single most expensive rule here to skip. The integrator does this pass for
   the whole app, but say in your report what you could not verify.
