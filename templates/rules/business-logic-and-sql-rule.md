# 業務邏輯、資料流、SQL 與共用模組分析規則（Business Logic & SQL Rule）

執行 `analyze <編號>` (`raa <編號>`) 與 `reanalyze <編號>` (`rar <編號>`) 時，必須在以**編號**命名的獨立資料夾 `project/<編號>/` 中產出並維護以下內容。

## 1. 必備分析元資料（時間日期與 Git 版本/分支）

每個編號資料夾內的分析文件表頭，**必須明確記錄**：
- **編號與功能名稱**：對應 `project/index.md` 的編號與功能/API。
- **執行分析的時間日期**：格式 `YYYY-MM-DD HH:mm`。
- **目標系統 Git 版本控制資訊**：
  - 若目標系統有 Git 版本控制，必須記錄分析當下的 **Git 分支（Branch）** 與 **Git Commit Hash（版本號/Tag）** 及工作區狀態（Clean / Modified）。
- **程式進入點與介面參數**：
  - **Web / API（如 Spring Web 等）**：記錄 Controller Class#Method、HTTP Method & URL Path、**Request Header / Path / Query / Body (Input Args)** 與 **Response DTO / Status Code (Output)**。
  - **Batch 批次 / 排程 / CLI**：記錄**程式進入點**（如 `main()`、`@Scheduled`、Job/Tasklet Class#Method）、觸發排程表達式（Cron），以及啟動輸入參數（Input Args）與輸出結果（Output）。
  - **APP / 桌面應用程式**：記錄畫面/視窗進入點、傳入參數（Input Args）與操作事件輸出（Output）。

## 2. 共用邏輯抽離去重（`project/shared/`）

- 若在追蹤呼叫鏈時，發現某個底層 Service、計價/驗證引擎或工具類別被多個編號共用：
  1. 將該共用邏輯獨立分析並寫入 `project/shared/<module-name>.md`。
  2. 在當前編號的 `business-logic.md` 與 `dependencies.md` 中直接附上 `project/shared/<module-name>.md` 引用連結與輸入輸出說明，**禁止在多個編號資料夾內重複展開讀取與抄寫相同邏輯**，以大幅節省 Token。

## 3. 現況（As-Is）與重構建議（To-Be Notes）分離

- 在 `project/<編號>/analysis.md` 中，必須將 **「現行邏輯摘要（As-Is）」** 與 **「技術債與重構改善建議（To-Be Refactoring Notes）」** 分開撰寫：
  - 明確標出舊程式中的不良設計（例如：迴圈內查詢 DB 導致 N+1 問題、缺乏 `@Transactional` 交易保護、寫死的硬編碼常數、過時加密演算法、多餘重複查詢），提醒後續重構開發時**只保留業務規則，嚴禁照抄舊系統的錯誤實作**。

## 4. SQL 與查詢邏輯專檔整理（`project/<編號>/sql.md`）

- 舊系統常將關鍵篩選條件、計算公式與業務狀態判斷寫在 SQL 中。
- 必須在 `project/<編號>/sql.md` 完整列出該編號呼叫鏈中執行的所有 SQL（含原生 SQL、MyBatis XML、JPQL/HQL、QueryBuilder 或 Stored Procedure 呼叫）：
  1. **來源檔案名稱、Mapper ID / 方法名與行數範圍**。
  2. **操作類型（`SELECT` / `INSERT` / `UPDATE` / `DELETE` / `CALL`）與涉及的資料表**。
  3. **原始 SQL 語句與動態條件（如 MyBatis `<if>` / `<where>`）**。
  4. **SQL 業務邏輯解析**（說明 `JOIN` 關聯、`WHERE` 過濾條件、`CASE WHEN` 與聚合計算代表之業務規則）。
  5. **SQL 效能與重構建議**（如是否使用 `SELECT *`、索引缺失風險、子查詢拆分建議）。
- 若該功能完全不涉及資料庫查詢，則在 `sql.md` 明確標示「無 SQL 操作」。
