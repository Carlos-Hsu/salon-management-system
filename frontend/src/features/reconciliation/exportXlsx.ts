import type { ReconciliationRow } from '../../api';
import { downloadBlob, toExportRecords } from './types';

const protectSpreadsheetValue = (value: unknown) => typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

export async function exportReconciliationXlsx(rows: ReconciliationRow[], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const records = toExportRecords(rows).map(record => Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, protectSpreadsheetValue(value)]),
  ));
  const worksheet = XLSX.utils.json_to_sheet(records);
  worksheet['!cols'] = [14, 14, 22, 12, 16, 18, 48, 14, 18, 18, 14, 24, 30].map(width => ({ width }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '對帳單');
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
  downloadBlob(new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
}
