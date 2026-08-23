import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Minimal generated-style schema typing. Regenerate from Supabase after deployment. */
export type Database = {
  public: {
    Tables: {
      customers: { Row: { id: number; name: string; phone: string; email: string | null; note: string | null; created_at: string; updated_at: string }; Insert: { name: string; phone: string; email?: string | null; note?: string | null }; Update: { name?: string; phone?: string; email?: string | null; note?: string | null }; Relationships: [] };
      services: { Row: { id: number; name: string; duration_min: number; price: number; active: boolean; created_at: string; updated_at: string }; Insert: { name: string; duration_min: number; price: number; active?: boolean }; Update: { name?: string; duration_min?: number; price?: number; active?: boolean }; Relationships: [] };
      products: { Row: { id: number; name: string; price: number; stock: number; vendor: string | null; active: boolean; created_at: string; updated_at: string }; Insert: { name: string; price: number; stock: number; vendor?: string | null; active?: boolean }; Update: { name?: string; price?: number; stock?: number; vendor?: string | null; active?: boolean }; Relationships: [] };
      appointments: { Row: { id: number; customer_id: number; service_id: number; start_time: string; end_time: string; status: 'pending'|'confirmed'|'in_service'|'completed'|'cancelled'; total_amount: number; custom_items: unknown[]; note: string | null; created_at: string; updated_at: string }; Insert: never; Update: never; Relationships: [{ foreignKeyName:'appointments_customer_id_fkey'; columns:['customer_id']; isOneToOne:false; referencedRelation:'customers'; referencedColumns:['id'] }, { foreignKeyName:'appointments_service_id_fkey'; columns:['service_id']; isOneToOne:false; referencedRelation:'services'; referencedColumns:['id'] }] };
      blocked_times: { Row: { id: number; title: string; start_time: string; end_time: string; created_at: string; updated_at: string }; Insert: { title: string; start_time: string; end_time: string }; Update: { title?: string; start_time?: string; end_time?: string }; Relationships: [] };
      stock_adjustments: { Row: { id: number; product_id: number; order_id: number | null; quantity_delta: number; resulting_stock: number; reason: string; created_at: string }; Insert: never; Update: never; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      create_appointment: { Args: { p_customer_id: number; p_service_id: number; p_start_time: string; p_status?: string; p_custom_items?: unknown[]; p_note?: string }; Returns: Database['public']['Tables']['appointments']['Row'] };
      update_appointment: { Args: { p_id: number; p_customer_id: number; p_service_id: number; p_start_time: string; p_status: string; p_custom_items?: unknown[]; p_note?: string }; Returns: Database['public']['Tables']['appointments']['Row'] };
      checkout_appointment: { Args: { p_appointment_id: number; p_idempotency_key: string; p_product_items?: unknown[]; p_custom_items?: unknown[]; p_payment_method?: string; p_discount?: number }; Returns: { order_id: number; total_amount: number }[] };
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
