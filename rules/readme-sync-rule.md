# README 多語系同步更新規範（README Sync Rule）

本規範適用於 `@loviusc/refactor-analyze` 工具本體的開發與維護。

## 強制同步原則

每次在本專案新增、修改或移除功能（包含 CLI 指令、參數旗標、AI 工作流程、`templates/` 模板結構或核心分析規範）時，**必須同步檢查並更新本專案根目錄下的所有 README 文件**，確保所有語言版本的功能說明、指令列表、範例與行為描述完全一致：

1. [readme.md](../readme.md)
2. [README.zh-TW.md](../README.zh-TW.md)
3. [README.zh-CN.md](../README.zh-CN.md)
4. [README.en.md](../README.en.md)
5. [README.ja.md](../README.ja.md)
6. [README.ko.md](../README.ko.md)

## 檢查清單

- 新增或變更 CLI 指令（例如 `scan-entries`、`verify`、`scandb` 等）時，6 份 README 的指令對照表與使用範例必須一併更新。
- 新增或變更 AI 工作流程（例如 `refactor:init` / `rai` 的三種掃描模式或主動提問規則）時，6 份 README 必須同步反映。
- 提交 Git commit 或發佈版本前，確認沒有任何一份 README 遺漏更新。
