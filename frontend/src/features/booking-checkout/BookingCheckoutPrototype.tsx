import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarDays, CreditCard, Edit3, Plus, Scissors, Trash2, X } from 'lucide-react';
import { addDays, format, startOfWeek } from 'date-fns';
import { api, type Appointment, type AppointmentStatus, type Customer, type Product, type Service } from '../../api';
import { CustomLineItemEditor } from './CustomLineItemEditor';
import type { CustomLineItem } from './types';

type Props = {
  appointments: Appointment[];
  customers: Customer[];
  services: Service[];
  products: Product[];
  onCreate(value: Omit<Appointment, 'id'>): Promise<void>;
  onUpdate(value: Appointment): Promise<void>;
  onDelete(id: number): Promise<void>;
  onRefresh(): Promise<void>;
};

const labels: Record<AppointmentStatus, string> = {
  pending: '待確認', confirmed: '已確認', in_service: '服務中', completed: '已完成', cancelled: '已取消',
};
const styles: Record<AppointmentStatus, string> = {
  pending: 'border-locked bg-locked-surface', confirmed: 'border-confirmed bg-confirmed-surface',
  in_service: 'border-service bg-service-surface', completed: 'border-completed bg-completed-surface',
  cancelled: 'border-slate-400 bg-slate-100',
};
const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['pending', 'confirmed', 'in_service', 'cancelled'],
  confirmed: ['confirmed', 'in_service', 'cancelled'],
  in_service: ['in_service', 'cancelled'],
  completed: ['completed'], cancelled: ['cancelled'],
};
const localDateTime = (value: string) => format(new Date(value), "yyyy-MM-dd'T'HH:mm");

async function advanceToInService(appointment: Appointment, onUpdate: Props['onUpdate']) {
  let prepared = appointment;
  if (prepared.status === 'pending') {
    prepared = { ...prepared, status: 'confirmed' };
    await onUpdate(prepared);
  }
  if (prepared.status === 'confirmed') {
    prepared = { ...prepared, status: 'in_service' };
    await onUpdate(prepared);
  }
  if (prepared.status !== 'in_service') throw new Error('此預約目前無法結帳。');
  return prepared;
}

function CheckoutDialog({ appointment, products, onClose, onPrepare, onSuccess }: {
  appointment?: Appointment; products: Product[]; onClose(): void;
  onPrepare(value: Appointment): Promise<Appointment>; onSuccess(): Promise<void>;
}) {
  const [customItems, setCustomItems] = useState<CustomLineItem[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const selectedProducts = products.filter(product => product.id !== undefined && (quantities[product.id] ?? 0) > 0)
    .map(product => ({ product_id: product.id!, quantity: quantities[product.id!]! }));
  const productTotal = products.reduce((sum, product) => sum + product.price * (product.id === undefined ? 0 : quantities[product.id] ?? 0), 0);
  const customTotal = customItems.reduce((sum, item) => sum + item.amount, 0);
  const total = Math.max(0, (appointment?.price ?? 0) + productTotal + customTotal - discount);

  const checkout = async () => {
    if (!appointment?.id) return;
    setSaving(true); setMessage('');
    try {
      const prepared = await onPrepare(appointment);
      await api.checkoutAppointment(prepared.id!, `appointment-${prepared.id}`, selectedProducts,
        customItems.map(({ name, amount }) => ({ name, amount })), payment, discount);
      await onSuccess(); onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '結帳失敗');
    } finally { setSaving(false); }
  };

  return <Dialog.Root open={Boolean(appointment)} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[200] bg-black/60"/><Dialog.Content className="checkout-dialog fixed inset-x-0 bottom-0 z-[201] max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-panel md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:rounded-none md:p-7">
      <div className="flex justify-between"><div><Dialog.Title className="text-2xl font-black">結帳面板</Dialog.Title><Dialog.Description>待確認與已確認預約會自動開始服務，再由 Supabase 原子交易結帳</Dialog.Description></div><Dialog.Close className="min-h-12 min-w-12" aria-label="關閉"><X className="mx-auto"/></Dialog.Close></div>
      <div className="mt-5 rounded-xl bg-salon-50 p-4"><strong>{appointment?.customerName}</strong><p>{appointment?.service_name} · {appointment && format(new Date(appointment.start_time), 'HH:mm')}</p></div>
      <div className="mt-5 space-y-3"><div className="flex justify-between"><span>服務費</span><strong>NT$ {(appointment?.price ?? 0).toLocaleString()}</strong></div>
        {products.filter(product => product.active && product.stock_quantity > 0 && product.id !== undefined).map(product => <label className="flex items-center justify-between" key={product.id}><span>{product.name}（庫存 {product.stock_quantity}）</span><input className="w-20" type="number" min="0" max={product.stock_quantity} value={quantities[product.id!] ?? 0} onChange={event => setQuantities(value => ({ ...value, [product.id!]: Math.max(0, Math.min(product.stock_quantity, Number(event.target.value))) }))}/></label>)}
        <CustomLineItemEditor items={customItems} onChange={setCustomItems}/><label className="block font-bold">折扣<input className="mt-1 w-full" type="number" min="0" value={discount} onChange={event => setDiscount(Math.max(0, Number(event.target.value)))}/></label><label className="block font-bold">付款方式<select className="mt-1 w-full" value={payment} onChange={event => setPayment(event.target.value)}><option value="cash">現金</option><option value="line_pay">LINE Pay</option></select></label><div className="flex justify-between border-t-2 pt-3 text-2xl font-black"><span>應收</span><span>NT$ {total.toLocaleString()}</span></div>
      </div>
      {message && <p role="alert" className="mt-3 settings-error">{message}</p>}<button disabled={saving} onClick={() => void checkout()} className="mt-5 min-h-14 w-full rounded-xl border border-amber-400/40 bg-amber-500 text-xl font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500">{saving ? '處理中…' : `確認收款 NT$ ${total.toLocaleString()}`}</button>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

function AppointmentDetailsDialog({ appointment, customers, services, onClose, onUpdate, onDelete, onCheckout }: {
  appointment?: Appointment; customers: Customer[]; services: Service[]; onClose(): void;
  onUpdate: Props['onUpdate']; onDelete: Props['onDelete']; onCheckout(value: Appointment): void;
}) {
  const [customerId, setCustomerId] = useState(0);
  const [serviceId, setServiceId] = useState(0);
  const [start, setStart] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('pending');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!appointment) return;
    setCustomerId(appointment.customer_id); setServiceId(appointment.service_id);
    setStart(localDateTime(appointment.start_time)); setStatus(appointment.status);
    setNotes(appointment.notes ?? ''); setMessage('');
  }, [appointment]);

  const draft = (): Appointment => ({ ...appointment!, customer_id: customerId, service_id: serviceId, start_time: new Date(start).toISOString(), status, notes });
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!appointment) return;
    setSaving(true); setMessage('');
    try {
      let value = draft();
      if (appointment.status === 'pending' && status === 'in_service') {
        value = { ...value, status: 'confirmed' }; await onUpdate(value);
        value = { ...value, status: 'in_service' };
      }
      await onUpdate(value); onClose();
    } catch (error) { setMessage(error instanceof Error ? error.message : '預約儲存失敗'); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!appointment?.id || !confirm('確定刪除此預約？已結帳款項將作廢，產品庫存會自動退回。')) return;
    setSaving(true); setMessage('');
    try { await onDelete(appointment.id); onClose(); }
    catch (error) { setMessage(error instanceof Error ? error.message : '預約刪除失敗'); }
    finally { setSaving(false); }
  };

  return <Dialog.Root open={Boolean(appointment)} onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[180] bg-black/60"/><Dialog.Content className="checkout-dialog fixed left-1/2 top-1/2 z-[181] max-h-[92vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-5">
    <div className="flex justify-between"><div><Dialog.Title className="text-2xl font-black">預約詳情與操作</Dialog.Title><Dialog.Description>可直接編輯、改期、變更狀態或進行結帳</Dialog.Description></div><Dialog.Close className="min-h-12 min-w-12" aria-label="關閉"><X className="mx-auto"/></Dialog.Close></div>
    <form className="mt-5 grid gap-3" onSubmit={save}>
      <label>顧客<select required value={customerId} onChange={event => setCustomerId(Number(event.target.value))}>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label>
      <label>服務<select required value={serviceId} onChange={event => setServiceId(Number(event.target.value))}>{services.filter(service => service.active || service.id === serviceId).map(service => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} 分</option>)}</select></label>
      <label>開始時間／改期<input required type="datetime-local" value={start} onChange={event => setStart(event.target.value)}/></label>
      <label>狀態<select value={status} onChange={event => setStatus(event.target.value as AppointmentStatus)}>{appointment && transitions[appointment.status].map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>備註<textarea value={notes} onChange={event => setNotes(event.target.value)}/></label>
      {message && <p role="alert" className="settings-error">{message}</p>}
      <div className="grid grid-cols-2 gap-2"><button className="min-h-12 rounded-xl border border-slate-600 font-semibold" type="submit" disabled={saving}><Edit3 className="mr-2 inline" size={18}/>{saving ? '儲存中…' : '儲存變更'}</button>{appointment && !['completed', 'cancelled'].includes(appointment.status) && <button className="min-h-12 rounded-xl border border-amber-400/40 bg-amber-500 font-semibold text-slate-950" type="button" disabled={saving} onClick={() => onCheckout({ ...draft(), status: appointment!.status })}><CreditCard className="mr-2 inline" size={18}/>直接結帳</button>}</div>
      <button className="min-h-12 rounded-xl border border-rose-500/30 text-rose-500" type="button" disabled={saving} onClick={() => void remove()}><Trash2 className="mr-2 inline" size={18}/>刪除預約</button>
    </form>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function NewBookingDialog({ open, onClose, customers, services, onCreate }: { open: boolean; onClose(): void; customers: Customer[]; services: Service[]; onCreate: Props['onCreate'] }) {
  const [customerId, setCustomerId] = useState(0); const [serviceId, setServiceId] = useState(0);
  const [start, setStart] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm")); const [customItems, setCustomItems] = useState<CustomLineItem[]>([]);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  const close = () => { setCustomItems([]); onClose(); };
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (customItems.some(item => !item.name.trim())) { setMessage('請填寫所有臨時項目名稱。'); return; } setSaving(true); setMessage(''); try { await onCreate({ customer_id: customerId || customers[0]?.id || 0, service_id: serviceId || services[0]?.id || 0, start_time: new Date(start).toISOString(), status: 'pending', custom_items: customItems.map(({ name, amount }) => ({ name: name.trim(), amount })) }); close(); } catch (error) { setMessage(error instanceof Error ? error.message : '新增失敗'); } finally { setSaving(false); } };
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) close(); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[200] bg-black/60"/><Dialog.Content className="checkout-dialog fixed left-1/2 top-1/2 z-[201] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 p-5"><div className="flex justify-between"><div><Dialog.Title className="text-2xl font-black">新增預約</Dialog.Title><Dialog.Description>資料會寫入目前設定的正式資料來源</Dialog.Description></div><Dialog.Close className="min-h-12 min-w-12"><X className="mx-auto"/></Dialog.Close></div><form className="mt-5 grid gap-3" onSubmit={save}><label>顧客<select required value={customerId || customers[0]?.id || ''} onChange={event => setCustomerId(Number(event.target.value))}>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>服務<select required value={serviceId || services[0]?.id || ''} onChange={event => setServiceId(Number(event.target.value))}>{services.filter(service => service.active).map(service => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} 分</option>)}</select></label><label>開始<input required type="datetime-local" value={start} onChange={event => setStart(event.target.value)}/></label><CustomLineItemEditor items={customItems} onChange={setCustomItems}/>{message && <p role="alert">{message}</p>}<button disabled={saving || !customers.length || !services.length} className="min-h-12 rounded-xl border border-amber-400/40 bg-amber-500 font-semibold text-slate-950 transition-colors hover:bg-amber-400">{saving ? '儲存中…' : '建立待確認預約'}</button></form></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function BookingCheckoutPrototype(props: Props) {
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selected, setSelected] = useState<Appointment>(); const [checkout, setCheckout] = useState<Appointment>();
  const [newOpen, setNewOpen] = useState(false);
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), index)), []);
  const bookings = props.appointments.filter(appointment => appointment.status !== 'cancelled' && format(new Date(appointment.start_time), 'yyyy-MM-dd') === selectedDay);
  const prepareCheckout = (appointment: Appointment) => advanceToInService(appointment, props.onUpdate);

  return <div className="booking-shell mx-auto max-w-7xl text-ink"><header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-400">點擊任一預約卡片即可編輯、改期、變更狀態或結帳</p><h2 className="text-3xl font-black">{selectedDay}</h2></div><button onClick={() => setNewOpen(true)} className="min-h-12 rounded-xl border border-amber-400/40 bg-amber-500 px-5 text-lg font-semibold text-slate-950 transition-colors hover:bg-amber-400"><Plus className="mr-2 inline"/>新增預約</button></header><main className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]"><section className="rounded-2xl bg-white p-4 shadow-panel"><div className="mb-4 flex justify-between"><h3 className="text-2xl font-black">當日詳情 · {bookings.length} 筆</h3><Scissors/></div><div className="space-y-4">{bookings.map(appointment => <button type="button" key={appointment.id} onClick={() => setSelected(appointment)} className={`block w-full rounded-xl border-l-8 p-4 text-left transition-transform hover:-translate-y-0.5 ${styles[appointment.status]}`}><div className="flex justify-between gap-3"><div><strong className="text-xl">{format(new Date(appointment.start_time), 'HH:mm')}–{appointment.end_time && format(new Date(appointment.end_time), 'HH:mm')}</strong><h3 className="text-xl font-black">{appointment.customerName}</h3><p>{appointment.service_name}</p></div><span className="font-bold">{labels[appointment.status]}</span></div><span className="mt-4 block font-semibold text-amber-700"><Edit3 className="mr-2 inline" size={18}/>查看詳情與操作</span></button>)}{!bookings.length && <p>本日沒有預約。</p>}</div></section><aside className="hidden self-start rounded-2xl bg-white p-5 shadow-panel md:block"><h3 className="text-xl font-black"><CalendarDays className="mr-2 inline"/>本週</h3><div className="mt-5 grid grid-cols-7 gap-2">{week.map(day => { const iso = format(day, 'yyyy-MM-dd'); const count = props.appointments.filter(appointment => appointment.status !== 'cancelled' && appointment.start_time.startsWith(iso)).length; return <button key={iso} onClick={() => setSelectedDay(iso)} className={`min-h-20 rounded-xl border-2 p-1 ${iso === selectedDay ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60'}`}><small>{format(day, 'EEE')}</small><strong className="block">{format(day, 'd')}</strong><span className="text-xs">{count}筆</span></button>; })}</div></aside></main>
    <AppointmentDetailsDialog appointment={selected} customers={props.customers} services={props.services} onClose={() => setSelected(undefined)} onUpdate={props.onUpdate} onDelete={props.onDelete} onCheckout={value => { setSelected(undefined); setCheckout(value); }}/>
    <CheckoutDialog appointment={checkout} products={props.products} onClose={() => setCheckout(undefined)} onPrepare={prepareCheckout} onSuccess={props.onRefresh}/>
    <NewBookingDialog open={newOpen} onClose={() => setNewOpen(false)} customers={props.customers} services={props.services} onCreate={props.onCreate}/>
  </div>;
}
