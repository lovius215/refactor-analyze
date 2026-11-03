# 資料流分析：編號 {{ITEM_ID}} — {{ITEM_NAME}}

- **執行分析的時間日期**：`{{ANALYSIS_TIME}}`
- **目標系統 Git 分支 / Commit Hash**：`{{GIT_BRANCH}}` @ `{{GIT_COMMIT}}`
- **程式進入點**：`{{ITEM_LOCATION}}`

> **規範**：請對照 `project/system/db/<table>.md` 的真實資料庫欄位結構（由 `scandb` 產出），明確記錄資料從進入點到資料庫及回傳的完整流向。若欄位定義不明，請同步列入 `backlog.md`。

---

## 1. 端到端資料流向圖 / 路徑 (End-to-End Data Flow)

```text
[Input: Request / Args]
   ──► [Controller / Entrypoint]
   ──► [Service / DTO Mapping]
   ──► [DAO / Repository / DB Tables]
   ──► [Output: Response / Result]
```

---

## 2. 資料庫資料表與欄位讀寫映射 (DB Tables & Columns Read/Write)

| 資料表名稱 (`project/system/db/`) | 操作 (`C`/`R`/`U`/`D`) | 涉及欄位名稱 | 欄位型態與說明（對照 `scandb`） | 對應程式位置與行號 |
|---|---|---|---|---|
| 待分析 | - | - | - | - |

---

## 3. 物件與欄位轉換映射 (Input $\to$ Entity $\to$ Output Mapping)

| 輸入參數 / 來源欄位 | 內部處理 / 轉換邏輯 | 目標資料表欄位或輸出欄位 | 來源檔案與行號 |
|---|---|---|---|
| 待分析 | - | - | - |
