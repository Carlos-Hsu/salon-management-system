import React, { useState } from 'react';
import { Search, Plus, Phone, MessageSquare, FileText, Edit, Trash2 } from 'lucide-react';
import { Customer } from '../api';

interface CustomersViewProps {
  customers: Customer[];
  onCreateCustomer: (customer: Omit<Customer, 'id'>) => Promise<{ id: number }>;
  onUpdateCustomer: (customer: Customer) => Promise<void>;
  onDeleteCustomer: (id: number) => Promise<void>;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ customers, onCreateCustomer, onUpdateCustomer, onDeleteCustomer }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 表單狀態
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // 篩選顧客
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email || '');
    setNotes(customer.notes || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await onUpdateCustomer({ ...editingCustomer, name, phone, email, notes });
      } else {
        await onCreateCustomer({ name, phone, email, notes });
      }
      setShowModal(false);
    } catch {
      alert(editingCustomer ? '更新客戶失敗' : '新增客戶失敗');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('確定要永久刪除此客戶嗎？此操作會一併永久刪除所有歷史預約、消費與財務紀錄，且無法復原。')) {
      try {
        await onDeleteCustomer(id);
        setToast('客戶及其關聯歷史資料已永久刪除。');
      } catch (error) {
        alert(error instanceof Error ? `刪除客戶失敗：${error.message}` : '刪除客戶失敗');
      }
    }
  };

  return (
    <div className="customers-view" style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontWeight: 700 }}>客戶關係管理 (CRM)</h2>
        <button className="btn" style={{ width: 'auto' }} onClick={openAddModal}>
          <Plus size={18} /> 新增客戶
        </button>
      </div>

      {/* 搜尋欄 */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
        <Search size={20} style={{ color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="搜尋客戶姓名或電話..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.95rem' }}
        />
      </div>

      {/* 客戶清單 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{customer.name}</h3>
                <div>
                  <button aria-label="編輯顧客" onClick={() => openEditModal(customer)} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                    <Edit size={16} />
                  </button>
                  <button aria-label="刪除顧客" className="danger-action" onClick={() => handleDelete(customer.id!)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Phone size={14} /> {customer.phone}
              </p>
              {customer.email && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <FileText size={14} /> {customer.email}
                </p>
              )}
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                最近消費：${customer.last_spend || 0}{customer.last_visit ? ` · ${new Date(customer.last_visit).toLocaleDateString()}` : ' · 尚無完成紀錄'}
              </p>
              {customer.notes && (
                <div style={{ marginTop: '0.75rem', padding: '8px', borderRadius: '3px', backgroundColor: 'var(--bg-app)', fontSize: '0.85rem', color: 'var(--text-main)', borderLeft: '3px solid var(--service-color)' }}>
                  <strong>備註：</strong>{customer.notes}
                </div>
              )}
            </div>

            {/* 行動端快速操作捷徑 */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <a href={`tel:${customer.phone}`} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                <Phone size={14} /> 撥打電話
              </a>
              <a href={`https://line.me`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                <MessageSquare size={14} /> LINE 聯繫
              </a>
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div role="status" style={{ position: 'fixed', right: '1rem', bottom: '1rem', zIndex: 1100, maxWidth: 'min(360px, calc(100vw - 2rem))', padding: '0.9rem 1rem', borderRadius: '10px', background: 'var(--success-color)', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.2)' }}>
          {toast}
          <button aria-label="關閉通知" onClick={() => setToast(null)} style={{ marginLeft: '0.75rem', color: 'inherit', background: 'transparent', border: 0, cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      {/* 新增/編輯客戶彈窗 */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', marginBottom: 0, animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 700 }}>{editingCustomer ? '編輯客戶資料' : '建立新客戶資料'}</h3>
              <button className="btn btn-secondary" style={{ padding: '4px', borderRadius: '50%', width: 'auto' }} onClick={() => setShowModal(false)}>
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">顧客姓名</label>
                <input className="form-control" type="text" required placeholder="例如：林明美" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">手機號碼</label>
                <input className="form-control" type="tel" required placeholder="例如：0923456789" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">電子信箱 (選填)</label>
                <input className="form-control" type="email" placeholder="例如：ming@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">特殊偏好或注意事項</label>
                <textarea className="form-control" rows={3} placeholder="例：粗硬髮，喜好冷色調染髮，頭皮易敏感..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <button className="btn" type="submit">{editingCustomer ? '更新資料' : '建立客戶'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
