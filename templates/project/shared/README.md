# 共用邏輯抽離區 (Shared Business Modules)

當多個功能編號（如 `001`、`002`、`003`）呼叫同一個核心商業元件、計價引擎、驗證器或底層共用 Service 時：
1. 請將該共用邏輯獨立記錄於本目錄下（如 `project/shared/<module-name>.md`）。
2. 各編號資料夾的 `business-logic.md` 與 `dependencies.md` 直接引用此處檔案，**禁止在多個編號中重複讀取與重寫相同邏輯**，以節省 Token 並維持全系統一致性。
