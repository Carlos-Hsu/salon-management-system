import type { ReconciliationRow } from '../../api';
import { downloadBlob, toExportRecords } from './types';

const protectSpreadsheetCell = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
const csvCell = (value: string | number) => {
  const text = typeof value === 'string' ? protectSpreadsheetCell(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export function exportReconciliationCsv(rows: ReconciliationRow[], filename: string): void {
  const records = toExportRecords(rows);
  const headers = Object.keys(records[0]) as (keyof typeof records[number])[];
  const lines = [headers.map(csvCell).join(','), ...records.map(record => headers.map(header => csvCell(record[header])).join(','))];
  downloadBlob(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}
