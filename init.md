# 專案定位

這個專案是一個透過 `npm` 安裝的 CLI 工具與 AI 工作台，用來產出 `skills` 與 `rules`，讓 AI Agent（支援 Gemini、Claude、GPT/Codex 等）協助進行**舊系統重構前的逆向分析與文件產出**。

- **套件名稱**：待定（*NPM 名字之後會另外給，在專案與安裝腳本中以變數抽離，目前暫以 `@loviusc/refactor-analyze` 作為預設佔位*）
- **CLI 指令**：`refactor-analyze`
- **跨平台支援**：完整支援 **macOS**、**Linux**、**Windows**
- **安裝/解除/更新腳本**：提供 Shell Script (`.sh`，適用 macOS / Linux) 與 Batch (`.bat`，適用 Windows) 協助安裝、解除安裝、更新 CLI 工具，並**在執行前強制檢查是否已安裝 `npm`**。
- **工作區模式**：分析工作區與被分析的舊系統目錄**分開**（在獨立工作區初始化，透過指令指定外部舊系統路徑進行分析，不污染舊系統專案）。
- **多語系支援（i18n）**：支援 **繁體中文 (`zh-TW`)**、**簡體中文 (`zh-CN`)**、**英文 (`en`)**、**日文 (`ja`)**、**韓文 (`ko`)** 共 5 種語言。

---

# 最高指導原則：禁止 AI 幻想鐵律（Zero-Hallucination Rule）

- **沒有來源依據，絕對不要亂寫（No Source, No Write）**：
  - 所有分析產出的系統架構、功能清單、Request/Response/Args、業務邏輯、狀態流轉、計算公式、資料流、SQL 與依賴關係，**必須 100% 基於實際讀取到的原始碼、設定檔或 `scandb` 抓取之真實資料庫結構**。
  - 每一項業務規則與關鍵邏輯，**必須明確標註原始碼檔案路徑與行號範圍**（如 `` `src/service/OrderService.java#L45-L88` ``）或資料庫表名/欄位來源。
- **禁止憑「一般系統常識」自行腦補**：
  - 嚴禁 AI 因為看到類別名稱、方法名稱或欄位縮寫（如 `TYPE = 3`、`FLAG_A = 'Y'`）就自行猜測其商業含義或補上程式碼中不存在的流程、欄位與驗證規則。
- **凡無明確來源或語意不明者，強制列入 `backlog.md`**：
  - 只要在程式碼或資料庫中找不到明確定義、註解或實作來源，**一律禁止寫入確定版業務邏輯**，必須如實記錄於 `project/<編號>/backlog.md` 標記待人工釐清，待使用者補充後再透過 `reanalyze <編號>` 更新。

---

# 跨平台腳本與現有項目更新機制

## 1. 跨平台管理腳本（`.sh` & `.bat`）
提供支援 **macOS / Linux (`.sh`)** 與 **Windows (`.bat`)** 的腳本：
- **檢查 `npm` 環境**：所有腳本執行時第一步強制檢查系統是否已安裝 `npm`（`command -v npm` / `where npm`），若未安裝則輸出明確提示訊息並中止執行。
- **支援三大功能**：
  1. **安裝（Install）**：`install.sh` / `install.bat` — 檢查 `npm` 後透過 `npm install -g <NPM_PACKAGE_NAME>`（或本機 `npm link`）完成全域安裝，並驗證 CLI 是否在 `PATH` 中可用。
  2. **解除安裝（Uninstall）**：`uninstall.sh` / `uninstall.bat` — 檢查 `npm` 後執行 `npm uninstall -g <NPM_PACKAGE_NAME>` 乾淨移除全域指令。
  3. **更新套件（Update）**：`update.sh` / `update.bat` — 檢查 `npm` 後執行 `npm update -g <NPM_PACKAGE_NAME>`（或 `npm install -g <NPM_PACKAGE_NAME>@latest`）更新至最新版 CLI。

## 2. 更新現有項目的 CLI 指令（`upgrade` / `update`）
當使用者已建立的分析工作區需要升級至最新版規則與結構時，可在該項目目錄執行：
```bash
refactor-analyze upgrade [--dry-run]
# 或別名：
refactor-analyze update [--dry-run]
```
- **語言繼承保護**：自動讀取 `project/system/overview.md` 偵測現有項目的語言設定，不變更既有語言。
- **規則與技能同步**：自動將工作區內的 `AGENTS.md`、`skills/`、`rules/` 更新至最新版本（並保留既有的 `<claude-mem-context>` 記憶區塊）。
- **既有項目無損補齊**：自動檢查 `.gitignore`、`project/system/` 與既有 `project/<編號>/` 資料夾，在不覆蓋使用者已寫好之分析內容的前提下，自動補齊缺少的新版檔案（如 `db-connection.md`、`domain-flows.md`、`dead-code.md`、`sql.md`）。

---

# 核心操作流程（Workflow 狀態機）

```text
步驟 1 (Terminal CLI)：
  執行 `refactor-analyze init [--full] [--lang zh-TW|zh-CN|en|ja|ko]`
  - 建立分析工作區骨架（AGENTS.md, skills/, rules/, project/）與資料庫連線設定檔模板 `project/system/db-connection.md`
  - 自動建立 `.gitignore`（將 `project/system/db-connection.md` 加入忽略清單，防止帳密與跳板機資訊外洩至 Git）
  - 自動檢查並建立 Git 功能（若尚未初始化則執行 `git init`）
        │
        ▼
步驟 2 (AI 對話啟動 & Git 對齊 & 產出系統大概與分類編號清單 — `init` / `rai`)：
  輸入 `refactor:init` (rai) ──►
  1. 語言確認：若未明確指定語言，主動詢問選擇 5 種語言之一並鎖定
  2. 系統路徑：詢問要分析的系統路徑（或直接輸入 `rai <系統路徑>`）
  3. Git 對齊：
     - 確認分析工作區與目標系統的 Git 狀態（目前分支 Branch、Commit Hash）
     - 詢問使用者「是否需要先向 remote 對齊（fetch/pull 同步最新進度或切換分支）？」
  4. 分析產出系統大概與分類編號清單：
     - 記錄執行分析時間日期、目標系統 Git 分支（Branch）與目前版本（Commit Hash / Tag）
     - 判斷系統型態（APP / 桌面應用程式 / 網頁 + 涵蓋範圍說明）、程式語言與技術棧（`overview.md`, `tech-stack.md`）
     - 盤點系統架構與**全域隱性機制（Filter / Interceptor / AOP / Middleware / 全域異常與權限處理）**（寫入 `architecture.md`）
     - 產出**死程式碼清單 `project/system/dead-code.md`**（列出未綁定路由/無人呼叫的 **Git 分支、Git Hash、程式檔案名稱、行數、判定原因與相關代碼**）
     - 產出功能與 API 分類總清單 `project/index.md`：
       * 同分類放在一起，無法歸類的統一放在「其他」
       * 每一項賦予唯一「編號」（如 `001`, `002`...），記錄：編號、功能或 API、程式的位置、複雜度、目前的狀態
        │
        ▼
步驟 3 (連結資料庫 Scan 所有欄位與 Trigger — `scandb` / `ras`)：
  填寫 `project/system/db-connection.md` 後，執行 `refactor-analyze scandb`（或 AI 指令 `refactor:scandb` / `ras`）：
  - 依據 `project/system/db-connection.md`（含資料庫產品、連線路徑/Host/Port/DB名、帳號、密碼，以及選填的**跳板機 SSH Bastion/Tunnel 資訊**）
  - 若有設定跳板機，自動建立 SSH Tunnel 通道；並以唯讀方式實際連線至資料庫 Scan 所有 Table、欄位名稱、資料型態、長度、PK/FK、Index、欄位註解（Comment）、View、Stored Procedure 與 **Trigger（觸發器）**
  - 自動產出資料庫總覽 `project/system/db-schema.md` 及各表欄位明細 `project/system/db/<table>.md`
        │
        ▼
步驟 4 (依「編號」深入分析個別業務邏輯並自動產出 SQL、死程式碼與 Backlog — `analyze <編號>` / `raa <編號>`)：
  執行 `refactor-analyze analyze <編號>`（或 AI 指令 `refactor:analyze <編號>` / `raa <編號>`）：
  - 依 `project/index.md` 的「編號」自動對應功能名稱與程式位置（進入點）
  - 自動新建以「編號」命名的獨立業務邏輯資料夾（如 `project/001/`），寫入執行分析日期時間、目標系統 Git 分支與 Commit Hash
  - **共用邏輯去重（`project/shared/`）**：若呼叫鏈中涉及多處共用的核心元件/Service，抽離記錄於 `project/shared/<name>.md`；若已存在於 `shared/` 則直接引用，不重複讀取與展開分析以節省 Token
  - 從程式位置（進入點）解析 Request/Response、Input/Output Args（或批次進入點），對照 `project/system/db/` 資料表與欄位定義（**嚴禁無來源幻想，所有邏輯必標註檔案與行號**）
  - 於 `project/<編號>/` 產出：
    1. `analysis.md`（執行時間、Git 分支與 Hash、進入點、I/O Args、複雜度與**技術債/重構改善建議 To-Be Notes**）
    2. `business-logic.md`（核心業務邏輯、流程、狀態轉換、計算與驗證規則，必附原始碼檔案與行號來源）
    3. `data-flow.md`（資料流與 DB 表/欄位讀寫映射）
    4. `sql.md`（**整理該業務邏輯涉及的所有 SQL 語句 / MyBatis / ORM Query、檔案名稱與行數、動態條件、JOIN/WHERE 邏輯解析與效能改善建議**）
    5. `dependencies.md`（上下游模組、共用元件、DB Table、外部 API 與套件依賴）
    6. `dead-code.md`（**列出該功能內發現的死程式碼：Git 分支、Git Commit Hash、程式檔案名稱、行數、判定原因與相關代碼片段**，並同步匯總至 `project/system/dead-code.md`）
    7. `backlog.md`（**自動產出**不確定的業務邏輯或無來源依據之未知欄位定義，嚴禁自行腦補）
        │
        ├──► (若有補充 Backlog 或需要重跑) ──► 步驟 5 (`reanalyze <編號>` / `rar <編號>`)：
        │     讀取 `project/<編號>/backlog.md` 內補充的業務邏輯或欄位定義，以及目標系統最新程式碼、DB 與 Git 分支/Hash，
        │     **再分析一次**並同步更新 `project/<編號>/` 內所有文件與執行分析時間日期。
        │
        ▼
步驟 6 (確認歸檔、跨編號流程匯總與 Git 自動 Commit & Remote Sync — `commit [編號]` / `rac [編號]`)：
  執行 `refactor-analyze commit [編號]`（或 AI 指令 `refactor:commit [編號]` / `rac [編號]`）：
  - 確認分析結果後，正式更新 `project/index.md` 對應編號的「複雜度」與「目前的狀態」
  - **更新跨編號領域狀態機與 CRUD 矩陣（`project/system/domain-flows.md`）** 與 **全域死程式碼清單（`project/system/dead-code.md`）**
  - 自動建立本機 Git commit（自動排除 `db-connection.md` 敏感帳密）
  - 若 Git 有設定 remote，自動執行 sync（先拉取遠端狀態並推送至 remote）
  - **衝突自動協助處理**：若 sync 時遇到 Git 衝突（如多人同時更新 `project/index.md` 或分析文件），主動協助解析與合併衝突，處理完成後自動再次執行 commit 與 sync 推送至 remote！
```

---

# 核心指令總表（CLI 與 AI 雙軌）

| 階段 / 功能 | CLI 指令 | AI 對話指令 | 簡寫 | 用途 |
|---|---|---|---|---|
| **1. 初始化與系統大概** | `refactor-analyze init [--full] [--lang ...]` | `refactor:init [路徑]` | `rai` | 建立工作區、`db-connection.md` 與 Git、確認語言、詢問目標系統路徑與是否向 remote 對齊，產出 `project/system/` 大概與分類編號清單 `project/index.md`。 |
| **2. 掃描資料庫欄位** | `refactor-analyze scandb` | `refactor:scandb` | `ras` | 依據 `project/system/db-connection.md`（支援跳板機）實際連進資料庫 Scan 所有 Table、欄位、關聯、View、Stored Procedure 與 Trigger，產出 `project/system/db-schema.md` 與 `project/system/db/<table>.md`。 |
| **3. 分析單一編號** | `refactor-analyze analyze <編號>` | `refactor:analyze <編號>` | `raa` | 新建 `project/<編號>/` 資料夾，深入分析業務邏輯、資料流、SQL、依賴關係、死程式碼、複雜度與重構建議，並**自動產出 `backlog.md`**。 |
| **4. 重新分析單一編號** | `refactor-analyze reanalyze <編號>` | `refactor:reanalyze <編號>` | `rar` | 根據 `backlog.md` 補充內容或程式碼/DB 變更**再分析一次**，更新 `project/<編號>/` 內所有文件。 |
| **5. 確認提交與遠端同步** | `refactor-analyze commit [編號]` | `refactor:commit [編號]` | `rac` | 確認後更新 `project/index.md` 狀態、自動 commit 到 Git；若有 remote 自動 sync，遇到衝突會協助處理，處理後再協助 commit 與 sync。 |
| **6. 匯出 PDF 文件** | `refactor-analyze pdf [目標] [--merge] [--output ...]` *(或 `md2pdf`)* | `refactor:pdf [目標]` | `rap` | 將指定的 `.md` 檔案、編號資料夾（如 `001`）或整個 `project/` 轉換為 `.pdf`（支援 `--merge` 合併為單一 PDF）。 |
| **7. 更新現有分析項目** | `refactor-analyze upgrade [--dry-run]` *(或 `update`)* | `refactor:upgrade` | `rau` | 將現有分析項目的 `AGENTS.md`、`skills/`、`rules/` 與缺失文件模板更新至最新版本（保留既有語言設定與分析內容）。 |
| **8. 狀態與健康檢查** | `refactor-analyze status` / `check` / `doctor` | - | - | 檢查現有項目進度統計、必要檔案完整性與環境狀態。 |

---

# 產出文件結構

```text
.gitignore                     # 自動忽略 project/system/db-connection.md 防止帳密外洩
project/
  index.md                     # 功能/API 分類清單（同分類放一起，無法歸類放「其他」；記錄：編號、功能或 API、程式的位置、複雜度、目前的狀態）
  system/                      # 第一階段：系統整體大概與資料庫結構（init & scandb 產出）
    db-connection.md           # 0. 資料庫與跳板機連線設定檔（填寫 DB 產品、路徑、帳號、密碼、跳板機；已被 .gitignore 保護）
    overview.md                # 1. 系統總覽、主要語言、分析時間、Git 分支與版本、系統型態判定（APP/應用程式/網頁 + 涵蓋說明）
    tech-stack.md              # 2. 現行程式語言、框架、建置工具與第三方套件盤點
    architecture.md            # 3. 現行系統架構、目錄職責、全域隱性機制（Filter / Interceptor / AOP / Middleware）
    domain-flows.md            # 4. 跨編號領域狀態機（State Machine）與核心資料表 CRUD 對照矩陣
    dead-code.md               # 5. 全系統死程式碼總表（列出 Git 分支、Hash、程式檔案名稱、行數、判定原因、相關代碼）
    db-schema.md               # 6. 資料庫總覽索引（由 scandb 實際抓取之所有資料表清單、View、Stored Procedure、Trigger 列表）
    db/                        # 7. 各資料表欄位明細（由 scandb 依 Table 拆檔產出，記錄實際抓取之欄位名稱、型別、PK/FK、註解）
      <table>.md
  shared/                      # 共用邏輯抽離區（避免多編號重複分析燒 Token）
    <shared-module>.md         # 多支 API/Batch 共用的核心商業元件或底層服務分析
  001/                         # 第二階段：以「編號」命名的獨立業務邏輯資料夾（analyze 001 / reanalyze 001 產出，commit 001 確認歸檔）
    analysis.md                # 1. 分析（執行日期時間、Git 分支與 Hash、進入點與 I/O Args、涉及檔案、複雜度、技術債與重構建議 To-Be Notes）
    business-logic.md          # 2. 業務邏輯（規則、流程、狀態轉換、計算與驗證邏輯，必附檔案與行號來源）
    data-flow.md               # 3. 資料流（Input -> 處理 -> 對應 system/db/ 的資料表與欄位讀寫 -> Output）
    sql.md                     # 4. SQL 與查詢邏輯整理（列出原始 SQL / MyBatis / ORM Query、檔案與行數、條件解析與優化建議）
    dependencies.md            # 5. 依賴關係（上下游模組、project/shared/ 共用元件引用、DB Table、外部 API 與套件依賴）
    dead-code.md               # 6. 死程式碼記錄（列出 Git 分支、Hash、程式檔案名稱、行數、相關代碼）
    backlog.md                 # 7. Backlog（自動產出不確定的業務邏輯、未知欄位定義、未明狀態碼）
```
