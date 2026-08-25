# 美髮沙龍管理系統（Salon Management System）

專為單人／小型美髮沙龍設計的營運管理系統，整合預約排程、顧客與服務資料、產品庫存、原子結帳、收支統計及打烊支付對帳。

- **Production**：<https://salon-management-system-beta.vercel.app>
- **資料來源**：Supabase Cloud
- **行事曆模型**：單一工作室共用排程（目前不區分多位造型師）

## 專案簡介

Salon Management System 以行動裝置操作為優先。使用者可直接點擊預約卡片開啟詳情，完成編輯、改期、狀態變更、結帳或刪除，不必在不同畫面間反覆切換。

結帳由 PostgreSQL RPC 在單一交易內處理訂單、明細、庫存及收入；預約作廢同樣以原子化流程註銷訂單與收支，並安全回補先前扣除的產品庫存。

## 技術棧（Tech Stack）

### 前端

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Radix UI
- Vercel Production Hosting

### 後端與資料庫

- Supabase
  - PostgreSQL
  - Supabase Auth 與持久化 Session
  - Row Level Security（RLS）
  - PostgreSQL RPC、Triggers、Constraints
  - Realtime

### 安全防護

- Cloudflare Turnstile CAPTCHA（Bot Protection）
- Supabase Auth CAPTCHA 驗證
- RPC `PUBLIC`／`anon` 執行權限撤銷
- RLS 與 Super Admin 權限控管
- DEV-only 緊急唯讀 PIN；不會繞過 Supabase Auth 或 RLS

## 核心功能亮點

### 預約管理

- 直覺式預約卡片操作，點擊即可開啟詳情與完整操作 Modal。
- 待確認預約可直接進入結帳流程，系統會依合法順序自動推進 `待確認 → 已確認 → 服務中 → 結帳完成`。
- 支援顧客／服務調整、改期、狀態變更、封鎖時段與撞期防護。
- 軟刪除保留稽核關聯，同時從有效行事曆與時段占用中排除。

### 財務與打烊封帳

- 結帳自動建立 Orders、Order Items、Finance Records 及庫存調整紀錄。
- 收支頁面提供收入、支出、淨利、現金收入與 LINE Pay 收入統計。
- 支援現金／LINE Pay 的打烊支付封帳與明細核對。
- 已結帳預約作廢時，自動註銷訂單與收入，不再列入收支或封帳統計。
- 產品庫存僅回補一次；重試或併發操作不會造成重複退庫存。

### 安全防護

- 全站登入 Gate，未取得有效 Session 前不載入營運資料。
- Supabase RLS 是資料存取的最終授權邊界。
- 營運 RPC 僅授權 `authenticated`，並撤銷 PostgreSQL 預設 `PUBLIC` 執行權限。
- Cloudflare Turnstile Token 由 Supabase Auth 驗證，不採可繞過的前端模擬驗證。
- Service-role Key、資料庫密碼及 Turnstile Secret 不會進入瀏覽器 Bundle。

## 專案結構

```text
frontend/                 React / Vite 前端
backend/                  Express / SQLite 相容與本地測試後端
supabase/schema.sql       新 Supabase 專案的完整 canonical schema
supabase/migrations/      既有 Supabase 專案的增量 migration
supabase/tests/           RLS 與 RPC 權限驗證 SQL
```

## 本地開發

### 必要條件

- Node.js 20+
- npm
- Supabase 專案及可供瀏覽器使用的 Publishable／Anon Key
- Cloudflare Turnstile Site Key

### 安裝與啟動

```bash
git clone https://github.com/Carlos-Hsu/salon-management-system.git
cd salon-management-system/frontend
npm install
```

建立本機環境檔：

```bash
cp .env.example .env.local
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env.local
```

填妥環境變數後啟動：

```bash
npm run dev -- --host 0.0.0.0
```

開啟 <http://localhost:5173>。

## 環境變數（Env Variables）

前端範例位於 [`frontend/.env.example`](frontend/.env.example)：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
VITE_TURNSTILE_SITE_KEY=YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY

# 僅在使用本機 Express 相容 API 時需要
# VITE_API_URL=http://localhost:5000/api
```

| 變數 | 必要性 | 說明 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 必要 | Supabase Project URL。 |
| `VITE_SUPABASE_ANON_KEY` | 必要 | 瀏覽器可使用的 Publishable／Anon Key；實際權限仍受 Auth 與 RLS 控制。 |
| `VITE_TURNSTILE_SITE_KEY` | 必要 | Cloudflare Turnstile 公開 Site Key。 |
| `VITE_API_URL` | 選用 | 本機 Express／SQLite 相容 API URL；Supabase Cloud 模式不需要。 |

> 所有 `VITE_*` 變數都會編譯進瀏覽器 Bundle。禁止放入 Supabase Service-role Key、資料庫密碼、Turnstile Secret 或任何伺服器私密憑證。

Turnstile **Secret Key** 必須設定於 Supabase Dashboard 的 Auth CAPTCHA／Bot Protection 設定；Vercel 僅設定公開的 `VITE_TURNSTILE_SITE_KEY`。Production 環境變數請在 Vercel Project Settings 中設定後重新部署。

## Supabase Schema 與 Migration

### 新 Supabase 專案

1. 確認 Supabase Project Ref 與目標環境。
2. 先備份資料庫。
3. 開啟 Supabase Dashboard → **SQL Editor**。
4. 執行 [`supabase/schema.sql`](supabase/schema.sql) 的完整內容。
5. 建立 Auth 使用者，並確認 `profiles`、Super Admin、RLS、Triggers 與 RPC 正常。
6. 執行 [`supabase/tests/authenticated_rls_checks.sql`](supabase/tests/authenticated_rls_checks.sql) 驗證權限。

### 既有 Supabase 專案

本專案採用 SQL Editor 手動套用 migration，不需要執行 `supabase link`。請依檔名順序逐一執行尚未套用的檔案：

```text
supabase/migrations/20260823_finance_records.sql
supabase/migrations/20260824_closeout_reconciliation.sql
supabase/migrations/20260825_super_admin_settings_security.sql
supabase/migrations/20260826_profile_full_name.sql
supabase/migrations/20260827_authenticated_core_rls.sql
supabase/migrations/20260828_revoke_public_rpc_execute.sql
supabase/migrations/20260829_edit_and_archive_appointments.sql
supabase/migrations/20260830_void_archived_appointment_financials.sql
```

執行步驟：

1. 在 SQL Editor 建立新 Query。
2. 複製單一 migration 的完整 SQL 並執行。
3. 確認成功後再執行下一個檔案，不要跳號。
4. 全部完成後執行：

```text
supabase/tests/authenticated_rls_checks.sql
```

若環境已由團隊事先安全連結 Supabase CLI，可先檢查再推送：

```bash
npx supabase db push --dry-run
npx supabase db push
```

請勿在未確認 Project Ref、備份及目標環境前執行 migration 或建立新的 CLI link。

## 測試與正式建置

```bash
cd frontend
npm run lint
npm run build

cd ../backend
npm install
npm test
```

目前 backend 測試涵蓋預約撞期、狀態轉換、原子結帳、收入作廢及庫存回補冪等性。

## 部署

前端部署於 Vercel。部署前請確認：

1. Supabase migrations 已套用。
2. Vercel Production 環境變數完整。
3. Supabase Auth 已啟用 Turnstile CAPTCHA，且 Site／Secret Key 相符。
4. `npm run lint` 與 `npm run build` 通過。
5. 部署後直接檢查 Production Bundle 與主要登入、預約、結帳及收支流程。
