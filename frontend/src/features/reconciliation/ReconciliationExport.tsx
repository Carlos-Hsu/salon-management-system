import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { endOfMonth, endOfYear, format, startOfMonth, startOfQuarter, startOfYear, subMonths, subYears } from 'date-fns';
import { api, type OrderStatus, type PaymentMethod, type ReconciliationFilters, type ReconciliationStaff } from '../../api';
import { paymentMethodLabels } from './types';

type ExportFormat = 'csv' | 'xlsx';
type DatePreset = { id:string; label:string; startDate:string; endDate:string };
const dateValue = (date:Date) => format(date, 'yyyy-MM-dd');

function createDatePresets(today:Date):DatePreset[] {
  const lastMonth = subMonths(today, 1);
  const lastYear = subYears(today, 1);
  return [
    { id:'this-month', label:'本月', startDate:dateValue(startOfMonth(today)), endDate:dateValue(today) },
    { id:'last-month', label:'上個月', startDate:dateValue(startOfMonth(lastMonth)), endDate:dateValue(endOfMonth(lastMonth)) },
    { id:'this-quarter', label:'本季', startDate:dateValue(startOfQuarter(today)), endDate:dateValue(today) },
    { id:'last-six-months', label:'近半年', startDate:dateValue(startOfMonth(subMonths(today, 6))), endDate:dateValue(today) },
    { id:'year-to-date', label:'今年至今', startDate:dateValue(startOfYear(today)), endDate:dateValue(today) },
    { id:'last-year', label:'去年全年', startDate:dateValue(startOfYear(lastYear)), endDate:dateValue(endOfYear(lastYear)) },
  ];
}

export function ReconciliationExport() {
  const presets = useMemo(() => createDatePresets(new Date()), []);
  const [filters, setFilters] = useState<ReconciliationFilters>({
    startDate: presets[0].startDate,
    endDate: presets[0].endDate,
  });
  const [staff, setStaff] = useState<ReconciliationStaff[]>([]);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    api.getReconciliationStaff()
      .then(setStaff)
      .catch(error => {
        setIsError(true);
        setMessage(error instanceof Error ? error.message : '經手人員清單載入失敗。');
      });
  }, []);

  const update = (patch: Partial<ReconciliationFilters>) => setFilters(current => ({ ...current, ...patch }));
  const applyPreset = (preset:DatePreset) => {
    update({ startDate:preset.startDate, endDate:preset.endDate });
    setIsError(false);
    setMessage(`已套用「${preset.label}」日期區間。`);
  };

  const exportReport = async (exportFormat: ExportFormat) => {
    setMessage('');
    setIsError(false);
    if (!filters.startDate || !filters.endDate || filters.startDate > filters.endDate) {
      setIsError(true);
      setMessage('請選擇有效的開始與結束日期。');
      return;
    }
    setExporting(exportFormat);
    try {
      const rows = await api.getReconciliationReport(filters);
      if (!rows.length) {
        setMessage('此篩選條件沒有可匯出的結帳資料。');
        return;
      }
      const filename = `對帳單_${filters.startDate}_${filters.endDate}`;
      if (exportFormat === 'csv') {
        const { exportReconciliationCsv } = await import('./exportCsv');
        exportReconciliationCsv(rows, filename);
      } else {
        const { exportReconciliationXlsx } = await import('./exportXlsx');
        await exportReconciliationXlsx(rows, filename);
      }
      setMessage(`已匯出 ${rows.length} 筆對帳資料。`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : '對帳單匯出失敗。');
    } finally {
      setExporting(null);
    }
  };

  return <section className="card reconciliation-export" aria-labelledby="reconciliation-export-title">
    <div className="panel-heading reconciliation-export-heading">
      <div><FileSpreadsheet size={21} /><span><h3 id="reconciliation-export-title">匯出對帳單</h3><p>依結帳時間篩選並下載會計用 CSV 或 Excel。</p></span></div>
      {exporting && <span className="reconciliation-loading" role="status"><LoaderCircle size={17} className="spin" />正在產生對帳單…</span>}
    </div>
    <div className="reconciliation-presets" aria-label="快選報表日期區間">
      <span>快選時間</span>
      <div>{presets.map(preset => {
        const active = filters.startDate === preset.startDate && filters.endDate === preset.endDate;
        return <button key={preset.id} type="button" className={`btn btn-secondary${active ? ' tab-active' : ''}`} aria-pressed={active} onClick={() => applyPreset(preset)}>{preset.label}</button>;
      })}</div>
    </div>
    <div className="reconciliation-filters">
      <label>開始日期<input type="date" value={filters.startDate} onChange={event => update({ startDate: event.target.value })} /></label>
      <label>結束日期<input type="date" value={filters.endDate} onChange={event => update({ endDate: event.target.value })} /></label>
      <label>結帳狀態<select value={filters.status ?? ''} onChange={event => update({ status: (event.target.value || undefined) as OrderStatus | undefined })}><option value="">全部</option><option value="paid">已付款</option><option value="refunded">已退款</option></select></label>
      <label>付款方式<select value={filters.paymentMethod ?? ''} onChange={event => update({ paymentMethod: (event.target.value || undefined) as PaymentMethod | undefined })}><option value="">全部</option>{(Object.entries(paymentMethodLabels) as [PaymentMethod,string][]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>經手人員<select value={filters.handledBy ?? ''} onChange={event => update({ handledBy: event.target.value || undefined })}><option value="">全體</option>{staff.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
    </div>
    <div className="reconciliation-actions">
      <button className="btn btn-secondary" disabled={Boolean(exporting)} onClick={() => void exportReport('csv')}><Download size={17} />匯出 CSV</button>
      <button className="btn" disabled={Boolean(exporting)} onClick={() => void exportReport('xlsx')}><FileSpreadsheet size={17} />匯出 Excel</button>
    </div>
    {message && <p className={isError ? 'settings-error' : 'settings-info'} role={isError ? 'alert' : 'status'}>{message}</p>}
  </section>;
}
