import { useEffect, useRef, useState } from 'react';
import { api, type Service } from '../api';

type ServiceDraft = Pick<Service, 'id' | 'name' | 'duration_minutes' | 'price' | 'active'>;

export function SettingsView({ services, onRefresh }: { services: Service[]; onRefresh(): Promise<void> }) {
  const [type, setType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [value, setValue] = useState(0);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, ServiceDraft>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState('');
  const savingRef = useRef(new Set<number>());
  const queuedSaveRef = useRef(new Map<number, ServiceDraft>());

  useEffect(() => { api.getSurcharge().then(setting => { setType(setting.type); setValue(setting.value); }); }, []);
  useEffect(() => { setDrafts(Object.fromEntries(services.map(service => [service.id, { ...service }]))); }, [services]);

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

  const onCellKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
  };

  const duplicateService = async (service: ServiceDraft) => {
    const base = `${service.name.replace(/（副本(?: \d+)?）$/, '')}（副本）`;
    let copyName = base;
    let number = 2;
    while (services.some(item => item.name === copyName)) copyName = `${service.name.replace(/（副本(?: \d+)?）$/, '')}（副本 ${number++}）`;
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

  return <div>
    <div className="card"><h2>假日加價</h2><p>套用於未指定個別加價的新預約；金額均為最小貨幣單位。</p><select aria-label="假日加價方式" value={type} onChange={event => setType(event.target.value as typeof type)}><option value="none">不加價</option><option value="percent">百分比</option><option value="fixed">固定金額</option></select><input aria-label="假日加價數值" type="number" min="0" value={value} onChange={event => setValue(Number(event.target.value))}/><button className="btn" onClick={() => api.updateSurcharge({ type, value })}>儲存</button></div>
    <div className="card service-settings">
      <h2>服務項目與定價</h2>
      <p className="settings-hint">欄位離開焦點或按 Enter 即儲存。停用服務仍會保留歷史紀錄。</p>
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
              <td data-label="快速操作"><div className="service-actions"><button type="button" disabled={isSaving} onClick={() => { const next = { ...draft, active: draft.active ? 0 as const : 1 as const }; updateDraft(service.id, next); void saveService(next); }}>{draft.active ? '停用' : '啟用'}</button><button type="button" disabled={isSaving} onClick={() => duplicateService(draft)}>複製</button><button type="button" className="danger-action" disabled={isSaving} onClick={() => deleteService(draft)}>刪除</button>{isSaving && <span role="status">儲存中…</span>}</div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <form className="service-create-form" onSubmit={async event => { event.preventDefault(); setMessage(''); try { await api.createService({ name: name.trim(), duration_minutes: Math.max(15, duration), price: Math.max(0, price) }); setName(''); await onRefresh(); } catch (error) { setMessage(error instanceof Error ? error.message : '新增服務失敗。'); } }}>
        <input required aria-label="新服務名稱" placeholder="服務名稱" value={name} onChange={event => setName(event.target.value)}/><input required type="number" min="15" step="15" aria-label="新服務所需分鐘" value={duration} onChange={event => setDuration(Number(event.target.value))}/><input required type="number" min="0" aria-label="新服務價格" value={price} onChange={event => setPrice(Number(event.target.value))}/><button className="btn">新增服務</button>
      </form>
    </div>
  </div>;
}
