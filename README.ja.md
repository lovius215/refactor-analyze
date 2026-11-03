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
| **3. 番号別詳細分析** | `refactor-analyze analyze <番号>` | `refactor:analyze <番号>` | `raa` | `project/<番号>/` フォルダを作成し、業務ロジック、データフロー、SQL、依存関係、デッドコード、複雑度を分析し **`backlog.md` を自動生成**。 |
| **4. 番号別再分析** | `refactor-analyze reanalyze <番号>` | `refactor:reanalyze <番号>` | `rar` | `backlog.md` の追記内容やコード更新を元に**再分析**し、`project/<番号>/` 内の全ファイルを更新。 |
| **5. 確定コミット＆同期** | `refactor-analyze commit [番号]` | `refactor:commit [番号]` | `rac` | 確認後に `project/index.md` の状態を更新し、Git コミットとリモート同期（競合解決支援を含む）を自動実行。 |
| **6. PDF エクスポート** | `refactor-analyze pdf [対象] [--merge] [--output ...]` *(または `md2pdf`)* | `refactor:pdf [対象]` | `rap` | 指定の `.md` ファイル、番号フォルダ（例: `001`）、または `project/` 全体を `.pdf` に変換（`--merge` で単一 PDF へ結合可能）。 |
| **7. 既存プロジェクト更新** | `refactor-analyze upgrade [--dry-run]` *(または `update`)* | `refactor:upgrade` | `rau` | 既存の分析ワークスペースの言語設定と分析内容を維持したまま、ルールと不足テンプレートを最新版に更新。 |
| **8. 状態確認** | `refactor-analyze status` / `check` / `doctor` | - | - | 分析進捗や必須ファイルの整合性をチェック。 |
