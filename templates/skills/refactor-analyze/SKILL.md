---
name: refactor-analyze
description: 用 init、scandb、analyze <編號>、reanalyze <編號>、commit [編號] 流程對舊系統進行逆向重構分析，產出系統大概、DB 結構、業務邏輯、資料流、SQL、依賴關係、死程式碼與 Backlog。
---

# Refactor Analyze Skill (舊系統重構分析技能)

## 最高指導原則：禁止 AI 幻想鐵律（Zero-Hallucination Rule）

- **沒有來源依據，絕對不要亂寫（No Source, No Write）**：
  - 所有產出的系統型態、技術棧、架構、進入點參數（Request/Response/Input/Output Args）、業務邏輯、資料流、SQL 語句、依賴關係与死程式碼，**必須 100% 來自實際讀取到的原始碼、設定檔或 `scandb` 抓取的真實資料庫結構**。
  - 每一條業務規則、計算公式、驗證條件與狀態轉換，**必須標註原始碼檔案路徑與行號範圍**（如 `` `src/service/OrderService.java#L45-L92` ``）或資料庫表名/欄位。
- **禁止憑常識自行腦補**：
  - 凡是程式碼或資料庫中無註解、語意不明的欄位定義、未知狀態碼（Magic Numbers）或缺少的外部實作，**一律禁止猜測，強制寫入 `project/<編號>/backlog.md`**，待使用者補充後執行 `reanalyze <編號>` 更新。

---

## 核心指令流程

支援完整指令與 3 字母簡寫別名（兩者完全等價）：

| AI 指令 | 簡寫 | 對應 CLI 指令 | 用途與動作 |
|---|---|---|---|
| `refactor:init [路徑]` | `rai` | `refactor-analyze init` | **初始化與產出系統大概**：確認語言（`zh-TW`/`zh-CN`/`en`/`ja`/`ko`）、詢問目標系統路徑、檢查工作區與目標系統 Git 狀態並**詢問是否需要向 remote 對齊**，接著產出 `project/system/` 與分類編號清單 `project/index.md`。 |
| `refactor:scandb` | `ras` | `refactor-analyze scandb` | **連結資料庫掃描欄位**：呼叫本機 CLI `refactor-analyze scandb` 讀取 `project/system/db-connection.md`（**AI 嚴禁讀取或輸出密碼至對話框**），支援 SQLite、MySQL/MariaDB、PostgreSQL、SQL Server (`sqlcmd`)、Oracle (`sqlplus`) 與獨立 SSH ControlMaster 跳板機通道，強制以**唯讀 Session** 抓取所有 Table、欄位、PK/FK、Index、註解、View、Stored Procedure 與 Trigger，產出 `project/system/db-schema.md` 與 `project/system/db/<table>.md`。 |
| `refactor:analyze <編號>` | `raa` | `refactor-analyze analyze <編號>` | **依編號分析業務邏輯**：依 `project/index.md` 的編號新建 `project/<編號>/` 資料夾，從進入點深入分析並產出 `analysis.md`、`business-logic.md`、`ui-behavior.md`、`data-flow.md`、`sql.md`、`dependencies.md`、`dead-code.md`，並**自動產出 `backlog.md`**。 |
| `refactor:reanalyze <編號>` | `rar` | `refactor-analyze reanalyze <編號>` | **重新分析單一編號**：讀取 `project/<編號>/backlog.md` 補充內容與目標系統最新 Git 版本/程式碼，**再分析一次**並更新 `project/<編號>/` 內所有文件。 |
| `refactor:verify [編號]` | `rav` | `refactor-analyze verify [編號]` | **0-Token 驗證來源與版本飄移**：驗證 `project/<編號>/` 內所有 `` `<file>#L<start>-L<end>` `` 原始碼檔案與行號是否真實存在，並檢查目標系統 Git Commit 是否改版導致行號偏移。 |
| `refactor:commit [編號]` | `rac` | `refactor-analyze commit [編號]` | **確認歸檔與 Git 同步**：先執行 `verify` 確認無幻覺引用，再更新 `project/index.md` 狀態與複雜度、匯總至 `domain-flows.md` 與 `system/dead-code.md`、自動建立 Git commit；若有 remote 則自動 sync，**CLI 遇衝突時安全停止不破壞檔案，由 AI (`rac`) 進行語意合併後再 commit 與 sync**。 |
| `refactor:pdf [目標]` | `rap` | `refactor-analyze pdf [目標]` *(或 `md2pdf`)* | **匯出 PDF**：將單一 `.md`、編號資料夾（如 `001`）或整個 `project/` 轉為 `.pdf`（支援 `--merge` 合併單一 PDF 與 `--output` 指定路徑）。 |
| `refactor:upgrade` | `rau` | `refactor-analyze upgrade` | **更新現有分析項目**：保留既有語言與分析內容，同步更新最新規則與補齊缺失文件模板。 |

---

## 各階段詳細執行規範

### 1. `refactor:init` (`rai`) — 初始化、Git 對齊與產出系統大概

1. **檢查 Git 與 `.gitignore`**：
   - 確認目前分析工作區已初始化 Git（`.git`），且 `.gitignore` 包含 `project/system/db-connection.md`。
2. **鎖定專案語言（i18n）**：
   - 若 `project/system/overview.md` 尚未鎖定語言且使用者未指定，主動詢問使用者選擇：`繁體中文 (zh-TW)`、`简体中文 (zh-CN)`、`English (en)`、`日本語 (ja)`、`한국어 (ko)` 之一。
3. **確認目標舊系統路徑與 Git Remote 對齊詢問**：
   - 若使用者未提供要分析的目標系統路徑，主動詢問路徑。
   - 讀取目標系統的 Git 資訊（目前分支 `git rev-parse --abbrev-ref HEAD`、目前 Commit Hash `git rev-parse HEAD`、Tag 與工作區狀態）。
   - **主動詢問使用者**：「目標系統與目前分析工作區是否有需要向 remote 對齊（`git fetch` / `git pull`）？」若使用者表示需要，先協助完成對齊。
4. **低 Token 掃描產出 `project/system/` 與 `project/index.md`**：
   - **`project/system/overview.md`**：記錄執行分析時間日期、目標系統路徑、Git 分支與 Commit Hash，並**判斷系統屬於 Mobile APP、桌面應用程式（Application）還是網頁系統（Web）**，附上該型態涵蓋範圍的完整說明。
   - **`project/system/tech-stack.md`**：盤點現行系統使用的程式語言、版本、核心框架、建置工具與第三方依賴套件。
   - **`project/system/architecture.md`**：盤點現行架構模式、目錄職責，以及**全域隱性機制（Filter / Interceptor / AOP / Middleware / 全域異常處理 / 權限驗證機制）**。
   - **`project/system/dead-code.md`**：初步列出未綁定路由或整檔廢棄的死程式碼（必含 **Git 分支、Git Commit Hash、程式檔案名稱、行數、判定原因、相關代碼**）。
   - **`project/index.md`（分類編號總清單）**：
     - **同分類放在一起**（依業務模組分類分組），**無法歸類的統一放在最後的「其他」分類**。
     - 每一項賦予唯一**編號**（如 `001`、`002`），只記錄：**編號**、**功能或 API**、**程式的位置（進入點）**、**複雜度（高/中/低）**、**目前的狀態**（`待分析` / `疑似廢棄`）。

---

### 2. `refactor:scandb` (`ras`) — 連結資料庫抓取所有資料表與欄位

1. 讀取 `project/system/db-connection.md` 中的資料庫產品、連線路徑（Host / Port / DB / Schema）、帳號、密碼與**跳板機（SSH Jump Host / Bastion）**設定。
2. 執行 `refactor-analyze scandb`（或透過對應 DB CLI 工具 / SSH Tunnel 唯讀連線）：
   - 若啟用跳板機，先建立本地 SSH Port Forwarding 通道。
   - 實際查詢資料庫 `INFORMATION_SCHEMA` 或系統目錄表（**100% 唯讀，嚴禁修改任何資料或結構**）。
   - 產出 `project/system/db-schema.md`（所有資料表、View、Stored Procedure、Trigger 總覽清單）與 `project/system/db/<table>.md`（每張表獨立檔案，記錄欄位名稱、資料型態、長度、Nullable、Default、PK/FK、Index 與欄位註解 Comment）。

---

### 3. `refactor:analyze <編號>` (`raa <編號>`) — 依編號新建資料夾深入分析業務邏輯

1. 從 `project/index.md` 查找該 `<編號>`（如 `001`）對應的功能/API 名稱、所屬分類與**程式的位置（進入點）**。
2. 新建以編號命名的獨立資料夾 **`project/<編號>/`**（可先執行 `refactor-analyze analyze <編號>` 建立模板並帶入 Git 與時間元資料）。
3. **共用邏輯去重檢查（`project/shared/`）**：
   - 順著進入點往下追蹤呼叫鏈時，若遇到多處共用的核心商業元件或底層服務：
     - 若 `project/shared/<模組>.md` 已存在，直接引用其結論，**不重複讀取與重複展開分析**以節省 Token。
     - 若尚未建立且確認為核心共用模組，將其抽離記錄於 `project/shared/<模組>.md`。
4. 在 `project/<編號>/` 下產出 8 份完整分析文件（嚴格遵守**禁止 AI 幻想鐵律**）：
   - **`analysis.md`**：
     - 記錄編號、功能名稱、分類、**執行分析的時間日期**、**目標系統 Git 分支（Branch）與 Commit Hash**。
     - 記錄**程式進入點**、**Request / Response / Input / Output Args**（若是批次程式則記錄進入點方法與啟動參數）。
     - 記錄呼叫鏈涉及的檔案清單、**複雜度等級（高/中/低）與詳細原因**。
     - 記錄 **技術債與重構改善建議（To-Be Refactoring Notes）**，明確區分「現行實作（As-Is）」與「重構時應改善之處（如 N+1 查詢、硬編碼、缺乏 Transaction 等）」，防止重構時照抄爛設計。
   - **`business-logic.md`**：
     - 梳理主流程、分支條件、狀態轉換、計算公式、驗證規則與權限控管。
     - **每一條規則強制標註原始碼檔案路徑與行號範圍**（如 `` `OrderService.java#L102-L145` ``）。
   - **`ui-behavior.md`**：
     - 梳理畫面欄位屬性、預設值、**動態顯隱/唯讀/禁用條件**、**下拉選單與選項控制項資料來源明細（`DropDownList` / `Select` / `ComboBox` / `Radio` 若取自資料庫，必須寫明對應 `db/<table>.md` 資料表、`Value`/`Text` 綁定欄位、`WHERE` 過濾條件、`ORDER BY` 排序、預設首項與級聯連動關係，並將 SQL 同步收錄於 `sql.md`）**、**畫面操作事件（`onLoad`/`onClick`/`onChange` 即時計算與跳轉動線）**、**畫面元件權限與資料遮罩**，以及**畫面與後端驗證規則對照矩陣（標註 `僅前端`/`僅後端`/`前後端皆有` 與不一致風險）**。
     - 每一項畫面規則與驗證皆須標註前端/畫面檔案路徑與行號範圍（若為純後端 API 或批次作業則明確標示「`無畫面操作（純後端 API / 批次作業）`」）。
   - **`data-flow.md`**：
     - 梳理從 Input（Request/Args）$\to$ 內部物件轉換 $\to$ 讀寫 `project/system/db/<table>.md` 的哪些資料表與欄位（標註 `C/R/U/D`）$\to$ Output（Response）的完整資料流。
   - **`sql.md`**：
     - 整理該業務邏輯涉及的所有原生 SQL、MyBatis Mapper XML、JPQL/HQL 或 ORM Query。
     - 列出：**所在檔案名稱與行數**、**原始 SQL / 查詢語句**、**動態條件（如 `<if>`）與 JOIN / WHERE 業務邏輯解析**、以及**慢查詢/索引重構建議**（若無 DB 操作則明確標示「無 SQL 操作」）。
   - **`dependencies.md`**：
     - 列出上游呼叫者、下游呼叫的內部模組、`project/shared/` 共用元件、DB 資料表、外部第三方 API 與套件依賴。
   - **`dead-code.md`**：
     - 列出該功能呼叫鏈內發現的死程式碼（被註解的舊代碼、永遠進不去的條件分支、未使用的私有方法）。
     - **強制列出：Git 分支、Git Commit Hash、程式檔案名稱、行數範圍、判定原因與相關代碼片段**。
   - **`backlog.md`（自動產出）**：
     - 自動將分析過程中發現**不確定的業務邏輯、無註解之縮寫欄位定義、未知狀態碼（Magic Numbers）或缺少的外部規格**逐項列出，標記為 `待確認`。

---

### 4. `refactor:reanalyze <編號>` (`rar <編號>`) — 補充 Backlog 後再分析一次

1. 讀取 `project/<編號>/backlog.md` 中使用者已補充或回答的業務邏輯與欄位定義，並檢查目標系統是否有新的 Git commit 或程式碼變更。
2. 結合補充資訊與最新程式碼**再分析一次**，將已釐清的規則與欄位定義同步更新回 `analysis.md`、`business-logic.md`、`data-flow.md`、`sql.md`、`dependencies.md`、`dead-code.md`，並更新**執行分析的時間日期**與**目標 Git 分支/Hash**。
3. 將 `backlog.md` 中已解決的項目狀態改為 `已釐清`。

---

### 5. `refactor:commit [編號]` (`rac [編號]`) — 確認歸檔、更新狀態與 Git 自動 Commit & Sync

1. 使用者確認分析結果後，正式更新 `project/index.md` 對應編號的 **複雜度** 與 **目前的狀態**（若 `backlog.md` 全數釐清則設為 `已完成`，若仍有未決項則設為 `待確認`）。
2. 將該編號涉及的跨功能狀態轉換與資料表讀寫關係匯總更新至 `project/system/domain-flows.md`，並將新發現的死程式碼同步匯總至 `project/system/dead-code.md`。
3. 執行 `refactor-analyze commit [編號]`（或由 AI 執行 Git 歸檔流程）：
   - 確保 `project/system/db-connection.md` 未被加入暫存區（保護帳密安全）。
   - 自動建立本機 Git commit（格式：`docs(<編號>): <功能名稱> - 完成重構分析歸檔`）。
   - 若分析工作區 Git 有設定 remote（如 `origin`），**自動執行 sync**（先拉取遠端最新狀態再推送至 remote）。
   - **遇到衝突自動協助處理**：若與遠端同步時發生 Git conflict（例如 `project/index.md` 衝突），主動解析並合併雙方變更，**處理完成後再自動協助執行 commit 與 sync 推送至 remote**。
