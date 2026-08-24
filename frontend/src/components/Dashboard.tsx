import {
  addDays,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import {
  CalendarDays,
  CalendarPlus,
  Clock3,
  Coffee,
  LockKeyhole,
  Phone,
  Plus,
} from 'lucide-react';
import type { Appointment, AppointmentStatus, BlockTime, Customer } from '../api';

interface DashboardProps {
  appointments: Appointment[];
  blocks: BlockTime[];
  customers: Customer[];
  isLoading: boolean;
  onNavigate: (tab: string) => void;
}

const statusDisplay: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: '待確認', className: 'confirmed' },
  confirmed: { label: '已確認', className: 'confirmed' },
  in_service: { label: '服務中', className: 'in-service' },
  completed: { label: '已完成', className: 'completed' },
  cancelled: { label: '已取消', className: 'locked' },
};

const currency = new Intl.NumberFormat('zh-TW', {
  maximumFractionDigits: 0,
});

function appointmentAmount(appointment: Appointment): number {
  return appointment.total_amount ?? appointment.price ?? 0;
}

export function Dashboard({ appointments, blocks, customers, isLoading, onNavigate }: DashboardProps) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const weekInterval = {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };
  const isToday = (timestamp: string) => {
    const time = new Date(timestamp).getTime();
    return time >= todayStart.getTime() && time < tomorrowStart.getTime();
  };

  const activeAppointments = appointments.filter(appointment => appointment.status !== 'cancelled');
  const todayAppointments = activeAppointments
    .filter(appointment => isToday(appointment.start_time))
    .sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime());
  const todayProjectedRevenue = todayAppointments.reduce(
    (total, appointment) => total + appointmentAmount(appointment),
    0,
  );
  const weeklyAppointmentCount = activeAppointments.filter(appointment =>
    isWithinInterval(new Date(appointment.start_time), weekInterval),
  ).length;
  const todayBlocks = blocks
    .filter(block => {
      const start = new Date(block.start_time).getTime();
      const end = new Date(block.end_time).getTime();
      return start < tomorrowStart.getTime() && end > todayStart.getTime();
    })
    .sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime());
  const nextAppointment = todayAppointments.find(appointment => {
    const endTime = new Date(appointment.end_time ?? appointment.start_time).getTime();
    return appointment.status !== 'completed' && endTime > now.getTime();
  });
  const nextCustomer = nextAppointment
    ? customers.find(customer => customer.id === nextAppointment.customer_id)
    : undefined;
  const hasTodayAppointments = todayAppointments.length > 0;

  return <section className="today-dashboard">
    <header className="today-header">
      <div>
        <p className="today-eyebrow">今日工作台</p>
        <h2>今日營運概覽</h2>
        <p>{format(now, 'yyyy年M月d日')}・即時行程</p>
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

    <div className="kpi-summary" aria-label="今日營運摘要" aria-busy={isLoading}>
      <span>今日預約<strong>{isLoading ? '—' : `${todayAppointments.length} 筆`}</strong></span>
      <span>預估營收<strong>{isLoading ? '—' : `${currency.format(todayProjectedRevenue)} 元`}</strong></span>
      <span>本週總計<strong>{isLoading ? '—' : `${weeklyAppointmentCount} 筆`}</strong></span>
    </div>

    <div className="today-layout">
      <main className="timeline-panel card">
        <div className="panel-heading">
          <div><p>今日預約</p><h3>服務時程</h3></div>
          {!isLoading && hasTodayAppointments && <span className="booked-badge">{todayAppointments.length} 筆預約</span>}
        </div>

        {isLoading ? (
          <div className="dashboard-empty-state dashboard-loading" role="status">正在同步今日行程…</div>
        ) : hasTodayAppointments ? (<>
          <button className="add-appointment-button" onClick={() => onNavigate('calendar')}>+ 新增預約</button>
          <div className="timeline-list">
            {todayAppointments.map(appointment => {
              const display = statusDisplay[appointment.status];
              const amount = appointmentAmount(appointment);
              return <article className={`timeline-item ${display.className}`} key={appointment.id ?? appointment.start_time}>
                <div className="timeline-time">
                  <strong>{format(new Date(appointment.start_time), 'HH:mm')}</strong>
                  <span>{appointment.end_time ? format(new Date(appointment.end_time), 'HH:mm') : '—'}</span>
                </div>
                <div className="timeline-marker" aria-hidden="true"><i /></div>
                <div className="timeline-content">
                  <div><span className="status-pill">{display.label}</span><strong>{appointment.customerName ?? '未命名顧客'}</strong></div>
                  <p>服務項目：{appointment.service_name ?? appointment.service ?? '未指定服務'}</p>
                </div>
                <strong className="timeline-price">{currency.format(amount)} 元</strong>
              </article>;
            })}
          </div>
        </>) : (
          <div className="dashboard-empty-state">
            <div className="dashboard-empty-icon" aria-hidden="true"><CalendarDays size={30} /><Coffee size={20} /></div>
            <h3>今日尚無預約</h3>
            <p>今天沒有排定的服務，點擊上方按鈕為顧客新增預約，或享受放鬆的一天！</p>
            <button className="dashboard-empty-cta" onClick={() => onNavigate('calendar')}>
              <CalendarPlus size={19} />+ 新增今日預約
            </button>
          </div>
        )}
      </main>

      <aside className="today-sidebar">
        <article className={`next-up-card card${!nextAppointment ? ' next-up-empty' : ''}`}>
          {isLoading ? (
            <div className="next-up-empty-content" role="status"><Clock3 size={24} /><h3>正在載入下一筆行程…</h3></div>
          ) : nextAppointment ? (<>
            <div className="panel-heading">
              <div><p>{format(new Date(nextAppointment.start_time), 'HH:mm')}</p><h3>下一位顧客</h3></div>
              <Clock3 size={22} />
            </div>
            <h4>{nextAppointment.customerName ?? nextCustomer?.name ?? '未命名顧客'}</h4>
            {nextCustomer?.phone && <a href={`tel:${nextCustomer.phone.replace(/\s/g, '')}`}><Phone size={17} />{nextCustomer.phone}</a>}
            <dl>
              <div><dt>服務項目</dt><dd>{nextAppointment.service_name ?? nextAppointment.service ?? '未指定服務'}</dd></div>
              <div><dt>顧客備註</dt><dd>{nextAppointment.notes || nextCustomer?.notes || '無特別備註'}</dd></div>
            </dl>
            <button className="next-up-button" onClick={() => onNavigate('calendar')}>檢視預約詳情</button>
          </>) : (
            <div className="next-up-empty-content">
              <Coffee size={28} aria-hidden="true" />
              <p>下一位顧客</p>
              <h3>今日無後續行程</h3>
              <span>目前沒有等待服務的顧客。</span>
            </div>
          )}
        </article>

        <article className="unavailable-card card">
          <div className="panel-heading">
            <div><p>不開放預約</p><h3>鎖定時段</h3></div>
            <button className="quick-add" onClick={() => onNavigate('calendar')}><Plus size={17} /> 新增時段</button>
          </div>
          <div className="unavailable-list">
            {todayBlocks.length > 0 ? todayBlocks.map(block => <div key={block.id ?? block.start_time}>
              <LockKeyhole size={16} />
              <span>
                <strong>{format(new Date(block.start_time), 'HH:mm')}–{format(new Date(block.end_time), 'HH:mm')}</strong>
                <small>{block.reason || '鎖定時段'}</small>
              </span>
            </div>) : <p className="unavailable-empty">今日無鎖定時段</p>}
          </div>
        </article>
      </aside>
    </div>
  </section>;
}
