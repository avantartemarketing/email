import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ImportSummary, Release } from '../types';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Facts } from '../ui/rd';
import { CsvImportDialog } from './CsvImportDialog';
import { ImportIssues } from './ImportIssues';

/**
 * CSV import: drop a Shopify order export (or paste its contents). Safe to
 * re-run with the same or a fresher export — dedupe is on Shopify order +
 * line item. Ends with the summary as FACTS rather than as a paragraph:
 * parsed, created, skipped, filtered, flagged, and per-row failures.
 */
export function ImportCsvModal({
  open,
  release,
  onClose,
  onImported,
}: {
  open: boolean;
  release: Release;
  onClose: () => void;
  onImported: () => void;
}): ReactElement {
  const { data, showToast } = useApp();
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const run = async (csv: string): Promise<boolean> => {
    try {
      const result = await data.importOrders(release.id, csv);
      setSummary(result);
      if (result.newOrders > 0) onImported();
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
      return false;
    }
  };

  return (
    <CsvImportDialog
      open={open}
      title={`Import orders — ${release.title}`}
      hint={
        <>
          Line items that do not belong to “{release.title}” are ignored, and re-uploading the same
          file never creates duplicates — export fresh any time to pick up new orders.
        </>
      }
      fileHint="Choose the Shopify CSV export, or drop it here"
      wrongFile="That file type is not accepted — upload the Shopify CSV export"
      onClose={onClose}
      onRun={run}
      onReset={() => setSummary(null)}
      summary={
        summary ? (
          <>
            <div className="rd-after-t">
              {plural(summary.newOrders, 'new order')} created from{' '}
              {plural(summary.rowsParsed, 'row')}
            </div>
            <Facts
              items={[
                { label: 'New orders', value: summary.newOrders },
                { label: 'Already imported', value: summary.duplicatesSkipped },
                { label: 'Other products', value: summary.filteredOut },
                { label: 'Could not import', value: summary.issues.length },
              ]}
            />
            {summary.missingEmail > 0 || summary.missingHubspotContact > 0 ? (
              <Bar tone="warn">
                <b>Some orders cannot receive email yet.</b>{' '}
                {summary.missingEmail > 0
                  ? `${plural(summary.missingEmail, 'order')} with no email address. `
                  : ''}
                {summary.missingHubspotContact > 0
                  ? `${plural(summary.missingHubspotContact, 'order')} with no matching HubSpot contact.`
                  : ''}{' '}
                They are flagged in the order list until fixed in HubSpot.
              </Bar>
            ) : null}
            <ImportIssues issues={summary.issues} />
          </>
        ) : null
      }
    />
  );
}
