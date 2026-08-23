import { Trash2 } from 'lucide-react';
import type { CustomLineItem } from './types';

export function CustomLineItemEditor({ items, onChange }: { items: CustomLineItem[]; onChange: (items: CustomLineItem[]) => void }) {
  const update = (id: string, patch: Partial<CustomLineItem>) => onChange(items.map(item => item.id === id ? { ...item, ...patch } : item));
  return <section className="mt-5 border-t border-[#3B3936] pt-4" aria-labelledby="custom-items-heading">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="custom-items-heading" className="text-lg font-black">臨時項目</h3>
      <button type="button" className="min-h-12 rounded-lg border-2 border-[#3B3936] bg-[#33312E] px-4 font-bold text-[#F2F0EB]" onClick={() => onChange([...items, { id: crypto.randomUUID(), name: '', amount: 0 }])}>＋ 新增臨時項目</button>
    </div>
    {items.length === 0 && <p className="mt-2 text-sm text-[#9E9A93]">僅加入本次預約／訂單，不會建立全域服務。</p>}
    <div className="mt-3 space-y-3">{items.map((item, index) => <div className="grid gap-2 rounded-lg border border-[#3B3936] bg-[#1C1B1A] p-3 sm:grid-cols-[1fr_140px_52px]" key={item.id}>
      <label className="font-bold">自定義名稱<input aria-label={`臨時項目 ${index + 1} 自定義名稱`} className="mt-1 w-full" placeholder="例如：特殊護理" value={item.name} onChange={event => update(item.id, { name: event.target.value })}/></label>
      <label className="font-bold">單次金額<input aria-label={`臨時項目 ${index + 1} 單次金額`} className="mt-1 w-full" type="number" min="0" step="1" value={item.amount} onChange={event => update(item.id, { amount: Math.max(0, Number(event.target.value)) })}/></label>
      <button type="button" className="min-h-12 min-w-12 self-end rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 transition-colors hover:bg-rose-500/20" aria-label={`移除臨時項目 ${index + 1}`} onClick={() => onChange(items.filter(candidate => candidate.id !== item.id))}><Trash2 className="mx-auto" size={20}/></button>
    </div>)}</div>
  </section>;
}
