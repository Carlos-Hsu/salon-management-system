const API_BASE_URL = 'http://localhost:5000/api'; // 在實際環境中可替換為您的電腦 IP 以利手機連線

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  created_at?: string;
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  stock_quantity: number;
}

export interface Staff {
  id?: number;
  name: string;
  title?: string;
}

export interface Appointment {
  id?: number;
  customer_id: number;
  customerName?: string;
  service: string;
  start_time: string;
  end_time: string;
  status?: 'pending' | 'completed' | 'cancelled';
  price: number;
  notes?: string;
}

export interface DashboardStats {
  todayAppointments: number;
  todayRevenue: number;
  totalCustomers: number;
}

export interface Transaction {
  id?: number;
  type: 'income' | 'expense';
  item_id: number;
  itemName?: string;
  amount: number;
  date?: string;
  notes?: string;
}

export interface TransactionItem {
  id: number;
  name: string;
}

export const api = {
  // Dashboard
  getStats: async (): Promise<DashboardStats> => {
    const res = await fetch(`${API_BASE_URL}/dashboard/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    return {
      todayAppointments: data.todayAppointments || 0,
      todayRevenue: data.todayRevenue || 0,
      totalCustomers: data.totalCustomers || 0,
    };
  },

  // Appointments
  getAppointments: async (): Promise<Appointment[]> => {
    const res = await fetch(`${API_BASE_URL}/appointments`);
    if (!res.ok) throw new Error('Failed to fetch appointments');
    return res.json();
  },

  createAppointment: async (appointment: Appointment): Promise<{ id: number }> => {
    const res = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    });
    if (!res.ok) throw new Error('Failed to create appointment');
    return res.json();
  },

  updateAppointment: async (appointment: Appointment): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/appointments/${appointment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    });
    if (!res.ok) throw new Error('Failed to update appointment');
  },

  deleteAppointment: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete appointment');
  },

  // Customers
  getCustomers: async (): Promise<Customer[]> => {
    const res = await fetch(`${API_BASE_URL}/customers`);
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  createCustomer: async (customer: Customer): Promise<{ id: number }> => {
    const res = await fetch(`${API_BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    if (!res.ok) throw new Error('Failed to create customer');
    return res.json();
  },

  updateCustomer: async (customer: Customer): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/customers/${customer.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    if (!res.ok) throw new Error('Failed to update customer');
  },

  deleteCustomer: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete customer');
  },

  // Products
  getProducts: async (): Promise<Product[]> => {
    const res = await fetch(`${API_BASE_URL}/products`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  createProduct: async (product: Omit<Product, 'id'>): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) throw new Error('Failed to create product');
  },

  // Staff
  getStaffList: async (): Promise<Staff[]> => {
    const res = await fetch(`${API_BASE_URL}/staff`);
    if (!res.ok) throw new Error('Failed to fetch staff');
    return res.json();
  },

  createStaff: async (staff: Omit<Staff, 'id'>): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staff),
    });
    if (!res.ok) throw new Error('Failed to create staff');
  },

  // Transactions
  getIncomeItems: async (): Promise<TransactionItem[]> => {
    const res = await fetch(`${API_BASE_URL}/income_items`);
    if (!res.ok) throw new Error('Failed to fetch income items');
    return res.json();
  },

  getExpenseItems: async (): Promise<TransactionItem[]> => {
    const res = await fetch(`${API_BASE_URL}/expense_items`);
    if (!res.ok) throw new Error('Failed to fetch expense items');
    return res.json();
  },

  getTransactions: async (startDate?: string, endDate?: string): Promise<Transaction[]> => {
    let url = `${API_BASE_URL}/transactions`;
    if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  createTransaction: async (transaction: Transaction): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!res.ok) throw new Error('Failed to create transaction');
  },

  updateTransaction: async (transaction: Transaction): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/transactions/${transaction.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
  },

  deleteTransaction: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete transaction');
  },
};
