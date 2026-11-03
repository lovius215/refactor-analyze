# 資料庫連線與 `scandb` 掃描規則（Database & ScanDB Rule）

## 1. 資料庫連線設定檔（`project/system/db-connection.md`）

`refactor-analyze init` 會在工作區建立 `project/system/db-connection.md`，包含：
- **資料庫產品（Database Product）**：`mysql` | `mariadb` | `postgres` | `mssql` | `oracle` | `sqlite`
- **連線路徑資訊**：`Host`、`Port`、`Database / Schema`（或 SQLite 檔案路徑）
- **認證資訊**：`Username`（帳號）、`Password`（密碼）
- **跳板機設定（SSH Jump Host / Bastion，選填）**：
  - `SSH Enabled`：`true` / `false`
  - `SSH Host`、`SSH Port`、`SSH User`、`SSH Password` 或 `SSH Key Path`

## 2. 資安與唯讀鐵律（Security & Read-Only Rules）

1. **禁止提交帳密至 Git 與禁止讀取帳密至 AI Context**：
   - `project/system/db-connection.md` 已預設加入 `.gitignore`。
   - 無論是 CLI 或 AI 執行 `commit` 時，**嚴禁執行 `git add -f project/system/db-connection.md` 或將帳密複製到其他追蹤檔案中**。
   - **資安防護**：當使用者在 AI 對話輸入 `refactor:scandb` (`ras`) 時，AI **只可呼叫本機 CLI `refactor-analyze scandb` 執行掃描，嚴禁直接讀取或印出 `db-connection.md` 內的明文密碼至 AI 對話框**。
2. **強制唯讀帳號與唯讀 Session（Read-Only Introspection）**：
   - 強烈要求使用者於 `db-connection.md` 配置僅具 `SELECT` 權限的唯讀資料庫帳號（Read-Only Account）。
   - `scandb` 連線時在程式端強制啟用唯讀模式（SQLite `-readonly`、MySQL `SET SESSION TRANSACTION READ ONLY`、PostgreSQL `default_transaction_read_only=on`、SQL Server `sqlcmd -K ReadOnly`、Oracle `SET TRANSACTION READ ONLY`），並透過獨立 SSH ControlMaster Socket 管理跳板機通道（不使用危險的 `pkill -f`）。
   - **嚴禁執行任何 `INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE` 或會修改業務資料之語句。**

## 3. 產出結構與省 Token 拆檔原則

執行 `scandb` 後，產出以下兩層文件：
1. **`project/system/db-schema.md`（資料庫總覽索引）**：
   - 記錄資料庫產品、Schema 名稱、掃描時間，以及所有 **Table 清單（表名、註解說明、欄位數、對應檔案連結）**、**View 清單**、**Stored Procedure / Function 清單**與 **Trigger（觸發器）清單**。
2. **`project/system/db/<table>.md`（單表欄位明細）**：
   - **每張資料表獨立一個 Markdown 檔案**，記錄該表的所有欄位名稱、資料型態與長度、是否允許 Null、預設值、PK/FK/Index 與欄位 Comment 註解。
   - 後續執行 `analyze <編號>` 時，AI **只讀取該編號實際用到的資料表 `.md` 檔**，避免一次載入全庫上百張表造成 Token 耗盡。
