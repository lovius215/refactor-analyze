# Legacy Refactoring Analysis AI Workspace (`@loviusc/refactor-analyze`)

[![npm version](https://img.shields.io/npm/v/@loviusc/refactor-analyze.svg)](https://www.npmjs.com/package/@loviusc/refactor-analyze)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> An evidence-based, zero-hallucination legacy system reverse-engineering and refactoring analysis workspace CLI for AI Agents (Gemini, Claude, GPT/Codex).

<p align="center">
  <b>🌐 Languages:</b>
  <a href="./README.en.md"><b>English</b></a> |
  <a href="./README.zh-TW.md"><b>繁體中文</b></a> |
  <a href="./README.zh-CN.md"><b>简体中文</b></a> |
  <a href="./README.ja.md"><b>日本語</b></a> |
  <a href="./README.ko.md"><b>한국어</b></a>
</p>

---

## Overview & Key Principles

`@loviusc/refactor-analyze` operates in a **separated analysis workspace** so it never pollutes the legacy codebase. It is engineered around six core safeguards for real-world legacy modernization:

1. **🛡️ Zero-Hallucination Iron Rule (No Source, No Write)**:
   - Every documented business rule, calculation, state transition, data flow, and SQL query must cite its exact source file path and line range (e.g., `` `OrderService.java#L45-L92` ``) or live DB schema.
   - Any undocumented column, magic number, or ambiguous logic must **never** be guessed by the AI—it is automatically logged into `project/<ID>/backlog.md` for human clarification and subsequent `reanalyze`.
2. **⚡ Token-Efficient Two-Stage Analysis**:
   - **Stage 1 (`init` / `rai`)** produces only the system-level overview (classifying whether the target is a **Mobile APP**, **Desktop Application**, or **Web System** with scope coverage) and a categorized, numbered feature/API inventory (`project/index.md`), using 0-Token local CLI complexity estimation.
   - **Stage 2 (`analyze <ID>` / `raa <ID>`)** traces one numbered entrypoint at a time and deduplicates shared services into `project/shared/` so subscription token quotas are never exhausted.
3. **🗄️ Live Database Schema Introspection with SSH Jump Host (`scandb` / `ras`)**:
   - Fill out `project/system/db-connection.md` (automatically protected by `.gitignore` so credentials never leak to Git) with DB product, host/path, credentials, and optional SSH Bastion/Jump Host settings.
   - Running `scandb` connects in strictly **read-only** mode to extract all Tables, Columns, PK/FKs, Comments, Views, Stored Procedures, and Triggers into `project/system/db-schema.md` and per-table files `project/system/db/<table>.md`.
4. **🧾 Dedicated SQL Extraction (`sql.md`) & Dead Code Tracking (`dead-code.md`)**:
   - `sql.md` isolates raw SQL, MyBatis XML, and ORM queries alongside condition breakdowns and optimization notes.
   - `dead-code.md` strictly records **Git Branch, Git Commit Hash, File Path, Line Numbers, Reason, and Code Snippets** for safe removal.
5. **🔄 Separation of As-Is Implementation vs. To-Be Refactoring Notes**:
   - Prevents AI coding tools from blindly copying legacy technical debt (e.g., N+1 queries, missing transactions) into the rebuilt system.
6. **🤝 Automated Git Commit, Remote Sync & Conflict Resolution (`commit` / `rac`)**:
   - Updates `project/index.md` status upon confirmation, creates a local Git commit, automatically syncs with remote (`pull` + `push`), and actively resolves merge conflicts before re-committing and syncing.

---

## Installation, Update & Uninstallation (macOS / Linux / Windows)

All scripts automatically verify that `npm` and `node` are installed before execution:

- **macOS / Linux (`.sh`)**:
  ```bash
  ./scripts/install.sh     # Check npm & install global CLI
  ./scripts/update.sh      # Check npm & update global CLI to latest
  ./scripts/uninstall.sh   # Check npm & uninstall global CLI
  ```
- **Windows (`.bat` in PowerShell or CMD)**:
  ```bat
  scripts\install.bat      :: Check npm & install global CLI
  scripts\update.bat       :: Check npm & update global CLI to latest
  scripts\uninstall.bat    :: Check npm & uninstall global CLI
  ```

---

## Command Reference (Dual CLI & AI Workflow)

| Step | Terminal CLI Command | AI Chat Command | Alias | Description |
|---|---|---|---|---|
| **1. Initialize & Overview** | `refactor-analyze init [--full] [--lang ...]` | `refactor:init [path]` | `rai` | Initializes workspace, `.gitignore`, and Git; locks language (`zh-TW`/`zh-CN`/`en`/`ja`/`ko`); asks for target system path & Git remote alignment; generates `project/system/` and categorized numbered `project/index.md`. |
| **2. Scan Database Schema** | `refactor-analyze scandb` | `refactor:scandb` | `ras` | Connects to DB via `project/system/db-connection.md` (with SSH Jump Host support) in read-only mode to scan all tables, columns, and triggers into `db-schema.md` & `db/<table>.md`. |
| **3. Analyze by ID** | `refactor-analyze analyze <ID>` | `refactor:analyze <ID>` | `raa` | Creates `project/<ID>/` folder; analyzes business logic, data flow, SQL, dependencies, dead code, complexity, and **auto-generates `backlog.md`**. |
| **4. Reanalyze by ID** | `refactor-analyze reanalyze <ID>` | `refactor:reanalyze <ID>` | `rar` | Reads user clarifications in `project/<ID>/backlog.md` and latest target Git state to **reanalyze** and update all files in `project/<ID>/`. |
| **5. 0-Token Citation & Drift Verify** | `refactor-analyze verify [ID]` | `refactor:verify [ID]` | `rav` | Local 0-Token check verifying that all cited `#Lx-Ly` files and line ranges exist in the target repo and detecting Git commit drift. |
| **6. Commit & Safe Remote Sync** | `refactor-analyze commit [ID]` | `refactor:commit [ID]` | `rac` | Runs `verify` first, updates `project/index.md` status, creates local Git commit, and safely syncs with remote (stopping safely on merge conflicts for semantic resolution). |
| **7. Export Markdown to PDF** | `refactor-analyze pdf [target] [--merge] [--output ...]` *(or `md2pdf`)* | `refactor:pdf [target]` | `rap` | **0-Token Local PDF Export**: Converts a `.md` file, a numbered folder (e.g., `001`), or the entire `project/` into `.pdf` (supports `--merge` into a single PDF). |
| **8. Upgrade Workspace** | `refactor-analyze upgrade [--dry-run]` *(or `update`)* | `refactor:upgrade` | `rau` | Non-destructively updates `AGENTS.md`, `skills/`, `rules/`, and missing templates in an existing workspace while preserving language settings. |
| **9. Status & Diagnostics** | `refactor-analyze status` / `check` / `doctor` | - | - | Displays analysis progress and verifies workspace file integrity. |

---

## End-to-End Usage Workflow

1. **Initialize Workspace**: Run `refactor-analyze init --full --lang en` in a dedicated directory separate from your legacy repository.
2. **Run AI Initialization (`rai`)**: Enter `rai /path/to/legacy-repo` in your AI chat. The agent checks Git branches/commits, asks whether to align with remote (`git fetch`/`pull`), determines whether the project is a **Mobile APP, Desktop Application, or Web System** (`project/system/overview.md`), and generates `project/index.md` where items of the **same category are grouped together** and uncategorized items are placed under **Other**, each assigned a unique ID (`001`, `002`...).
3. **Scan Database (`scandb` / `ras`)**: Fill in `project/system/db-connection.md` and run `refactor-analyze scandb` (or `ras`).
4. **Analyze Feature by ID (`analyze 001` / `raa 001`)**: Creates `project/001/` containing `analysis.md` (with execution timestamp, target Git branch & commit hash, entrypoint Request/Response/Args, complexity, and To-Be refactoring notes), `business-logic.md`, `data-flow.md`, `sql.md`, `dependencies.md`, `dead-code.md` (with Git branch, commit hash, file name, line range, and code snippet), and `backlog.md`.
5. **Clarify Backlog & Reanalyze (`reanalyze 001` / `rar 001`)**: Fill in answers for uncertain logic or column definitions in `project/001/backlog.md`, then run `rar 001` to reanalyze and update all documents.
6. **Commit & Sync (`commit 001` / `rac 001`)**: Updates `project/index.md` status, commits to local Git, and syncs with remote (automatically assisting with any merge conflicts).
7. **Update Existing Projects (`upgrade` / `update`)**: Run `refactor-analyze upgrade` anytime to update rules and templates in existing workspaces.
