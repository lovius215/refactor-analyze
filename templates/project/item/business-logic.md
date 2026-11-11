# 業務邏輯分析：編號 {{ITEM_ID}} — {{ITEM_NAME}}

- **執行分析的時間日期**：`{{ANALYSIS_TIME}}`
- **目標系統 Git 分支 / Commit Hash**：`{{GIT_BRANCH}}` @ `{{GIT_COMMIT}}`
- **程式進入點**：`{{ITEM_LOCATION}}`

> **最高指導原則（禁止 AI 幻想鐵律）**：
> 1. 每一條業務規則、條件分支、計算公式與狀態轉換，**必須標註對應的原始碼檔案路徑與行號範圍**（如 `` `src/service/OrderService.java#L45-L88` ``）。
> 2. 凡是在程式碼中語意不明、無註解定義的狀態碼或規則，**嚴禁自行猜測腦補**，必須移入同目錄下的 `backlog.md` 記錄。
> 3. 若呼叫了已抽離於 `project/shared/` 的共用元件，請直接引用該檔案，不重複展開。

---

## 1. 主要業務流程步驟 (Main Execution Flow)

1. **[步驟 1]**：待分析（來源：`` `檔案路徑#L行號` ``）
2. **[步驟 2]**：待分析（來源：`` `檔案路徑#L行號` ``）

---

## 2. 核心商業規則與條件判斷 (Business Rules & Branch Conditions)

| 規則編號 | 觸發條件 (`if` / `switch` 邏輯) | 執行動作 / 結果 | 原始碼檔案路徑與行號來源 |
|---|---|---|---|
| `BR-01` | 待分析 | - | - |

---

## 3. 計算公式與資料驗證規則 (Calculations & Validations)

- **資料驗證與權限檢查**：
  - 待分析（附檔案與行號來源）
- **計算公式與數值處理**：
  - 待分析（附檔案與行號來源）

---

## 4. 狀態轉換、交易邊界與例外處理 (State Transitions, Transactions & Locking)

- **狀態碼變更與生命週期**：待分析（附檔案與行號來源）
- **交易邊界與併發控制 (Transaction & Locking)**：
  - **資料庫交易範圍 (Transaction Scope)**：*(待 AI 分析填寫：如有 `@Transactional` 涵蓋哪些 Service/DAO 方法與 Table；若無交易保護則記錄技術債)*
  - **併發控制與鎖定機制 (Concurrency Control)**：*(待 AI 分析填寫：如樂觀鎖 `VERSION` 欄位、悲觀鎖 `FOR UPDATE`、分散式鎖或無鎖併發風險)*
- **例外狀況、Rollback 與補償機制**：待分析（失敗時之回滾範圍與錯誤回傳，附檔案與行號來源）

---

## 5. 重構驗收測試情境 (Acceptance Test Scenarios — Given / When / Then)

> 💡 供接手重構的工程師與 QA 撰寫自動化測試（Unit/Integration Tests），以舊系統真實邏輯作為重構驗收準則。

| 情境編號 | 測試案例名稱 / 目的 | 前置條件 (Given) | 觸發動作與輸入參數 (When) | 預期結果、狀態碼與 DB 變更 (Then) | 對應規則編號 (`BR-xx` / `VAL-xx`) |
|---|---|---|---|---|---|
| `TC-01` | *(待 AI 填寫：正向核心業務成功情境)* | - | - | - | - |
| `TC-02` | *(待 AI 填寫：邊界值或例外檢核阻擋情境)* | - | - | - | - |
