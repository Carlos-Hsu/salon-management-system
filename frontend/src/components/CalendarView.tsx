import React, { useState } from 'react';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Plus, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { Appointment, Customer, Product } from '../api';

interface CalendarViewProps {
  appointments: Appointment[];
  customers: Customer[];
  products: Product[];
  onCreateAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<void>;
  onUpdateAppointment: (appointment: Appointment) => Promise<void>;
  onDeleteAppointment: (id: number) => Promise<void>;
  onCreateCustomer: (customer: Omit<Customer, 'id'>) => Promise<{ id: number }>;
}

// 輔助函式：取得狀態顏色
const getStatusColors = (status: string) => {
  switch (status) {
    case 'completed': return { bg: '#eefcfb', border: '#12b886' }; // 粉綠
    case 'cancelled': return { bg: '#fff0f0', border: '#ff4d4f' }; // 粉紅
    default: return { bg: '#fff9f0', border: '#fcc419' }; // 粉黃
  }
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  appointments,
  customers,
  products,
  onCreateAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  onCreateCustomer,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  // 表單狀態
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [service, setService] = useState('剪髮');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [servicePrice, setServicePrice] = useState(800); // 服務費用
  const [productPrice, setProductPrice] = useState(0);   // 產品費用
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed' | 'cancelled'>('pending');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');

  const handleProductChange = (productId: string) => {
    const id = Number(productId);
    setSelectedProductId(id);
    const product = products.find(p => p.id === id);
    setProductPrice(product ? product.price : 0);
  };

  const openAddModal = () => {
    setEditingAppointment(null);
    setCustomerName('');
    setCustomerPhone('');
    setService('剪髮');
    setStartTime('');
    setEndTime('');
    setServicePrice(800);
    setProductPrice(0);
    setNotes('');
    setStatus('pending');
    setSelectedProductId('');
    setShowModal(true);
  };

  const openEditModal = (app: Appointment) => {
    setEditingAppointment(app);
    const customer = customers.find(c => c.id === app.customer_id);
    setCustomerName(customer?.name || '');
    setCustomerPhone(customer?.phone || '');
    setService(app.service);
    setStartTime(format(new Date(app.start_time), "yyyy-MM-dd'T'HH:mm"));
    setEndTime(format(new Date(app.end_time), "yyyy-MM-dd'T'HH:mm"));
    setServicePrice(app.price);
    setProductPrice(0);
    setNotes(app.notes || '');
    setStatus(app.status || 'pending');
    setSelectedProductId('');
    setShowModal(true);
  };

  // 處理切換週期
  const nextPeriod = () => {
    setCurrentDate(addDays(currentDate, viewMode === 'month' ? 30 : viewMode === 'week' ? 7 : 1));
  };
  const prevPeriod = () => {
    setCurrentDate(addDays(currentDate, viewMode === 'month' ? -30 : viewMode === 'week' ? -7 : -1));
  };

  // 生成行事曆日期
  const getDays = () => {
    if (viewMode === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const startDayOfWeek = start.getDay(); 
      const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
      const days: Date[] = [];
      for (let i = 0; i < adjustedStartDay; i++) {
        days.push(addDays(start, -adjustedStartDay + i));
      }
      const monthDays = eachDayOfInterval({ start, end });
      return [...days, ...monthDays];
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      return [currentDate];
    }
  };

  const days = getDays();
  const timeSlots = Array.from({ length: 96 }, (_, i) => {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    return { hour, minute, label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` };
  });

  // 提交預約
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let customer = customers.find(c => c.name === customerName);
      let customerId = customer?.id;
      if (!customerId) {
        const res = await onCreateCustomer({ name: customerName, phone: customerPhone || '無' });
        customerId = res.id;
      }
      
      const formatDateTime = (dt: string) => dt.replace('T', ' ') + ':00';
      const appData = {
        customer_id: customerId!,
        service,
        start_time: formatDateTime(startTime),
        end_time: formatDateTime(endTime),
        price: servicePrice + productPrice,
        notes,
        status
      };

      if (editingAppointment) {
        await onUpdateAppointment({ ...editingAppointment, ...appData });
      } else {
        await onCreateAppointment(appData);
      }
      setShowModal(false);
    } catch (err) {
      alert('操作失敗，請再試一次');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('確定要刪除此預約嗎？')) {
      await onDeleteAppointment(id);
      setShowModal(false);
    }
  };

  return (
    <div className="calendar-view" style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontWeight: 700 }}>預約行事曆</h2>
        <button className="btn" style={{ width: 'auto' }} onClick={openAddModal}>
          <Plus size={18} /> 新增預約
        </button>
      </div>

      {/* 控制列 */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={prevPeriod}><ChevronLeft size={20} /></button>
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {format(currentDate, viewMode === 'month' ? 'yyyy年 MM月' : 'yyyy年 MM月 dd日', { locale: zhTW })}
          </span>
          <button className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={nextPeriod}><ChevronRight size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f3f5', padding: '4px', borderRadius: '8px' }}>
          {['month', 'week', 'day'].map((mode) => (
            <button
              key={mode}
              className="btn"
              style={{
                padding: '0.4rem 1rem',
                fontSize: '0.85rem',
                backgroundColor: viewMode === mode ? 'var(--primary-color)' : 'transparent',
                color: viewMode === mode ? '#ffffff' : 'var(--text-main)',
                width: 'auto',
                boxShadow: 'none'
              }}
              onClick={() => setViewMode(mode as any)}
            >
              {mode === 'month' ? '月' : mode === 'week' ? '週' : '日'}
            </button>
          ))}
        </div>
      </div>

      {/* 日曆網格 */}
      <div className="card" style={{ padding: '0.5rem' }}>
        {viewMode === 'day' ? (
          <div style={{ height: '600px', overflowY: 'auto' }}>
            {timeSlots.map((slot, idx) => {
              const showPeriodHeader = slot.hour === 12 && slot.minute === 0;
              const slotApps = appointments.filter(app => {
                const start = new Date(app.start_time);
                return isSameDay(start, currentDate) && 
                       start.getHours() === slot.hour && 
                       Math.floor(start.getMinutes() / 15) * 15 === slot.minute;
              });
              
              return (
                <React.Fragment key={idx}>
                  {showPeriodHeader && (
                    <div style={{ padding: '0.5rem', backgroundColor: '#f8f9fa', fontWeight: 600, fontSize: '0.8rem', color: 'var(--primary-color)', borderBottom: '1px solid #eee' }}>
                      下午時段
                    </div>
                  )}
                  {slot.hour === 0 && slot.minute === 0 && (
                     <div style={{ padding: '0.5rem', backgroundColor: '#f8f9fa', fontWeight: 600, fontSize: '0.8rem', color: 'var(--primary-color)', borderBottom: '1px solid #eee' }}>
                      上午時段
                    </div>
                  )}
                  <div style={{ display: 'flex', borderBottom: '1px solid #eee', minHeight: '30px' }}>
                    <div style={{ width: '50px', borderRight: '1px solid #eee', padding: '0.2rem', fontSize: '0.7rem', color: '#888' }}>
                      {slot.label}
                    </div>
                    <div style={{ flex: 1, padding: '0.1rem' }}>
                      {slotApps.map(app => {
                        const colors = getStatusColors(app.status || 'pending');
                        return (
                          <div key={app.id} onClick={() => openEditModal(app)} style={{
                            backgroundColor: colors.bg,
                            color: 'var(--text-main)',
                            padding: '0.1rem 0.5rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            borderLeft: `3px solid ${colors.border}`
                          }}>
                            {format(new Date(app.start_time), 'HH:mm')} {app.customerName} - {app.service}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginTop: '4px' }}>
              {days.map((day, idx) => {
                const dayApps = appointments.filter(app => isSameDay(new Date(app.start_time), day));
                return (
                  <div key={idx} style={{
                    minHeight: '80px',
                    border: '1px solid #f1f3f5',
                    borderRadius: '8px',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: isSameDay(day, new Date()) ? 'var(--secondary-color)' : 'transparent',
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSameDay(day, new Date()) ? 'var(--primary-color)' : 'inherit', marginBottom: '4px' }}>
                      {format(day, 'd')}
                    </span>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {dayApps.map((app, appIdx) => {
                        const colors = getStatusColors(app.status || 'pending');
                        return (
                          <div key={appIdx} onClick={() => openEditModal(app)} style={{
                            backgroundColor: colors.bg,
                            color: 'var(--text-main)',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            borderLeft: `3px solid ${colors.border}`
                          }}>
                            {format(new Date(app.start_time), 'HH:mm')} {app.customerName || '客戶'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 預約彈窗 */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', marginBottom: 0, animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 700 }}>{editingAppointment ? '修改預約' : '快速預約登記'}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {editingAppointment && <button className="btn btn-secondary" style={{ padding: '4px', borderRadius: '50%', color: '#ff4d4f' }} onClick={() => handleDelete(editingAppointment.id!)}><Trash2 size={20} /></button>}
                <button className="btn btn-secondary" style={{ padding: '4px', borderRadius: '50%' }} onClick={() => setShowModal(false)}><X size={20} /></button>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">顧客姓名</label>
                <select className="form-control" required value={customerName} onChange={e => setCustomerName(e.target.value)}>
                  <option value="">請選擇顧客</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.phone})</option>
                  ))}
                  <option value="__NEW__">+ 新增顧客</option>
                </select>
                {customerName === '__NEW__' && (
                    <input className="form-control" style={{marginTop: '0.5rem'}} type="text" required placeholder="輸入新顧客姓名" onChange={e => setCustomerName(e.target.value)} />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">選擇產品 (自動帶入價格)</label>
                <select className="form-control" value={selectedProductId} onChange={e => handleProductChange(e.target.value)}>
                  <option value="">自行輸入服務</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">服務項目</label>
                <input className="form-control" type="text" required value={service} onChange={e => setService(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">開始時間</label>
                  <input className="form-control" type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">結束時間</label>
                  <input className="form-control" type="datetime-local" required value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">總金額 ($)</label>
                <input className="form-control" type="number" readOnly value={servicePrice + productPrice} />
              </div>
              <div className="form-group">
                <label className="form-label">狀態</label>
                <select className="form-control" value={status} onChange={e => setStatus(e.target.value as any)}>
                  <option value="pending">預約中</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} style={{ flex: 1 }}>取消</button>
                <button className="btn" type="submit" style={{ flex: 1 }}>{editingAppointment ? '儲存修改' : '確認預約'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
