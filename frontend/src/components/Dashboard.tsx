import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Users, DollarSign, ArrowUpRight, TrendingUp } from 'lucide-react';
import { DashboardStats } from '../api';

interface DashboardProps {
  stats: DashboardStats;
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, onNavigate }) => {
  return (
    <div className="dashboard-view" style={{ animation: 'fadeIn 0.5s ease' }}>
      <h2 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>營運概覽</h2>

      {/* 統計卡片網格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {/* 卡片 1 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>今日預約</p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{stats.todayAppointments} 筆</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <TrendingUp size={12} /> 穩定預約中
            </span>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: '#eefcfb', color: 'var(--success-color)' }}>
            <Calendar size={24} />
          </div>
        </div>

        {/* 卡片 2 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>今日預估營業額</p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>${stats.todayRevenue}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <ArrowUpRight size={12} /> 業績穩健成長
            </span>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: '#fdf0ed', color: 'var(--accent-color)' }}>
            <DollarSign size={24} />
          </div>
        </div>

        {/* 卡片 3 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>累計客戶數</p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0' }}>{stats.totalCustomers} 人</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <TrendingUp size={12} /> 顧客關係良好
            </span>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'var(--secondary-color)', color: 'var(--primary-color)' }}>
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* 快速捷徑卡片 */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>快速操作</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button className="btn" onClick={() => onNavigate('calendar')}>
            前往預約行事曆
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('customers')}>
            查看顧客名單
          </button>
        </div>
      </div>
    </div>
  );
};
