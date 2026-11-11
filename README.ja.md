# レガシーシステム再構築分析 AI ワークスペース (`@loviusc/refactor-analyze`)

[![npm version](https://img.shields.io/npm/v/@loviusc/refactor-analyze.svg)](https://www.npmjs.com/package/@loviusc/refactor-analyze)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Gemini、Claude、GPT/Codex などの AI エージェントに対応した、ハルシネーション（捏造）ゼロ・根拠ベースのレガシーシステム逆분석およびリファクタリング仕様策定ワークスペース CLI。

<p align="center">
  <b>🌐 言語ナビゲーション (Languages):</b>
  <a href="./README.en.md"><b>English</b></a> |
  <a href="./README.zh-TW.md"><b>繁體中文</b></a> |
  <a href="./README.zh-CN.md"><b>简体中文</b></a> |
  <a href="./README.ja.md"><b>日本語</b></a> |
  <a href="./README.ko.md"><b>한국어</b></a>
</p>

---

## 概要と 6 つの核心機能

`@loviusc/refactor-analyze` は**「分析ワークスペースと対象レガシーシステムの分離」**アーキテクチャを採用し、既存プロジェクトを汚染せずに以下の 6 つの仕組みで確実なリファクタリング分析を実現します：

1. **🛡️ AI ハルシネーション禁止の鉄則（根拠なき記述の完全禁止）**：
   - 業務ロジック、計算式、状態遷移、データフロー、SQL はすべてソースコードのファイルパスと行番号（例：`` `OrderService.java#L45-L92` ``）または DB スキーマの根拠を必須とします。
   - 意味不明なカラム名やコメントのないマジックナンバーは勝手に推測せず、自動的に `project/<番号>/backlog.md` に記録し、確認後に `reanalyze` で反映します。
2. **⚡ トークン消費を抑える 2 段階分析**：
   - 第 1 段階（`init` / `rai`）ではシステム概要（**モバイル APP / デスクトップアプリ / Web システム**の判定とカバー範囲の説明）とカテゴリ別番号付き一覧（`project/index.md`）のみを生成します。
   - 第 2 段階（`analyze <番号>` / `raa <番号>`）では番号単位でエントリポイントから追跡し、共通モジュールを `project/shared/` に分離して重複分析を防ぎます。
3. **🗄️ 踏み台サーバ（SSH Jump Host）対応の DB スキーマスキャン（`scandb` / `ras`）**：
   - `project/system/db-connection.md`（`.gitignore` により自動保護）に DB 製品、パス、認証情報、SSH 踏み台設定を記入し、`scandb` を実行すると読み取り専用で全テーブル、カラム、コメント、Trigger を取得し、`project/system/db/<table>.md` に分割保存します。
4. **🧾 SQL 専用整理（`sql.md`）とデッドコード管理（`dead-code.md`）**：
   - `sql.md` に SQL や MyBatis の動的クエリ条件・改善提案を整理し、`dead-code.md` には **Git ブランチ、Git Commit Hash、ファイル名、行数範囲、判定理由、関連コード**を明記します。
5. **🔄 現状（As-Is）と再構築改善提案（To-Be Notes）の分離**：
   - 旧システムの技術的負債（N+1 クエリやトランザクション漏れなど）が新システムにそのままコピーされるのを防ぎます。
6. **🤝 自動 Git Commit・Remote Sync・コンフリクト解決支援（`commit` / `rac`）**：
   - 確認後に `project/index.md` のステータスを更新して Git コミットを作成し、リモートと自動同期（競合発生時はマージを支援した上で再コミット＆同期）します。

---

## インストール・更新・アンインストール（macOS / Linux / Windows）

スクリプト実行前に **`npm` がインストールされているか自動チェック**します：

- **macOS / Linux (`.sh`)**:
  ```bash
  ./scripts/install.sh     # インストール
  ./scripts/update.sh      # 最新版へ更新
  ./scripts/uninstall.sh   # アンインストール
  ```
- **Windows (`.bat`)**:
  ```bat
  scripts\install.bat      :: インストール
  scripts\update.bat       :: 最新版へ更新
  scripts\uninstall.bat    :: アンインストール
  ```

---

## コマンド一覧

| 段階 | CLI コマンド | AI チャットコマンド | 短縮形 | 説明 |
|---|---|---|---|---|
| **1. 初期化と全体概要** | `refactor-analyze init [--full] [--lang ...]` | `refactor:init [パス]` | `rai` | ワークスペースと Git を構築、言語確認、対象システムパスとリモート同期確認、`project/system/` と番号付き一覧 `project/index.md` を生成。 |
| **2. DB カラムスキャン** | `refactor-analyze scandb` | `refactor:scandb` | `ras` | `db-connection.md`（踏み台対応）に基づき DB から全テーブル・カラム・Trigger を取得し、`db-schema.md` と `db/<table>.md` を生成。 |
| **3. 番号別詳細分析** | `refactor-analyze analyze <番号>` | `refactor:analyze <番号>` | `raa` | `project/<番号>/` フォルダを作成し、業務ロジック、**画面操作挙動と入力検証（`ui-behavior.md`）**、データフロー、SQL、依存関係、デッドコード、複雑度を分析し **`backlog.md` を自動生成**。 |
| **4. 番号別再分析** | `refactor-analyze reanalyze <番号>` | `refactor:reanalyze <番号>` | `rar` | `backlog.md` の追記内容やコード更新を元に**再分析**し、`project/<番号>/` 内の全ファイルを更新。 |
| **5. 0-Token 根拠＆ドリフト検証** | `refactor-analyze verify [番号]` | `refactor:verify [番号]` | `rav` | ローカル 0-Token で `#Lx-Ly` のファイルと行番号の実在性を検証し、対象システムの Git コミット変更による行番号ずれを検出。 |
| **6. 確定コミット＆同期** | `refactor-analyze commit [番号]` | `refactor:commit [番号]` | `rac` | `verify` 通過後に `project/index.md` の状態を更新し、Git コミットと安全なリモート同期を実行（競合時はファイルを破壊せず安全に停止）。 |
| **7. PDF エクスポート** | `refactor-analyze pdf [対象] [--merge] [--output ...]` *(または `md2pdf`)* | `refactor:pdf [対象]` | `rap` | **0-Token ローカル変換**：指定の `.md` ファイル、番号フォルダ（例: `001`）、または `project/` 全体を `.pdf` に変換（`--merge` で単一 PDF へ結合可能）。 |
| **8. 既存プロジェクト更新** | `refactor-analyze upgrade [--dry-run]` *(または `update`)* | `refactor:upgrade` | `rau` | 既存の分析ワークスペースの言語設定と分析内容を維持したまま、ルールと不足テンプレートを最新版に更新。 |
| **9. 状態確認** | `refactor-analyze status` / `check` / `doctor` | - | - | 分析進捗や必須ファイルの整合性をチェック。 |

---

## 💡 実践利用例：レガシー受注システムのリバースエンジニアリング (Example Walkthrough)

以下は、10年稼働している Java/Spring/JSP の受注システム（`legacy-shop`）をリバースエンジニアリングする実践例です：

### Step 1. 独立ワークスペースの作成
```bash
mkdir shop-refactor-workspace && cd shop-refactor-workspace
refactor-analyze init --full --lang ja
```

### Step 2. AI によるシステム全体把握 (`rai`)
AI チャット（Gemini / Claude / Cursor / Antigravity）で以下を入力：
```text
rai /Users/dev/projects/legacy-shop
```
AI が旧システムの Git ブランチとコミットを確認し、以下を出力します：
- `project/system/overview.md`：**Web システム** (Spring MVC + MyBatis + JSP + MySQL) と判定。
- `project/index.md`：業務分類別の機能・API 一覧：
  ```markdown
  ## 分類：注文管理 (Order Management)
  | 番号 | 機能または API | エントリーポイント | 複雑度 | 現在の状態 |
  |---|---|---|---|---|
  | `001` | チェックアウトと注文作成 | `src/controller/OrderController.java#createOrder` | 高 | 未分析 |
  | `002` | 注文詳細・状態照会 | `src/controller/OrderController.java#getOrderDetail` | 低 | 未分析 |
  ```

### Step 3. 実データベースとコード辞書の読み取り専用スキャン (`ras`)
`project/system/db-connection.md`（`.gitignore` 保護）に接続情報とコードテーブル（`Code Tables: SYS_CODE`）を設定し、以下を実行：
```bash
refactor-analyze scandb
```
出力結果：
- `project/system/db/orders.md`, `order_items.md`：カラム型、PK/FK、インデックス、コメント。
- `project/system/db/_routines.md`：ストアドプロシージャ `SP_CALC_DISCOUNT` の完全な DDL/SQL ソース。
- `project/system/code-dictionary.md`：`SYS_CODE` の辞書値（`01=ドラフト, 02=支払済, 03=出荷済`）。

### Step 4. 番号 001 の業務ロジック詳細分析 (`raa 001`)
```bash
refactor-analyze analyze 001
# または AI チャットで入力:
raa 001
```
AI が `project/001/` 配下にゼロ幻覚で 8 つのファイルを生成：
1. **`analysis.md`**：引数仕様、暗黙の Session 依存（`Session["CURRENT_DEPT_ID"]`）、As-Is 現状と To-Be 改善提案（ループ内 DB クエリの N+1 技術負債を指摘）。
2. **`business-logic.md`**：ソース行番号付きの業務ルール（`OrderService.java#L85-L112`）、トランザクション境界、受入テストシナリオ（Given/When/Then）。
3. **`ui-behavior.md`**：プルダウンデータ取得元、画面 vs バックエンド検証マトリクス（画面側で最大 99 件チェックしているがサーバー側で未チェックの脆弱性を特定）。
4. **`data-flow.md`**：Request → Service → `orders` テーブル書き込みフロー。
5. **`sql.md`**：`OrderMapper.xml` の SQL と動的 `<if>` タグ解析。
6. **`dependencies.md`**：呼び出しチェーンと共有コンポーネント。
7. **`dead-code.md`**：コメントアウトされた古い計算ロジック。
8. **`backlog.md`**：コード内の不明なマジックナンバー（`FLG_03 = 'K'`）を自動抽出。

### Step 5. 0-Token 根拠検証＆ドリフト検出 (`rav 001`)
```bash
refactor-analyze verify 001
```
ローカルで引用行番号の実在性を 0 Token で検証し、対象コードの Git コミット差分（行ずれ）を検出。

### Step 6. 確定コミット・CRUD集約・リモート同期 (`rac 001`)
```bash
refactor-analyze commit 001
```
- `orders` テーブルの CRUD 操作を `project/system/domain-flows.md` に自動集約。
- `project/index.md` のステータスを `完了` に更新し、Git コミットとリモート同期を実行。

### Step 7. ワンクリック PDF 出力 (`rap 001`)
```bash
refactor-analyze pdf 001 --merge
```
表紙・目次・シンタックスハイライト付きの単一 PDF（`project/001/001-merged.pdf`）をローカルで高速生成！
