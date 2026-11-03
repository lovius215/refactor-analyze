# 依賴關係分析：編號 {{ITEM_ID}} — {{ITEM_NAME}}

- **執行分析的時間日期**：`{{ANALYSIS_TIME}}`
- **目標系統 Git 分支 / Commit Hash**：`{{GIT_BRANCH}}` @ `{{GIT_COMMIT}}`
- **程式進入點**：`{{ITEM_LOCATION}}`

---

## 1. 上游呼叫者 (Upstream Callers — 誰呼叫了這個功能)

| 呼叫來源（前端畫面 / 外部系統 / 排程器 / 其他編號） | 呼叫方式 | 來源檔案位置與行號 |
|---|---|---|
| 待分析 | - | - |

---

## 2. 下游內部模組與共用元件依賴 (Internal & Shared Module Dependencies)

| 依賴元件 / Service 名稱 | 是否為共用模組 (`project/shared/`) | 呼叫之方法 | 用途與影響範圍 | 來源檔案與行號 |
|---|---|---|---|---|
| 待分析 | 否 | - | - | - |

---

## 3. 資料庫、快取與外部系統依賴 (Database, Cache & External Integrations)

| 依賴類型 (`DB Table` / `Redis` / `MQ` / `External API` / `File`) | 目標名稱 / 端點 | 讀寫或通訊方向 | 重構耦合風險評估 |
|---|---|---|---|
| 待分析 | - | - | - |
