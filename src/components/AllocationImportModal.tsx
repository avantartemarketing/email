import {
  Banner,
  BlockStack,
  DropZone,
  List,
  Modal,
  Text,
  TextField,
} from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { AllocationImportSummary, Release } from '../types';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';

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
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [pasted, setPasted] = useState('');
  const [summary, setSummary] = useState<AllocationImportSummary | null>(null);
  const [importing, setImporting] = useState(false);

  const effectiveCsv = csvText || pasted;

  const reset = () => {
    setFileName(null);
    setCsvText('');
    setPasted('');
    setSummary(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const result = await data.importAllocations(release.id, effectiveCsv);
      setSummary(result);
      if (result.matchedOrders > 0) onImported();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = async (_dropped: File[], accepted: File[]) => {
    const file = accepted[0];
    if (!file) {
      showToast('That file type is not accepted — upload the allocation sheet as CSV', true);
      return;
    }
    setFileName(file.name);
    setCsvText(await file.text());
    setSummary(null);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Import warehouse allocation — ${release.title}`}
      primaryAction={
        summary
          ? { content: 'Done', onAction: close }
          : {
              content: 'Import',
              onAction: () => void runImport(),
              loading: importing,
              disabled: !effectiveCsv.trim(),
            }
      }
      secondaryActions={
        summary
          ? [{ content: 'Import another file', onAction: reset }]
          : [{ content: 'Cancel', onAction: close }]
      }
    >
      <Modal.Section>
        {summary ? (
          <BlockStack gap="400">
            <Banner
              tone={summary.matchedOrders > 0 ? 'success' : 'warning'}
              title={`${plural(summary.matchedOrders, 'order')} matched from ${plural(summary.rowsParsed, 'sheet row')}`}
            >
              <List>
                <List.Item>
                  {plural(summary.allocationsApplied, 'allocation row')} applied (print, frame
                  spec, edition number)
                </List.Item>
                {summary.ordersWithoutAllocation > 0 ? (
                  <List.Item>
                    {plural(summary.ordersWithoutAllocation, 'active order')} still without
                    allocation — not on the sheet yet
                  </List.Item>
                ) : null}
                {summary.unmatchedOrderNumbers.length > 0 ? (
                  <List.Item>
                    {plural(summary.unmatchedOrderNumbers.length, 'sheet order number')} with no
                    matching order here: {summary.unmatchedOrderNumbers.slice(0, 8).join(', ')}
                    {summary.unmatchedOrderNumbers.length > 8 ? ', …' : ''}
                  </List.Item>
                ) : null}
              </List>
            </Banner>
            {summary.issues.length > 0 ? (
              <Banner tone="critical" title={`${plural(summary.issues.length, 'row')} could not be read`}>
                <List>
                  {summary.issues.map((issue, idx) => (
                    <List.Item key={idx}>
                      Row {issue.row}: {issue.reason}
                    </List.Item>
                  ))}
                </List>
              </Banner>
            ) : null}
          </BlockStack>
        ) : (
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              Upload the warehouse edition allocation sheet as CSV. The validation rows above the
              header are skipped automatically, and re-importing a fresher sheet replaces what's
              here — the sheet stays the warehouse's source of truth.
            </Text>
            <DropZone accept=".csv,text/csv" allowMultiple={false} onDrop={handleDrop}>
              {fileName ? (
                <DropZone.FileUpload actionTitle={`Replace ${fileName}`} />
              ) : (
                <DropZone.FileUpload actionTitle="Add CSV" actionHint="or drop the sheet export here" />
              )}
            </DropZone>
            {!csvText ? (
              <TextField
                label="Or paste the CSV contents"
                value={pasted}
                onChange={setPasted}
                multiline={6}
                autoComplete="off"
                monospaced
              />
            ) : (
              <Banner tone="info" title={`${fileName} ready to import`} />
            )}
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
}
