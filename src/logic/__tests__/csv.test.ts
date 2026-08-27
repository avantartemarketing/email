import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvWithHeader } from '../csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const text = '"Smith, Jane",said ""hi"",plain\n';
    expect(parseCsv('Name,Quote,Other\n"Smith, Jane","said ""hi""",plain')).toEqual([
      ['Name', 'Quote', 'Other'],
      ['Smith, Jane', 'said "hi"', 'plain'],
    ]);
    void text;
  });

  it('handles embedded newlines inside quotes', () => {
    expect(parseCsv('a,b\n"line1\nline2",x')).toEqual([
      ['a', 'b'],
      ['line1\nline2', 'x'],
    ]);
  });

  it('handles CRLF line endings and trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles a bare CR as a row separator', () => {
    expect(parseCsv('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops fully empty rows', () => {
    expect(parseCsv('a,b\n\n1,2\n,,\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('parseCsvWithHeader', () => {
  it('keys cells by trimmed header names', () => {
    expect(parseCsvWithHeader(' Name ,Email\n#1001,a@b.com')).toEqual([
      { Name: '#1001', Email: 'a@b.com' },
    ]);
  });

  it('pads short rows with empty strings', () => {
    expect(parseCsvWithHeader('a,b,c\n1')).toEqual([{ a: '1', b: '', c: '' }]);
  });
});
