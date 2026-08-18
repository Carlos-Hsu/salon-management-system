import { useState, useEffect } from 'react';
import { Home, Calendar as CalendarIcon, Users, Settings as SettingsIcon, Menu, Package, DollarSign, User } from 'lucide-react';
import { api, Customer, Appointment, DashboardStats, Product, Transaction, TransactionItem, Staff } from './api';
import { Dashboard } from './components/Dashboard';
import { CalendarView } from './components/CalendarView';
import { CustomersView } from './components/CustomersView';
import { ProductsView } from './components/ProductsView';
import { FinanceView } from './components/FinanceView';
import { StaffView } from './components/StaffView';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [stats, setStats] = useState<DashboardStats>({ todayAppointments: 0, todayRevenue: 0, totalCustomers: 0 });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeItems, setIncomeItems] = useState<TransactionItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<TransactionItem[]>([]);

  // 載入資料
  const loadData = async () => {
    try {
      const [fetchedStats, fetchedAppointments, fetchedCustomers, fetchedProducts, fetchedStaff, fetchedTransactions, fetchedIncomeItems, fetchedExpenseItems] = await Promise.all([
        api.getStats(),
        api.getAppointments(),
        api.getCustomers(),
        api.getProducts(),
        api.getStaffList(),
        api.getTransactions(),
        api.getIncomeItems(),
        api.getExpenseItems(),
      ]);
      setStats(fetchedStats);
      setAppointments(fetchedAppointments);
      setCustomers(fetchedCustomers);
      setProducts(fetchedProducts);
      setStaffList(fetchedStaff);
      setTransactions(fetchedTransactions);
      setIncomeItems(fetchedIncomeItems);
      setExpenseItems(fetchedExpenseItems);
    } catch (err) {
      console.error('載入資料失敗:', err);
    }
  };

  useEffect(() => {
    loadData();
    // 設定每 10 秒自動同步
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // 預約的 handler
  const handleCreateAppointment = async (newApp: Omit<Appointment, 'id'>) => {
    await api.createAppointment(newApp as Appointment);
    await loadData();
  };
  const handleUpdateAppointment = async (app: Appointment) => {
    await api.updateAppointment(app);
    await loadData();
  };
  const handleDeleteAppointment = async (id: number) => {
    await api.deleteAppointment(id);
    await loadData();
  };

  // 顧客的 handler
  const handleCreateCustomer = async (newCust: Omit<Customer, 'id'>) => {
    const res = await api.createCustomer(newCust as Customer);
    await loadData();
    return res;
  };
  const handleUpdateCustomer = async (cust: Customer) => {
    await api.updateCustomer(cust);
    await loadData();
  };
  const handleDeleteCustomer = async (id: number) => {
    await api.deleteCustomer(id);
    await loadData();
  };

  return (
    <div className="app-container">
      {/* 頂部導航列 (行動裝置標題列) */}
      <header className="top-nav">
        <h1 className="brand-title">
          <Menu size={22} style={{ color: 'var(--primary-color)' }} />
          <span>美容美髮沙龍管理系統</span>
        </h1>
      </header>

      {/* 主要內容展示 */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard stats={stats} onNavigate={setActiveTab} />
        )}
        {activeTab === 'calendar' && (
          <CalendarView 
            appointments={appointments} 
            customers={customers} 
            products={products}
            onCreateAppointment={handleCreateAppointment}
            onUpdateAppointment={handleUpdateAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            onCreateCustomer={handleCreateCustomer}
          />
        )}
        {activeTab === 'customers' && (
          <CustomersView 
            customers={customers} 
            onCreateCustomer={handleCreateCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}
        {activeTab === 'products' && (
          <ProductsView
            products={products}
            vendors={[]}
            onCreateProduct={async (p) => { await api.createProduct(p); await loadData(); }}
            onUpdateProduct={async (p) => { /* TODO: Implement backend API */ }}
            onDeleteProduct={async (id) => { /* TODO: Implement backend API */ }}
          />
        )}
        {activeTab === 'staff' && (
          <StaffView
            staffList={staffList}
            onCreateStaff={async (s) => { await api.createStaff(s); await loadData(); }}
            onUpdateStaff={async (s) => { /* TODO: Implement backend API */ }}
            onDeleteStaff={async (id) => { /* TODO: Implement backend API */ }}
          />
        )}
        {activeTab === 'finance' && (
          <FinanceView
            incomeItems={incomeItems}
            expenseItems={expenseItems}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'settings' && (
          <div className="card" style={{ animation: 'fadeIn 0.5s ease' }}>
            <h2 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>系統設定</h2>
            <button className="btn" onClick={loadData}>立即手動強制同步</button>
          </div>
        )}
      </main>

      {/* 底部導航欄 */}
      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <Home size={20} />
          <span>概覽</span>
        </button>
        <button className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
          <CalendarIcon size={20} />
          <span>預約</span>
        </button>
        <button className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
          <Users size={20} />
          <span>客戶</span>
        </button>
        <button className={`nav-item ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
          <Package size={20} />
          <span>產品</span>
        </button>
        <button className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>
          <User size={20} />
          <span>設計師</span>
        </button>
        <button className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
          <DollarSign size={20} />
          <span>收支</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
