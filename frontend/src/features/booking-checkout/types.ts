export type BookingStatus = 'confirmed' | 'in-service' | 'locked';

export interface CustomLineItem {
  id: string;
  name: string;
  amount: number;
}

export interface BookingItem {
  id: string;
  customerName: string;
  phone: string;
  service: string;
  stylist: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  price: number;
  note?: string;
}

export interface CheckoutProduct {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface WeekDaySummary {
  isoDate: string;
  weekday: string;
  day: number;
  bookingCount: number;
  isToday?: boolean;
}
