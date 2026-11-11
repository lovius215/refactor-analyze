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

---

## 4. 檔案匯入 / 報表匯出 / 套表欄位映射 (File Import, Report Export & Templates — 若適用)

> 💡 舊系統若涉及 Excel/CSV 匯入匯出、銀行定長電文檔（TXT）或套表列印（PDF/Crystal Report/JasperReports），必須記錄檔案格式、編碼（如 `Big5`/`UTF-8 with BOM`）、欄位位置與檢核邏輯。若本編號無檔案匯入匯出，請填寫「無檔案匯入匯出作業」。

- **作業類型**：*(待 AI 分析填寫：`Excel 匯入` / `CSV 匯出` / `PDF 套印` / `銀行 EDI 定長檔` / `無檔案匯入匯出`)*
- **範本檔案路徑或報表定義檔**：*(待 AI 分析填寫：如 `templates/order_export.xlsx` 或 `OrderRpt.jrxml`；無則填「無」)*
- **檔案編碼與分隔符號**：*(例如 `UTF-8` / `Big5` / `逗號 (,)` / `Tab` / `定長欄位 (Fixed-Width)`)*

### 欄位對照清單 (File Column Mapping)

| 欄位序號 / 儲存格座標 | 檔案欄位標題 / 說明 | 對應系統或 DB 欄位 (`db/<table>.md`) | 資料格式化 / 轉換規則（日期、千分位、代碼轉中文） | 匯入檢核規則 / 必填限制 | 來源檔案與行號 |
|---|---|---|---|---|---|
| *(待 AI 分析填寫；若無請填「無」)* | - | - | - | - | - |
