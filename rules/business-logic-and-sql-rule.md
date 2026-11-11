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

## 5. 畫面操作行為與前後端驗證專檔整理（`project/<編號>/ui-behavior.md`）

- 舊系統常將大量欄位連動、預設值邏輯與輸入驗證寫在前端畫面（如 JSP / Vue / React / Angular / WinForms / WPF / Mobile 畫面事件）中，甚至出現「只有前端畫面驗證、後端 API 未驗證」的現象。
- 必須在 `project/<編號>/ui-behavior.md` 完整盤點並記錄（每一項皆須標註對應的前端/畫面檔案路徑與行號範圍 `` `<file>#L<start>-L<end>` ``）：
  1. **畫面欄位屬性與動態連動**：記錄欄位型態、預設值，以及**動態顯隱、唯讀（ReadOnly）、禁用（Disabled）與動態必填條件**。
  2. **下拉選單與選項控制項資料來源明細（`DropDownList` / `Select` / `ComboBox` / `Radio` Data Sources）**：凡是選項資料來源取自資料庫（無論是後端直連 DB 綁定、透過 API 查 DB、或查詢共用代碼表 Code Table），**必須明確寫出**：
     - 對應的資料庫 Table 名稱（對照 `project/system/db/<table>.md`）或 API 路徑。
     - 實際綁定的值欄位（`Value` / `DataValueField`）與畫面顯示文字欄位（`Text` / `DataTextField`）。
     - 查詢過濾條件（`WHERE`，例如是否只撈啟用狀態 `STATUS = '1'`、是否依登入者權限過濾、編輯舊資料時停用選項如何回顯）、排序規則（`ORDER BY`）與預設首項（如「請選擇 `""`」或「全部 `ALL`」）。
     - 級聯連動關係（Cascading DropDownList：上層父下拉選單變更時如何帶入參數重查下層選單並清空原值），且**相關查詢 SQL 必須同步收錄於 `sql.md`**。
  3. **畫面操作行為與事件觸發流程**：記錄頁面初始化（`onLoad` / `onMount`）、按鈕點擊（`onClick`）、欄位變更（`onChange` / `onBlur`）即時計算公式、確認彈窗、防連點機制與操作後跳轉動線。
  4. **畫面與後端驗證規則對照矩陣（Validation Matrix）**：逐一列出單欄位驗證（必填、長度、型態、Regex、數值範圍）與跨欄位連動驗證，並**明確標註驗證實作層級（`僅前端 UI` / `僅後端 API` / `前後端皆有`）及前後端規則是否一致**。
  5. **畫面元件級權限與資料遮罩**：記錄按鈕/頁籤的角色權限顯隱控管與敏感欄位遮罩格式。
- 若該編號為純後端 API 或背景批次作業（Batch Job）且無對應畫面，則在 `ui-behavior.md` 第一節明確標示「`無畫面操作（純後端 API / 批次作業）`」。

## 6. 隱性依賴、報表檔案映射、交易鎖定與驗收情境

1. **隱性上下文依賴盤點（`analysis.md`）**：舊系統常偷讀 `Session`、`HttpContext`、`ThreadLocal` 或全域變數，必須在 `analysis.md` 明確列出並提供現代無狀態 API 的傳入建議。
2. **報表匯出與檔案匯入映射（`data-flow.md`）**：涉及 Excel、CSV、定長電文檔或報表套印時，必須在 `data-flow.md` 記錄範本檔路徑、編碼與欄位對照清單。
3. **交易邊界與併發控制（`business-logic.md`）**：必須記錄 `@Transactional` 涵蓋範圍、資料庫鎖定機制（樂觀鎖/悲觀鎖）與回滾補償行為。
4. **重構驗收測試情境（`business-logic.md`）**：強制以 Given / When / Then 格式提供正向與邊界驗收條件，作為重構後自動化測試的黃金依據。
