import type { ReconciliationRow } from '../../api';
import { downloadBlob, paymentMethodLabels, toExportRecords, type ExportRecord } from './types';

export type ReconciliationExportContext = {
  startDate:string;
  endDate:string;
  handledByName:string;
};

const MONEY_FORMAT = '"TWD" #,##0';
const COUNT_FORMAT = '#,##0" 筆"';
const HEADER_COLOR = 'FF1E293B';
const HEADER_TEXT_COLOR = 'FFFFFFFF';
const ACCENT_COLOR = 'FF0F766E';
const STRIPE_COLOR = 'FFF1F5F9';
const exportColumns:{ header:keyof ExportRecord; key:keyof ExportRecord; minimum:number; maximum:number }[] = [
  { header:'交易編號', key:'交易編號', minimum:14, maximum:18 },
  { header:'預約編號', key:'預約編號', minimum:14, maximum:18 },
  { header:'交易日期時間', key:'交易日期時間', minimum:20, maximum:24 },
  { header:'結帳狀態', key:'結帳狀態', minimum:12, maximum:16 },
  { header:'客戶姓名', key:'客戶姓名', minimum:14, maximum:24 },
  { header:'聯絡電話', key:'聯絡電話', minimum:16, maximum:22 },
  { header:'服務／商品項目明細', key:'服務／商品項目明細', minimum:24, maximum:52 },
  { header:'原始金額', key:'原始金額', minimum:16, maximum:20 },
  { header:'折扣／優惠折抵', key:'折扣／優惠折抵', minimum:18, maximum:22 },
  { header:'最終實收金額', key:'最終實收金額', minimum:18, maximum:22 },
  { header:'付款方式', key:'付款方式', minimum:14, maximum:18 },
  { header:'經手設計師／服務人員', key:'經手設計師／服務人員', minimum:22, maximum:32 },
  { header:'備註', key:'備註', minimum:16, maximum:40 },
];

const safeText = (value:string|number):string|number => typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
const textLength = (value:unknown) => Array.from(String(value ?? '')).reduce((length, character) => length + (character.charCodeAt(0) <= 255 ? 1 : 2), 0);

export async function exportReconciliationXlsx(
  rows:ReconciliationRow[],
  filename:string,
  context:ReconciliationExportContext,
):Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'Salon Management System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const originalTotal = rows.reduce((sum, row) => sum + row.original_amount, 0);
  const discountTotal = rows.reduce((sum, row) => sum + row.discount_amount, 0);
  const finalTotal = rows.reduce((sum, row) => sum + row.final_amount, 0);
  const generatedAt = new Intl.DateTimeFormat('zh-TW', {
    timeZone:'Asia/Taipei', dateStyle:'medium', timeStyle:'medium',
  }).format(new Date());

  const summary = workbook.addWorksheet('對帳摘要', { views:[{ showGridLines:false }] });
  summary.columns = [{ width:24 }, { width:22 }, { width:22 }, { width:22 }];
  summary.mergeCells('A1:D1');
  const title = summary.getCell('A1');
  title.value = '對帳摘要 Reconciliation Summary (TWD)';
  title.font = { bold:true, size:20, color:{ argb:HEADER_TEXT_COLOR } };
  title.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:HEADER_COLOR } };
  title.alignment = { vertical:'middle', horizontal:'left' };
  summary.getRow(1).height = 36;

  const information = [
    ['匯出日期區間', `${context.startDate} ～ ${context.endDate}`],
    ['報表產生時間', generatedAt],
    ['經手人', context.handledByName],
    ['報表幣別', 'TWD'],
  ];
  information.forEach(([label, value], index) => {
    const row = summary.getRow(index + 3);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold:true, color:{ argb:'FF475569' } };
    summary.mergeCells(index + 3, 2, index + 3, 4);
    row.getCell(2).value = safeText(value);
  });

  const metrics = [
    ['總營業額', originalTotal, MONEY_FORMAT],
    ['總折抵', discountTotal, MONEY_FORMAT],
    ['實際淨收入', finalTotal, MONEY_FORMAT],
    ['總交易筆數', rows.length, COUNT_FORMAT],
  ] as const;
  metrics.forEach(([label, value, numberFormat], index) => {
    const column = index + 1;
    const labelCell = summary.getRow(7).getCell(column);
    const valueCell = summary.getRow(8).getCell(column);
    labelCell.value = label;
    labelCell.font = { bold:true, color:{ argb:HEADER_TEXT_COLOR } };
    labelCell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:ACCENT_COLOR } };
    labelCell.alignment = { horizontal:'center' };
    valueCell.value = value;
    valueCell.numFmt = numberFormat;
    valueCell.font = { bold:true, size:15, color:{ argb:HEADER_COLOR } };
    valueCell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFECFDF5' } };
    valueCell.alignment = { horizontal:'right' };
    valueCell.border = { bottom:{ style:'medium', color:{ argb:ACCENT_COLOR } } };
  });
  summary.getRow(7).height = 24;
  summary.getRow(8).height = 30;

  summary.getCell('A11').value = '付款方式拆解';
  summary.getCell('A11').font = { bold:true, size:14, color:{ argb:HEADER_COLOR } };
  const paymentHeader = summary.getRow(12);
  ['付款方式', '交易筆數', '實收小計'].forEach((value, index) => { paymentHeader.getCell(index + 1).value = value; });
  paymentHeader.eachCell(cell => {
    cell.font = { bold:true, color:{ argb:HEADER_TEXT_COLOR } };
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:HEADER_COLOR } };
    cell.alignment = { horizontal:'center' };
  });
  (Object.entries(paymentMethodLabels) as [ReconciliationRow['payment_method'],string][]).forEach(([method, label], index) => {
    const matching = rows.filter(row => row.payment_method === method);
    const paymentRow = summary.getRow(index + 13);
    paymentRow.values = [label, matching.length, matching.reduce((sum, row) => sum + row.final_amount, 0)];
    paymentRow.getCell(1).alignment = { horizontal:'left' };
    paymentRow.getCell(2).numFmt = COUNT_FORMAT;
    paymentRow.getCell(2).alignment = { horizontal:'right' };
    paymentRow.getCell(3).numFmt = MONEY_FORMAT;
    paymentRow.getCell(3).alignment = { horizontal:'right' };
    if (index % 2 === 1) paymentRow.eachCell(cell => { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:STRIPE_COLOR } }; });
  });

  const records = toExportRecords(rows).map(record => Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, safeText(value)]),
  ));
  const transactions = workbook.addWorksheet('交易明細', {
    views:[{ state:'frozen', ySplit:1, activeCell:'A2', showGridLines:false }],
  });
  transactions.columns = exportColumns.map(column => ({ header:column.header, key:column.key, width:column.minimum }));
  transactions.addRows(records);
  transactions.autoFilter = { from:'A1', to:`M${Math.max(1, rows.length + 1)}` };

  const headerRow = transactions.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell(cell => {
    cell.font = { bold:true, color:{ argb:HEADER_TEXT_COLOR } };
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:HEADER_COLOR } };
    cell.alignment = { horizontal:'center', vertical:'middle' };
    cell.border = { bottom:{ style:'medium', color:{ argb:ACCENT_COLOR } } };
  });

  for (let rowNumber = 2; rowNumber <= rows.length + 1; rowNumber += 1) {
    const row = transactions.getRow(rowNumber);
    row.alignment = { vertical:'top', wrapText:true };
    if (rowNumber % 2 === 1) row.eachCell(cell => { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:STRIPE_COLOR } }; });
    [1, 2, 3, 4, 11].forEach(column => { row.getCell(column).alignment = { horizontal:'center', vertical:'top', wrapText:true }; });
    [5, 6, 7, 12, 13].forEach(column => { row.getCell(column).alignment = { horizontal:'left', vertical:'top', wrapText:true }; });
    [8, 9, 10].forEach(column => {
      row.getCell(column).numFmt = MONEY_FORMAT;
      row.getCell(column).alignment = { horizontal:'right', vertical:'top' };
    });
  }

  exportColumns.forEach((definition, index) => {
    const values = [definition.header, ...records.map(record => {
      const value = record[definition.key];
      return typeof value === 'number' ? `TWD ${value.toLocaleString('en-US')}` : value;
    })];
    const longest = Math.max(...values.map(textLength));
    transactions.getColumn(index + 1).width = Math.min(definition.maximum, Math.max(definition.minimum, longest + 4));
  });

  const totalRowNumber = rows.length + 2;
  const totalRow = transactions.getRow(totalRowNumber);
  totalRow.getCell(1).value = `合計 (共 ${rows.length} 筆)`;
  totalRow.getCell(8).value = { formula:`SUM(H2:H${rows.length + 1})`, result:originalTotal };
  totalRow.getCell(9).value = { formula:`SUM(I2:I${rows.length + 1})`, result:discountTotal };
  totalRow.getCell(10).value = { formula:`SUM(J2:J${rows.length + 1})`, result:finalTotal };
  totalRow.font = { bold:true, color:{ argb:HEADER_COLOR } };
  totalRow.height = 26;
  totalRow.eachCell({ includeEmpty:true }, cell => {
    cell.border = {
      top:{ style:'medium', color:{ argb:HEADER_COLOR } },
      bottom:{ style:'double', color:{ argb:HEADER_COLOR } },
    };
  });
  totalRow.getCell(1).alignment = { horizontal:'left', vertical:'middle' };
  [8, 9, 10].forEach(column => {
    totalRow.getCell(column).numFmt = MONEY_FORMAT;
    totalRow.getCell(column).alignment = { horizontal:'right', vertical:'middle' };
  });

  const output = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([output], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
}
