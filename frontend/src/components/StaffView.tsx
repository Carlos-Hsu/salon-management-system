import React, { useState } from 'react';
import { Plus, Edit, Trash2, User } from 'lucide-react';
import { api, Staff } from '../api';

interface StaffViewProps {
  staffList: Staff[];
  onCreateStaff: (staff: Omit<Staff, 'id'>) => Promise<void>;
  onUpdateStaff: (staff: Staff) => Promise<void>;
  onDeleteStaff: (id: number) => Promise<void>;
}

export const StaffView: React.FC<StaffViewProps> = ({ staffList, onCreateStaff, onUpdateStaff, onDeleteStaff }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaff) {
      await onUpdateStaff({ ...editingStaff, name, title });
    } else {
      await onCreateStaff({ name, title });
    }
    setShowModal(false);
    setName('');
    setTitle('');
  };

  const openAddModal = () => {
    setEditingStaff(null);
    setName('');
    setTitle('');
    setShowModal(true);
  };

  const openEditModal = (staff: Staff) => {
    setEditingStaff(staff);
    setName(staff.name);
    setTitle(staff.title || '');
    setShowModal(true);
  };

  return (
    <div className="staff-view" style={{ animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: 700 }}>設計師管理</h2>
        <button className="btn" onClick={openAddModal}><Plus size={18} /> 新增設計師</button>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>姓名</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>職稱</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                <td style={{ padding: '0.5rem' }}>{s.name}</td>
                <td style={{ padding: '0.5rem' }}>{s.title}</td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <button onClick={() => openEditModal(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', marginRight: '0.5rem' }}><Edit size={16} /></button>
                  <button onClick={() => onDeleteStaff(s.id!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>{editingStaff ? '編輯設計師' : '新增設計師'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>姓名</label>
                <input className="form-control" type="text" required value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>職稱</label>
                <input className="form-control" type="text" value={title} onChange={e => setTitle(e.target.value)} />
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
