# 系統型態判定與架構盤點規則（System Type & Architecture Rule）

執行 `refactor:init` (`rai`) 時，必須針對目標舊系統進行系統型態判定與全域架構盤點，寫入 `project/system/`。

## 1. 系統型態判定與涵蓋範圍說明（`project/system/overview.md`）

必須依據目標專案的目錄與設定檔特徵，明確判定其屬於 **Mobile APP**、**桌面應用程式（Application）** 或 **網頁系統（Web）**（若為混合或多模組專案則同時列出），並完整說明該型態在本專案涵蓋的範圍：

### A. Mobile APP（行動裝置應用）
- **特徵依據**：`AndroidManifest.xml`、`build.gradle` (Android)、`Info.plist` / `.xcodeproj` (iOS)、`pubspec.yaml` (Flutter)、`app.json` / `react-native` 等。
- **必須說明的涵蓋範圍**：
  1. 支援平台（iOS / Android / 跨平台框架）與最低系統版本要求。
  2. 畫面與導覽架構（Activities / Fragments / ViewControllers / Screens / Router）。
  3. 裝置權限與原生硬體呼叫（相機、定位、推播通知、藍牙、生物辨識等）。
  4. 本地儲存機制（SQLite / Room / CoreData / SharedPreferences / Keychain）與遠端 API 通訊方式。

### B. 桌面應用程式（Desktop Application）
- **特徵依據**：`.sln` / `.csproj` (WPF / WinForms / WinUI / MAUI)、`electron` / `tauri`、Java `Swing` / `JavaFX`、C++ `Qt` 等。
- **必須說明的涵蓋範圍**：
  1. 目標作業系統（Windows / macOS / Linux）與執行環境依賴（如 .NET Framework 版本、JRE）。
  2. 視窗與 UI 框架結構（Main Window、Dialogs、Forms、自訂控制項）。
  3. 本機資源依賴（本地檔案讀寫、Windows Registry 登錄檔、序列埠/硬體週邊、系統 API / DLL 呼叫）。
  4. 背景執行緒、本地資料庫或網路同步機制與打包安裝方式。

### C. 網頁系統（Web / Backend / Batch）
- **特徵依據**：`package.json` (React / Vue / Angular / Next.js / Nuxt)、`pom.xml` / `build.gradle` (Spring Web / Spring Boot / Spring Batch)、`composer.json` (Laravel / PHP)、ASP.NET Core / MVC 等。
- **必須說明的涵蓋範圍**：
  1. 架構型態（純前端 SPA、SSR、前後端混合 MVC、純後端 REST/SOAP API 服務，以及是否包含附屬 **Batch 批次排程程式**）。
  2. 路由與進入點機制（前端頁面路由、後端 Controller URL Mapping、或批次 Job / `@Scheduled` / `main()` 進入點）。
  3. 前後端通訊協定、資料格式（JSON / XML / Form / Multipart）與認證授權機制（Session / Cookie / JWT / OAuth2）。

## 2. 全域隱性機制必盤點（`project/system/architecture.md`）

為防止在分析單一功能時遺漏進入點之前的隱性邏輯，`architecture.md` 必須專門盤點：
- **全域攔截器與過濾器**（如 Spring `Filter`、`HandlerInterceptor`、Servlet Filter、Middleware）。
- **AOP 切面邏輯**（如 `@Aspect` 權限檢查、日誌、加解密、多租戶資料隔離、交易管理 `@Transactional`）。
- **全域異常處理與統一回傳格式**（如 `@ControllerAdvice`、`@ExceptionHandler`、全域 Error Code）。
