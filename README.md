# 美髮沙龍管理系統（Salon Management System）

專為單人美髮工作室設計的響應式管理系統，整合顧客、服務、產品、預約排程、封鎖時段、結帳與庫存管理。核心資料使用 Supabase PostgreSQL，並透過 Realtime 在不同裝置間同步更新。

## 線上版本

**正式環境：<https://salon-management-system-beta.vercel.app>**

## 核心功能

- **顧客、服務與產品管理**：提供新增、查詢、修改、停用及安全刪除等 CRUD 操作。
- **預約排程與時段防護**：支援月、週、日與列表檢視，防止重複預約、預約與封鎖時段撞期，以及封鎖時段互相重疊。
- **預約狀態保護**：依序執行 `Pending → Confirmed → In-Service → Completed`，避免終態被任意反轉。
- **購物車結帳與庫存扣抵**：Atomic Checkout RPC 以單一交易建立訂單、扣除庫存及寫入稽核紀錄，並支援冪等性與庫存不足回滾。
- **Supabase Realtime**：即時同步顧客、服務、產品、預約及封鎖時段異動。
- **響應式介面**：MUJI Morandi Dark 視覺風格，支援桌面、平板與手機。

## 技術棧

| 類別 | 技術 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite |
| UI | Tailwind CSS、Radix UI、Lucide React |
| 資料庫 | Supabase PostgreSQL |
| 即時同步 | Supabase Realtime |
| 資料存取 | Supabase JavaScript Client、PostgreSQL RPC／Trigger／Constraint |
| 部署 | Vercel |
| 本機相容層 | Express、SQLite（收支與假日加價功能） |

> 本專案目前是 **React + Vite**，不是 Next.js。Supabase Auth 尚未正式導入；正式開放敏感資料前，必須啟用 Auth 並將開發用匿名 RLS Policy 改為 owner／tenant scoped Policy。

## 專案結構

```text
salon-management-system/
├── frontend/             # React + Vite 前端
├── backend/              # Express + SQLite 本機相容 API
├── supabase/
│   ├── schema.sql        # PostgreSQL schema、RLS、Trigger 與 RPC
│   └── README.md         # Supabase 資料層補充說明
└── .github/workflows/    # GitHub Actions
```

## 本地開發

### 需求

- Node.js 22+
- npm
- Supabase 專案

### 1. 取得專案

```bash
git clone https://github.com/Carlos-Hsu/salon-management-system.git
cd salon-management-system
```

### 2. 設定 Supabase 環境變數

建立 `frontend/.env.local`：

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

如需在本機使用尚未遷移至 Supabase 的收支與假日加價功能，可再加入：

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Vercel 正式環境需設定同名的 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。根目錄 `.env.local` 可保留以下相容命名，但 Vite 不會直接讀取 `NEXT_PUBLIC_*`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

> `.env.local` 已被 Git 忽略。請勿提交資料庫密碼、Supabase service-role key 或其他私密憑證；瀏覽器端只能使用 publishable／anon key。

### 3. 部署 Supabase Schema

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)。
2. 選擇專案並開啟 **SQL Editor**。
3. 建立新的 Query。
4. 複製 [`supabase/schema.sql`](supabase/schema.sql) 的完整內容並貼入。
5. 執行 SQL，確認資料表、索引、RLS Policy、Trigger 與 RPC 建立成功。
6. 至 **Database → Replication／Publications** 確認相關資料表已加入 `supabase_realtime` publication。

Schema 會建立顧客、服務、產品、預約、封鎖時段、訂單、訂單明細及庫存異動等資料結構。重新對既有資料庫執行前，請先完成備份並審閱 migration 內容。

### 4. 啟動前端

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

開啟 <http://localhost:5173>。

### 5. 啟動本機相容 API（選用）

```bash
cd backend
npm install
npm start
```

API 預設位於 <http://localhost:5000>。Supabase 已設定時，核心 CRUD 與預約／結帳流程不會在請求失敗後靜默退回 SQLite，避免資料分裂。

## 驗證

```bash
cd frontend
npm run lint
npm run build

cd ../backend
npm test
```

## 資料安全

- 核心撞期、狀態轉換、結帳、庫存扣抵及冪等性由 PostgreSQL Constraint、Trigger 或 RPC 強制執行。
- 只有 `Completed` 預約可完成入帳，失敗交易會完整回滾。
- `VITE_*` 與 `NEXT_PUBLIC_*` 變數會公開至瀏覽器，絕不可存放 service-role key 或資料庫密碼。
- 目前 schema 的 `dev_anon_all` Policy 僅適合開發／測試；正式使用前應導入 Supabase Auth 與租戶隔離。

## License

本專案目前未指定開源授權條款。
