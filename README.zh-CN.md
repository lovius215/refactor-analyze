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
| **3. 分析单一编号** | `refactor-analyze analyze <编号>` | `refactor:analyze <编号>` | `raa` | 新建 `project/<编号>/` 文件夹，深入分析业务逻辑、**画面操作行为与验证（`ui-behavior.md`）**、数据流、SQL、依赖、死代码与复杂度，并**自动产出 `backlog.md`**。 |
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

---

## 💡 实战使用范例：从 0 到 1 逆向分析旧电商/ERP 系统 (Example Walkthrough)

以下演示如何使用 `@loviusc/refactor-analyze` 将一套 10 年历史的旧 Java/Spring/JSP 订单系统（`legacy-shop`）逆向分析为标准重构文档：

### Step 1. 建立独立分析工作区
```bash
# 建立并进入分析工作区（与旧系统源码目录隔离，互不污染）
mkdir shop-refactor-workspace && cd shop-refactor-workspace

# 初始化工作区（建立 .gitignore、AGENTS.md、规则集与空白模板）
refactor-analyze init --full --lang zh-CN
```

### Step 2. 启动 AI 进行第一阶段全局盘点 (`rai`)
在 AI Agent（Gemini / Claude / Cursor / Antigravity）的对话框输入：
```text
rai /Users/dev/projects/legacy-shop
```
AI 会自动检查旧系统的 Git 分支与版本，询问是否向 remote 对齐，接着输出：
- `project/system/overview.md`：判定为 **网页系统 (Web)**，技术为 Spring MVC + MyBatis + JSP + MySQL。
- `project/system/architecture.md`：盘点全局机制（如 `AuthFilter` 与事务控制）。
- `project/index.md`：按业务分类产出编号总清单：
  ```markdown
  ## 分类：订单管理 (Order Management)
  | 编号 | 功能或 API | 程式的位置（进入点） | 复杂度 | 目前的状态 |
  |---|---|---|---|---|
  | `001` | 购物车结账与建立订单 | `src/controller/OrderController.java#createOrder` | 高 | 待分析 |
  | `002` | 订单明细与状态查询 | `src/controller/OrderController.java#getOrderDetail` | 低 | 待分析 |
  ```

### Step 3. 只读扫描真实数据库结构与代码表 (`ras`)
在 `project/system/db-connection.md` 填妥只读连接信息与共用代码表（账号密码被 `.gitignore` 保护，不进入 AI 对话框）：
```markdown
- **启用数据库扫描 (Enabled)**: `true`
- **数据库产品 (Database Product)**: `mysql`
- **连接主机或文件路径 (Host / Path)**: `127.0.0.1`
- **端口 (Port)**: `3306`
- **数据库名称 / Schema (Database / Schema)**: `shop_db`
- **账号 (Username)**: `readonly_user`
- **密码 (Password)**: `secret123`
- **共用代码表清单 (Code Tables)**: `SYS_CODE`
```
在终端执行（或对 AI 输入 `ras`）：
```bash
refactor-analyze scandb
```
输出：
- `project/system/db/orders.md`、`order_items.md`：字段类型、主外键 PK/FK、Index 与注释。
- `project/system/db/_routines.md`：导出存储过程 `SP_CALC_DISCOUNT` 的完整 SQL 源码。
- `project/system/code-dictionary.md`：自动导出 `SYS_CODE` 字典（如 `ORDER_STS`: `01=草稿, 02=已付款, 03=已发货`），AI 分析时直接查表，不再脑补状态码。

### Step 4. 深入分析编号 001 业务逻辑 (`raa 001`)
在终端建立骨架并在 AI 对话输入：
```bash
refactor-analyze analyze 001
# 或直接在 AI 对话框输入：
raa 001
```
AI 会针对 `001` 深入调用链，在 `project/001/` 产出 8 份标准文档（**禁止 AI 幻想铁律：每一项规则必附源码文件与行号**）：
1. **`analysis.md`**：记录进入点 Request/Response Args、**隐性 Session 依赖**（如偷读 `Session["CURRENT_DEPT_ID"]`），以及 **As-Is 现状 vs To-Be 重构建议**（指出旧代码在 `for` 循环内查 DB 导致 N+1 性能问题，重构时应改为批量查询）。
2. **`business-logic.md`**：
   - 核心规则清单（附行号）：
     | 规则编号 | 触发条件 | 执行动作 / 结果 | 源码文件与行号来源 |
     |---|---|---|---|
     | `BR-01` | 购物车金额 > 10,000 且会员等级为 VIP | 自动套用 9 折并产生赠品序号 | `src/service/OrderService.java#L85-L112` |
   - 事务边界与锁：记录 `@Transactional` 涵盖表与乐观锁 `VERSION` 字段。
   - 重构验收测试场景：提供 `TC-01 (满万打折成功)`、`TC-02 (库存不足阻拦)` 的 Given/When/Then 验收规格。
3. **`ui-behavior.md`**：
   - 记录下拉菜单 `ddlPayment` 数据查自 `SYS_CODE WHERE CODE_TYPE = 'PAY'`。
   - **前后端验证对照矩阵**：抓出“JSP 前端限制数量最多 99 件，但后端 Controller 漏写检查”的安全漏洞！
4. **`data-flow.md`**：记录数据从 Request → Service → 写入 `orders`、`order_items` 表。
5. **`sql.md`**：完整收录 `OrderMapper.xml#insertOrder` 之 SQL 语句与动态 `<if test="coupon != null">` 条件解析。
6. **`dependencies.md`**：梳理调用链与 `project/shared/` 共用模块。
7. **`dead-code.md`**：标注被注释掉的旧计算逻辑（附 Git commit 与文件行号）。
8. **`backlog.md`**：自动列出代码中语义不明的魔术数字（如 `FLG_03 = 'K'`），标记为待人工厘清。

### Step 5. 0-Token 验证来源与版本漂移 (`rav 001`)
在完成补充后，执行本地 0-Token 验证：
```bash
refactor-analyze verify 001
# 或在 AI 对话输入：rav 001
```
CLI 会在本地自动核对：
- ✅ `src/service/OrderService.java#L85-L112` 等行号范围是否真实存在且行数正确。
- ✅ 比对目标系统 Git Commit Hash，若目标系统有人推了新代码，立即发出“版本漂移警告（Git Drift Detected）”。

### Step 6. 确认归档与自动同步 (`rac 001`)
```bash
refactor-analyze commit 001
# 或在 AI 对话输入：rac 001
```
- CLI 自动解析 `001/data-flow.md`，将 `orders` 表的 `C/U` 操作 **0-Token 自动汇总至 `project/system/domain-flows.md` 的 CRUD 矩阵**！
- 自动将 `project/index.md` 中的 `001` 状态更新为 `已完成`。
- 自动建立本地 Git commit；若有配置 remote 则自动安全同步（若遇到冲突会停止并引导 AI 语义合并）。

### Step 7. 一键导出 PDF 报告 (`rap 001`)
```bash
# 将编号 001 的 8 份文档合并为单一美观 PDF，直接交付利益相关者与主管
refactor-analyze pdf 001 --merge
```
生成的 `project/001/001-merged.pdf` 包含封面、目录、行号来源与语法高亮，0-Token 本地渲染完成！
