# 舊系統重構分析工作區 (Legacy Refactoring Analysis Workspace)

本工作區由 `@loviusc/refactor-analyze` 初始化建立，用於逆向分析外部舊系統並產出零幻覺、可追溯的重構分析文件。

- **專案主要語言**：`{{LANG_LABEL}}`
- **最高指導原則**：**禁止 AI 幻想（沒有來源依據絕對不亂寫；未知邏輯與欄位定義一律寫入 `backlog.md`）**

## 核心指令（CLI 與 AI 對話雙軌）

| 步驟 | CLI 指令 | AI 對話指令 | 簡寫 | 說明 |
|---|---|---|---|---|
| 1 | `refactor-analyze init [--full]` | `refactor:init [路徑]` | `rai` | 確認語言、詢問目標系統路徑與是否向 remote 對齊，產出 `project/system/` 大概與分類編號清單 `project/index.md`。 |
| 2 | `refactor-analyze scandb` | `refactor:scandb` | `ras` | 依據 `project/system/db-connection.md`（支援跳板機）實際連進資料庫抓取所有資料表、欄位與 Trigger，產出 `db-schema.md` 與 `db/<table>.md`。 |
| 3 | `refactor-analyze analyze <編號>` | `refactor:analyze <編號>` | `raa` | 依編號新建 `project/<編號>/` 資料夾，深入分析業務邏輯、資料流、SQL、依賴關係、死程式碼、複雜度，並**自動產出 `backlog.md`**。 |
| 4 | `refactor-analyze reanalyze <編號>` | `refactor:reanalyze <編號>` | `rar` | 根據 `backlog.md` 補充內容或程式碼變更**再分析一次**，更新 `project/<編號>/` 所有文件。 |
| 5 | `refactor-analyze verify [編號]` | `refactor:verify [編號]` | `rav` | **0-Token 驗證**：檢查原始碼檔案與 `#Lx-Ly` 行號是否真實存在，並偵測目標系統 Git 改版飄移。 |
| 6 | `refactor-analyze commit [編號]` | `refactor:commit [編號]` | `rac` | 驗證通過後更新 `project/index.md` 狀態、自動 commit 到 Git；若有 remote 自動安全 sync。 |
| 7 | `refactor-analyze pdf [目標] [--merge]` *(或 `md2pdf`)* | `refactor:pdf [目標]` | `rap` | 將 `.md` 檔案、編號資料夾（如 `001`）或整個 `project/` 轉換為 `.pdf` 文件（0 Token）。 |
| 8 | `refactor-analyze upgrade` *(或 `update`)* | `refactor:upgrade` | `rau` | 更新現有工作區規則與缺失文件模板至最新版本。 |
