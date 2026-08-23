import type { BookingItem, CheckoutProduct, WeekDaySummary } from './types';

export const mockWeek: WeekDaySummary[] = [
  { isoDate: '2026-03-09', weekday: '一', day: 9, bookingCount: 3 },
  { isoDate: '2026-03-10', weekday: '二', day: 10, bookingCount: 4 },
  { isoDate: '2026-03-11', weekday: '三', day: 11, bookingCount: 2, isToday: true },
  { isoDate: '2026-03-12', weekday: '四', day: 12, bookingCount: 5 },
  { isoDate: '2026-03-13', weekday: '五', day: 13, bookingCount: 3 },
  { isoDate: '2026-03-14', weekday: '六', day: 14, bookingCount: 2 },
  { isoDate: '2026-03-15', weekday: '日', day: 15, bookingCount: 1 },
];

export const mockBookings: BookingItem[] = [
  { id: 'bk-001', customerName: '王小美', phone: '0911-000-001', service: '女士剪髮', stylist: 'Owner', date: '2026-03-11', startTime: '09:00', endTime: '10:00', status: 'confirmed', price: 900, note: '自然層次，頭皮敏感' },
  { id: 'bk-002', customerName: '陳怡君', phone: '0911-000-002', service: '全頭染髮', stylist: 'Owner', date: '2026-03-11', startTime: '10:30', endTime: '13:00', status: 'in-service', price: 2800, note: '暖棕色系' },
  { id: 'bk-003', customerName: '私人時段', phone: '', service: '午休／備料', stylist: 'Owner', date: '2026-03-11', startTime: '13:00', endTime: '14:00', status: 'locked', price: 0 },
  { id: 'bk-004', customerName: '林雅雯', phone: '0911-000-003', service: '深層護髮', stylist: 'Owner', date: '2026-03-11', startTime: '14:30', endTime: '15:30', status: 'confirmed', price: 1200 },
  { id: 'bk-005', customerName: '張志豪', phone: '0911-000-004', service: '男士剪髮', stylist: 'Owner', date: '2026-03-11', startTime: '16:00', endTime: '16:45', status: 'confirmed', price: 700 },
];

export const mockCheckoutProducts: CheckoutProduct[] = [
  { id: 'pd-001', name: '護色髮油', quantity: 1, unitPrice: 760 },
];
