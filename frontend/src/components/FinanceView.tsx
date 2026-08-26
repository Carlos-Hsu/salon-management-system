import React, { useState, useEffect, useCallback } from 'react';
import { Plus, WalletCards, Banknote, Smartphone, Eye, Edit, Trash2, X } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { api, Transaction, TransactionItem } from '../api';
import { ReconciliationExport } from '../features/reconciliation/ReconciliationExport';
import { supabase } from '../lib/supabase';

interface FinanceViewProps {
  incomeItems: TransactionItem[];
  expenseItems: TransactionItem[];
  onRefresh: () => Promise<void>;
}

type ChannelFilter = 'all' | 'cash' | 'line_pay' | 'expense';

const currency = (value: number) => new Intl.NumberFormat('zh-TW', {
  style: 'currency', currency: 'TWD', maximumFractionDigits: 0,
}).format(value);

const contentBadge = (transaction: Transaction) => {
  if (transaction.type === 'income') return ({ cash:'現金', credit_card:'信用卡', line_pay:'LINE Pay', bank_transfer:'轉帳' } as const)[transaction.payment_method ?? 'cash'];
  return /髮品|藥水|耗材|進貨/.test(transaction.itemName ?? '') ? '髮品進貨' : '固定支出';
};

export const FinanceView: React.FC<FinanceViewProps> = ({ incomeItems, expenseItems, onRefresh }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'day' | 'week' | 'month'>('month');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [itemId, setItemId] = useState<number | ''>('');
  const [amount, setAmount] = useState(0);
  const [transactionDate, setTransactionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const loadTransactions = useCallback(async () => {
    let startDate: string;
    let endDate: string;
    const now = new Date();
    if (periodFilter === 'day') {
      startDate = format(startOfDay(now), 'yyyy-MM-dd');
      endDate = format(endOfDay(now), 'yyyy-MM-dd');
    } else if (periodFilter === 'week') {
      startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      const month = new Date(`${selectedMonth}-01T12:00:00`);
      startDate = format(startOfMonth(month), 'yyyy-MM-dd');
      endDate = format(endOfMonth(month), 'yyyy-MM-dd');
    }
    try {
      setTransactions(await api.getTransactions(startDate, endDate));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '收支資料載入失敗');
    }
  }, [periodFilter, selectedMonth]);

  useEffect(() => {
    void loadTransactions();
    const channel = supabase?.channel('finance-record-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_records' }, () => void loadTransactions())
      .subscribe();
    return () => { if (channel && supabase) void supabase.removeChannel(channel); };
  }, [loadTransactions]);

  const totalIncome = transactions.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = transactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const cashIncome = transactions.filter(item => item.type === 'income' && item.payment_method === 'cash').reduce((sum, item) => sum + item.amount, 0);
  const linePayIncome = transactions.filter(item => item.type === 'income' && item.payment_method === 'line_pay').reduce((sum, item) => sum + item.amount, 0);
  const visibleTransactions = transactions.filter(item => {
    if (channelFilter === 'all') return true;
    if (channelFilter === 'expense') return item.type === 'expense';
    return item.type === 'income' && item.payment_method === channelFilter;
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingTransaction) await api.updateTransaction({ ...editingTransaction, amount, notes });
      else await api.createTransaction({ type, item_id: Number(itemId), amount, date: `${transactionDate}T12:00:00+08:00`, notes });
      setShowModal(false);
      await loadTransactions();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '收支記錄儲存失敗');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定刪除此筆記錄？')) return;
    try {
      await api.deleteTransaction(id);
      await loadTransactions();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '收支記錄刪除失敗');
    }
  };

  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setType(transaction.type);
    setItemId(transaction.item_id);
    setAmount(transaction.amount);
    setTransactionDate(transaction.date ? format(new Date(transaction.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setNotes(transaction.notes ?? '');
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingTransaction(null);
    setType('expense');
    setItemId('');
    setAmount(0);
    setNotes('');
    setTransactionDate(format(new Date(), 'yyyy-MM-dd'));
    setShowModal(true);
  };

  return <div className="finance-view" style={{ animation: 'fadeIn 0.5s ease' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <div><h2 style={{ fontWeight: 800 }}>收支與打烊對帳</h2><p style={{ color: 'var(--text-muted)' }}>核對現金、LINE Pay 與工作室營運支出</p></div>
      <button className="btn" onClick={openCreateModal}><Plus size={18} /> 新增收支</button>
    </div>

    <div className="card" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
      {(['day', 'week', 'month'] as const).map(value => <button key={value} className={`btn btn-secondary ${periodFilter === value ? 'tab-active' : ''}`} onClick={() => setPeriodFilter(value)} style={{ flex: 1 }}>
        {value === 'day' ? '今日' : value === 'week' ? '本週' : '指定月份'}
      </button>)}
      {periodFilter === 'month' && <input aria-label="選擇收支月份" className="form-control" type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} style={{ minHeight: 48, flexBasis: '100%' }} />}
    </div>

    {error && <p className="settings-error" role="alert">{error}</p>}

    <section className="finance-total-grid" aria-label="收支總覽">
      <article className="card finance-total income"><span>收入總計</span><strong>{currency(totalIncome)}</strong></article>
      <article className="card finance-total expense"><span>支出總計</span><strong>{currency(totalExpense)}</strong></article>
      <article className="card finance-total profit"><span>淨利</span><strong>{currency(totalIncome - totalExpense)}</strong></article>
    </section>

    <section className="card payment-summary" aria-labelledby="payment-summary-title">
      <div className="panel-heading"><WalletCards size={20} /><h3 id="payment-summary-title">打烊支付對帳</h3></div>
      <div className="payment-summary-grid">
        <div><Banknote size={24} /><span>現金收入</span><strong>{currency(cashIncome)}</strong></div>
        <div><Smartphone size={24} /><span>LINE Pay 收入</span><strong>{currency(linePayIncome)}</strong></div>
      </div>
      <small>支付管道合計：{currency(cashIncome + linePayIncome)}{cashIncome + linePayIncome !== totalIncome ? '（尚有未分類收入）' : ''}</small>
    </section>

    <ReconciliationExport />

    <div className="card finance-channel-filter" aria-label="支付與類型篩選">
      {([['all', '全部'], ['cash', '現金'], ['line_pay', 'LINE Pay'], ['expense', '支出']] as const).map(([value, label]) =>
        <button key={value} className={`btn btn-secondary ${channelFilter === value ? 'tab-active' : ''}`} onClick={() => setChannelFilter(value)}>{label}</button>)}
    </div>

    <div className="card finance-table-wrap">
      <table className="finance-table">
        <thead><tr><th>日期</th><th>類型</th><th>項目</th><th>內容</th><th>金額</th><th>操作</th></tr></thead>
        <tbody>
          {visibleTransactions.map(transaction => <tr key={`${transaction.source ?? 'legacy'}-${transaction.id}`}>
            <td>{transaction.date ? format(new Date(transaction.date), 'MM/dd') : '—'}</td>
            <td><span className={`finance-type-badge ${transaction.type}`}>{transaction.type === 'income' ? '收入' : '支出'}</span></td>
            <td><strong>{transaction.itemName}</strong>{transaction.customerName && <small>{transaction.customerName}・{transaction.serviceName}</small>}</td>
            <td><span className={`finance-content-badge ${transaction.type === 'income' ? transaction.payment_method : 'expense'}`}>{contentBadge(transaction)}</span></td>
            <td className={`finance-amount ${transaction.type}`}>{transaction.type === 'expense' ? '−' : '+'}{currency(transaction.amount)}</td>
            <td>
              {transaction.order_id && <button className="finance-detail-button" onClick={() => setDetailTransaction(transaction)}><Eye size={16} />檢視明細</button>}
              {transaction.editable && <span className="finance-row-actions"><button aria-label="編輯收支記錄" onClick={() => openEditModal(transaction)}><Edit size={16} /></button><button aria-label="刪除收支記錄" onClick={() => handleDelete(transaction.id!)}><Trash2 size={16} /></button></span>}
            </td>
          </tr>)}
          {!visibleTransactions.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>此區間沒有符合條件的收支紀錄</td></tr>}
        </tbody>
      </table>
    </div>

    {detailTransaction && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setDetailTransaction(null); }}>
      <section className="card finance-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-detail-title">
        <button className="modal-close" aria-label="關閉明細" onClick={() => setDetailTransaction(null)}><X size={20} /></button>
        <h3 id="finance-detail-title">結帳明細</h3>
        <dl><div><dt>顧客</dt><dd>{detailTransaction.customerName ?? '—'}</dd></div><div><dt>服務</dt><dd>{detailTransaction.serviceName ?? '—'}</dd></div><div><dt>付款</dt><dd><span className={`finance-content-badge ${detailTransaction.payment_method}`}>{contentBadge(detailTransaction)}</span></dd></div></dl>
        <div className="finance-detail-items">{detailTransaction.details?.map((item, index) => <div key={`${item.item_type}-${index}`}><span>{item.name} × {item.quantity}</span><strong>{currency(item.line_amount)}</strong></div>)}</div>
        <div className="finance-detail-total"><span>實收金額</span><strong>{currency(detailTransaction.amount)}</strong></div>
      </section>
    </div>}

    {showModal && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setShowModal(false); }}>
      <section className="card finance-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-entry-title">
        <h3 id="finance-entry-title">{editingTransaction ? '編輯記錄' : '新增收支記錄'}</h3>
        <form onSubmit={handleSubmit}>
          {!editingTransaction && <><div className="form-group"><label>類型</label><select className="form-control" value={type} onChange={event => { setType(event.target.value as 'income' | 'expense'); setItemId(''); }}><option value="income">收入</option><option value="expense">支出</option></select></div><div className="form-group"><label>項目</label><select className="form-control" required value={itemId} onChange={event => setItemId(Number(event.target.value))}><option value="">請選擇項目</option>{(type === 'income' ? incomeItems : expenseItems).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="form-group"><label>日期</label><input className="form-control" type="date" required value={transactionDate} onChange={event => setTransactionDate(event.target.value)} /></div></>}
          <div className="form-group"><label>金額</label><input className="form-control" type="number" min="0" required value={amount} onChange={event => setAmount(Number(event.target.value))} /></div>
          <div className="form-group"><label>備註</label><input className="form-control" value={notes} onChange={event => setNotes(event.target.value)} /></div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}><button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ flex: 1 }}>取消</button><button className="btn" type="submit" style={{ flex: 1 }}>儲存</button></div>
        </form>
      </section>
    </div>}
  </div>;
};
