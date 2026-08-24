import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Bell,
  CalendarDays,
  Clock3,
  Copy,
  CreditCard,
  Database,
  Scissors,
  Settings2,
  Store,
  Trash2,
} from 'lucide-react';
import { api, type Service } from '../api';
import { SettingsAccessGate, type SettingsAccess } from './SettingsAccessGate';

type SettingsTab = 'general' | 'services' | 'notifications';
type SurchargeType = 'none' | 'percent' | 'fixed';
type PaymentMethod = 'cash' | 'line_pay';
type ServiceDraft = Pick<Service, 'id' | 'name' | 'duration_minutes' | 'price' | 'active'>;

type LocalPreferences = {
  storeName: string;
  openingTime: string;
  closingTime: string;
  defaultPayment: PaymentMethod;
  reminderEnabled: boolean;
  reminderHours: number;
  autoBackup: boolean;
};

const PREFERENCES_KEY = 'salon-settings-preferences';
const currency = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });

const defaultPreferences: LocalPreferences = {
  storeName: '我的美髮工作室',
  openingTime: '10:00',
  closingTime: '20:00',
  defaultPayment: 'cash',
  reminderEnabled: true,
  reminderHours: 24,
  autoBackup: false,
};

const tabs: { id: SettingsTab; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: '基本設定', icon: Settings2 },
  { id: 'services', label: '服務項目管理', icon: Scissors },
  { id: 'notifications', label: '通知與備份', icon: Bell },
];

function loadPreferences(): LocalPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? { ...defaultPreferences, ...JSON.parse(stored) as Partial<LocalPreferences> } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function SettingsContent({ services, onRefresh, access }: { services: Service[]; onRefresh(): Promise<void>; access: SettingsAccess }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [preferences, setPreferences] = useState<LocalPreferences>(loadPreferences);
  const [surchargeType, setSurchargeType] = useState<SurchargeType>('none');
  const [surchargeValue, setSurchargeValue] = useState(0);
  const [previewAmount, setPreviewAmount] = useState(1000);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, ServiceDraft>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState('');
  const [basicMessage, setBasicMessage] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const savingRef = useRef(new Set<number>());
  const queuedSaveRef = useRef(new Map<number, ServiceDraft>());

  useEffect(() => {
    api.getSystemSettings()
      .then(setting => {
        setPreferences({ storeName:setting.storeName, openingTime:setting.openingTime, closingTime:setting.closingTime, defaultPayment:setting.defaultPayment, reminderEnabled:setting.reminderEnabled, reminderHours:setting.reminderHours, autoBackup:setting.autoBackup });
        setSurchargeType(setting.surchargeType);
        setSurchargeValue(setting.surchargeValue);
      })
      .catch(error => setBasicMessage(error instanceof Error ? error.message : '系統設定載入失敗。'));
  }, []);
  useEffect(() => { setDrafts(Object.fromEntries(services.map(service => [service.id, { ...service }]))); }, [services]);

  const updatePreferences = (patch: Partial<LocalPreferences>) => {
    setPreferences(current => ({ ...current, ...patch }));
  };

  const parsedPreviewAmount = Number(previewAmount);
  const parsedSurchargeValue = Number(surchargeValue);
  const normalizedPreviewAmount = Number.isFinite(parsedPreviewAmount) ? Math.max(0, Math.round(parsedPreviewAmount)) : 0;
  const normalizedSurchargeValue = Number.isFinite(parsedSurchargeValue) ? Math.max(0, Math.round(parsedSurchargeValue)) : 0;
  const previewSurcharge = surchargeType === 'percent'
    ? Math.round(normalizedPreviewAmount * normalizedSurchargeValue / 100)
    : surchargeType === 'fixed'
      ? normalizedSurchargeValue
      : 0;
  const previewTotal = normalizedPreviewAmount + previewSurcharge;
  const surchargeModeLabel = surchargeType === 'percent'
    ? `比例 +${normalizedSurchargeValue}%`
    : surchargeType === 'fixed'
      ? `固定 +$${currency.format(normalizedSurchargeValue)}`
      : '不加價';

  const saveBasicSettings = async () => {
    setBasicMessage('');
    if (!preferences.storeName.trim()) { setBasicMessage('店家名稱不可空白。'); return; }
    if (preferences.openingTime >= preferences.closingTime) { setBasicMessage('結束營業時間必須晚於開始時間。'); return; }
    try {
      const normalizedPreferences = { ...preferences, storeName: preferences.storeName.trim() };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalizedPreferences));
      await api.updateSystemSettings({ ...normalizedPreferences, surchargeType, surchargeValue:Math.max(0,Math.round(surchargeValue)) });
      setBasicMessage('基本設定已儲存。');
    } catch (error) {
      setBasicMessage(error instanceof Error ? error.message : '基本設定儲存失敗。');
    }
  };

  const saveNotificationSettings = async () => {
    setBackupMessage('');
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      await api.updateSystemSettings({ ...preferences, surchargeType, surchargeValue });
      setBackupMessage('通知與備份偏好已儲存。');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : '通知與備份設定儲存失敗。');
    }
  };

  const exportBackup = async () => {
    setBackupMessage('正在整理備份資料…');
    try {
      const [customers, currentServices, products, appointments, blocks, transactions] = await Promise.all([
        api.getCustomers(), api.getServices(), api.getProducts(), api.getAppointments(), api.getBlocks(), api.getTransactions(),
      ]);
      const payload = { exportedAt: new Date().toISOString(), customers, services: currentServices, products, appointments, blocks, transactions };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `salon-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupMessage('備份 JSON 已下載。請妥善保管顧客資料。');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : '備份匯出失敗。');
    }
  };

  const updateDraft = (id: number, patch: Partial<ServiceDraft>) => {
    setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const saveService = async (draft: ServiceDraft) => {
    if (savingRef.current.has(draft.id)) { queuedSaveRef.current.set(draft.id, draft); return; }
    const normalized = { ...draft, name: draft.name.trim(), duration_minutes: Math.max(15, Math.round(draft.duration_minutes)), price: Math.max(0, Math.round(draft.price)), active: draft.active ? 1 as const : 0 as const };
    if (!normalized.name) { setMessage('服務名稱不可空白。'); return; }
    updateDraft(draft.id, normalized);
    savingRef.current.add(draft.id);
    setSaving(new Set(savingRef.current));
    setMessage('');
    try {
      await api.updateService(normalized);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '服務儲存失敗，請稍後再試。');
    } finally {
      savingRef.current.delete(draft.id);
      setSaving(new Set(savingRef.current));
      const queued = queuedSaveRef.current.get(draft.id);
      if (queued) { queuedSaveRef.current.delete(draft.id); void saveService(queued); }
    }
  };

  const onCellKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
  };

  const duplicateService = async (service: ServiceDraft) => {
    const baseName = service.name.replace(/（副本(?: \d+)?）$/, '');
    let copyName = `${baseName}（副本）`;
    let number = 2;
    while (services.some(item => item.name === copyName)) copyName = `${baseName}（副本 ${number++}）`;
    setMessage('');
    try {
      await api.createService({ name: copyName, duration_minutes: service.duration_minutes, price: service.price });
      await onRefresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : '複製服務失敗。'); }
  };

  const deleteService = async (service: ServiceDraft) => {
    if (!window.confirm(`確定永久刪除「${service.name}」？已有預約紀錄的服務無法刪除。`)) return;
    setMessage('');
    try {
      await api.deleteService(service.id);
      await onRefresh();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '刪除服務失敗。';
      setMessage(`${detail}${detail.includes('停用') ? '' : ' 若需保留歷史紀錄，請改為停用。'}`);
    }
  };

  return <section className="settings-shell">
    <header className="settings-header">
      <div><p>系統管理</p><h2>設定</h2><span>集中管理工作室營運、服務項目與資料安全。</span></div>
    </header>

    <div className="settings-tabs" role="tablist" aria-label="設定分類">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`settings-panel-${tab.id}`}
          className={activeTab === tab.id ? 'active' : ''}
          onClick={() => setActiveTab(tab.id)}
        ><Icon size={18} />{tab.label}</button>;
      })}
    </div>

    {activeTab === 'general' && <div id="settings-panel-general" role="tabpanel" className="settings-panel">
      {!access.canManage && <p className="settings-readonly-notice">PIN 模式為唯讀；請登入 super_admin 帳號以儲存變更。</p>}
      <fieldset disabled={!access.canManage} className="settings-panel-fieldset settings-general-grid">
      <article className="card settings-section-card">
        <div className="settings-card-heading"><Store size={21} /><div><h3>店家資訊</h3><p>顯示於系統與日後通知內容中的基本資料。</p></div></div>
        <label>店家名稱<input value={preferences.storeName} onChange={event => updatePreferences({ storeName: event.target.value })} /></label>
        <div className="settings-inline-fields">
          <label><Clock3 size={16} />開始營業<input type="time" value={preferences.openingTime} onChange={event => updatePreferences({ openingTime: event.target.value })} /></label>
          <label><Clock3 size={16} />結束營業<input type="time" value={preferences.closingTime} onChange={event => updatePreferences({ closingTime: event.target.value })} /></label>
        </div>
        <label><CreditCard size={16} />預設付款方式<select value={preferences.defaultPayment} onChange={event => updatePreferences({ defaultPayment: event.target.value as PaymentMethod })}><option value="cash">現金</option><option value="line_pay">LINE Pay</option></select></label>
      </article>

      <article className="card settings-section-card surcharge-card">
        <div className="settings-card-heading"><CalendarDays size={21} /><div><h3>假日加價規則</h3><p>設定新預約未指定個別加價時採用的預設規則。</p></div></div>
        <div className="settings-rule-note">
          <strong>適用方式</strong>
          <p>可依工作室政策指定週六、週日或國定假日，自動加收固定金額或服務金額比例；個別預約仍可另外調整。</p>
        </div>
        <div className="settings-inline-fields">
          <label>加價方式<select aria-label="假日加價方式" value={surchargeType} onChange={event => setSurchargeType(event.target.value as SurchargeType)}><option value="none">不加價</option><option value="percent">依比例加收</option><option value="fixed">固定金額</option></select></label>
          <label>加價數值<span className="input-with-unit"><input aria-label="假日加價數值" type="number" min="0" disabled={surchargeType === 'none'} value={surchargeValue} onChange={event => setSurchargeValue(Number(event.target.value))}/><small>{surchargeType === 'percent' ? '%' : 'NT$'}</small></span></label>
        </div>
        <p className="settings-field-help">比例以整數百分比計算；固定金額以新台幣元計算。選擇「不加價」時數值不會套用。</p>
        <div className={`surcharge-preview mode-${surchargeType}`}>
          <div className="surcharge-preview-heading">
            <div><strong>即時試算預覽</strong><span>調整原價、方式或數值，結果會立即更新。</span></div>
            <span className="surcharge-preview-badge">{surchargeModeLabel}</span>
          </div>
          <label>試算原價（NT$）
            <input type="number" min="0" step="100" value={previewAmount} onChange={event => setPreviewAmount(Number(event.target.value))} />
          </label>
          <output className="surcharge-preview-result" aria-live="polite">
            <span><small>原價</small><strong>${currency.format(normalizedPreviewAmount)}</strong></span>
            <i aria-hidden="true">➔</i>
            <span className="surcharge-preview-total"><small>最終收取</small><strong>${currency.format(previewTotal)}</strong></span>
            <em>加價 +${currency.format(previewSurcharge)}</em>
          </output>
        </div>
      </article>

      <div className="settings-save-row">
        {basicMessage && <p className={basicMessage.includes('已儲存') ? 'settings-success' : 'settings-error'} role="status">{basicMessage}</p>}
        <button className="btn" type="button" onClick={() => void saveBasicSettings()}>儲存基本設定</button>
      </div>
      </fieldset>
    </div>}

    {activeTab === 'services' && <div id="settings-panel-services" role="tabpanel" className="settings-panel">
      {!access.canManage && <p className="settings-readonly-notice">PIN 模式為唯讀；服務新增、修改與刪除受 Supabase RLS 保護。</p>}
      <fieldset disabled={!access.canManage} className="settings-panel-fieldset">
      <div className="card service-settings">
        <div className="settings-card-heading"><Scissors size={21} /><div><h3>服務項目與定價</h3><p>欄位離開焦點或按 Enter 即儲存；停用服務仍會保留歷史紀錄。</p></div></div>
        {message && <p className="settings-error" role="alert">{message}</p>}
        <div className="service-table-wrap">
          <table className="service-table">
            <thead><tr><th>服務名稱</th><th>所需時長（分鐘）</th><th>預設價格（NT$）</th><th>快速操作</th></tr></thead>
            <tbody>{services.map(service => {
              const draft = drafts[service.id] ?? service;
              const isSaving = saving.has(service.id);
              return <tr key={service.id} className={draft.active ? '' : 'service-inactive'}>
                <td data-label="服務名稱"><input aria-label={`${service.name}服務名稱`} value={draft.name} onChange={event => updateDraft(service.id, { name: event.target.value })} onBlur={() => saveService(draft)} onKeyDown={onCellKeyDown}/></td>
                <td data-label="所需時長（分鐘）"><div className="duration-editor"><button type="button" aria-label={`${service.name}減少 15 分鐘`} disabled={isSaving || draft.duration_minutes <= 15} onClick={() => { const next = { ...draft, duration_minutes: Math.max(15, draft.duration_minutes - 15) }; updateDraft(service.id, next); void saveService(next); }}>−15</button><input aria-label={`${service.name}所需時長（分鐘）`} type="number" min="15" step="15" value={draft.duration_minutes} onChange={event => updateDraft(service.id, { duration_minutes: Number(event.target.value) })} onBlur={() => saveService(draft)} onKeyDown={onCellKeyDown}/><button type="button" aria-label={`${service.name}增加 15 分鐘`} disabled={isSaving} onClick={() => { const next = { ...draft, duration_minutes: Math.max(15, draft.duration_minutes + 15) }; updateDraft(service.id, next); void saveService(next); }}>+15</button></div></td>
                <td data-label="預設價格（NT$）"><input aria-label={`${service.name}預設價格`} type="number" min="0" step="1" value={draft.price} onChange={event => updateDraft(service.id, { price: Number(event.target.value) })} onBlur={() => saveService(draft)} onKeyDown={onCellKeyDown}/></td>
                <td data-label="快速操作"><div className="service-actions"><button type="button" className="service-action-secondary" disabled={isSaving} onClick={() => { const next = { ...draft, active: draft.active ? 0 as const : 1 as const }; updateDraft(service.id, next); void saveService(next); }}>{draft.active ? '停用' : '啟用'}</button><button type="button" className="service-action-secondary" disabled={isSaving} onClick={() => duplicateService(draft)}><Copy size={15} />複製</button><button type="button" className="service-delete-action danger-action" aria-label={`刪除 ${service.name}`} title="刪除服務" disabled={isSaving} onClick={() => deleteService(draft)}><Trash2 size={17} /></button>{isSaving && <span role="status">儲存中…</span>}</div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <form className="service-create-form" onSubmit={async event => { event.preventDefault(); setMessage(''); try { await api.createService({ name: name.trim(), duration_minutes: Math.max(15, duration), price: Math.max(0, price) }); setName(''); await onRefresh(); } catch (error) { setMessage(error instanceof Error ? error.message : '新增服務失敗。'); } }}>
          <input required aria-label="新服務名稱" placeholder="服務名稱" value={name} onChange={event => setName(event.target.value)}/><input required type="number" min="15" step="15" aria-label="新服務所需分鐘" value={duration} onChange={event => setDuration(Number(event.target.value))}/><input required type="number" min="0" aria-label="新服務價格" value={price} onChange={event => setPrice(Number(event.target.value))}/><button className="btn">新增服務</button>
        </form>
      </div>
      </fieldset>
    </div>}

    {activeTab === 'notifications' && <div id="settings-panel-notifications" role="tabpanel" className="settings-panel">
      {!access.canManage && <p className="settings-readonly-notice">PIN 模式為唯讀；請登入 super_admin 帳號以儲存偏好。</p>}
      <fieldset disabled={!access.canManage} className="settings-panel-fieldset settings-notification-grid">
      <article className="card settings-section-card">
        <div className="settings-card-heading"><Bell size={21} /><div><h3>預約提醒</h3><p>管理顧客預約前的提醒偏好。</p></div></div>
        <label className="settings-toggle-row"><span><strong>啟用預約提醒</strong><small>通知管道串接完成後，將依此時間發送。</small></span><input type="checkbox" checked={preferences.reminderEnabled} onChange={event => updatePreferences({ reminderEnabled: event.target.checked })}/></label>
        <label>提前提醒時間<select disabled={!preferences.reminderEnabled} value={preferences.reminderHours} onChange={event => updatePreferences({ reminderHours: Number(event.target.value) })}><option value={2}>2 小時前</option><option value={6}>6 小時前</option><option value={24}>1 天前</option><option value={48}>2 天前</option></select></label>
      </article>

      <article className="card settings-section-card">
        <div className="settings-card-heading"><Database size={21} /><div><h3>資料庫備份</h3><p>匯出目前可讀取的顧客、服務、商品、預約與收支資料。</p></div></div>
        <label className="settings-toggle-row"><span><strong>自動備份偏好</strong><small>保留排程偏好；雲端備份仍由 Supabase 專案管理。</small></span><input type="checkbox" checked={preferences.autoBackup} onChange={event => updatePreferences({ autoBackup: event.target.checked })}/></label>
        <button type="button" className="settings-secondary-button" onClick={() => void exportBackup()}><Database size={17} />立即匯出 JSON 備份</button>
      </article>

      <div className="settings-save-row">
        {backupMessage && <p className="settings-success" role="status">{backupMessage}</p>}
        <button className="btn" type="button" onClick={saveNotificationSettings}>儲存通知與備份設定</button>
      </div>
      </fieldset>
    </div>}
  </section>;
}

export function SettingsView(props: { services: Service[]; onRefresh(): Promise<void> }) {
  return <SettingsAccessGate>{access => <SettingsContent {...props} access={access} />}</SettingsAccessGate>;
}
