# 舊系統重構分析 AI 工作台 / Legacy Refactoring Analysis AI Workspace

[![npm version](https://img.shields.io/npm/v/@loviusc/refactor-analyze.svg)](https://www.npmjs.com/package/@loviusc/refactor-analyze)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> An evidence-based, zero-hallucination legacy system refactoring analysis workspace CLI for AI Agents (Gemini, Claude, GPT/Codex).
> 零幻覺、有憑有據的舊系統重構逆向分析 AI 工作台，協助團隊在翻新舊系統前徹底掌握系統型態、架構、資料庫結構、業務邏輯、資料流、SQL、依賴關係與死程式碼。

<p align="center">
  <b>🌐 Languages / 語言選擇:</b>
  <a href="https://github.com/lovius215/refactor-analyze/blob/main/README.en.md"><b>English</b></a> |
  <a href="https://github.com/lovius215/refactor-analyze/blob/main/README.zh-TW.md"><b>繁體中文</b></a> |
  <a href="https://github.com/lovius215/refactor-analyze/blob/main/README.zh-CN.md"><b>简体中文</b></a> |
  <a href="https://github.com/lovius215/refactor-analyze/blob/main/README.ja.md"><b>日本語</b></a> |
  <a href="https://github.com/lovius215/refactor-analyze/blob/main/README.ko.md"><b>한국어</b></a>
</p>

---

### Quick Start

```bash
# 1. Install via cross-platform script (automatically checks npm) or npm directly
./scripts/install.sh          # macOS / Linux
scripts\install.bat           # Windows
# Or: npm install -g @loviusc/refactor-analyze

# 2. Initialize an isolated refactoring analysis workspace (supports zh-TW, zh-CN, en, ja, ko)
mkdir my-legacy-analysis && cd my-legacy-analysis
refactor-analyze init --full
```

**🤖 Core AI & CLI Workflow (Gemini / Claude / GPT / Cursor / Antigravity):**
- `refactor:init [路徑]` (`rai`) → 鎖定語言、詢問目標系統路徑與是否向 Git remote 對齊，產出**系統大概**（`project/system/`）與**分類編號清單**（`project/index.md`）
- `refactor:scandb` (`ras` / CLI `refactor-analyze scandb`) → 依據 `db-connection.md`（支援 SQLite、MySQL/MariaDB、PostgreSQL、SQL Server `sqlcmd`、Oracle `sqlplus` 與 SSH 跳板機，**帳密不進 AI 對話框**）以**強制唯讀 Session** 抓取所有 Table、欄位、PK/FK、Index、註解、View、SP 與 Trigger
- `refactor:analyze <編號>` (`raa`) → 新建以**編號**命名的資料夾（`project/001/`），產出分析、業務邏輯、資料流、SQL、依賴關係、死程式碼，並**自動產出 `backlog.md`**
- `refactor:reanalyze <編號>` (`rar`) → 在 `backlog.md` 補充未知欄位或業務邏輯後，**再分析一次**並同步更新文件
- `refactor:verify [編號]` (`rav` / CLI `refactor-analyze verify`) → **0-Token 防幻覺與版本飄移驗證**：自動核對 `#Lx-Ly` 原始碼檔案與行號是否真實存在，並比對 Git Commit Hash 偵測目標系統是否已改版導致行號偏移
- `refactor:commit [編號]` (`rac`) → 通過 `verify` 後更新 `project/index.md` 狀態、自動 Git commit、若有 remote 自動安全 sync（**CLI 遇衝突時安全停止不破壞檔案，交由 AI `rac` 進行語意合併**）
- `refactor:pdf [目標]` (`rap`) → **0-Token 本機轉 PDF**：將單一 `.md`、編號資料夾（如 `001`）或整個 `project/` 轉換為 `.pdf`（CLI: `refactor-analyze pdf` 或 `md2pdf`，支援 `--merge` 與 `--output`）
- `refactor:upgrade` (`rau`) → 更新現有分析項目的規則與缺失模板（CLI: `refactor-analyze upgrade` 或 `update`）

👉 **Language Guides: [English](https://github.com/lovius215/refactor-analyze/blob/main/README.en.md) | [繁體中文](https://github.com/lovius215/refactor-analyze/blob/main/README.zh-TW.md) | [简体中文](https://github.com/lovius215/refactor-analyze/blob/main/README.zh-CN.md) | [日本語](https://github.com/lovius215/refactor-analyze/blob/main/README.ja.md) | [한국어](https://github.com/lovius215/refactor-analyze/blob/main/README.ko.md)**

---

## 核心設計理念與六大防坑機制

在重構大型舊系統時，最怕 AI **「Token 瞬間爆掉被鎖額度」** 以及 **「看不懂舊程式碼就自己瞎掰（幻覺）」**。`@loviusc/refactor-analyze` 採用工作區與目標舊系統**分離**的架構，並內建六大核心機制：

1. **🛡️ 禁止 AI 幻想鐵律（Zero-Hallucination Rule）**：
   - **沒有來源依據，絕對不要亂寫**。所有業務邏輯、計算公式、狀態流轉、SQL 與依賴關係，100% 必須標註原始碼檔案路徑與行號（如 `` `OrderService.java#L45-L92` ``）或 `scandb` 抓取的真實資料表欄位。
   - 遇到語意不明的縮寫欄位（如 `FLG_02`）或無註解的狀態碼（Magic Numbers），**嚴禁自行猜測腦補**，強制自動寫入 `project/<編號>/backlog.md` 待人工確認後以 `reanalyze` 更新。
2. **⚡ 極致省 Token 的兩階段設計（CLI 0-Token 預掃描 + 進入點導向）**：
   - 第一階段 `init` 只盤點系統大概（判斷 **APP / 桌面應用程式 / 網頁** 並說明涵蓋範圍）與分類進入點清單（`project/index.md`），並由 CLI 在本機 0-Token 計算初步複雜度與讀取 Git 分支/Hash。
   - 第二階段 `analyze <編號>` 每次只針對單一編號順著進入點往下追，支援隨時中斷與跨 AI 接力。
3. **🗄️ 真實資料庫掃描（`scandb` + 支援 SSH 跳板機 + 按表拆檔）**：
   - 在 `project/system/db-connection.md` 填入資料庫產品、路徑、帳號、密碼與跳板機（SSH Bastion）設定後（該檔案自動被 `.gitignore` 保護不外洩），執行 `scandb` 即可唯讀抓取所有 Table、欄位、PK/FK、註解与 Trigger，並按表拆分為 `project/system/db/<table>.md`，分析時用到哪張表才讀哪張表。
4. **♻️ 共用邏輯抽離去重（`project/shared/`）**：
   - 多支 API 或批次共用的底層核心元件抽離至 `project/shared/<module>.md`，後續編號分析時直接引用，不重複燒 Token。
5. **🧾 SQL 專檔整理（`sql.md`）與死程式碼列管（`dead-code.md`）**：
   - `sql.md` 專門把藏在原生 SQL / MyBatis / ORM Query 裡的 `JOIN`、`WHERE`、`CASE WHEN` 業務條件與效能建議整理出來。
   - `dead-code.md` 強制列出 **Git 分支、Git Commit Hash、程式檔案名稱、行數、判定原因與相關代碼片段**，讓團隊安心移除廢棄代碼。
6. **🔄 As-Is 與 To-Be 重構建議分離 + 自動 Git Commit / Sync / 衝突處理**：
   - 在 `analysis.md` 明確區分「現行實作（As-Is）」與「技術債及重構改善建議（To-Be Notes）」，防止新系統照抄舊系統爛設計。
   - 執行 `commit` 時自動更新 `project/index.md` 狀態、建立本機 Git commit、自動與 remote sync，遇到衝突主動協助處理後再自動 commit 與 sync。

---

## 安裝、更新與解除安裝（支援 macOS / Linux / Windows）

### 環境需求
- Node.js 18 或以上
- npm（安裝腳本會自動檢查是否已安裝 `npm`）
- Git

### 1. macOS / Linux（使用 Shell Script `.sh`）

```bash
# 安裝（自動檢查 npm 並安裝全域指令）
./scripts/install.sh

# 更新至最新版本
./scripts/update.sh

# 解除安裝
./scripts/uninstall.sh
```

> 若在本地開發環境測試，也可執行 `./scripts/install.sh --local`。若未來變更 npm 套件名稱，可直接傳入 `./scripts/install.sh <your-npm-package-name>`。

### 2. Windows（使用 Batch `.bat`，於 PowerShell 或 CMD 執行）

```bat
:: 安裝（自動檢查 npm 並安裝全域指令）
scripts\install.bat

:: 更新至最新版本
scripts\update.bat

:: 解除安裝
scripts\uninstall.bat
```

---

## 核心指令總表（CLI 與 AI 對話雙軌）

| 階段 | CLI 終端機指令 | AI 對話指令 | 簡寫 | 用途說明 |
|---|---|---|---|---|
| **1. 初始化與系統大概** | `refactor-analyze init [--full] [--lang ...]` | `refactor:init [路徑]` | `rai` | 建立工作區、`db-connection.md` 與 Git、確認語言、詢問目標系統路徑與是否向 remote 對齊，產出 `project/system/` 大概與分類編號清單 `project/index.md`。 |
| **2. 掃描資料庫欄位** | `refactor-analyze scandb` | `refactor:scandb` | `ras` | 依據 `project/system/db-connection.md`（支援跳板機）實際連進資料庫 Scan 所有 Table、欄位、關聯、View、Stored Procedure 與 Trigger，產出 `db-schema.md` 與 `db/<table>.md`。 |
| **3. 分析單一編號** | `refactor-analyze analyze <編號>` | `refactor:analyze <編號>` | `raa` | 新建 `project/<編號>/` 資料夾，深入分析業務邏輯、資料流、SQL、依賴關係、死程式碼、複雜度與重構建議，並**自動產出 `backlog.md`**。 |
| **4. 重新分析單一編號** | `refactor-analyze reanalyze <編號>` | `refactor:reanalyze <編號>` | `rar` | 根據 `backlog.md` 補充內容或程式碼/DB 變更**再分析一次**，更新 `project/<編號>/` 內所有文件與分析時間、Git 版本。 |
| **5. 0-Token 驗證來源與飄移** | `refactor-analyze verify [編號]` | `refactor:verify [編號]` | `rav` | 本機 0-Token 核對所有 `#Lx-Ly` 原始碼檔案與行號是否真實存在，並比對 Git Commit Hash 偵測目標系統改版飄移。 |
| **6. 確認提交與遠端同步** | `refactor-analyze commit [編號]` | `refactor:commit [編號]` | `rac` | 通過 `verify` 後更新 `project/index.md` 狀態、自動 commit 到 Git；若有 remote 自動安全 sync（CLI 遇衝突安全停止不破壞檔案，交由 AI `rac` 語意合併）。 |
| **7. 匯出 PDF 文件** | `refactor-analyze pdf [目標] [--merge] [--output ...]` *(或 `md2pdf`)* | `refactor:pdf [目標]` | `rap` | **0-Token 本機轉換**：將指定的 `.md` 檔案、編號資料夾（如 `001`）或整個 `project/` 轉換為 `.pdf`（支援 `--merge` 合併為單一 PDF）。 |
| **8. 更新現有分析項目** | `refactor-analyze upgrade [--dry-run]` *(或 `update`)* | `refactor:upgrade` | `rau` | 將現有分析項目的 `AGENTS.md`、`skills/`、`rules/` 與缺失文件模板更新至最新版本（保留既有語言與分析內容）。 |
| **9. 狀態與健康檢查** | `refactor-analyze status` / `check` / `doctor` | - | - | 查看清單完成進度、檢查必要檔案是否齊全。 |

---

## 完整使用流程

```text
1. 終端機初始化工作區
   refactor-analyze init --full
         │
         ▼
2. AI 對話啟動與 Git 對齊 (輸入 refactor:init [目標系統路徑] 或 rai)
   - 鎖定專案語言 (zh-TW / zh-CN / en / ja / ko)，詢問是否向 Git remote 對齊
   - 產出系統大概 (project/system/，判定 APP / 桌面應用程式 / 網頁 + 涵蓋說明)
   - 產出分類編號清單 (project/index.md：同分類放一起、無法歸類放「其他」)
         │
         ▼
3. 填寫 db-connection.md 並執行 refactor-analyze scandb (或 ras)
   - 支援 SQLite / MySQL / MariaDB / PostgreSQL / SQL Server (sqlcmd) / Oracle (sqlplus) 與 SSH 跳板機
   - 強制唯讀 Session 抓取所有 Table、欄位、PK/FK、Index、註解、View、SP 與 Trigger (帳密不進 AI Context)
         │
         ▼
4. 依編號分析業務邏輯 (執行 refactor-analyze analyze 001 + AI 輸入 raa 001)
   - 新建 project/001/ 產出 7 份核心文件，所有邏輯必附原始碼檔案與行號 (#Lx-Ly)，並自動產出 backlog.md
         │
         ├──► [若有待補充項目] 於 backlog.md 補充說明 ──► 5. 執行 rar 001 再分析一次並更新文件
         ▼
6. 執行 0-Token 驗證與確認歸檔 (refactor-analyze verify 001 -> refactor-analyze commit 001 / rac 001)
   - 自動核對 #Lx-Ly 檔案與行號真實性、偵測目標系統 Git 版本飄移
   - 更新 index.md 狀態 -> 自動本機 Git commit -> 自動安全 remote sync
```

### 步驟 1：初始化獨立工作區
```bash
mkdir erp-refactor-workspace
cd erp-refactor-workspace
refactor-analyze init --full --lang zh-TW
```

### 步驟 2：啟動 AI 分析並產出系統大概與分類編號清單（`init` / `rai`）
在 AI 對話側邊欄輸入：
```text
rai /Users/lovius/projects/legacy-erp
```
- AI 會檢查本工作區與目標舊系統的 Git 分支与 Commit Hash，並主動詢問你**是否有需要向 remote 對齊**。
- 接著產出 `project/system/overview.md`（判斷是 **APP、桌面應用程式、還是網頁**，並附上涵蓋範圍說明）、`tech-stack.md`、`architecture.md`（含全域 Filter/Interceptor/AOP）、`dead-code.md`。
- 產出 `project/index.md` 分類編號清單（**同分類放在一起，無法歸類的統一放在「其他」**）：
  ```markdown
  ## 分類：訂單管理 (Order)
  | 編號 | 功能或 API | 程式的位置 | 複雜度 | 目前的狀態 |
  |---|---|---|---|---|
  | `001` | 建立訂單 (`POST /api/orders`) | `src/controller/OrderController.java#create` | 高 | 待分析 |
  | `002` | 查詢訂單 (`GET /api/orders/{id}`) | `src/controller/OrderController.java#detail` | 低 | 待分析 |

  ## 分類：其他 (Other)
  | 編號 | 功能或 API | 程式的位置 | 複雜度 | 目前的狀態 |
  |---|---|---|---|---|
  | `003` | 舊版匯入批次 | `src/batch/LegacyImportJob.java#run` | 中 | 疑似廢棄 |
  ```

### 步驟 3：連結資料庫掃描所有欄位（`scandb` / `ras`）
編輯 `project/system/db-connection.md`（已被 `.gitignore` 保護），填入資料庫產品、連線路徑、帳號、密碼與跳板機設定，然後執行：
```bash
refactor-analyze scandb
# 或在 AI 對話框輸入：ras
```
系統會實際連進資料庫抓取所有資料表與欄位，產出 `project/system/db-schema.md` 與 `project/system/db/<table>.md`。

### 步驟 4：依編號深入分析業務邏輯（`analyze <編號>` / `raa <編號>`）
針對清單上的編號 `001` 執行：
```bash
refactor-analyze analyze 001
# 並在 AI 對話框輸入：
raa 001
```
自動新建 **`project/001/`** 資料夾，產出 7 份核心文件（所有內容皆附原始碼檔案與行號來源，絕不無中生有）：
- `analysis.md`：記錄執行分析時間日期、目標系統 Git 分支與 Hash、進入點、Request/Response/Input/Output Args、複雜度原因、以及**技術債與重構建議（To-Be Notes）**。
- `business-logic.md`：商業規則、流程、計算公式与驗證邏輯。
- `data-flow.md`：資料流向與讀寫的 DB 資料表/欄位。
- `sql.md`：該功能用到的所有 SQL 語句、動態條件與邏輯解析。
- `dependencies.md`：上下游依賴與 `project/shared/` 共用元件引用。
- `dead-code.md`：列出 **Git 分支、Git Commit Hash、程式檔案名稱、行數、判定原因與相關代碼片段**。
- `backlog.md`：**自動產出**目前還不確定的業務邏輯或未知欄位定義。

### 步驟 5：補充 Backlog 後重新分析（`reanalyze <編號>` / `rar <編號>`）
在 `project/001/backlog.md` 填上未知欄位或規則的說明後，執行：
```text
rar 001
```
AI 會讀取你補充的定義**再分析一次**，更新 `project/001/` 內的所有文件與最新分析時間、Git 版本。

### 步驟 6：確認歸檔、更新清單與自動 Git Commit & Sync（`commit` / `rac`）
確認分析結果無誤後，執行：
```bash
refactor-analyze commit 001
# 或在 AI 對話框輸入：rac 001
```
- 正式將 `project/index.md` 中 `001` 的狀態更新為 `已完成`（或 `待確認`），並同步更新 `domain-flows.md` 與 `system/dead-code.md`。
- 自動建立本機 Git commit，若 Git 有設定 remote 則自動執行 sync（pull + push）；**若遇到 Git 衝突，會主動協助解析並合併衝突，處理完成後自動再次 commit 與 sync**！

---

## 產出文件完整目錄結構

```text
.gitignore                     # 自動忽略 project/system/db-connection.md 防止帳密外洩
AGENTS.md                      # AI Agent 核心規則入口
skills/
  refactor-analyze/
    SKILL.md                   # 重構分析核心技能定義
rules/                         # 詳細規則集 (--full 時建立)
project/
  index.md                     # 功能/API 分類編號清單（同類放一起，無法歸類放「其他」）
  system/                      # 第一階段：系統整體大概與資料庫結構
    db-connection.md           # 0. 資料庫與跳板機連線設定檔（受 .gitignore 保護）
    overview.md                # 1. 系統總覽、主要語言、分析時間、Git 分支與 Hash、系統型態判定（APP/應用程式/網頁 + 涵蓋說明）
    tech-stack.md              # 2. 現行程式語言、框架、建置工具與第三方套件盤點
    architecture.md            # 3. 現行系統架構、目錄職責、全域隱性機制（Filter / Interceptor / AOP / Middleware）
    domain-flows.md            # 4. 跨編號領域狀態機（State Machine）與核心資料表 CRUD 對照矩陣
    dead-code.md               # 5. 全系統死程式碼總表（列出 Git 分支、Hash、程式檔案名稱、行數、相關代碼）
    db-schema.md               # 6. 資料庫總覽索引（資料表、View、Stored Procedure、Trigger 列表）
    db/                        # 7. 各資料表欄位明細（依 Table 拆檔以節省 Token）
      <table>.md
  shared/                      # 多編號共用邏輯抽離區（避免重複分析燒 Token）
    <shared-module>.md
  001/                         # 第二階段：以「編號」命名的獨立業務邏輯資料夾
    analysis.md                # 1. 分析（執行時間、Git 分支與 Hash、進入點與 I/O Args、涉及檔案、複雜度、重構建議）
    business-logic.md          # 2. 業務邏輯（規則、流程、狀態轉換、計算與驗證邏輯，必附檔案與行號來源）
    data-flow.md               # 3. 資料流（Input -> 處理 -> DB 表/欄位讀寫 -> Output）
    sql.md                     # 4. SQL 與查詢邏輯整理（原始 SQL、檔案與行數、條件解析與優化建議）
    dependencies.md            # 5. 依賴關係（上下游模組、shared/ 共用元件引用、DB Table、外部 API）
    dead-code.md               # 6. 死程式碼記錄（列出 Git 分支、Hash、程式檔案名稱、行數、相關代碼）
    backlog.md                 # 7. Backlog（自動產出不確定的業務邏輯與未知欄位定義）
```

---

## 多語系與國際化支援（i18n）

支援 5 種語言的系統重構分析產出：
- `zh-TW`：**繁體中文**（預設，台灣技術慣用語）
- `zh-CN`：**简体中文**（大陸技術慣用語）
- `en`：**English**（100% 專業技術英文）
- `ja`：**日本語**（日語專業技術文體）
- `ko`：**한국어**（韓語專業技術文體）

> **專有名詞保留原生英文**：在非英語系模式下，業界標準技術術語、API 路徑、類別/方法名稱、SQL 關鍵字與資料表欄位名稱（如 `REST API`, `Request`, `Response`, `DTO`, `Spring Web`, `JWT` 等）強制保留原生英文，嚴禁生硬直譯。
