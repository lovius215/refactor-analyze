# 資料庫與跳板機連線設定檔 (Database & SSH Jump Host Configuration)

> ⚠️ **資安保護提醒**：本檔案包含敏感帳號密碼，已自動加入 `.gitignore`，執行 `commit` 時絕不會被提交或推送至遠端 Git。
> 填寫完畢後，請執行 `refactor-analyze scandb`（或在 AI 對話輸入 `refactor:scandb` / `ras`）以唯讀方式實際抓取所有資料表與欄位。

## 1. 資料庫基本連線資訊

- **啟用資料庫掃描 (Enabled)**: `false`
- **資料庫產品 (Database Product)**: `mysql`
  *(支援填入: `mysql` | `mariadb` | `postgres` | `mssql` | `oracle` | `sqlite`)*
- **連線主機或檔案路徑 (Host / Path)**: `127.0.0.1`
- **連接埠 (Port)**: `3306`
- **資料庫名稱 / Schema (Database / Schema)**: `your_database_name`
- **帳號 (Username)**: `your_username`
- **密碼 (Password)**: `your_password`

---

## 2. 跳板機設定 (SSH Jump Host / Bastion — 若無需跳板機請保持 `false`)

- **啟用跳板機 (SSH Enabled)**: `false`
- **跳板機主機 (SSH Host)**: `bastion.example.com`
- **跳板機連接埠 (SSH Port)**: `22`
- **跳板機帳號 (SSH Username)**: `ec2-user`
- **跳板機密碼 (SSH Password)**: ``
- **跳板機私鑰路徑 (SSH Private Key Path)**: `~/.ssh/id_rsa`
- **本地轉發連接埠 (Local Tunnel Port)**: `13306`
