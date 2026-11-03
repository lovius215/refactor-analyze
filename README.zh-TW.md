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
| **3. 分析單一編號** | `refactor-analyze analyze <編號>` | `refactor:analyze <編號>` | `raa` | 新建 `project/<編號>/` 資料夾，深入分析業務邏輯、資料流、SQL、依賴、死程式碼與複雜度，並**自動產出 `backlog.md`**。 |
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
4. **依編號分析業務邏輯**：執行 `refactor-analyze analyze 001` 與 AI 指令 `raa 001`，在 `project/001/` 下產出 `analysis.md`、`business-logic.md`、`data-flow.md`、`sql.md`、`dependencies.md`、`dead-code.md` 與自動生成的 `backlog.md`。
5. **補充 Backlog 並重新分析**：在 `project/001/backlog.md` 補上未知欄位或規則說明後，執行 `rar 001` 再分析一次。
6. **確認歸檔與同步**：執行 `refactor-analyze commit 001`（或 `rac 001`），更新 `project/index.md` 狀態並自動完成 Git commit 與 remote sync（含衝突協助處理）。
7. **升級現有工作區**：未來工具更新後，在工作區執行 `refactor-analyze upgrade`（或 `update`）即可無損更新規則與模板。
