import { useState } from 'react';
import type { ReactElement } from 'react';
import type { AllocationImportSummary, Release } from '../types';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Bar, Facts } from '../ui/rd';
import { CsvImportDialog } from './CsvImportDialog';
import { ImportIssues } from './ImportIssues';

/**
 * Import the warehouse edition-allocation sheet (order number, print, frame
 * spec, edition number). Junk rows above the header are skipped; re-running
 * with a fresher sheet replaces each matched order's allocation.
 */
export function AllocationImportModal({
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
  const [summary, setSummary] = useState<AllocationImportSummary | null>(null);

  const run = async (csv: string): Promise<boolean> => {
    try {
      const result = await data.importAllocations(release.id, csv);
      setSummary(result);
      if (result.matchedOrders > 0) onImported();
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
      return false;
    }
  };

  return (
    <CsvImportDialog
      open={open}
      title={`Allocation — ${release.title}`}
      fileHint="Allocation sheet — CSV"
      wrongFile="Not a CSV"
      onClose={onClose}
      onRun={run}
      onReset={() => setSummary(null)}
      summary={
        summary ? (
          <>
            <div className="rd-after-t">
              {plural(summary.matchedOrders, 'order')} matched from{' '}
              {plural(summary.rowsParsed, 'sheet row')}
            </div>
            <Facts
              items={[
                { label: 'Orders matched', value: summary.matchedOrders },
                { label: 'Allocation rows', value: summary.allocationsApplied },
                { label: 'Still unallocated', value: summary.ordersWithoutAllocation },
                { label: 'Unmatched on sheet', value: summary.unmatchedOrderNumbers.length },
              ]}
            />
            {summary.unmatchedOrderNumbers.length > 0 ? (
              <Bar tone="note" title="Not found here">
                {summary.unmatchedOrderNumbers.slice(0, 8).join(', ')}
                {summary.unmatchedOrderNumbers.length > 8 ? ', …' : ''}
              </Bar>
            ) : null}
            <ImportIssues issues={summary.issues} />
          </>
        ) : null
      }
    />
  );
}
