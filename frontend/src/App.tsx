import { lazy, Suspense, useState, useEffect } from 'react';
import { Home, Calendar as CalendarIcon, Users, Menu, Package, DollarSign, Settings } from 'lucide-react';
import { api, Customer, Appointment, Product, TransactionItem, Service, BlockTime } from './api';
import { Dashboard } from './components/Dashboard';
import { supabase } from './lib/supabase';

const CalendarView = lazy(() => import('./components/CalendarView').then(module => ({ default: module.CalendarView })));
const CustomersView = lazy(() => import('./components/CustomersView').then(module => ({ default: module.CustomersView })));
const ProductsView = lazy(() => import('./components/ProductsView').then(module => ({ default: module.ProductsView })));
const FinanceView = lazy(() => import('./components/FinanceView').then(module => ({ default: module.FinanceView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(module => ({ default: module.SettingsView })));
const BookingCheckoutPrototype = lazy(() => import('./features/booking-checkout/BookingCheckoutPrototype').then(module => ({ default: module.BookingCheckoutPrototype })));

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [calendarPreview, setCalendarPreview] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [blocks, setBlocks] = useState<BlockTime[]>([]);
  const [incomeItems, setIncomeItems] = useState<TransactionItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<TransactionItem[]>([]);
  const [dataError, setDataError] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Core data uses one explicit adapter; configured Supabase failures never fall back to SQLite.
  const loadData = async () => {
    try {
      const [fetchedAppointments, fetchedCustomers, fetchedProducts, fetchedServices, fetchedBlocks] = await Promise.all([
        api.getAppointments(), api.getCustomers(), api.getProducts(), api.getServices(), api.getBlocks(),
      ]);
      setAppointments(fetchedAppointments); setCustomers(fetchedCustomers); setProducts(fetchedProducts); setServices(fetchedServices); setBlocks(fetchedBlocks); setDataError('');
    } catch (err) {
      setDataError(err instanceof Error ? err.message : '核心資料載入失敗');
    } finally {
      setIsDataLoading(false);
    }
    // Finance uses Supabase when configured and the legacy Express API otherwise.
    try { const [income, expense] = await Promise.all([api.getIncomeItems(), api.getExpenseItems()]); setIncomeItems(income); setExpenseItems(expense); } catch { /* Finance view reports API errors when used. */ }
  };

  useEffect(() => {
    void loadData();
    const interval = setInterval(loadData, 10000);
    const channel = supabase?.channel('salon-core-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { void loadData(); })
      .subscribe();
    return () => {
      clearInterval(interval);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
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
          <Menu size={22} aria-hidden="true" />
          <span>美髮沙龍管理</span>
        </h1>
      </header>

      {/* 主要內容展示 */}
      <main className="main-content">
        {dataError && <p className="settings-error" role="alert">資料來源錯誤：{dataError}</p>}
        <Suspense fallback={<div className="dashboard-loading card" role="status">正在載入功能模組…</div>}>
        {activeTab === 'dashboard' && (
          <Dashboard
            appointments={appointments}
            blocks={blocks}
            customers={customers}
            isLoading={isDataLoading}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'calendar' && (<>
          <div className="view-switcher mx-auto mb-4 flex max-w-7xl gap-2 p-2">
            <button className={`min-h-12 flex-1 px-4 text-base font-bold ${calendarPreview?'active':''}`} onClick={() => setCalendarPreview(true)}>預約操作預覽</button>
            <button className={`min-h-12 flex-1 px-4 text-base font-bold ${!calendarPreview?'active':''}`} onClick={() => setCalendarPreview(false)}>正式預約行事曆</button>
          </div>
          {calendarPreview ? <BookingCheckoutPrototype appointments={appointments} customers={customers} services={services} products={products} onCreate={handleCreateAppointment} onRefresh={loadData} /> : <CalendarView
            appointments={appointments} 
            customers={customers} 
            products={products}
            services={services}
            blocks={blocks}
            onCreateAppointment={handleCreateAppointment}
            onUpdateAppointment={handleUpdateAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            onCreateBlock={async value => { await api.createBlock(value); await loadData(); }}
            onDeleteBlock={async id => { await api.deleteBlock(id); await loadData(); }}
          />}
        </>)}
        {activeTab === 'customers' && (
          <CustomersView 
            customers={customers} 
            onCreateCustomer={handleCreateCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}
        {activeTab === 'products' && (
          <ProductsView products={products} onRefresh={loadData} />
        )}
        {activeTab === 'finance' && (
          <FinanceView
            incomeItems={incomeItems}
            expenseItems={expenseItems}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'settings' && <SettingsView services={services} onRefresh={loadData} />}
        </Suspense>
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
        <button className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>
          <DollarSign size={20} /><span>收支</span>
        </button>
        <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={20} /><span>設定</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
