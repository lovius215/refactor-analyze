# 禁止 AI 幻想鐵律（Zero-Hallucination & Evidence-Based Rule）

本規則為全專案最高優先級鐵律，任何分析產出皆不得違反。

## 1. 無來源依據，嚴禁亂寫（No Source, No Write）

- 所有寫入 `project/system/`、`project/index.md`、`project/shared/` 與 `project/<編號>/` 的內容，**必須 100% 具備可查證的實體來源**：
  - 原始碼檔案路徑與行號範圍（格式：`` `<relative/path/to/File.ext>#L<start>-L<end>` ``）
  - 專案設定檔路徑與設定項名稱（如 `` `pom.xml` ``、`` `package.json` ``、`` `application.yml` ``）
  - 資料庫掃描結果（`project/system/db/<table>.md` 或 DDL / SQL 檔）
- **找不到實體來源的任何推論、假設或常見設計慣例，嚴禁寫入正式規格或業務邏輯欄位中。**

## 2. 嚴禁腦補未知欄位、狀態碼與商業規則

- 當程式碼出現以下情況時，AI **絕對禁止自行猜測其含義**：
  1. **無註解之狀態碼或魔術數字（Magic Numbers）**：例如程式碼寫 `if (order.getStatus() == 4)`，但專案內無 Enum 或註解定義 `4` 代表什麼，AI 只能記錄「當 `status == 4` 時執行...（`4` 之業務語意未明）」，並將「`order.status == 4` 的業務定義」列入 `backlog.md`。
  2. **縮寫或語意不明的資料表/API 欄位**：例如 `USR_LVL_TP`、`EXT_ATTR_2` 在資料庫無 Comment 且程式碼無明確說明時，一律列入 `backlog.md`。
  3. **外部系統 API 或缺少的 Stored Procedure**：當程式碼呼叫外部 HTTP URL、MQ Topic 或 DB Stored Procedure，但本專案與 DB 中找不到其內部邏輯時，僅記錄呼叫參數與回傳處理，並將未知內部行為列入 `backlog.md`。

## 3. 原文忠實性與 CLI 0-Token 自動驗證 (`verify`)

- 在 `sql.md` 記錄的 SQL 語句與在 `dead-code.md` 記錄的死程式碼片段，必須忠實反映目標系統在該 Git 分支與 Commit Hash 下的真實代碼，不得擅自改寫、美化或省略關鍵條件。
- **0-Token 實體檔案與行號核驗（`refactor-analyze verify [編號]`）**：
  - 分析完成後或執行 `commit` 前，CLI 會自動掃描 `project/<編號>/` 內所有 `` `<file>#L<start>-L<end>` `` 引用，直接核對目標系統實體檔案是否存在、行號是否超出實際檔案總行數，並檢查目標系統 Git Commit 是否已改版導致行號飄移（Drift Detection）。
  - 凡未通過 `verify` 檢查（缺少來源引用、引用了不存在的幻覺路徑或超出檔案行數）之編號，CLI 將拒絕標記為 `已完成`。
