import { format } from 'date-fns';
import { CalendarPlus, Clock3, LockKeyhole, Phone, Plus } from 'lucide-react';
import {
  nextUp,
  todayAppointmentCount,
  todayProjectedRevenue,
  todayTimeline,
  unavailableTimes,
  weeklyAppointmentCount,
} from './dashboard-mock-data';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

const statusLabels = {
  confirmed: '已確認',
  'in-service': '服務中',
  completed: '已完成',
  locked: '不服務',
};

const currency = new Intl.NumberFormat('zh-TW', {
  maximumFractionDigits: 0,
});

export function Dashboard({ onNavigate }: DashboardProps) {
  return <section className="today-dashboard">
    <header className="today-header">
      <div>
        <p className="today-eyebrow">今日工作台</p>
        <h2>今日營運概覽</h2>
        <p>{format(new Date(), 'yyyy年M月d日')}・展示資料</p>
      </div>
      <div className="today-actions">
        <button className="dashboard-action primary" onClick={() => onNavigate('calendar')}>
          <CalendarPlus size={20} />+ 新增預約
        </button>
        <button className="dashboard-action secondary" onClick={() => onNavigate('calendar')}>
          <LockKeyhole size={19} />鎖定時段
        </button>
      </div>
    </header>

    <div className="kpi-summary" aria-label="今日營運摘要">
      <span>今日預約<strong>{todayAppointmentCount}</strong></span>
      <span>預估營收<strong>{currency.format(todayProjectedRevenue)} 元</strong></span>
      <span>本週總計<strong>{weeklyAppointmentCount}</strong></span>
    </div>

    <div className="today-layout">
      <main className="timeline-panel card">
        <div className="panel-heading">
          <div><p>今日預約</p><h3>服務時程</h3></div>
          <span className="booked-badge">今日額滿</span>
        </div>
        <button className="add-appointment-button" onClick={() => onNavigate('calendar')}>+ 新增預約</button>
        <div className="timeline-list">
          {todayTimeline.map(item => <article className={`timeline-item ${item.status}`} key={item.id}>
            <div className="timeline-time"><strong>{item.time}</strong><span>{item.endTime}</span></div>
            <div className="timeline-marker" aria-hidden="true"><i /></div>
            <div className="timeline-content">
              <div><span className="status-pill">{statusLabels[item.status]}</span><strong>{item.customer}</strong></div>
              <p>服務項目：{item.service}</p>
            </div>
            {item.price && <strong className="timeline-price">{currency.format(item.price)} 元</strong>}
          </article>)}
        </div>
      </main>

      <aside className="today-sidebar">
        <article className="next-up-card card">
          <div className="panel-heading"><div><p>{nextUp.time}</p><h3>下一位顧客</h3></div><Clock3 size={22} /></div>
          <h4>{nextUp.customer}</h4>
          <a href={`tel:${nextUp.phone?.replace(/\s/g, '')}`}><Phone size={17} />{nextUp.phone}</a>
          <dl>
            <div><dt>服務項目</dt><dd>{nextUp.service}</dd></div>
            <div><dt>顧客備註</dt><dd>{nextUp.notes}</dd></div>
          </dl>
          <button className="next-up-button" onClick={() => onNavigate('calendar')}>檢視預約詳情</button>
        </article>

        <article className="unavailable-card card">
          <div className="panel-heading">
            <div><p>不開放預約</p><h3>鎖定時段</h3></div>
            <button className="quick-add" onClick={() => onNavigate('calendar')}><Plus size={17} /> 新增時段</button>
          </div>
          <div className="unavailable-list">
            {unavailableTimes.map(item => <div key={item.id}>
              <LockKeyhole size={16} /><span><strong>{item.time}–{item.endTime}</strong><small>{item.customer}</small></span>
            </div>)}
          </div>
        </article>
      </aside>
    </div>
  </section>;
}
