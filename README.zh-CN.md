# 旧系统重构分析 AI 工作台 (Legacy Refactoring Analysis AI Workspace)

[![npm version](https://img.shields.io/npm/v/@loviusc/refactor-analyze.svg)](https://www.npmjs.com/package/@loviusc/refactor-analyze)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> 零幻觉、有据可查的旧系统重构逆向分析 AI 工作台，支持 Gemini、Claude、GPT/Codex 等 AI Agent，协助团队在重构前彻底厘清系统形态、架构、数据库表结构、业务逻辑、数据流、SQL、依赖关系与死代码。

<p align="center">
  <b>🌐 语言导航 (Languages):</b>
  <a href="./README.en.md"><b>English</b></a> |
  <a href="./README.zh-TW.md"><b>繁體中文</b></a> |
  <a href="./README.zh-CN.md"><b>简体中文</b></a> |
  <a href="./README.ja.md"><b>日本語</b></a> |
  <a href="./README.ko.md"><b>한국어</b></a>
</p>

---

## 核心定位与特色

`@loviusc/refactor-analyze` 采用**“分析工作区与目标旧系统分离”**的架构设计，不污染旧系统项目目录，并提供六大核心机制：

1. **禁止 AI 幻想铁律（Zero-Hallucination）**：所有写入文档的业务逻辑、计算公式、数据流与 SQL 必须 100% 标注源代码文件路径与行号或真实数据库字段来源；无明确来源或语义不明的字段与逻辑一律强制列入 `backlog.md`，严禁 AI 自行猜测脑补。
2. **极省 Token 的分段式分析**：第一阶段只产出系统概览与分类编号清单（`project/index.md`），配合 CLI 本地 0-Token 复杂度估算；第二阶段按编号逐一深入分析并抽离 `project/shared/` 公共模块，避免订阅制额度耗尽卡死。
3. **支持跳板机的真实数据库扫描（`scandb`）**：通过 `project/system/db-connection.md`（自动加入 `.gitignore` 防止账号密码泄露）配置数据库产品、路径、账号、密码与 SSH 跳板机，以只读方式抓取所有 Table、字段、注释与 Trigger，并按表拆分为 `project/system/db/<table>.md`。
4. **独立 SQL 解析（`sql.md`）与死代码列管（`dead-code.md`）**：每个编号文件夹自动整理 SQL 查询与动态条件；死代码强制记录 **Git 分支、Git Commit Hash、代码文件名称、行数与相关代码片段**。
5. **分离现状（As-Is）与重构改进建议（To-Be Notes）**：防止重构开发时把旧系统的技术债（如 N+1 查询、缺乏事务保护）照抄到新系统。
6. **自动 Git Commit、Remote Sync 与冲突协助处理**：执行 `commit` 确认后自动更新 `index.md` 状态并同步至远程 Git，遇到合并冲突会主动协助处理后再自动 commit 与 sync。

---

## 安装、更新与卸载（macOS / Linux / Windows）

脚本执行前会**自动检查系统是否已安装 `npm`**（未安装会提示并中止）：

- **macOS / Linux**：
  ```bash
  ./scripts/install.sh     # 安装
  ./scripts/update.sh      # 更新 CLI
  ./scripts/uninstall.sh   # 卸载
  ```
- **Windows (PowerShell / CMD)**：
  ```bat
  scripts\install.bat      :: 安装
  scripts\update.bat       :: 更新 CLI
  scripts\uninstall.bat    :: 卸载
  ```

---

## 指令总览表

| 阶段 | CLI 指令 | AI 对话指令 | 简写 | 说明 |
|---|---|---|---|---|
| **1. 初始化与系统概览** | `refactor-analyze init [--full] [--lang ...]` | `refactor:init [路径]` | `rai` | 建立工作区与 Git、确认语言、询问目标路径与是否向 remote 对齐，产出 `project/system/` 与分类编号清单 `project/index.md`。 |
| **2. 扫描数据库字段** | `refactor-analyze scandb` | `refactor:scandb` | `ras` | 依据 `project/system/db-connection.md`（支持跳板机）实际连入数据库抓取所有字段与 Trigger，产出 `db-schema.md` 与 `db/<table>.md`。 |
| **3. 分析单一编号** | `refactor-analyze analyze <编号>` | `refactor:analyze <编号>` | `raa` | 新建 `project/<编号>/` 文件夹，深入分析业务逻辑、数据流、SQL、依赖、死代码与复杂度，并**自动产出 `backlog.md`**。 |
| **4. 重新分析单一编号** | `refactor-analyze reanalyze <编号>` | `refactor:reanalyze <编号>` | `rar` | 根据 `backlog.md` 补充内容或代码变更**再分析一次**，更新 `project/<编号>/` 所有文档。 |
| **5. 0-Token 验证来源与飘移** | `refactor-analyze verify [编号]` | `refactor:verify [编号]` | `rav` | 本地 0-Token 核对所有 `#Lx-Ly` 源代码文件与行号是否真实存在，并检测目标系统 Git 改版飘移。 |
| **6. 确认提交与远程同步** | `refactor-analyze commit [编号]` | `refactor:commit [编号]` | `rac` | 通过 `verify` 后更新 `project/index.md` 状态、自动 commit 到 Git；若有 remote 自动安全 sync（CLI 遇冲突安全停止不破坏文件，交由 AI `rac` 语义合并）。 |
| **7. 导出 PDF 文档** | `refactor-analyze pdf [目标] [--merge] [--output ...]` *(或 `md2pdf`)* | `refactor:pdf [目标]` | `rap` | **0-Token 本地转换**：将指定的 `.md` 文件、编号文件夹（如 `001`）或整个 `project/` 转换为 `.pdf`（支持 `--merge` 合并为单一 PDF）。 |
| **8. 更新现有分析项目** | `refactor-analyze upgrade [--dry-run]` *(或 `update`)* | `refactor:upgrade` | `rau` | 更新现有分析项目的 `AGENTS.md`、`skills/`、`rules/` 与缺失模板（保留既有语言与分析内容）。 |
| **9. 检查与状态** | `refactor-analyze status` / `check` / `doctor` | - | - | 查看清单进度与检查必要文件。 |

---

## 完整使用步骤

1. **建立工作区**：在独立目录执行 `refactor-analyze init --full --lang zh-CN`。
2. **启动 AI 初始盘点**：在 AI 对话输入 `rai`（或 `rai /path/to/legacy`），锁定语言、确认是否向 Git remote 对齐，产出 `project/system/`（判断系统属于 **APP / 桌面应用程序 / 网页** 并说明涵盖范围）与 `project/index.md`（**同分类放在一起，无法归类的统一放在“其他”**，赋予编号 `001`, `002`...）。
3. **扫描数据库**：填写 `project/system/db-connection.md` 后执行 `refactor-analyze scandb`（或 `ras`），实际抓取所有数据表与字段。
4. **按编号分析业务逻辑**：执行 `refactor-analyze analyze 001` 与 AI 指令 `raa 001`，在 `project/001/` 下产出 `analysis.md`、`business-logic.md`、`data-flow.md`、`sql.md`、`dependencies.md`、`dead-code.md` 与自动生成的 `backlog.md`。
5. **补充 Backlog 并重新分析**：在 `project/001/backlog.md` 补上未知字段或规则说明后，执行 `rar 001` 再分析一次。
6. **确认归档与同步**：执行 `refactor-analyze commit 001`（或 `rac 001`），更新 `project/index.md` 状态并自动完成 Git commit 与 remote sync（含冲突协助处理）。
7. **升级现有工作区**：工具升级后，在工作区执行 `refactor-analyze upgrade`（或 `update`）即可无损更新规则与模板。
