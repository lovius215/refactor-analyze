# SQL 與查詢邏輯整理：編號 {{ITEM_ID}} — {{ITEM_NAME}}

- **執行分析的時間日期**：`{{ANALYSIS_TIME}}`
- **目標系統 Git 分支 / Commit Hash**：`{{GIT_BRANCH}}` @ `{{GIT_COMMIT}}`
- **程式進入點**：`{{ITEM_LOCATION}}`

> **規範**：完整列出本編號呼叫鏈中執行的所有原生 SQL、MyBatis Mapper XML、JPQL/HQL、QueryBuilder 或 Stored Procedure。若本功能完全無資料庫操作，請明確標示「無 SQL 操作」。

---

## 1. SQL 操作清單總覽

| 序號 | 來源檔案與行數 | 方法名 / Mapper ID | 操作類型 (`SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CALL`) | 涉及資料表 |
|---|---|---|---|---|
| `SQL-01` | 待分析 | - | - | - |

---

## 2. SQL 語句與業務邏輯解析明細

### `SQL-01`：[方法名 / Mapper ID]
- **來源位置**：`待補充檔案名稱#L0-L0`
- **目標資料表**：`待補充`
- **傳入參數**：`待補充`
- **原始 SQL / 查詢語句（含動態條件）**：
  ```sql
  -- 原始 SQL 語句（忠實呈現原始碼內容，禁止自行竄改）
  ```
- **SQL 條件與業務邏輯解析（`JOIN` / `WHERE` / `CASE WHEN` 說明）**：
  - 待分析
- **SQL 效能與重構建議（如 `SELECT *`、缺少索引、N+1 或子查詢優化）**：
  - 待分析
