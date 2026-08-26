import { isSupabaseConfigured, requireSupabase, unwrap } from './lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
let apiReadOnlyMode = true;

export function setApiReadOnlyMode(readOnly: boolean): void {
  apiReadOnlyMode = readOnly;
}
export interface Customer { id?: number; name: string; phone: string; email?: string; notes?: string; created_at?: string; last_visit?: string; last_spend?: number }
export interface Service { id: number; name: string; duration_minutes: number; price: number; active: 0 | 1 }
export interface Product { id?: number; name: string; price: number; stock_quantity: number; active: 0 | 1; vendor_name: string | null }
export interface ProductStockAdjustment { id: number; product_id: number; quantity_delta: number; resulting_quantity: number; reason: string; created_at: string }
export type AppointmentStatus = 'pending' | 'confirmed' | 'in_service' | 'completed' | 'cancelled';
export interface Appointment { id?: number; customer_id: number; customerName?: string; service_id: number; service_name?: string; service?: string; duration_minutes?: number; start_time: string; end_time?: string; status: AppointmentStatus; price?: number; total_amount?: number; product_total?: number; products?: { product_id: number; quantity: number }[]; custom_items?: { name: string; amount: number }[]; surcharge_type?: 'none'|'percent'|'fixed'; surcharge_value?: number; notes?: string }
export interface BlockTime { id?: number; start_time: string; end_time: string; reason?: string }
export interface DashboardStats { todayAppointments: number; todayRevenue: number; totalCustomers: number }
export type PaymentMethod = 'cash'|'credit_card'|'line_pay'|'bank_transfer';
export type OrderStatus = 'paid'|'refunded';
export interface SystemSettings { storeName: string; openingTime: string; closingTime: string; defaultPayment: PaymentMethod; surchargeType: 'none'|'percent'|'fixed'; surchargeValue: number; reminderEnabled: boolean; reminderHours: number; autoBackup: boolean }
export interface Transaction { id?: number; type: 'income'|'expense'; item_id: number; itemName?: string; amount: number; date?: string; notes?: string; customerName?: string; serviceName?: string; source?: 'manual'|'appointment'|'order'; order_id?: number|null; appointment_id?: number|null; editable?: boolean; payment_method?: PaymentMethod; details?: { item_type:string; name:string; quantity:number; line_amount:number }[] }
export interface TransactionItem { id: number; name: string }
export interface ReconciliationFilters { startDate:string; endDate:string; status?:OrderStatus; paymentMethod?:PaymentMethod; handledBy?:string }
export interface ReconciliationStaff { id:string; full_name:string }
export interface ReconciliationItem { item_type:'service'|'product'|'custom'; name:string; quantity:number; unit_amount:number; line_amount:number }
export interface ReconciliationRow { order_id:number; appointment_id:number; transaction_at:string; order_status:OrderStatus; customer_name:string; customer_phone:string; item_details:ReconciliationItem[]; original_amount:number; discount_amount:number; final_amount:number; payment_method:PaymentMethod; handled_by:string|null; handled_by_name:string; notes:string|null }
export interface Vendor { id?: number; name: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `Request failed (${response.status})`); }
  if (response.status === 204) return undefined as T;
  return response.json();
}
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const sb = () => requireSupabase();
const row = <T>(result: { data: T; error: { message: string } | null }): NonNullable<T> => unwrap({ data: result.data, error: result.error }) as NonNullable<T>;
const mapCustomer = (value: { id:number; name:string; phone:string; email:string|null; note:string|null; created_at:string }): Customer => ({ id:value.id, name:value.name, phone:value.phone, email:value.email ?? '', notes:value.note ?? '', created_at:value.created_at });
const mapService = (value: { id:number; name:string; duration_min:number; price:number; active:boolean }): Service => ({ id:value.id, name:value.name, duration_minutes:value.duration_min, price:value.price, active:value.active ? 1 : 0 });
const mapProduct = (value: { id:number; name:string; price:number; stock:number; vendor:string|null; active:boolean }): Product => ({ id:value.id, name:value.name, price:value.price, stock_quantity:value.stock, vendor_name:value.vendor, active:value.active ? 1 : 0 });
type AppointmentQueryRow = { id:number; customer_id:number; service_id:number; start_time:string; end_time:string; status:AppointmentStatus; total_amount:number; custom_items:unknown; note:string|null; customers:{name:string}|null; services:{name:string;duration_min:number;price:number}|null };
const mapAppointment = (value: AppointmentQueryRow): Appointment => ({ id:value.id, customer_id:value.customer_id, customerName:value.customers?.name, service_id:value.service_id, service_name:value.services?.name, service:value.services?.name, duration_minutes:value.services?.duration_min, price:value.services?.price, total_amount:value.total_amount, custom_items:Array.isArray(value.custom_items) ? value.custom_items as {name:string;amount:number}[] : [], start_time:value.start_time, end_time:value.end_time, status:value.status, notes:value.note ?? '' });
const appointmentSelect = 'id,customer_id,service_id,start_time,end_time,status,total_amount,custom_items,note,customers(name),services(name,duration_min,price)';
type FinanceRecordQueryRow = { id:number; type:'income'|'expense'; category:string; amount:number; occurred_at:string; notes:string|null; source:'manual'|'appointment'|'order'; order_id:number|null; appointment_id:number|null; appointments:{customers:{name:string}|null;services:{name:string}|null}|null; orders:{payment_method:string;order_items:{item_type:string;name:string;quantity:number;line_amount:number}[]}|null };
const incomeItems:TransactionItem[]=[{id:1,name:'其他收入'}];
const expenseItems:TransactionItem[]=[{id:1,name:'營運支出'},{id:2,name:'進貨成本'},{id:3,name:'租金／水電'}];
const nextDate=(date:string)=>{const value=new Date(`${date}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+1);return value.toISOString().slice(0,10);};
async function getSupabaseTransactions(start?:string,end?:string) {
  let query=sb().from('finance_records').select('id,type,category,amount,occurred_at,notes,source,order_id,appointment_id,appointments(customers(name),services(name)),orders(payment_method,order_items(item_type,name,quantity,line_amount))').is('voided_at',null).order('occurred_at',{ascending:false});
  if(start&&end) query=query.gte('occurred_at',`${start}T00:00:00+08:00`).lt('occurred_at',`${nextDate(end)}T00:00:00+08:00`);
  return row(await query).map(value=>{const record=value as unknown as FinanceRecordQueryRow;const paymentMethod=record.orders?.payment_method as PaymentMethod|undefined;const paymentLabel=paymentMethod?({cash:'現金',credit_card:'信用卡',line_pay:'LINE Pay',bank_transfer:'轉帳'} as const)[paymentMethod]:null;return {id:record.id,type:record.type,item_id:record.type==='income'?1:expenseItems.find(item=>item.name===record.category)?.id??1,itemName:record.category,amount:record.amount,date:record.occurred_at,notes:paymentLabel??record.notes??'',customerName:record.appointments?.customers?.name,serviceName:record.appointments?.services?.name,source:record.source,order_id:record.order_id,appointment_id:record.appointment_id,editable:record.source==='manual',payment_method:paymentMethod,details:record.orders?.order_items??[]} satisfies Transaction;});
}
async function getSupabaseAppointments(customerId?: number) {
  let query = sb().from('appointments').select(appointmentSelect).is('deleted_at', null).order('start_time');
  if (customerId !== undefined) query = query.eq('customer_id', customerId);
  return row(await query) .map(value => mapAppointment(value as unknown as AppointmentQueryRow));
}
async function getAppointment(id: number) {
  const result = await sb().from('appointments').select(appointmentSelect).eq('id', id).single();
  return mapAppointment(row(result) as unknown as AppointmentQueryRow);
}

const expressApi = {
  getStats: () => request<DashboardStats>('/dashboard/stats'),
  getAppointments: () => request<Appointment[]>('/appointments'), createAppointment: (value: Omit<Appointment,'id'>) => request<Appointment>('/appointments', json('POST', value)), updateAppointment: (value: Appointment) => request<Appointment>(`/appointments/${value.id}`, json('PUT', value)), deleteAppointment: (id: number) => request<void>(`/appointments/${id}`, { method: 'DELETE' }),
  getServices: () => request<Service[]>('/services'), createService: (value: Omit<Service,'id'|'active'>) => request<{id:number}>('/services', json('POST', value)), updateService: (value: Service) => request<void>(`/services/${value.id}`, json('PUT', value)), deleteService: (id: number) => request<void>(`/services/${id}`, { method: 'DELETE' }),
  getBlocks: () => request<BlockTime[]>('/block-times'), createBlock: (value: Omit<BlockTime,'id'>) => request<BlockTime>('/block-times', json('POST', value)), updateBlock: (value: BlockTime) => request<void>(`/block-times/${value.id}`, json('PUT', value)), deleteBlock: (id: number) => request<void>(`/block-times/${id}`, { method: 'DELETE' }),
  getCustomers: () => request<Customer[]>('/customers'), getCustomerHistory: (id: number) => request<Appointment[]>(`/customers/${id}/history`), createCustomer: (value: Omit<Customer,'id'>) => request<{id:number}>('/customers', json('POST', value)), updateCustomer: (value: Customer) => request<void>(`/customers/${value.id}`, json('PUT', value)), deleteCustomer: (id: number) => request<void>(`/customers/${id}`, { method: 'DELETE' }),
  getProducts: () => request<Product[]>('/products'), createProduct: (value: Omit<Product,'id'>) => request<void>('/products', json('POST', value)), updateProduct: (value: Product) => request<void>(`/products/${value.id}`, json('PUT', value)), deleteProduct: (id: number) => request<void>(`/products/${id}`, { method: 'DELETE' }), adjustProductStock: (id: number, quantity_delta: number, reason: string) => request<{stock_quantity:number}>(`/products/${id}/adjust`, json('POST', { quantity_delta, reason })), getProductStockHistory: (id: number) => request<ProductStockAdjustment[]>(`/products/${id}/history`),
};

const defaultSystemSettings: SystemSettings = { storeName:'我的美髮工作室', openingTime:'10:00', closingTime:'20:00', defaultPayment:'cash', surchargeType:'none', surchargeValue:0, reminderEnabled:true, reminderHours:24, autoBackup:false };
const textSetting = (value:unknown, fallback:string) => typeof value === 'string' ? value : fallback;
const numberSetting = (value:unknown, fallback:number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const booleanSetting = (value:unknown, fallback:boolean) => typeof value === 'boolean' ? value : fallback;

const apiImpl = {
  getStats: expressApi.getStats,
  getSystemSettings: async ():Promise<SystemSettings> => {
    if (!isSupabaseConfigured) {
      const surcharge = await request<{type:'none'|'percent'|'fixed';value:number}>('/settings/surcharge');
      return { ...defaultSystemSettings, surchargeType:surcharge.type, surchargeValue:surcharge.value };
    }
    const records = row(await sb().from('system_settings').select('key,value')) as {key:string;value:unknown}[];
    const values = Object.fromEntries(records.map(record => [record.key, record.value]));
    const payment = textSetting(values.default_payment, defaultSystemSettings.defaultPayment);
    const surcharge = textSetting(values.holiday_surcharge_type, defaultSystemSettings.surchargeType);
    return {
      storeName:textSetting(values.store_name,defaultSystemSettings.storeName), openingTime:textSetting(values.opening_time,defaultSystemSettings.openingTime), closingTime:textSetting(values.closing_time,defaultSystemSettings.closingTime),
      defaultPayment:(['cash','credit_card','line_pay','bank_transfer'] as const).find(value=>value===payment)??'cash', surchargeType:surcharge==='percent'||surcharge==='fixed'?surcharge:'none', surchargeValue:numberSetting(values.holiday_surcharge_value,0),
      reminderEnabled:booleanSetting(values.reminder_enabled,true), reminderHours:numberSetting(values.reminder_hours,24), autoBackup:booleanSetting(values.auto_backup,false),
    };
  },
  updateSystemSettings: async (settings:SystemSettings) => {
    if (!isSupabaseConfigured) return request<void>('/settings/surcharge',json('PUT',{type:settings.surchargeType,value:settings.surchargeValue}));
    const {data:{user},error:userError}=await sb().auth.getUser(); if(userError)throw userError;if(!user)throw new Error('Super admin sign-in required.');
    const pairs:Array<[string,unknown]>=[
      ['store_name',settings.storeName],['opening_time',settings.openingTime],['closing_time',settings.closingTime],['default_payment',settings.defaultPayment],
      ['holiday_surcharge_type',settings.surchargeType],['holiday_surcharge_value',settings.surchargeValue],['reminder_enabled',settings.reminderEnabled],['reminder_hours',settings.reminderHours],['auto_backup',settings.autoBackup],
    ];
    const values=pairs.map(([key,value])=>({key,value,updated_at:new Date().toISOString(),updated_by:user.id}));
    row(await sb().from('system_settings').upsert(values,{onConflict:'key'}).select('key'));
  },
  getAppointments: () => isSupabaseConfigured ? getSupabaseAppointments() : expressApi.getAppointments(),
  createAppointment: async (value: Omit<Appointment,'id'>) => isSupabaseConfigured ? mapAppointment(row(await sb().rpc('create_appointment', { p_customer_id:value.customer_id, p_service_id:value.service_id, p_start_time:value.start_time, p_status:value.status, p_custom_items:value.custom_items ?? [], p_note:value.notes })) as unknown as AppointmentQueryRow) : expressApi.createAppointment(value),
  updateAppointment: async (value: Appointment) => {
    if (!isSupabaseConfigured) return expressApi.updateAppointment(value);
    if (value.id === undefined) throw new Error('Appointment id is required.');
    row(await sb().rpc('update_appointment', { p_id:value.id, p_customer_id:value.customer_id, p_service_id:value.service_id, p_start_time:value.start_time, p_status:value.status, p_custom_items:value.custom_items ?? [], p_note:value.notes }));
    return getAppointment(value.id);
  },
  deleteAppointment: async (id: number) => {
    if (!isSupabaseConfigured) return expressApi.deleteAppointment(id);
    row(await sb().rpc('archive_appointment',{p_appointment_id:id}));
  },
  checkoutAppointment: async (appointmentId:number, idempotencyKey:string, products:{product_id:number;quantity:number}[], customItems:{name:string;amount:number}[], paymentMethod:string, discount=0) => {
    if (!isSupabaseConfigured) throw new Error('Atomic checkout is available only in configured Supabase mode.');
    return row(await sb().rpc('checkout_appointment', { p_appointment_id:appointmentId, p_idempotency_key:idempotencyKey, p_product_items:products, p_custom_items:customItems, p_payment_method:paymentMethod, p_discount:discount }))[0];
  },
  getServices: async () => isSupabaseConfigured ? row(await sb().from('services').select('*').order('name')).map(mapService) : expressApi.getServices(),
  createService: async (value: Omit<Service,'id'|'active'>) => isSupabaseConfigured ? { id:row(await sb().from('services').insert({ name:value.name, duration_min:value.duration_minutes, price:value.price }).select('id').single()).id } : expressApi.createService(value),
  updateService: async (value: Service) => { if (!isSupabaseConfigured) return expressApi.updateService(value); row(await sb().from('services').update({ name:value.name, duration_min:value.duration_minutes, price:value.price, active:Boolean(value.active) }).eq('id',value.id).select('id').single()); },
  deleteService: async (id:number) => { if (!isSupabaseConfigured) return expressApi.deleteService(id); row(await sb().from('services').delete().eq('id',id).select('id')); },
  getBlocks: async () => isSupabaseConfigured ? row(await sb().from('blocked_times').select('*').order('start_time')).map(value => ({ id:value.id, start_time:value.start_time, end_time:value.end_time, reason:value.title })) : expressApi.getBlocks(),
  createBlock: async (value:Omit<BlockTime,'id'>) => { if (!isSupabaseConfigured) return expressApi.createBlock(value); const created=row(await sb().from('blocked_times').insert({title:value.reason??'Blocked',start_time:value.start_time,end_time:value.end_time}).select('*').single()); return {id:created.id,start_time:created.start_time,end_time:created.end_time,reason:created.title}; },
  updateBlock: async (value:BlockTime) => { if (!isSupabaseConfigured) return expressApi.updateBlock(value); if(value.id===undefined) throw new Error('Block id is required.'); row(await sb().from('blocked_times').update({ title:value.reason ?? 'Blocked', start_time:value.start_time, end_time:value.end_time }).eq('id',value.id).select('id').single()); },
  deleteBlock: async (id:number) => { if (!isSupabaseConfigured) return expressApi.deleteBlock(id); row(await sb().from('blocked_times').delete().eq('id',id).select('id')); },
  getSurcharge: () => request<{type:'none'|'percent'|'fixed';value:number}>('/settings/surcharge'), updateSurcharge: (value:{type:'none'|'percent'|'fixed';value:number}) => request<void>('/settings/surcharge', json('PUT',value)),
  getCustomers: async () => isSupabaseConfigured ? row(await sb().from('customers').select('*').order('name')).map(mapCustomer) : expressApi.getCustomers(),
  getCustomerHistory: (id:number) => isSupabaseConfigured ? getSupabaseAppointments(id) : expressApi.getCustomerHistory(id),
  createCustomer: async (value:Omit<Customer,'id'>) => isSupabaseConfigured ? { id:row(await sb().from('customers').insert({name:value.name,phone:value.phone,email:value.email || null,note:value.notes}).select('id').single()).id } : expressApi.createCustomer(value),
  updateCustomer: async (value:Customer) => { if (!isSupabaseConfigured) return expressApi.updateCustomer(value); if(value.id===undefined) throw new Error('Customer id is required.'); row(await sb().from('customers').update({name:value.name,phone:value.phone,email:value.email || null,note:value.notes}).eq('id',value.id).select('id').single()); },
  deleteCustomer: async (id:number) => { if (!isSupabaseConfigured) return expressApi.deleteCustomer(id); row(await sb().from('customers').delete().eq('id',id).select('id')); },
  getProducts: async () => isSupabaseConfigured ? row(await sb().from('products').select('*').order('name')).map(mapProduct) : expressApi.getProducts(),
  createProduct: async (value:Omit<Product,'id'>) => { if (!isSupabaseConfigured) return expressApi.createProduct(value); row(await sb().from('products').insert({name:value.name,price:value.price,stock:value.stock_quantity,vendor:value.vendor_name,active:Boolean(value.active)}).select('id')); },
  updateProduct: async (value:Product) => { if (!isSupabaseConfigured) return expressApi.updateProduct(value); if(value.id===undefined) throw new Error('Product id is required.'); row(await sb().rpc('update_product',{p_product_id:value.id,p_name:value.name,p_price:value.price,p_stock:value.stock_quantity,p_vendor:value.vendor_name,p_active:Boolean(value.active)})); },
  deleteProduct: async (id:number) => { if (!isSupabaseConfigured) return expressApi.deleteProduct(id); row(await sb().from('products').delete().eq('id',id).select('id')); },
  adjustProductStock: async (id:number,quantity_delta:number,reason:string) => isSupabaseConfigured ? {stock_quantity:row(await sb().rpc('adjust_product_stock',{p_product_id:id,p_quantity_delta:quantity_delta,p_reason:reason}))} : expressApi.adjustProductStock(id,quantity_delta,reason),
  getProductStockHistory: async (id:number) => isSupabaseConfigured ? row(await sb().from('stock_adjustments').select('*').eq('product_id',id).order('created_at',{ascending:false})).map(value=>({id:value.id,product_id:value.product_id,quantity_delta:value.quantity_delta,resulting_quantity:value.resulting_stock,reason:value.reason,created_at:value.created_at})) : expressApi.getProductStockHistory(id),
  getIncomeItems: () => isSupabaseConfigured ? Promise.resolve(incomeItems) : request<TransactionItem[]>('/income_items'),
  getExpenseItems: () => isSupabaseConfigured ? Promise.resolve(expenseItems) : request<TransactionItem[]>('/expense_items'),
  getTransactions: (start?:string,end?:string) => isSupabaseConfigured ? getSupabaseTransactions(start,end) : request<Transaction[]>(`/transactions${start&&end?`?startDate=${start}&endDate=${end}`:''}`),
  getReconciliationStaff: async ():Promise<ReconciliationStaff[]> => {
    if(!isSupabaseConfigured)throw new Error('匯出對帳單僅支援已設定 Supabase 的登入模式。');
    return row(await sb().rpc('get_reconciliation_staff',{}));
  },
  getReconciliationReport: async (filters:ReconciliationFilters):Promise<ReconciliationRow[]> => {
    if(!isSupabaseConfigured)throw new Error('匯出對帳單僅支援已設定 Supabase 的登入模式。');
    return row(await sb().rpc('get_reconciliation_report',{p_start_date:filters.startDate,p_end_date:filters.endDate,p_status:filters.status??null,p_payment_method:filters.paymentMethod??null,p_handled_by:filters.handledBy??null})) as ReconciliationRow[];
  },
  createTransaction: async (value:Transaction) => { if(!isSupabaseConfigured)return request<void>('/transactions',json('POST',value));const category=(value.type==='income'?incomeItems:expenseItems).find(item=>item.id===value.item_id)?.name??(value.type==='income'?'其他收入':'營運支出');row(await sb().from('finance_records').insert({type:value.type,category,amount:value.amount,occurred_at:value.date??new Date().toISOString(),notes:value.notes??null,source:'manual'}).select('id').single()); },
  updateTransaction: async (value:Transaction) => { if(!isSupabaseConfigured)return request<void>(`/transactions/${value.id}`,json('PUT',value));if(value.id===undefined||value.source!=='manual')throw new Error('Only manual finance records can be edited.');row(await sb().from('finance_records').update({amount:value.amount,notes:value.notes??null}).eq('id',value.id).eq('source','manual').select('id').single()); },
  deleteTransaction: async (id:number) => { if(!isSupabaseConfigured)return request<void>(`/transactions/${id}`,{method:'DELETE'});row(await sb().from('finance_records').delete().eq('id',id).eq('source','manual').select('id').single()); }
};

const MUTATION_METHOD = /^(create|update|delete|adjust|checkout)/;
export const api = new Proxy(apiImpl, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof property !== 'string' || typeof value !== 'function' || !MUTATION_METHOD.test(property)) return value;
    return (...args: unknown[]) => {
      if (apiReadOnlyMode) throw new Error('緊急 PIN 模式為唯讀，請使用管理者帳號登入後再執行此操作。');
      return (value as (...values: unknown[]) => unknown)(...args);
    };
  },
});

// Configured Supabase mode owns core salon and finance data; surcharge settings remain Express-only.
