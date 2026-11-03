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

## 2. Backlog 自動產出與 `reanalyze` 閉環（`project/<編號>/backlog.md`）

1. **自動產出**：執行 `analyze <編號>` 時，必須自動建立並填入 `project/<編號>/backlog.md`，將所有：
   - 語意不明或缺乏註解的業務邏輯與條件分支
   - 資料庫與程式碼中無註解說明的欄位定義或狀態碼（Magic Numbers）
   - 缺少原始碼的外部系統介面或 DB Stored Procedure
   逐一編號列管，狀態標為 `待確認`。
2. **補充與重新分析（`reanalyze <編號>` / `rar <編號>`）**：
   - 當使用者在 `backlog.md` 填入確認後的定義或說明並執行 `reanalyze <編號>` 時，AI 必須讀取補充內容與目標系統最新程式碼/Git 狀態，**再分析一次**，將已確認的定義正式寫入 `business-logic.md`、`data-flow.md`、`sql.md`、`analysis.md` 中，並將該筆 Backlog 狀態更新為 `已釐清`。

---

## 3. `commit` 確認歸檔、自動 Git Commit、Remote Sync 與衝突處理規範

當使用者執行 `refactor-analyze commit [編號]`（或 AI 指令 `refactor:commit [編號]` / `rac [編號]`）時，必須依序完成以下動作：

1. **確認並更新 `project/index.md` 狀態**：
   - 檢查該編號的分析文件與 `backlog.md`，將 `project/index.md` 對應編號的「複雜度」與「目前的狀態」（如 `已完成` 或 `待確認`）更新為最新確認結果。
   - 同步更新 `project/system/domain-flows.md`（跨編號領域狀態機與資料表 CRUD 矩陣）與 `project/system/dead-code.md`（全域死程式碼總表）。
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
