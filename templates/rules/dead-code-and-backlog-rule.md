# 死程式碼、Backlog 與 Commit 同步規則（Dead Code, Backlog & Commit Rule）

## 1. 死程式碼記錄規範（`dead-code.md`）

無論是在全系統層級的 `project/system/dead-code.md`，或是在個別業務邏輯資料夾的 `project/<編號>/dead-code.md`，凡列出死程式碼（Dead Code，如未綁定路由的方法、無人呼叫的私有/公開方法、整段被註解掉的舊版代碼、永遠無法進入的條件分支），**每一筆都必須強制列出以下 6 項資訊**：

1. **目標系統 Git 分支（Branch）**
2. **目標系統 Git Commit Hash（版本號）**
3. **程式檔案名稱（完整相對路徑）**
4. **行數範圍（Line Numbers，如 `L120-L158`）**
5. **判定為死程式碼之原因**
6. **相關代碼片段（Code Snippet）**

> 強制記錄 Git 分支與 Commit Hash 是為了確保行號與代碼片段有絕對的時間與版本基準，不會因後續他人改動程式碼而錯位。

---

## 2. 業務知識憑證（Knowledge Voucher）、Backlog 與全域辭典閉環

### 2.1 業務知識憑證（Knowledge Voucher）記錄規範（`project/<編號>/backlog.md`）

1. **結構化憑證立案**：執行 `analyze <編號>` 時，凡遇下列情境，一律嚴禁憑空猜測，必須於 `project/<編號>/backlog.md` 建立結構化業務知識憑證：
   - 語意不明或缺乏註解的業務邏輯與條件分支
   - 資料庫與程式碼中無註解說明的縮寫欄位定義或狀態碼（Magic Numbers）
   - 缺少原始碼的外部系統介面或 DB Stored Procedure
2. **憑證欄位標準**：
   - `憑證編號`：`BL-01`, `BL-02`...
   - `類型`：`業務名詞/欄位`、`商業規則/流程`、`狀態碼/魔術數字`、`計算公式` 等
   - `程式/資料庫位置`：原始碼檔案或資料表欄位
   - `疑問與待釐清事項`：具體問題
   - `調查結果與拍板決策`：調查結果（待人工或官方規格確認）
   - `來源類型`：`Human/Interview`（訪談/會議）、`Official-Doc`（官方規範）、`Production-DB`（實測資料）、`Business-Decision`（業務拍板）
   - `佐證依據/訪談記錄`：會議記錄、簽呈、文件章節或 SQL 查證指令
   - `拍板人`：姓名或職稱（如 `王小明 (PM)`）
   - `適用範圍`：`全系統通用` 或 `單一編號: <編號>`
   - `狀態`：`待確認` 或 `已釐清`
3. **雙軌引用規範（Dual-Track Citation）**：
   - 程式碼依據：使用 `` `path/File.java#L10-L25` ``
   - 人為調查/規格書依據：必須使用憑證引用格式，如 `` `[Human: 訪談維運主管]#BL-01` `` 或 `` `[Doc: 2025會員手冊第4條]#BL-02` ``。
   - `refactor-analyze verify` 將嚴格核對該憑證是否在 `backlog.md` 中立案、狀態是否為 `已釐清`，且具備簽核拍板人與結論。
4. **補充與重新分析（`reanalyze <編號>` / `rar <編號>`）**：
   - 當使用者在 `backlog.md` 填入確認後的定義與拍板人並執行 `reanalyze <編號>` 時，AI 必須讀取補充內容，將已確認的業務邏輯正式寫入 `business-logic.md`、`data-flow.md` 等文件，並將狀態標為 `已釐清`。

---

## 3. `commit` 確認歸檔、全域辭典匯總、Git Sync 與衝突處理規範

當使用者執行 `refactor-analyze commit [編號]`（或 AI 指令 `refactor:commit [編號]` / `rac [編號]`）時，必須依序完成以下動作：

1. **確認並更新 `project/index.md` 狀態**：
   - 檢查該編號的分析文件與 `backlog.md`，將 `project/index.md` 對應編號的「複雜度」與「目前的狀態」（如 `已完成` 或 `待確認`）更新為最新確認結果。
   - 同步更新 `project/system/domain-flows.md`（跨編號領域狀態機與資料表 CRUD 矩陣）與 `project/system/dead-code.md`（全域死程式碼總表）。
   - **自動匯總全域辭典**：自動掃描 `backlog.md`，將標記為 `已釐清` 且範圍為 `全系統通用` 之業務憑證自動收錄至 `project/system/domain-dictionary.md`，供後續所有編號直接繼承，嚴禁重複提問！
2. **自動建立本機 Git Commit**：
   - 確認 `project/system/db-connection.md` 已被 `.gitignore` 忽略且未進入 staged 區。
   - 將變更加入暫存區並建立本機 commit（例如：`docs(001): 完成編號 001 業務邏輯重構分析歸檔`）。
3. **自動與 Git Remote Sync（Pull & Push）**：
   - 檢查分析工作區是否有設定 Git remote（如 `origin`）。
   - 若有設定 remote，自動先拉取遠端最新變更並同步推送至 remote。
4. **遇到 Git 衝突時主動協助處理，處理後再自動 Commit 與 Sync**：
   - 若在與 remote 同步（pull / rebase / merge）時發生衝突（例如多人協作同時更新了 `project/index.md` 或 `domain-flows.md`）：
     1. 主動解析衝突區塊（例如保留雙方各自新增/更新的編號狀態列，消除 `<<<<<<<`、`=======`、`>>>>>>>` 衝突標記）。
     2. 若為同一編號內容衝突，主動向使用者說明差異並協助合併。
     3. 衝突處理完成後，**自動執行 `git add`、建立合併/修正 commit，並再次執行 sync 推送至 remote**，完成閉環。
