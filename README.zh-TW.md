# 舊系統重構分析 AI 工作台 (Legacy Refactoring Analysis AI Workspace)

[![npm version](https://img.shields.io/npm/v/@loviusc/refactor-analyze.svg)](https://www.npmjs.com/package/@loviusc/refactor-analyze)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> 零幻覺、有憑有據的舊系統重構逆向分析 AI 工作台，支援 Gemini、Claude、GPT/Codex 等 AI Agent，協助團隊在重構前徹底釐清系統型態、架構、資料庫結構、業務邏輯、資料流、SQL、依賴關係與死程式碼。

<p align="center">
  <b>🌐 語言選擇 (Languages):</b>
  <a href="./README.en.md"><b>English</b></a> |
  <a href="./README.zh-TW.md"><b>繁體中文</b></a> |
  <a href="./README.zh-CN.md"><b>简体中文</b></a> |
  <a href="./README.ja.md"><b>日本語</b></a> |
  <a href="./README.ko.md"><b>한국어</b></a>
</p>

---

## 核心定位與特色

`@loviusc/refactor-analyze` 採用**「分析工作區與目標舊系統分離」**的設計，不污染舊系統專案目錄，並針對大型舊系統重構實戰提供六大保障：

1. **禁止 AI 幻想鐵律（Zero-Hallucination）**：所有寫入文件的業務邏輯、計算公式、資料流與 SQL 必須 100% 標註原始碼檔案路徑與行號或真實 DB 欄位來源；無明確來源或語意不明的欄位與邏輯一律強制列入 `backlog.md`，嚴禁 AI 自行猜測腦補。
2. **節省 Token 的分段式分析**：第一階段只產出系統大概與分類編號清單（`project/index.md`），搭配 CLI 本機 0-Token 複雜度估算；第二階段依編號逐一深入分析並抽離 `project/shared/` 共用模組，不怕訂閱制額度卡住。
3. **支援跳板機之真實資料庫掃描（`scandb`）**：透過 `project/system/db-connection.md`（自動加入 `.gitignore` 防止帳密外洩）設定資料庫產品、路徑、帳號、密碼與 SSH 跳板機，唯讀抓取所有 Table、欄位、註解與 Trigger，並依表拆檔存放於 `project/system/db/<table>.md`。
4. **獨立 SQL 解析（`sql.md`）與死程式碼列管（`dead-code.md`）**：每個編號資料夾自動整理 SQL 邏輯；死程式碼強制記錄 **Git 分支、Git Commit Hash、程式檔案名稱、行數與相關代碼**。
5. **分離現況（As-Is）與重構改善建議（To-Be Notes）**：防止後續重構時把舊系統的技術債（如 N+1 查詢、無交易保護）照抄到新系統。
6. **自動 Git Commit、Remote Sync 與衝突協助處理**：執行 `commit` 確認後自動更新 `index.md` 狀態並同步至遠端 Git，遇到合併衝突會主動協助處理後再自動 commit 與 sync。

---

## 安裝、更新與解除安裝（macOS / Linux / Windows）

執行腳本前會**自動檢查是否已安裝 `npm`**（未安裝會提示並安全中止）：

- **macOS / Linux**：
  ```bash
  ./scripts/install.sh     # 安裝
  ./scripts/update.sh      # 更新 CLI
  ./scripts/uninstall.sh   # 解除安裝
  ```
- **Windows (PowerShell / CMD)**：
  ```bat
  scripts\install.bat      :: 安裝
  scripts\update.bat       :: 更新 CLI
  scripts\uninstall.bat    :: 解除安裝
  ```

---

## 指令一覽表

| 階段 | CLI 指令 | AI 對話指令 | 簡寫 | 說明 |
|---|---|---|---|---|
| **1. 初始化與系統大概** | `refactor-analyze init [--full] [--lang ...]` | `refactor:init [路徑]` | `rai` | 建立工作區與 Git、確認語言、詢問目標路徑與是否向 remote 對齊，產出 `project/system/` 與分類編號清單 `project/index.md`。 |
| **2. 掃描資料庫欄位** | `refactor-analyze scandb` | `refactor:scandb` | `ras` | 依據 `project/system/db-connection.md`（支援跳板機）實際連進資料庫抓取所有欄位與 Trigger，產出 `db-schema.md` 與 `db/<table>.md`。 |
| **3. 分析單一編號** | `refactor-analyze analyze <編號>` | `refactor:analyze <編號>` | `raa` | 新建 `project/<編號>/` 資料夾，深入分析業務邏輯、**畫面操作行為與驗證（`ui-behavior.md`）**、資料流、SQL、依賴、死程式碼與複雜度，並**自動產出 `backlog.md`**。 |
| **4. 重新分析單一編號** | `refactor-analyze reanalyze <編號>` | `refactor:reanalyze <編號>` | `rar` | 根據 `backlog.md` 補充內容或程式碼變更**再分析一次**，更新 `project/<編號>/` 所有文件。 |
| **5. 0-Token 驗證來源與飄移** | `refactor-analyze verify [編號]` | `refactor:verify [編號]` | `rav` | 本機 0-Token 核對所有 `#Lx-Ly` 原始碼檔案與行號是否真實存在，並偵測目標系統 Git 改版飄移。 |
| **6. 確認提交與遠端同步** | `refactor-analyze commit [編號]` | `refactor:commit [編號]` | `rac` | 通過 `verify` 後更新 `project/index.md` 狀態、自動 commit 到 Git；若有 remote 自動安全 sync（CLI 遇衝突安全停止不破壞檔案，交由 AI `rac` 語意合併）。 |
| **7. 匯出 PDF 文件** | `refactor-analyze pdf [目標] [--merge] [--output ...]` *(或 `md2pdf`)* | `refactor:pdf [目標]` | `rap` | **0-Token 本機轉換**：將指定的 `.md` 檔案、編號資料夾（如 `001`）或整個 `project/` 轉換為 `.pdf`（支援 `--merge` 合併為單一 PDF）。 |
| **8. 更新現有分析項目** | `refactor-analyze upgrade [--dry-run]` *(或 `update`)* | `refactor:upgrade` | `rau` | 更新現有分析項目的 `AGENTS.md`、`skills/`、`rules/` 與缺失模板（保留既有語言與分析內容）。 |
| **9. 檢查與狀態** | `refactor-analyze status` / `check` / `doctor` | - | - | 查看清單進度與檢查必要檔案。 |

---

## 完整操作步驟

1. **建立工作區**：執行 `refactor-analyze init --full`。
2. **啟動 AI 初始盤點**：在 AI 對話輸入 `rai`（或 `rai /path/to/legacy`），鎖定語言、確認是否向 Git remote 對齊，產出 `project/system/`（判斷系統屬於 **APP / 桌面應用程式 / 網頁** 並說明涵蓋範圍）與 `project/index.md`（**同分類放在一起，無法歸類放「其他」**，賦予編號 `001`, `002`...）。
3. **掃描資料庫**：填寫 `project/system/db-connection.md` 後執行 `refactor-analyze scandb`（或 `ras`），實際抓出所有資料表與欄位。
4. **依編號分析業務邏輯**：執行 `refactor-analyze analyze 001` 與 AI 指令 `raa 001`，在 `project/001/` 下產出 `analysis.md`、`business-logic.md`、`ui-behavior.md`、`data-flow.md`、`sql.md`、`dependencies.md`、`dead-code.md` 與自動生成的 `backlog.md`。
5. **補充 Backlog 並重新分析**：在 `project/001/backlog.md` 補上未知欄位或規則說明後，執行 `rar 001` 再分析一次。
6. **確認歸檔與同步**：執行 `refactor-analyze commit 001`（或 `rac 001`），更新 `project/index.md` 狀態並自動完成 Git commit 與 remote sync（含衝突協助處理）。
7. **升級現有工作區**：未來工具更新後，在工作區執行 `refactor-analyze upgrade`（或 `update`）即可無損更新規則與模板。

---

## 💡 實戰使用範例：從 0 到 1 逆向分析舊電商/ERP 系統 (Example Walkthrough)

以下示範如何使用 `@loviusc/refactor-analyze` 將一套 10 年歷史的舊 Java/Spring/JSP 訂單系統（`legacy-shop`）逆向分析為標準重構文件：

### Step 1. 建立獨立分析工作區
```bash
# 建立並進入分析工作區（與舊系統原始碼目錄分開，互不污染）
mkdir shop-refactor-workspace && cd shop-refactor-workspace

# 初始化工作區（建立 .gitignore、AGENTS.md、規則集與空白模板）
refactor-analyze init --full --lang zh-TW
```

### Step 2. 啟動 AI 進行第一階段全域盤點 (`rai`)
在 AI Agent（Gemini / Claude / Cursor / Antigravity）的對話框輸入：
```text
rai /Users/dev/projects/legacy-shop
```
AI 會自動檢查舊系統的 Git 分支與版本，詢問是否向 remote 對齊，接著輸出：
- `project/system/overview.md`：判定為 **網頁系統 (Web)**，技術為 Spring MVC + MyBatis + JSP + MySQL。
- `project/system/architecture.md`：盤點全域機制（如 `AuthFilter` 與交易控制）。
- `project/index.md`：依業務分類產出編號總清單：
  ```markdown
  ## 分類：訂單管理 (Order Management)
  | 編號 | 功能或 API | 程式的位置（進入點） | 複雜度 | 目前的狀態 |
  |---|---|---|---|---|
  | `001` | 購物車結帳與建立訂單 | `src/controller/OrderController.java#createOrder` | 高 | 待分析 |
  | `002` | 訂單明細與狀態查詢 | `src/controller/OrderController.java#getOrderDetail` | 低 | 待分析 |

  ## 分類：其他 (Other)
  | 編號 | 功能或 API | 程式的位置（進入點） | 複雜度 | 目前的狀態 |
  |---|---|---|---|---|
  | `003` | 歷史訂單匯出批次 | `src/batch/OrderExportJob.java#run` | 中 | 待分析 |
  ```

### Step 3. 唯讀掃描真實資料庫結構與代碼表 (`ras`)
在 `project/system/db-connection.md` 填妥唯讀連線資訊與共用代碼表（帳密被 `.gitignore` 隔離，不進入 AI 對話框）：
```markdown
- **啟用資料庫掃描 (Enabled)**: `true`
- **資料庫產品 (Database Product)**: `mysql`
- **連線主機或檔案路徑 (Host / Path)**: `127.0.0.1`
- **連接埠 (Port)**: `3306`
- **資料庫名稱 / Schema (Database / Schema)**: `shop_db`
- **帳號 (Username)**: `readonly_user`
- **密碼 (Password)**: `secret123`
- **共用代碼表清單 (Code Tables)**: `SYS_CODE`
```
在終端機執行（或對 AI 輸入 `ras`）：
```bash
refactor-analyze scandb
```
輸出：
- `project/system/db/orders.md`、`order_items.md`：欄位型態、主外鍵 PK/FK、Index 與註解。
- `project/system/db/_routines.md`：匯出預存程序 `SP_CALC_DISCOUNT` 的完整 SQL 原始碼。
- `project/system/code-dictionary.md`：自動匯出 `SYS_CODE` 字典（如 `ORDER_STS`: `01=草稿, 02=已付款, 03=已出貨`），AI 分析時不再需要猜測狀態碼意義。

### Step 4. 深入分析編號 001 業務邏輯 (`raa 001`)
在終端機建立骨架並在 AI 對話輸入：
```bash
refactor-analyze analyze 001
# 或直接在 AI 對話框輸入：
raa 001
```
AI 會針對 `001` 深入呼叫鏈，在 `project/001/` 產出 8 份標準文件（**禁止 AI 幻想鐵律：每一項規則必附原始碼檔案與行號**）：
1. **`analysis.md`**：記錄進入點 Request/Response Args、**隱性 Session 依賴**（如偷讀 `Session["CURRENT_DEPT_ID"]`），以及 **As-Is 現況 vs To-Be 重構建議**（指出舊代碼在 `for` 迴圈內查 DB 導致 N+1 效能問題，重構時應改為批次查詢）。
2. **`business-logic.md`**：
   - 核心規則清單（附行號）：
     | 規則編號 | 觸發條件 | 執行動作 / 結果 | 原始碼檔案與行號來源 |
     |---|---|---|---|
     | `BR-01` | 購物車金額 > 10,000 且會員等級為 VIP | 自動套用 9 折並產生贈品序號 | `src/service/OrderService.java#L85-L112` |
   - 交易邊界與鎖定：記錄 `@Transactional` 涵蓋表與樂觀鎖 `VERSION` 欄位。
   - 重構驗收測試情境：提供 `TC-01 (滿萬打折成功)`、`TC-02 (庫存不足阻擋)` 的 Given/When/Then 驗收規格。
3. **`ui-behavior.md`**：
   - 記錄下拉選單 `ddlPayment` 資料查自 `SYS_CODE WHERE CODE_TYPE = 'PAY'`。
   - **前後端驗證對照矩陣**：抓出「JSP 前端限制數量最多 99 件，但後端 Controller 漏寫檢查」的安全漏洞！
4. **`data-flow.md`**：記錄資料從 Request $\to$ Service $\to$ 寫入 `orders`、`order_items` 表。
5. **`sql.md`**：完整收錄 `OrderMapper.xml#insertOrder` 之 SQL 語句與動態 `<if test="coupon != null">` 條件解析。
6. **`dependencies.md`**：梳理呼叫鏈與 `project/shared/` 共用模組。
7. **`dead-code.md`**：標註被註解掉的舊計算邏輯（附 Git commit 與檔案行號）。
8. **`backlog.md`**：自動列出程式中語意不明的魔術數字（如 `FLG_03 = 'K'`），標記為待人工釐清。

### Step 5. 0-Token 驗證來源與版本飄移 (`rav 001`)
在完成補充後，執行本機 0-Token 驗證：
```bash
refactor-analyze verify 001
# 或在 AI 對話輸入：rav 001
```
CLI 會在本地自動核對：
- ✅ `src/service/OrderService.java#L85-L112` 等行號範圍是否真實存在且行數正確。
- ✅ 比對目標系統 Git Commit Hash，若目標系統有人推了新代碼，立即發出「版本飄移警告（Git Drift Detected）」。

### Step 6. 確認歸檔與自動同步 (`rac 001`)
```bash
refactor-analyze commit 001
# 或在 AI 對話輸入：rac 001
```
- CLI 自動解析 `001/data-flow.md`，將 `orders` 表的 `C/U` 操作 **0-Token 自動匯總至 `project/system/domain-flows.md` 的 CRUD 矩陣**！
- 自動將 `project/index.md` 中的 `001` 狀態更新為 `已完成`。
- 自動建立本機 Git commit；若有設定 remote 則自動安全同步（若遇到衝突會停止並引導 AI 語意合併）。

### Step 7. 一鍵匯出 PDF 報告 (`rap 001`)
```bash
# 將編號 001 的 8 份文件合併為單一美觀 PDF，直接交付利害關係人與主管
refactor-analyze pdf 001 --merge
```
生成的 `project/001/001-merged.pdf` 包含封面、目錄、行號來源與語法高亮，0-Token 本機渲染完成！
