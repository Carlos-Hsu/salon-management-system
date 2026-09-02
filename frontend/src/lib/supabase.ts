import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Minimal generated-style schema typing. Regenerate from Supabase after deployment. */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; email: string | null; full_name: string | null; role: 'staff'|'super_admin'; created_at: string; updated_at: string }; Insert: { id: string; email?: string | null; full_name?: string | null; role?: 'staff'|'super_admin' }; Update: { email?: string | null; full_name?: string | null; role?: 'staff'|'super_admin'; updated_at?: string }; Relationships: [] };
      system_settings: { Row: { key: string; value: unknown; description: string | null; updated_at: string; updated_by: string | null }; Insert: { key: string; value: unknown; description?: string | null; updated_at?: string; updated_by?: string | null }; Update: { value?: unknown; description?: string | null; updated_at?: string; updated_by?: string | null }; Relationships: [] };
      customers: { Row: { id: number; name: string; phone: string; email: string | null; note: string | null; deleted_at: string | null; created_at: string; updated_at: string }; Insert: { name: string; phone: string; email?: string | null; note?: string | null }; Update: { name?: string; phone?: string; email?: string | null; note?: string | null; deleted_at?: string | null }; Relationships: [] };
      services: { Row: { id: number; name: string; duration_min: number; price: number; active: boolean; created_at: string; updated_at: string }; Insert: { name: string; duration_min: number; price: number; active?: boolean }; Update: { name?: string; duration_min?: number; price?: number; active?: boolean }; Relationships: [] };
      products: { Row: { id: number; name: string; price: number; stock: number; vendor: string | null; active: boolean; created_at: string; updated_at: string }; Insert: { name: string; price: number; stock: number; vendor?: string | null; active?: boolean }; Update: { name?: string; price?: number; stock?: number; vendor?: string | null; active?: boolean }; Relationships: [] };
      appointments: { Row: { id: number; customer_id: number; service_id: number; start_time: string; end_time: string; status: 'pending'|'confirmed'|'in_service'|'completed'|'cancelled'; total_amount: number; custom_items: unknown[]; note: string | null; deleted_at: string | null; created_at: string; updated_at: string }; Insert: never; Update: { deleted_at?: string | null }; Relationships: [{ foreignKeyName:'appointments_customer_id_fkey'; columns:['customer_id']; isOneToOne:false; referencedRelation:'customers'; referencedColumns:['id'] }, { foreignKeyName:'appointments_service_id_fkey'; columns:['service_id']; isOneToOne:false; referencedRelation:'services'; referencedColumns:['id'] }] };
      blocked_times: { Row: { id: number; title: string; start_time: string; end_time: string; created_at: string; updated_at: string }; Insert: { title: string; start_time: string; end_time: string }; Update: { title?: string; start_time?: string; end_time?: string }; Relationships: [] };
      orders: { Row: { id:number; appointment_id:number; idempotency_key:string; status:'paid'|'refunded'; service_amount:number; product_amount:number; custom_amount:number; discount:number; total_amount:number; payment_method:'cash'|'credit_card'|'line_pay'|'bank_transfer'; custom_items:unknown[]; handled_by:string|null; voided_at:string|null; void_reason:string|null; created_at:string }; Insert: never; Update: never; Relationships: [{ foreignKeyName:'orders_appointment_id_fkey'; columns:['appointment_id']; isOneToOne:true; referencedRelation:'appointments'; referencedColumns:['id'] }, { foreignKeyName:'orders_handled_by_fkey'; columns:['handled_by']; isOneToOne:false; referencedRelation:'profiles'; referencedColumns:['id'] }] };
      order_items: { Row: { id:number; order_id:number; item_type:'service'|'product'|'custom'; product_id:number|null; name:string; quantity:number; unit_amount:number; line_amount:number }; Insert: never; Update: never; Relationships: [{ foreignKeyName:'order_items_order_id_fkey'; columns:['order_id']; isOneToOne:false; referencedRelation:'orders'; referencedColumns:['id'] }] };
      finance_records: { Row: { id:number; type:'income'|'expense'; category:string; amount:number; occurred_at:string; notes:string|null; source:'manual'|'appointment'|'order'; appointment_id:number|null; order_id:number|null; voided_at:string|null; void_reason:string|null; created_at:string; updated_at:string }; Insert: { type:'income'|'expense'; category:string; amount:number; occurred_at?:string; notes?:string|null; source?:'manual'|'appointment'|'order'; appointment_id?:number|null; order_id?:number|null }; Update: { category?:string; amount?:number; occurred_at?:string; notes?:string|null }; Relationships: [{ foreignKeyName:'finance_records_appointment_id_fkey'; columns:['appointment_id']; isOneToOne:true; referencedRelation:'appointments'; referencedColumns:['id'] }, { foreignKeyName:'finance_records_order_id_fkey'; columns:['order_id']; isOneToOne:true; referencedRelation:'orders'; referencedColumns:['id'] }] };
      stock_adjustments: { Row: { id: number; product_id: number; order_id: number | null; quantity_delta: number; resulting_stock: number; reason: string; created_at: string }; Insert: never; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      create_appointment: { Args: { p_customer_id: number; p_service_id: number; p_start_time: string; p_status?: string; p_custom_items?: unknown[]; p_note?: string }; Returns: Database['public']['Tables']['appointments']['Row'] };
      update_appointment: { Args: { p_id: number; p_customer_id: number; p_service_id: number; p_start_time: string; p_status: string; p_custom_items?: unknown[]; p_note?: string }; Returns: Database['public']['Tables']['appointments']['Row'] };
      checkout_appointment: { Args: { p_appointment_id: number; p_idempotency_key: string; p_product_items?: unknown[]; p_custom_items?: unknown[]; p_payment_method?: string; p_discount?: number }; Returns: { order_id: number; total_amount: number }[] };
      archive_appointment: { Args: { p_appointment_id: number }; Returns: number };
      get_reconciliation_staff: { Args: Record<string, never>; Returns: { id:string; full_name:string }[] };
      get_reconciliation_report: { Args: { p_start_date:string; p_end_date:string; p_status?:string|null; p_payment_method?:string|null; p_handled_by?:string|null }; Returns: { order_id:number; appointment_id:number; transaction_at:string; order_status:'paid'|'refunded'; customer_name:string; customer_phone:string; item_details:unknown; original_amount:number; discount_amount:number; final_amount:number; payment_method:'cash'|'credit_card'|'line_pay'|'bank_transfer'; handled_by:string|null; handled_by_name:string; notes:string|null }[] };
      adjust_product_stock: { Args: { p_product_id: number; p_quantity_delta: number; p_reason: string }; Returns: number };
      update_product: { Args: { p_product_id: number; p_name: string; p_price: number; p_stock: number; p_vendor?: string | null; p_active?: boolean }; Returns: number };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const isSupabaseConfigured = Boolean(url && anonKey);
if (Boolean(url) !== Boolean(anonKey)) throw new Error('Supabase configuration requires both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
if (url && !/^https:\/\/[^/]+\.supabase\.co$/.test(url)) throw new Error('VITE_SUPABASE_URL is not a valid Supabase project URL.');

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase mode is not configured. Set both VITE_SUPABASE_* variables or remove both to use Express/SQLite mode.');
  return supabase;
}

export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(`Supabase request failed: ${error.message}`);
  if (data === null) throw new Error('Supabase request returned no data.');
  return data;
}

// This is Vite, not Next.js: there are no Server Components or API Routes here.
// Never import service-role/server secrets into frontend code or expose them as VITE_* variables.
