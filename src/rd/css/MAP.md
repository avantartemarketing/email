# What is in `redesign.css`, section by section

65 sections, and every one of them is the system's own vocabulary.

This file was cut down from a working admin's stylesheet, which is where the
reasoning in the comments comes from. Forty-five sections that were one
screen's own rules — a warehouse planner, a send calendar, a stock sheet —
were removed; what survives is the part any admin needs. A handful of rules
that belonged to a deleted screen but are worn by a component in
`components/` were lifted out first and sit under the last heading below.

Two habits are worth keeping if you cut it further:

- **A section boundary is not a rule boundary.** Component vocabulary is
  scattered under screen-named headings, and the first pass of this cut took
  the Picker's whole stylesheet out with a screen that happened to house it.
  `node checks/prove-kit.mjs` is what caught it.
- **Then look at the render.** The cut also took `.rd-head`'s own flex rule,
  leaving three rules that merely MENTION it, so every class-level check still
  passed while the page's primary button dropped below its title. Only the
  picture knew. `checks/prove-example.mjs` now measures that one.

| Lines | Section |
|---|---|
|    1–29   | the file's own preamble — why the `rd-` prefix exists |
|   30–47   | Page head |
|   48–83   | Two tables, one screen |
|   84–127  | Controls |
|  128–155  | Bands |
|  156–211  | Card and its parts |
|  212–460  | Table |
|  461–562  | Toolbar |
|  563–634  | the view controls (item 1) |
|  635–686  | switch |
|  687–761  | the reason on hover |
|  762–772  | the wide screens stop at 1600 |
|  773–801  | a field's own footnote |
|  802–857  | segmented toggle |
|  858–918  | tabs (ruling 96) |
|  919–987  | record cards |
|  988–1030 | naming a group of fields inside a card |
| 1031–1079 | activity |
| 1080–1301 | form fields |
| 1302–1538 | expandable counts |
| 1539–1611 | floating menu |
| 1612–1647 | KPI band |
| 1648–1655 | Section head with a qualifier |
| 1656–1671 | Status lozenge |
| 1672–1791 | the category tag |
| 1792–1812 | Failure band, inside a panel |
| 1813–1814 | The wide analysis table (`t27`) |
| 1815–1988 | Item 3: columns sized by their contents |
| 1989–2027 | Meter |
| 2028–2118 | Figures that carry a grade |
| 2119–2224 | Grouped list |
| 2225–2257 | Search |
| 2258–2311 | Bulk action bar |
| 2312–2362 | dialogue |
| 2363–2549 | Sections: one bounded group per section |
| 2550–2627 | the flag on a country column (ruling 13) |
| 2628–2728 | group bands (ruling 14) |
| 2729–2750 | a record that is one column of cards |
| 2751–2897 | The one chart shape (ruling 15) |
| 2898–3085 | A cell that OPENS rather than takes a figure |
| 3086–3146 | Ruling 19: the column seam |
| 3147–3198 | Loading |
| 3199–3313 | The chart's hover readout |
| 3314–3410 | The date-range calendar |
| 3411–3453 | A dialogue's facts, and its consequence |
| 3454–3500 | leaving a record with typing on it |
| 3501–3575 | A picker inside a table cell |
| 3576–3644 | ruling 25: the Orders dot tally |
| 3645–3694 | 88b · The tick draws, the box fills |
| 3695–3740 | 86b · Segmented fills slide and resize |
| 3741–3771 | 88d · Menu items arrive in order |
| 3772–3831 | 85b · Overlays grow from what opened them |
| 3832–3873 | 88a · The floating label rises |
| 3874–3891 | 84d · Copy flashes where the value is |
| 3892–3907 | 85e · The bulk bar cross-fades in place |
| 3908–3946 | 86a · The active dot travels |
| 3947–3974 | §0 · The pointer exception |
| 3975–3987 | the filler column |
| 3988–4055 | 89h · A group band pins under the header and hands over |
| 4056–4126 | A header's action row is one height, and reads as one |
| 4127–4235 | picking, rather than typing |
| 4236–4288 | every dialogue is a sheet on a phone |
| 4289–4366 | the shell on a phone |
| 4367–4501 | The shell, 27 Aug 2026: the rail goes to the top |
| 4502–4604 | Ruling 95: if it acts, it says so |
| 4605–4744 | vocabulary that outlived the screens it was drawn for |
