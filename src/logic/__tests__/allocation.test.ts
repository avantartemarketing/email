import { describe, expect, it } from 'vitest';
import {
  allocationOrderKey,
  describeAllocationSpec,
  parseEditionAllocationCsv,
} from '../allocation';

// A faithful miniature of the real warehouse sheet export: formula junk above
// the header, a blank leading column, framed and print-only rows, a repeated
// order (multi-print set), and an artist's proof.
const SHEET = `,,#REF!,0,0,TRUE,,,,Mismatches:,0
,,,0,0,TRUE,,,,,All multi-print orders have consistent edition numbers
,,,0,0,TRUE,,,,,
,Order Number,Print Name,Fulfilment,Frame Finish,Glass,Mounting Type,Set_Size,Edition No.,,
,#76415,La Maison de Monet,Framed,BLACK,Museum-grade acrylic,FLOAT,4,1,,
,#76415,A Moment's Pleasure #2,Framed,BLACK,Museum-grade acrylic,FLOAT,4,1,,
,#76041,La Maison de Monet,Print Only,,,,4,15,,
,#75192,Girlfriends and Lovers,Framed,DARK BROWN,UV-protective acrylic,FLOAT,,AP,,
`;

describe('parseEditionAllocationCsv', () => {
  const result = parseEditionAllocationCsv(SHEET);

  it('finds the header below the junk rows and parses every data row', () => {
    expect(result.issues).toEqual([]);
    expect(result.rowsParsed).toBe(4);
    expect(result.rows).toHaveLength(4);
  });

  it('reads the full framed spec', () => {
    const row = result.rows[0];
    expect(row.orderNumber).toBe('#76415');
    expect(row.allocation).toEqual({
      printName: 'La Maison de Monet',
      fulfilment: 'Framed',
      frameFinish: 'BLACK',
      glass: 'Museum-grade acrylic',
      mountingType: 'FLOAT',
      setSize: 4,
      editionNumber: '1',
    });
  });

  it('keeps a multi-print order as separate rows sharing the order number', () => {
    const rows = result.rows.filter((r) => r.orderNumber === '#76415');
    expect(rows.map((r) => r.allocation.printName)).toEqual([
      'La Maison de Monet',
      "A Moment's Pleasure #2",
    ]);
  });

  it('leaves framing fields null for print-only rows', () => {
    const row = result.rows.find((r) => r.orderNumber === '#76041')!;
    expect(row.allocation.fulfilment).toBe('Print Only');
    expect(row.allocation.frameFinish).toBeNull();
    expect(row.allocation.glass).toBeNull();
    expect(row.allocation.mountingType).toBeNull();
  });

  it('keeps non-numeric edition numbers like artist proofs as text', () => {
    const row = result.rows.find((r) => r.orderNumber === '#75192')!;
    expect(row.allocation.editionNumber).toBe('AP');
    expect(row.allocation.setSize).toBeNull();
  });

  it('rejects a file with no recognisable header', () => {
    const bad = parseEditionAllocationCsv('Name,Email\n#1,x@example.com\n');
    expect(bad.rows).toEqual([]);
    expect(bad.issues[0].reason).toMatch(/edition allocation sheet/i);
  });

  it('reports rows missing an order number', () => {
    const withGap = parseEditionAllocationCsv(
      ',Order Number,Print Name,Fulfilment,Frame Finish,Glass,Mounting Type,Set_Size,Edition No.\n,,Orphan Print,Framed,BLACK,,,1,9\n',
    );
    expect(withGap.rows).toEqual([]);
    expect(withGap.issues).toHaveLength(1);
    expect(withGap.issues[0].reason).toMatch(/no order number/);
  });
});

describe('allocationOrderKey', () => {
  it('matches with and without the leading #, case-insensitively', () => {
    expect(allocationOrderKey('#AA10412')).toBe(allocationOrderKey('aa10412'));
  });
});

describe('describeAllocationSpec', () => {
  it('summarises a framed spec', () => {
    expect(
      describeAllocationSpec({
        printName: 'X',
        fulfilment: 'Framed',
        frameFinish: 'BLACK',
        glass: 'Museum-grade acrylic',
        mountingType: 'FLOAT',
        setSize: 1,
        editionNumber: '1',
      }),
    ).toBe('Framed · BLACK · Museum-grade acrylic · FLOAT');
  });

  it('passes print-only through untouched', () => {
    expect(
      describeAllocationSpec({
        printName: 'X',
        fulfilment: 'Print Only',
        frameFinish: null,
        glass: null,
        mountingType: null,
        setSize: 2,
        editionNumber: '4',
      }),
    ).toBe('Print Only');
  });
});
