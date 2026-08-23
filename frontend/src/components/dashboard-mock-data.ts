export type TimelineStatus = 'confirmed' | 'in-service' | 'completed' | 'locked';

export interface TimelineItem {
  id: string;
  time: string;
  endTime: string;
  customer: string;
  service: string;
  status: TimelineStatus;
  price?: number;
  phone?: string;
  notes?: string;
}

export const todayTimeline: TimelineItem[] = [
  { id: 'a1', time: '09:00', endTime: '10:30', customer: '林雅婷', service: '剪髮＋深層護髮', status: 'completed', price: 1800, phone: '0912 345 680', notes: '瀏海保留長度；頭皮較敏感' },
  { id: 'a2', time: '10:30', endTime: '12:30', customer: '張書妍', service: '質感染髮', status: 'completed', price: 2600, phone: '0988 201 477', notes: '偏暖棕，不漂髮' },
  { id: 'a3', time: '12:30', endTime: '13:15', customer: '午餐／器具消毒', service: '不開放預約', status: 'locked' },
  { id: 'a4', time: '13:15', endTime: '14:30', customer: '陳品潔', service: '女生精緻剪髮', status: 'in-service', price: 1600, phone: '0921 663 105', notes: '自然捲；希望好整理、不要打太薄' },
  { id: 'a5', time: '14:30', endTime: '16:00', customer: '許安安', service: '頭皮養護＋造型', status: 'confirmed', price: 2200, phone: '0935 820 114', notes: '第一次來店；偏好安靜服務，無香精產品' },
  { id: 'a6', time: '16:00', endTime: '16:30', customer: '補貨簽收', service: '鎖定時段', status: 'locked' },
  { id: 'a7', time: '16:30', endTime: '18:00', customer: '王思涵', service: '剪髮＋快速護髮', status: 'confirmed', price: 1900, phone: '0905 411 928', notes: '需準時於 18:00 離店' },
  { id: 'a8', time: '18:00', endTime: '20:00', customer: '周怡君', service: '長髮染髮', status: 'confirmed', price: 2800, phone: '0977 306 225', notes: '帶參考照片；預留灰棕色配方' },
];

export const unavailableTimes = todayTimeline.filter(item => item.status === 'locked');
export const nextUp = todayTimeline.find(item => item.status === 'confirmed')!;
export const todayAppointmentCount = todayTimeline.filter(item => item.status !== 'locked').length;
export const todayProjectedRevenue = todayTimeline.reduce((sum, item) => sum + (item.price ?? 0), 0);
export const weeklyAppointmentCount = 23;
