import type { ReconciliationRow } from '../../api';

export const paymentMethodLabels = {
  cash: '現金',
  credit_card: '信用卡',
  line_pay: 'LINE Pay',
  bank_transfer: '轉帳',
} as const;

export const orderStatusLabels = { paid: '已付款', refunded: '已退款' } as const;

export type ExportRecord = {
  '交易編號': string;
  '預約編號': string;
  '交易日期時間': string;
  '結帳狀態': string;
  '客戶姓名': string;
  '聯絡電話': string;
  '服務／商品項目明細': string;
  '原始金額': number;
  '折扣／優惠折抵': number;
  '最終實收金額': number;
  '付款方式': string;
  '經手設計師／服務人員': string;
  '備註': string;
};

const taipeiDateTime = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

export function toExportRecords(rows: ReconciliationRow[]): ExportRecord[] {
  return rows.map(row => ({
    '交易編號': `ORD-${row.order_id}`,
    '預約編號': `APT-${row.appointment_id}`,
    '交易日期時間': taipeiDateTime.format(new Date(row.transaction_at)),
    '結帳狀態': orderStatusLabels[row.order_status],
    '客戶姓名': row.customer_name,
    '聯絡電話': row.customer_phone,
    '服務／商品項目明細': row.item_details.map(item => `${item.name} × ${item.quantity}`).join('；'),
    '原始金額': row.original_amount,
    '折扣／優惠折抵': row.discount_amount,
    '最終實收金額': row.final_amount,
    '付款方式': paymentMethodLabels[row.payment_method],
    '經手設計師／服務人員': row.handled_by_name,
    '備註': row.notes ?? '',
  }));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
