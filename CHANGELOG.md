# Changelog

本專案的重大變更均記錄於此文件，版本號遵循 [Semantic Versioning](https://semver.org/)。

## [1.1.0] - 2026-08-24

### Added

- 新增全站 `GlobalAuthGate`：未登入時阻擋應用程式掛載，避免預先載入營運資料、Realtime 與輪詢。
- 整合 Supabase Auth 原生 Cloudflare Turnstile CAPTCHA 驗證，登入 Token 由 Supabase 後端驗證。
- 實作 Supabase Session 持久化與自動還原，重新整理或切換頁面後可保持登入。
- 新增 `profiles.role = super_admin` 多管理者授權模型與受 RLS 保護的設定、服務管理權限。
- 新增 localhost／開發環境限定的緊急 PIN 唯讀通道；不建立 Auth Session，亦不授予 Supabase 寫入權限。
- 新增管理者 `full_name` 顯示支援及超級管理者狀態列。

### Changed

- Dashboard 改用即時營運資料並支援載入、零值與空狀態。
- 重整基本設定、假日加價即時試算及服務管理介面。

### Security

- 登入失敗不鎖定 Email 帳號，避免攻擊者藉由暴力嘗試造成管理者帳號阻斷服務。
- PIN 唯讀模式透過前端 API mutation guard 阻擋新增、修改、刪除、結帳與庫存異動。
- Supabase Session 使用官方 SDK 的 `persistSession` 與自動 Token 更新機制。

[1.1.0]: https://github.com/Carlos-Hsu/salon-management-system/releases/tag/v1.1.0
