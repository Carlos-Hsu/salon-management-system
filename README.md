# Salon Management System (美髮沙龍管理系統)

線上正式環境：<https://salon-management-system-beta.vercel.app>

## 專案簡介

專為單人／小型美髮沙龍設計的管理系統，整合預約排程、顧客資料、服務項目與產品庫存管理，並支援自動化結帳與即時資料同步。

## 技術棧

- **Frontend**：Vite + React、TypeScript、Tailwind CSS
- **Backend & Database**：Supabase (PostgreSQL、Realtime、RPC、RLS)
- **Deployment**：Vercel
- **Version Control**：GitHub

> 本專案實際使用 Vite + React，並非 Next.js。Supabase Auth 尚未導入；正式處理敏感資料前，應啟用 Auth 並將開發用匿名 RLS Policy 改為 owner／tenant scoped Policy。

## 核心功能

1. **預約與行事曆管理**：支援預約時段防護、封鎖時段設定與撞期檢查 (PostgreSQL Exclusion Constraints & Advisory Locks)。
2. **顧客與服務管理**：完整 CRUD 顧客資料、服務項目與產品清單。
3. **購物車與結帳 (Checkout)**：扣抵庫存、計算折扣與金額，以 Atomic Transaction 防範競爭條件 (Race Conditions)，並提供冪等性與失敗回滾。
4. **Realtime 即時同步**：多裝置操作自動推播最新狀態。

## 環境變數設定 (`.env.local`)

Vite 前端實際讀取 `frontend/.env.local` 的 `VITE_*` 變數：

```env
VITE_SUPABASE_URL=https://tgnusjcsqwuvojykgrgj.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

根目錄可保留以下相容設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://tgnusjcsqwuvojykgrgj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

> `VITE_*` 與 `NEXT_PUBLIC_*` 都會公開至瀏覽器，只能使用 Supabase publishable／anon key。禁止放入 service-role key、資料庫密碼或其他私密憑證。

## Supabase 資料庫部署

1. 開啟 Supabase Dashboard 的 **SQL Editor**。
2. 複製 [`supabase/schema.sql`](supabase/schema.sql) 的完整內容。
3. 貼入 SQL Editor 並執行。
4. 確認資料表、索引、RLS Policies、Triggers、RPC Functions 與 Realtime publication 建立成功。

## 本地開發

```bash
git clone https://github.com/Carlos-Hsu/salon-management-system.git
cd salon-management-system/frontend
npm install
npm run dev -- --host 0.0.0.0
```

開啟 <http://localhost:5173>。

## 測試與建置

```bash
cd frontend
npm run lint
npm run build

cd ../backend
npm test
```

## 目前限制

- 行事曆採單一全域工作室資源，尚未支援多造型師獨立排程。
- Supabase Auth 與租戶隔離尚未導入。
- 收支與假日加價功能目前仍依賴本機 Express／SQLite API，尚未部署至 Vercel。
