import React, { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, TrendingDown, Edit, Trash2 } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { api, Transaction, TransactionItem } from '../api';

interface FinanceViewProps {
  incomeItems: TransactionItem[];
  expenseItems: TransactionItem[];
  onRefresh: () => Promise<void>;
}

export const FinanceView: React.FC<FinanceViewProps> = ({ incomeItems, expenseItems, onRefresh }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<'day' | 'week' | 'month'>('day');
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // 記錄用的表單狀態
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [itemId, setItemId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const loadTransactions = useCallback(async () => {
    let startDate, endDate;
    const now = new Date();
    if (filter === 'day') {
      startDate = format(startOfDay(now), 'yyyy-MM-dd');
      endDate = format(endOfDay(now), 'yyyy-MM-dd');
    } else if (filter === 'week') {
      startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      startDate = format(startOfMonth(now), 'yyyy-MM-dd');
      endDate = format(endOfMonth(now), 'yyyy-MM-dd');
    }
    const data = await api.getTransactions(startDate, endDate);
    setTransactions(data);
  }, [filter]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTransaction) {
      await api.updateTransaction({ ...editingTransaction, amount, notes });
    } else {
      await api.createTransaction({ type, item_id: Number(itemId), amount, notes });
    }
    setShowModal(false);
    loadTransactions();
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (confirm('確定刪除此筆記錄？')) {
      await api.deleteTransaction(id);
      loadTransactions();
      onRefresh();
    }
  };

  const openEditModal = (t: Transaction) => {
    setEditingTransaction(t);
    setType(t.type);
    setItemId(t.item_id);
    setAmount(t.amount);
    setNotes(t.notes || '');
    setShowModal(true);
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="finance-view" style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: 700 }}>收支管理</h2>
        <button className="btn" onClick={() => { setEditingTransaction(null); setShowModal(true); }}><Plus size={18} /> 新增記錄</button>
      </div>

      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        {(['day', 'week', 'month'] as const).map(f => (
          <button key={f} className={`btn ${filter === f ? '' : 'btn-secondary'}`} onClick={() => setFilter(f)} style={{ flex: 1 }}>
            {f === 'day' ? '今日' : f === 'week' ? '本週' : '本月'}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-around', fontWeight: 600 }}>
        <span>收入總計: <span style={{ color: 'var(--success-color)' }}>${totalIncome}</span></span>
        <span>支出總計: <span style={{ color: 'var(--warning-color)' }}>${totalExpense}</span></span>
        <span>淨利: <span style={{ color: totalIncome - totalExpense >= 0 ? 'var(--primary-color)' : 'var(--warning-color)' }}>${totalIncome - totalExpense}</span></span>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>類型</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>項目</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>內容</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>金額</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.5rem', color: t.type === 'income' ? 'var(--success-color)' : 'var(--warning-color)' }}>
                  {t.type === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </td>
                <td style={{ padding: '0.5rem' }}>
                    {t.itemName}
                    {t.customerName && <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>{t.customerName} - {t.serviceName}</div>}
                </td>
                <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{t.notes}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem' }}>${t.amount}</td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <button onClick={() => openEditModal(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', marginRight: '0.5rem' }}><Edit size={16} /></button>
                  <button onClick={() => handleDelete(t.id!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warning-color)' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>{editingTransaction ? '編輯記錄' : '新增記錄'}</h3>
            <form onSubmit={handleSubmit}>
              {!editingTransaction && (
                <>
                  <div className="form-group">
                    <label>類型</label>
                    <select className="form-control" value={type} onChange={e => { setType(e.target.value as 'income' | 'expense'); setItemId(''); }}>
                      <option value="income">收入</option>
                      <option value="expense">支出</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>項目</label>
                    <select className="form-control" required value={itemId} onChange={e => setItemId(Number(e.target.value))}>
                      <option value="">請選擇項目</option>
                      {(type === 'income' ? incomeItems : expenseItems).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="form-group">
                <label>金額</label>
                <input className="form-control" type="number" required value={amount} onChange={e => setAmount(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>備註</label>
                <input className="form-control" type="text" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ flex: 1 }}>取消</button>
                <button className="btn" type="submit" style={{ flex: 1 }}>儲存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
