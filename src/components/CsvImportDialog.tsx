import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useApp } from '../ui/AppContext';
import { Dialog } from '../ui/rd';
import Field from '../rd/components/Field';

/**
 * Take a CSV — dropped, chosen or pasted — run it, then report what happened.
 *
 * Both importers in this app are this dialogue with different words and a
 * different summary, so it is written once: two copies would be two chances to
 * word "re-importing is safe" differently, and the second one would be the one
 * nobody updates. The caller owns the run and the summary; everything about
 * choosing a file is here.
 *
 * The file box is the kit's own — the dashed edge this system uses for
 * "nothing here yet", with the input covering the box so the whole block is
 * the target.
 */
export function CsvImportDialog({
  open,
  title,
  hint,
  fileHint,
  wrongFile,
  onClose,
  onRun,
  summary,
  onReset,
}: {
  open: boolean;
  title: string;
  /** One line: what this sheet is and what re-importing does. */
  hint: ReactNode;
  fileHint: string;
  wrongFile: string;
  onClose: () => void;
  /** Runs the import. Returns true when there is now a summary to show. */
  onRun: (csv: string) => Promise<boolean>;
  /** What the run produced, rendered by the caller. Null before a run. */
  summary: ReactNode | null;
  onReset: () => void;
}): ReactElement {
  const { showToast } = useApp();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [pasted, setPasted] = useState('');
  const [importing, setImporting] = useState(false);

  const effectiveCsv = csvText || pasted;

  const reset = () => {
    setFileName(null);
    setCsvText('');
    setPasted('');
    onReset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const run = async () => {
    setImporting(true);
    try {
      await onRun(effectiveCsv);
    } finally {
      setImporting(false);
    }
  };

  const take = async (file: File | undefined) => {
    if (!file) {
      showToast(wrongFile, true);
      return;
    }
    setFileName(file.name);
    setCsvText(await file.text());
    onReset();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      primary={
        summary
          ? { label: 'Done', onClick: close }
          : {
              label: 'Import',
              onClick: () => void run(),
              disabled: importing || !effectiveCsv.trim(),
            }
      }
      secondary={
        summary
          ? { label: 'Import another file', onClick: reset }
          : { label: 'Cancel', onClick: close }
      }
    >
      {summary ?? (
        <>
          <p>{hint}</p>
          <label className="rd-importdrop">
            {fileName ? `Replace ${fileName}` : fileHint}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void take(e.target.files?.[0])}
            />
          </label>
          {csvText ? null : (
            <div className="rd-fields">
              <Field
                label="Or paste the CSV contents"
                value={pasted}
                onChange={setPasted}
                multiline
                deep
              />
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
