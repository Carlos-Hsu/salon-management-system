# 美髮沙龍管理系統（Salon Management System）

專為單人／小型美髮沙龍設計的營運管理系統，整合預約排程、顧客與服務資料、產品庫存、原子結帳、收支統計及打烊支付對帳。

- **Production**：<https://salon-management-system-beta.vercel.app>
- **資料來源**：Supabase Cloud
- **行事曆模型**：單一工作室共用排程（目前不區分多位造型師）

## 專案簡介

Salon Management System 以行動裝置操作為優先。使用者可直接點擊預約卡片開啟詳情，完成編輯、改期、狀態變更、結帳或刪除，不必在不同畫面間反覆切換。

結帳由 PostgreSQL RPC 在單一交易內處理訂單、明細、庫存及收入；預約作廢同樣以原子化流程註銷訂單與收支，並安全回補先前扣除的產品庫存。顧客永久刪除時，亦經由安全的 Cascade RPC 交易，確保在刪除顧客資料時，同步清理關聯預約、訂單與財務紀錄。

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
- RPC PUBLIC／anon 執行權限撤銷
- RLS 與 Super Admin 權限控管
- DEV-only 緊急唯讀 PIN；不會繞過 Supabase Auth 或 RLS

## 核心功能亮點

### 預約與顧客管理

- 直覺式預約卡片操作，點擊即可開啟詳情與完整操作 Modal。
- 待確認預約可直接進入結帳流程，系統會依合法順序自動推進 待確認 -> 已確認 -> 服務中 -> 結帳完成。
- 支援顧客／服務調整、改期、狀態變更、封鎖時段與撞期防護。
- 提供顧客資料徹底刪除（Cascade Hard Delete）機制：透過 PostgreSQL RPC permanently_delete_customer 在單一交易中按外鍵層級徹底清除關聯之預約、訂單、產品調整與財務紀錄，避免 409 外鍵衝突並確保資料一致性。

### 財務與打烊封帳

- 結帳自動建立 Orders、Order Items、Finance Records 及庫存調整紀錄。
- 收支頁面提供收入、支出、淨利、現金收入與 LINE Pay 收入統計。
- 支援現金／LINE Pay 的打烊支付封帳與明細核對。
- 已結帳預約作廢時，自動註銷訂單與收入，不再列入收支或封帳統計。
- 產品庫存僅回補一次；重試或併發操作不會造成重複退庫存。

### 安全防護

- 全站登入 Gate，未取得有效 Session 前不載入營運資料。
- Supabase RLS 是資料存取的最終授權邊界。
- 營運 RPC 僅授權 authenticated，並撤銷 PostgreSQL 預設 PUBLIC 執行權限。
- Cloudflare Turnstile Token 由 Supabase Auth 驗證，不採可繞過的前端模擬驗證。
- Service-role Key、資料庫密碼及 Turnstile Secret 不會進入瀏覽器 Bundle。

## 專案結構

frontend/                React / Vite 前端
backend/                 Express / SQLite 相容與本地測試後端
supabase/schema.sql       新 Supabase 專案的完整 canonical schema
supabase/migrations/     既有 Supabase 專案的增量 migration
supabase/tests/          RLS 與 RPC 權限驗證 SQL

## 本地開發

### 必要條件

- Node.js 20+
- npm
- Supabase 專案及可供瀏覽器使用的 Publishable／Anon Key
- Cloudflare Turnstile Site Key

### 安裝與啟動

git clone https://github.com/Carlos-Hsu/salon-management-system.git
cd salon-management-system/frontend
npm install

建立本機環境檔：
cp .env.example .env.local

填妥環境變數後啟動：
npm run dev -- --host 0.0.0.0

開啟 http://localhost:5173。

## Supabase Schema 與 Migration

### 既有 Supabase 專案

本專案採用 SQL Editor 手動套用 migration，請依檔名順序逐一執行：

supabase/migrations/20260823_finance_records.sql
supabase/migrations/20260824_closeout_reconciliation.sql
supabase/migrations/20260825_super_admin_settings_security.sql
supabase/migrations/20260826_profile_full_name.sql
supabase/migrations/20260827_authenticated_core_rls.sql
supabase/migrations/20260828_revoke_public_rpc_execute.sql
supabase/migrations/20260829_edit_and_archive_appointments.sql
supabase/migrations/20260830_void_archived_appointment_financials.sql
supabase/migrations/20260902_delete_customer_cascade.sql

## 測試與正式建置

cd frontend
npm run lint
npm run build

cd ../backend
npm install
npm test
