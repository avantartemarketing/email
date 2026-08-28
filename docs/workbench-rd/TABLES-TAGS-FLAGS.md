# Rulings 11–13 — table density, category tags, country flags

From Design, 21 Aug 2026. Commit as an addition to `docs/TOKEN-RULINGS.md`.
Reference: turns 60 and 61 in the concept file (options 60c and 61b).
These supersede the row geometry and the "one lozenge" assumption in HANDOFF.md.

---

## 11 · Standard tables are 32px rows

Airtable's own default density, matched exactly. Applies to **every checkbox table** in the
system — every record list, every ledger, every roster.

**The cell must own the height. Do not infer height from padding.**

```css
.table td {
  box-sizing: border-box;
  height: 32px;          /* the row IS 32px; nothing else decides it */
  padding: 0 12px;       /* horizontal only */
  vertical-align: middle;
  font: 400 13px/1.2 var(--font-text);
  border-bottom: 1px solid var(--hairline-row);
}
.table th {
  box-sizing: border-box;
  height: 34px;
  padding: 0 12px;
  vertical-align: middle;
  font: 500 12px var(--font-text);
  color: #3f454e;
  border-bottom: 1px solid var(--hairline);
}
```

**Then cap the status pill, or none of the above holds:**

```css
.table td .status-pill { height: 17px; padding: 0 10px; font: 500 11px/17px var(--font-text); }
```

A status pill at its natural size is ~21px tall — taller than a 13px line box — so left alone it
props every cell open and the row lands at ~36px regardless of what the CSS says. This is not
theoretical: it is the bug that made our own first draft of this card render 46px rows while
labelled 40px. **Verify by measuring `tr.getBoundingClientRect().height` === 32, not by reading
the stylesheet.**

Unchanged: the dense sheet screens keep their own ~27px geometry —
12.5px text, 5px vertical padding. That 5px gap between 32 and 27 is what distinguishes *a list you
act on* from *a sheet you read*; do not converge them.

---

## 12 · A second lozenge shape: the category tag

The admin now has **two** lozenge shapes, and the shape carries the distinction:

| shape | radius | height | carries | example |
|---|---|---|---|---|
| **pill** | 999px | 17px in tables | **status** — a state that changes over time | Reserved, Payment due, Logged |
| **tag** | 6px | 19px | **category** — a fixed taxonomy value | Print, Freight, Storage, EUR |

```css
.tag {
  display: inline-block;
  padding: 0 9px;
  height: 19px;
  border-radius: 6px;
  font: 500 11px/19px var(--font-text);
  white-space: nowrap;
  /* soft fill, NO border */
}
```

### Tinted per value (adopted — 61b)
Each taxonomy value gets its own stable tint, so a column is scannable by colour once learned.
The word is always present inside the tag, so nothing is colour-only and a colour-blind reader
loses nothing.

**Source**
```
Storage      bg #e9eef6  ink #3f5573
Print        bg #efeaf9  ink #5b3fa8
Production   bg #eaf0ea  ink #3f6349
```

**Category** (Log, Pay, All payments, Vendors)
```
Print        bg #efeaf9  ink #5b3fa8
Freight      bg #e9eef6  ink #3f5573
Creative     bg #fdeee9  ink #a84b23
Materials    bg #eaf0ea  ink #3f6349
Software     bg #eef0f3  ink #4a515b
Banking      bg #eef0f3  ink #4a515b
```

**Currency** — one neutral tint for every currency: `bg #eef0f3  ink #4a515b`. Currency is not a
taxonomy anyone scans by colour, and tinting six currencies would spend six colours to say nothing.

New values need a token added here, not a colour picked at the call site. Tints are deliberately
lower-chroma than the status pills so a tag never reads as a state. **Never tint a tag from the
status palette**, and never let a tag be the only carrier of meaning.

### Currency splits out of Value
Money columns become pure figures with the currency in its own adjacent tag column.
**That column takes a real `Currency` header** — it is a column, not a decoration.

```
Value        Currency
793,600      [SEK]
48,160       [EUR]
```

This also fixes numeric alignment: `SEK 793,600` and `JPY 1,404,000` never aligned as text.
Amount stays the only 500-weight figure in the row.

---

## 13 · Country columns carry a flag

A 14×10px flag precedes the code or name in every Country column.

```html
<img src="/flags/se.png" width="14" height="10" alt=""
     style="border-radius:2px;vertical-align:-1px;margin-right:6px;
            box-shadow:0 0 0 .5px rgba(24,29,38,.12)">SE
```

- `alt=""` — the code beside it is the accessible label; the flag is decoration.
- The hairline shadow keeps white-heavy flags (JP, FI, DK) from dissolving into a white row.
- Source: the concept uses `flagcdn.com/w20/<iso2>.png`. **Host these locally in production** —
  do not ship a runtime dependency on a third-party CDN for a screen behind a login.
- Codes still sort alphabetically, with any "rest of" bucket last. It has no national flag; it gets a 14px spacer
  so the codes stay aligned.

---

## What to re-check after these three land

1. **Row height measured, not assumed** — 32px on every checkbox table (see the pill trap above).
2. **Column widths.** Tags are wider than bare text and Inter is wider than the old face. Pay's
   eleven columns and the widest sheet will scroll horizontally; that is specified behaviour. Confirm
   nothing *wraps*.
3. **Tag vs pill never adjacent in the same column.** If a column holds both, it is two columns.
4. **The four palettes stay separable**: status pills, category tags, language lozenges, chart
   fills. If a tag is being mistaken for a status, the tint is too saturated — lower it, do not
   change the shape.
