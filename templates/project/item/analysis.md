# 分析總覽：編號 {{ITEM_ID}} — {{ITEM_NAME}}

- **編號**：`{{ITEM_ID}}`
- **功能或 API**：`{{ITEM_NAME}}`
- **所屬分類**：`{{ITEM_CATEGORY}}`
- **程式的位置（進入點）**：`{{ITEM_LOCATION}}`
- **執行分析的時間日期**：`{{ANALYSIS_TIME}}`
- **目標系統 Git 分支 (Branch)**：`{{GIT_BRANCH}}`
- **目標系統 Git 版本 (Commit Hash / Tag)**：`{{GIT_COMMIT}}`
- **目標系統 Git 工作區狀態**：`{{GIT_STATUS}}`
- **複雜度等級**：`{{ITEM_COMPLEXITY}}`
- **目前的狀態**：`{{ITEM_STATUS}}`

> **禁止 AI 幻想鐵律**：本文件所有參數、檔案清單與分析內容必須 100% 基於實際讀取的原始碼與資料庫結構，無來源依據嚴禁亂寫。

---

## 1. 程式進入點與介面參數規格 (Entrypoint & Input/Output Args)

- **進入點類型**：`API / Page / Batch / Event`
- **進入點檔案與方法（含行號）**：`{{ITEM_LOCATION}}`
- **Request / Input Args（輸入參數）**：
  | 參數名稱 | 來源 (`Body`/`Query`/`Path`/`Header`/`Batch Args`) | 資料型態 | 必填 | 說明与驗證規則（附檔案行號來源） |
  |---|---|---|---|---|
  | 待分析 | - | - | - | - |
- **Response / Output（輸出結果與狀態碼）**：
  | 欄位或狀態碼 | 資料型態 | 說明（附檔案行號來源） |
  |---|---|---|
  | 待分析 | - | - |
- **隱性上下文依賴與狀態盤點 (Implicit Context / Session / ThreadLocal / Global State)**：
  > ⚠️ **重構防坑重點**：舊系統常在進入點後方深處直接取用 `Session["USER_ID"]`、`HttpContext`、`ThreadLocal`、Cookie 或全域靜態變數。重構為現代無狀態 REST API 時若未盤點，將造成缺少關鍵欄位或權限漏洞。
  | 隱性參數名稱 / 鍵值 | 來源 (`Session`/`Cookie`/`ThreadLocal`/`Global`/`Header`) | 型態 | 業務意義與用途 | 程式中讀取之位置與行號 | 重構建議傳入方式 (`JWT Claims`/`Header`/`Body`) |
  |---|---|---|---|---|---|
  | *(待 AI 分析填寫；若無隱性依賴請填「無」)* | - | - | - | - | - |

---

## 2. 呼叫鏈涉及的檔案清單 (Involved Files)

| 順序 | 層級 (`Controller`/`Service`/`DAO`/`Batch`) | 檔案路徑與行號範圍 | 主要職責說明 |
|---|---|---|---|
| 1 | Entrypoint | `{{ITEM_LOCATION}}` | 程式進入點 |

---

## 3. 複雜度評估分析 (Complexity Assessment)

- **複雜度等級**：`{{ITEM_COMPLEXITY}}`
- **量化指標（CLI / 靜態分析）**：`{{COMPLEXITY_METRICS}}`
- **複雜度詳細原因**：
  - 待分析（說明條件分支數、跨資料表數量、外部依賴或邏輯糾結程度）

---

## 4. 現行邏輯摘要（As-Is）vs. 技術債與重構改善建議（To-Be Notes）

### A. 現行系統功能摘要 (As-Is Summary)
- 待分析

### B. 技術債與重構改善建議 (Technical Debt & Refactoring Notes — 嚴禁照抄之舊設計)
- 待分析（例如：是否有迴圈內查 DB 的 N+1 問題、缺乏 `@Transactional` 交易保護、寫死的常數、重複查詢或安全性風險）
