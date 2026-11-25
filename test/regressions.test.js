const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  aggregateDomainFlowsAndDeadCode,
  aggregateDomainDictionary,
  parseIndexItems,
  updateIndexRowStatus,
  getPositionalArgs
} = require("../src/lib/utils");
const { parseDbConnectionConfig } = require("../src/lib/db-scanner");
const { verifySingleItem } = require("../src/lib/verifier");
const { markdownToHtmlBody } = require("../src/lib/pdf-exporter");

const binPath = path.resolve(__dirname, "..", "bin", "refactor-analyze.js");

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runCli(cwd, args, envExtra = {}) {
  return spawnSync("node", [binPath, ...args], {
    cwd,
    encoding: "utf8",
    env: Object.assign({}, process.env, envExtra)
  });
}

test("regression: CLI positional args do not misread --lang or --target values", () => {
  assert.deepEqual(getPositionalArgs(["--lang", "en"], ["--lang", "--target"]), []);
  assert.deepEqual(getPositionalArgs(["--target", "./legacy", "001"], ["--target", "--id"]), ["001"]);

  const workDir = makeTempDir("ra-cliargs-");
  try {
    fs.mkdirSync(path.join(workDir, "en"));
    const initRes = runCli(workDir, ["init", "--lang", "en"]);
    assert.equal(initRes.status, 0);
    const overview = fs.readFileSync(path.join(workDir, "project", "system", "overview.md"), "utf8");
    assert.doesNotMatch(overview, /已連結目標系統路徑/);
    assert.match(overview, /English \(en\)/);

    const anRes = runCli(workDir, ["analyze", "--target", "./en", "001"]);
    assert.equal(anRes.status, 0);
    assert.ok(fs.existsSync(path.join(workDir, "project", "001", "analysis.md")));
    assert.equal(fs.existsSync(path.join(workDir, "project", "en")), false);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: data-flow CRUD aggregation only parses Section 2 and dead-code aggregation preserves Git metadata", () => {
  const workDir = makeTempDir("ra-agg-");
  try {
    runCli(workDir, ["init"]);
    runCli(workDir, ["analyze", "001"]);
    const itemDir = path.join(workDir, "project", "001");

    fs.writeFileSync(
      path.join(itemDir, "data-flow.md"),
      `# 資料流
## 2. 資料庫資料表與欄位讀寫映射 (DB Tables & Columns Read/Write)
| 資料表名稱 | 操作 | 欄位 | 說明 | 位置 |
|---|---|---|---|---|
| \`orders\` | C/R | id | 主鍵 | \`Order.java#L10\` |

## 3. 物件與欄位轉換映射
| 輸入參數 / 來源欄位 | 內部處理 / 轉換邏輯 | 目標欄位 | 來源 |
|---|---|---|---|
| \`userName\` | String trim() | name | \`Order.java#L12\` |
| \`amount\` | BigDecimal round | amt | \`Order.java#L15\` |
`,
      "utf8"
    );

    // Remove placeholder `system` row from system/dead-code.md to test resilience
    const sysDeadPath = path.join(workDir, "project", "system", "dead-code.md");
    fs.writeFileSync(
      sysDeadPath,
      `# 全系統死程式碼總表
## 1. 死程式碼總表
| 來源編號 | Git 分支 | Git Commit Hash | 程式檔案名稱 | 行數範圍 | 判定原因 |
|---|---|---|---|---|---|
`,
      "utf8"
    );
    // Use official 6-column dead-code.md template format WITH the instructional blockquote containing "無死程式碼"
    fs.writeFileSync(
      path.join(itemDir, "dead-code.md"),
      `# 死程式碼記錄：編號 001
- **目標系統 Git 分支 (Branch)**：\`release/v2\`
- **目標系統 Git Commit Hash**：\`deadbeef1234\`

> **強制規範**：若本功能無死程式碼，請明確標示「本編號未發現死程式碼」。

## 1. 死程式碼清單
| 序號 | Git 分支 | Git Commit Hash | 程式檔案名稱 | 行數範圍 | 判定原因 |
|---|---|---|---|---|---|
| \`DC-01\` | \`release/v2\` | \`deadbeef1234\` | \`src/OldHelper.java\` | \`L10-L40\` | 無人呼叫 |
`,
      "utf8"
    );

    aggregateDomainFlowsAndDeadCode(workDir, "001");

    const flows = fs.readFileSync(path.join(workDir, "project", "system", "domain-flows.md"), "utf8");
    assert.match(flows, /`orders`/);
    assert.doesNotMatch(flows, /`userName`/);
    assert.doesNotMatch(flows, /`amount`/);

    const sysDead = fs.readFileSync(sysDeadPath, "utf8");
    assert.match(sysDead, /`release\/v2`/);
    assert.match(sysDead, /`deadbeef1234`/);
    assert.match(sysDead, /`src\/OldHelper\.java`/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: domain-dictionary promotes colliding BL-01/BL-02 across multiple items without dropping", () => {
  const workDir = makeTempDir("ra-dictdup-");
  try {
    runCli(workDir, ["init"]);
    runCli(workDir, ["analyze", "001"]);
    runCli(workDir, ["analyze", "002"]);

    const hdr = "| 憑證 ID | 類型 | 位置 | 問題 | 結論 | 來源 | 佐證 | 拍板人 | 範圍 | 狀態 |";
    fs.writeFileSync(
      path.join(workDir, "project", "001", "backlog.md"),
      `${hdr}\n|---|---|---|---|---|---|---|---|---|---|\n` +
        `| \`BL-01\` | 狀態碼 | T1.A | Q1 | 結論001-1 | Human | M1 | Alice | 全系統通用 | 已釐清 |\n` +
        `| \`BL-02\` | 狀態碼 | T1.B | Q2 | 結論001-2 | Human | M2 | Alice | 全系統通用 | 已釐清 |\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(workDir, "project", "002", "backlog.md"),
      `${hdr}\n|---|---|---|---|---|---|---|---|---|---|\n` +
        `| \`BL-01\` | 狀態碼 | T2.A | Q3 | 結論002-1 | Human | M3 | Bob | 全系統通用 | 已釐清 |\n` +
        `| \`BL-02\` | 狀態碼 | T2.B | Q4 | 結論002-2 | Human | M4 | Bob | 全系統通用 | 已釐清 |\n`,
      "utf8"
    );

    aggregateDomainDictionary(workDir, "001");
    aggregateDomainDictionary(workDir, "002");

    const dict = fs.readFileSync(path.join(workDir, "project", "system", "domain-dictionary.md"), "utf8");
    assert.match(dict, /結論001-1/);
    assert.match(dict, /結論001-2/);
    assert.match(dict, /結論002-1/);
    assert.match(dict, /結論002-2/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: reanalyze updates combined Git branch/commit header in backlog.md and data-flow.md", () => {
  const targetDir = makeTempDir("ra-retarget-");
  const workDir = makeTempDir("ra-rework-");
  try {
    spawnSync("git", ["init"], { cwd: targetDir });
    spawnSync("git", ["config", "user.email", "t@t.com"], { cwd: targetDir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: targetDir });
    fs.writeFileSync(path.join(targetDir, "a.js"), "console.log(1);\n", "utf8");
    spawnSync("git", ["add", "."], { cwd: targetDir });
    spawnSync("git", ["commit", "-m", "c1"], { cwd: targetDir });

    runCli(workDir, ["init", "--target", targetDir]);
    runCli(workDir, ["analyze", "001"]);

    // Advance target commit
    fs.writeFileSync(path.join(targetDir, "a.js"), "console.log(2);\n", "utf8");
    spawnSync("git", ["add", "."], { cwd: targetDir });
    spawnSync("git", ["commit", "-m", "c2"], { cwd: targetDir });
    const newHash = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: targetDir, encoding: "utf8" }).stdout.trim();

    const reRes = runCli(workDir, ["reanalyze", "001"]);
    assert.equal(reRes.status, 0);

    const backlog = fs.readFileSync(path.join(workDir, "project", "001", "backlog.md"), "utf8");
    const dataFlow = fs.readFileSync(path.join(workDir, "project", "001", "data-flow.md"), "utf8");
    assert.ok(backlog.includes(newHash), `backlog.md should update to ${newHash}`);
    assert.ok(dataFlow.includes(newHash), `data-flow.md should update to ${newHash}`);
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: pdf-exporter preserves * inside inline code and unescapes \\| in tables", () => {
  const html = markdownToHtmlBody(
    "SQL: `SELECT * FROM orders /* comment */` and **bold**\n\n| Col1 | Col2 |\n|---|---|\n| a \\| b | `c * d * e` |\n"
  );
  assert.match(html, /<code>SELECT \* FROM orders \/\* comment \*\/<\/code>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<td>a \| b<\/td>/);
  assert.match(html, /<code>c \* d \* e<\/code>/);
});

test("regression: verifier ignores fenced code blocks and blocks path traversal", () => {
  const parentDir = makeTempDir("ra-verparent-");
  const targetDir = path.join(parentDir, "repo");
  const workDir = path.join(parentDir, "work");
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(path.join(parentDir, "secret.txt"), "line1\nline2\n", "utf8");
  fs.writeFileSync(path.join(targetDir, "ok.js"), "const x = 1;\n", "utf8");

  try {
    runCli(workDir, ["init", "--target", targetDir]);
    runCli(workDir, ["analyze", "001"]);
    const itemDir = path.join(workDir, "project", "001");
    for (const f of ["analysis.md", "ui-behavior.md", "data-flow.md", "sql.md", "dependencies.md", "dead-code.md"]) {
      fs.writeFileSync(path.join(itemDir, f), `# ${f}\nOK\n`, "utf8");
    }

    // Fenced code block fake citation should be ignored; valid ok.js#L1 should pass
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# 業務邏輯\n- 有效：`ok.js#L1`\n```md\n範例：`nonexistent/Fake.java#L1-L999`\n```\n",
      "utf8"
    );
    const passRes = verifySingleItem(workDir, "001", targetDir);
    assert.equal(passRes.valid, true, `Expected valid, got: ${passRes.errors.join("; ")}`);

    // Path traversal outside targetDir must fail
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# 業務邏輯\n- 越界：`../secret.txt#L1-L2`\n",
      "utf8"
    );
    const travRes = verifySingleItem(workDir, "001", targetDir);
    assert.equal(travRes.valid, false, "Path traversal outside targetDir must be rejected");
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("regression: parseDbConnectionConfig does not leak SSH fields into DB port/username/password", () => {
  const workDir = makeTempDir("ra-sshleak-");
  try {
    fs.mkdirSync(path.join(workDir, "project", "system"), { recursive: true });
    fs.writeFileSync(
      path.join(workDir, "project", "system", "db-connection.md"),
      `- **啟用資料庫掃描 (Enabled)**: \`true\`
- **資料庫產品 (Database Product)**: \`sqlite\`
- **連線主機或檔案路徑 (Host / Path)**: \`./app.db\`
- **啟用跳板機 (SSH Enabled)**: \`true\`
- **跳板機主機 (SSH Host)**: \`jump.local\`
- **跳板機連接埠 (SSH Port)**: \`2222\`
- **跳板機帳號 (SSH Username)**: \`jumpuser\`
- **跳板機密碼 (SSH Password)**: \`jumppass\`
`,
      "utf8"
    );

    const cfg = parseDbConnectionConfig(workDir);
    assert.equal(cfg.port, "");
    assert.equal(cfg.username, "");
    assert.equal(cfg.password, "");
    assert.equal(cfg.sshPort, "2222");
    assert.equal(cfg.sshUser, "jumpuser");
    assert.equal(cfg.sshPassword, "jumppass");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: domain-dictionary Section 2 insertion does not shift index or corrupt Section 1", () => {
  const workDir = makeTempDir("ra-dictsec2-");
  try {
    runCli(workDir, ["init"]);
    runCli(workDir, ["analyze", "001"]);

    const hdr = "| 憑證 ID | 類型 | 位置 | 問題 | 結論 | 來源 | 佐證 | 拍板人 | 範圍 | 狀態 |";
    fs.writeFileSync(
      path.join(workDir, "project", "001", "backlog.md"),
      `${hdr}\n|---|---|---|---|---|---|---|---|---|---|\n` +
        `| \`BL-01\` | 商業規則/公式 | PriceCalc.java | VIP折扣公式 | 滿千折百 | Official-Doc | 產品手冊 | PM王 | 全系統通用 | 已釐清 |\n`,
      "utf8"
    );

    aggregateDomainDictionary(workDir, "001");
    const dict = fs.readFileSync(path.join(workDir, "project", "system", "domain-dictionary.md"), "utf8");
    // Section 1 placeholder must remain intact!
    const sec1 = dict.slice(dict.indexOf("## 1."), dict.indexOf("## 2."));
    const sec2 = dict.slice(dict.indexOf("## 2."));
    assert.match(sec1, /\*\(待由各編號 commit 自動匯總\)\*/);
    assert.doesNotMatch(sec1, /BL-01/);
    assert.match(sec2, /\| `VIP折扣公式` \(`BL-01`\) \| 滿千折百 \| Official-Doc \| 產品手冊 \| PM王 \| `001` \|/);
    assert.doesNotMatch(sec2, /\*\(待由各編號 commit 自動匯總\)\*/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: verifier catches colon/semicolon variants of *(待 AI 填寫...)* placeholders", () => {
  const workDir = makeTempDir("ra-verph-");
  try {
    runCli(workDir, ["init"]);
    runCli(workDir, ["analyze", "001"]);
    const itemDir = path.join(workDir, "project", "001");
    for (const f of ["analysis.md", "ui-behavior.md", "data-flow.md", "sql.md", "dependencies.md", "dead-code.md"]) {
      fs.writeFileSync(path.join(itemDir, f), `# ${f}\nOK\n`, "utf8");
    }
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# 業務邏輯\n- 規則：`[Human: PM]#BL-01`\n- 交易範圍：*(待 AI 分析填寫：如有 @Transactional)*\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(itemDir, "backlog.md"),
      `| 憑證 ID | 類型 | 位置 | 問題 | 結論 | 來源 | 佐證 | 拍板人 | 範圍 | 狀態 |\n|---|---|---|---|---|---|---|---|---|---|\n| \`BL-01\` | 規則 | A | Q | 確認 | Human | M | PM | 單一編號 | 已釐清 |\n`,
      "utf8"
    );
    const res = verifySingleItem(workDir, "001");
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes("模板佔位符")));
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: SSH tunnel fills default DB port 3306 when Port is omitted in db-connection.md", () => {
  const workDir = makeTempDir("ra-sshport-");
  const mockBin = makeTempDir("ra-sshportbin-");
  try {
    runCli(workDir, ["init"]);
    fs.writeFileSync(
      path.join(workDir, "project", "system", "db-connection.md"),
      `- **啟用資料庫掃描 (Enabled)**: \`true\`
- **資料庫產品 (Database Product)**: \`mysql\`
- **連線主機或檔案路徑 (Host / Path)**: \`db.internal\`
- **資料庫名稱 (Database / Schema)**: \`shop\`
- **帳號 (Username)**: \`ro\`
- **密碼 (Password)**: \`pw\`
- **啟用跳板機 (SSH Enabled)**: \`true\`
- **跳板機主機 (SSH Host)**: \`jump.internal\`
- **跳板機帳號 (SSH Username)**: \`ops\`
`,
      "utf8"
    );
    const sshLog = path.join(workDir, "ssh.json");
    fs.writeFileSync(
      path.join(mockBin, "ssh"),
      `#!/usr/bin/env node\nconst fs = require("fs");\nconst a = process.argv.slice(2);\nif (a.includes("-O")) process.exit(0);\nfs.writeFileSync(${JSON.stringify(sshLog)}, JSON.stringify(a));\nprocess.exit(0);\n`,
      { mode: 0o755 }
    );
    fs.writeFileSync(
      path.join(mockBin, "mysql"),
      `#!/usr/bin/env node\nconsole.log("");\n`,
      { mode: 0o755 }
    );

    const res = runCli(workDir, ["scandb"], { PATH: `${mockBin}${path.delimiter}${process.env.PATH}` });
    assert.equal(res.status, 0, `scandb failed: ${res.stderr}`);
    const sshArgs = JSON.parse(fs.readFileSync(sshLog, "utf8"));
    assert.ok(sshArgs.includes("127.0.0.1:13306:db.internal:3306"), `Expected default port 3306 in -L, got: ${sshArgs.join(" ")}`);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(mockBin, { recursive: true, force: true });
  }
});

test("regression: pdf-exporter flushes unclosed code block and sanitizes javascript: links", () => {
  const html = markdownToHtmlBody("Link: [bad](javascript:alert(1)) and [ok](https://example.com)\n\n```sql\nSELECT 1;");
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /<a href="https:\/\/example\.com">ok<\/a>/);
  assert.match(html, /<pre><code class="lang-sql">SELECT 1;<\/code><\/pre>/);
});

test("regression: backlog.md Section 2 Reality Check does not overwrite Section 1 voucher or corrupt verify/commit", () => {
  const workDir = makeTempDir("ra-blsec2-");
  try {
    runCli(workDir, ["init"]);
    spawnSync("git", ["config", "user.email", "t@t.com"], { cwd: workDir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: workDir });
    runCli(workDir, ["analyze", "001"]);
    const itemDir = path.join(workDir, "project", "001");

    for (const f of ["ui-behavior.md", "data-flow.md", "sql.md", "dependencies.md", "dead-code.md"]) {
      fs.writeFileSync(path.join(itemDir, f), `# ${f}\nOK\n`, "utf8");
    }
    // analysis.md has two complexity lines: header still 待評估, Section 3 updated to 高
    fs.writeFileSync(
      path.join(itemDir, "analysis.md"),
      "# 分析\n- **複雜度等級**：`待評估`\n- **目前的狀態**：`分析中`\n## 3. 複雜度\n- **複雜度等級**：`高`\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# 業務邏輯\n- 規則：`[Human: 王經理]#BL-01`\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(itemDir, "backlog.md"),
      `# Backlog
## 1. 業務邏輯與欄位憑證清單 (Knowledge Vouchers)
| 憑證 ID | 類型 | 位置 | 待確認問題 | 結論 | 來源 | 佐證 | 拍板人 | 範圍 | 狀態 |
|---|---|---|---|---|---|---|---|---|---|
| \`BL-01\` | 狀態碼 | ORDERS.STS | 9代表什麼 | 逾時取消 | Human | 會議 | 王經理 | 全系統通用 | 已釐清 |

## 2. 真實資料真偽驗證探針 (Reality Check — 選填)
| 憑證 ID | 驗證項目 | 驗證 SQL | 實際結果 | 因應方案 | 驗證人 |
|---|---|---|---|---|---|
| \`BL-01\` | 檢查歷史髒資料 | SELECT DISTINCT STS FROM ORDERS | 僅 0/1/9 | 無需清洗 | DBA老王(待確認名單) |
`,
      "utf8"
    );

    const verRes = verifySingleItem(workDir, "001");
    assert.equal(verRes.valid, true, `Section 2 must not overwrite Section 1 voucher: ${verRes.errors.join("; ")}`);

    // Force-stage db-connection.md on unborn branch -> commit must still exclude it!
    spawnSync("git", ["add", "-f", "project/system/db-connection.md"], { cwd: workDir });
    const commitRes = runCli(workDir, ["commit", "001"]);
    assert.equal(commitRes.status, 0, `commit failed: ${commitRes.stderr}`);
    assert.match(commitRes.stdout, /狀態為: 已完成/);

    const committedFiles = spawnSync("git", ["show", "--name-only", "--pretty=format:", "HEAD"], {
      cwd: workDir,
      encoding: "utf8"
    }).stdout;
    assert.doesNotMatch(committedFiles, /db-connection\.md/, "db-connection.md must NEVER be committed even on unborn branch");

    // Verify complexity picked non-placeholder 高 from Section 3
    fs.writeFileSync(
      path.join(workDir, "project", "system", "domain-flows.md"),
      `# Flows
## 2. 資料表與功能編號 CRUD 對照矩陣 (Table CRUD Matrix)
| 資料表名稱 (\`project/system/db/\`) | \`C\` (新增編號) | \`R\` (查詢編號) | \`U\` (更新編號) | \`D\` (刪除編號) |
|---|---|---|---|---|
| 待補充 | - | - | - | - |

## 3. 自訂外部事件表 (User Custom Section)
| 事件 | 備註 |
|---|---|
| \`OrderPaid\` | 必須保留 |
`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(itemDir, "data-flow.md"),
      `## 2. 資料庫資料表與欄位讀寫映射\n| 資料表名稱 | 操作 | 欄位 |\n|---|---|---|\n| \`orders\` | C | id |\n`,
      "utf8"
    );
    aggregateDomainFlowsAndDeadCode(workDir, "001");
    const flows = fs.readFileSync(path.join(workDir, "project", "system", "domain-flows.md"), "utf8");
    assert.match(flows, /`orders`/);
    assert.match(flows, /## 3\. 自訂外部事件表/);
    assert.match(flows, /`OrderPaid`/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: index.md features containing '編號', '---', or escaped pipes \\| are not dropped as header rows", () => {
  const workDir = makeTempDir("ra-idxhdr-");
  try {
    runCli(workDir, ["init"]);
    const indexPath = path.join(workDir, "project", "index.md");
    fs.writeFileSync(
      indexPath,
      `# Index\n## 分類：訂單模組\n| 編號 | 功能或 API | 程式的位置（進入點） | 複雜度 | 目前的狀態 |\n|---|---|---|---|---|\n| \`001\` | 訂單編號產生規則 \\| 發票編號查詢 | \`src/order---v2/OrderNum.java\` | 待評估 | 待分析 |\n`,
      "utf8"
    );

    const items = parseIndexItems(workDir);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "001");
    assert.equal(items[0].name, "訂單編號產生規則 | 發票編號查詢");
    assert.equal(items[0].location, "src/order---v2/OrderNum.java");

    const updated = updateIndexRowStatus(workDir, "001", "高", "已完成");
    assert.equal(updated, true);
    const afterText = fs.readFileSync(indexPath, "utf8");
    assert.match(afterText, /訂單編號產生規則 \\\| 發票編號查詢/);
    const afterItems = parseIndexItems(workDir);
    assert.equal(afterItems[0].complexity, "高");
    assert.equal(afterItems[0].status, "已完成");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: verifier supports real OrderService.java, extensionless Dockerfile, and verifies against recorded commit when HEAD shrinks", () => {
  const targetDir = makeTempDir("ra-ordtarget-");
  const workDir = makeTempDir("ra-ordwork-");
  try {
    spawnSync("git", ["init"], { cwd: targetDir });
    spawnSync("git", ["config", "user.email", "t@t.com"], { cwd: targetDir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: targetDir });

    fs.mkdirSync(path.join(targetDir, "src", "service"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "src", "service", "OrderService.java"),
      Array.from({ length: 12 }, (_, i) => `// line ${i + 1}`).join("\n") + "\n",
      "utf8"
    );
    fs.writeFileSync(path.join(targetDir, "Dockerfile"), "FROM node:20\nWORKDIR /app\nCMD [\"node\",\"index.js\"]\n", "utf8");
    spawnSync("git", ["add", "."], { cwd: targetDir });
    spawnSync("git", ["commit", "-m", "c1"], { cwd: targetDir });

    runCli(workDir, ["init", "--target", targetDir]);
    runCli(workDir, ["analyze", "001"]);
    const itemDir = path.join(workDir, "project", "001");
    for (const f of ["ui-behavior.md", "data-flow.md", "sql.md", "dependencies.md", "dead-code.md", "backlog.md"]) {
      fs.writeFileSync(path.join(itemDir, f), `# ${f}\nOK\n`, "utf8");
    }
    const analysisOrig = fs.readFileSync(path.join(itemDir, "analysis.md"), "utf8");
    fs.writeFileSync(path.join(itemDir, "analysis.md"), analysisOrig.replace(/\*\(待 AI (?:分析)?填寫[^)]*\)\*/g, "OK"), "utf8");
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# 業務邏輯\n- 核心下單：`src/service/OrderService.java#L5-L10`\n- 容器啟動：`Dockerfile#L1-L3`\n",
      "utf8"
    );

    // Now shrink OrderService.java in a newer commit c2 so worktree only has 2 lines
    fs.writeFileSync(path.join(targetDir, "src", "service", "OrderService.java"), "// shortened\n", "utf8");
    spawnSync("git", ["add", "."], { cwd: targetDir });
    spawnSync("git", ["commit", "-m", "c2 shrink"], { cwd: targetDir });

    const verRes = verifySingleItem(workDir, "001", targetDir);
    assert.equal(verRes.valid, true, `Expected valid against recorded commit, got: ${verRes.errors.join("; ")}`);
    assert.equal(verRes.citationCount, 2);
    assert.ok(verRes.warnings.some((w) => w.includes("版本飄移警告")));
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: multilingual (en) & escaped pipe \\| support in backlog vouchers, commit, and domain-dictionary", () => {
  const workDir = makeTempDir("ra-i18npipe-");
  try {
    runCli(workDir, ["init", "--lang", "en"]);
    spawnSync("git", ["config", "user.email", "t@t.com"], { cwd: workDir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: workDir });
    runCli(workDir, ["analyze", "001"]);
    const itemDir = path.join(workDir, "project", "001");

    for (const f of ["ui-behavior.md", "data-flow.md", "sql.md", "dependencies.md", "dead-code.md"]) {
      fs.writeFileSync(path.join(itemDir, f), `# ${f}\nNo dead code\n`, "utf8");
    }
    fs.writeFileSync(
      path.join(itemDir, "analysis.md"),
      "# Analysis: 001\n- **Analysis Date & Time**: `2026-01-01 00:00`\n- **Complexity Level**: `Pending`\n- **Current Status**: `Analyzing`\n## 3. Complexity\n- **Complexity Level**: `High`\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# Business Logic\n- Status rule: `[Human: Ops Lead]#BL-01`\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(itemDir, "backlog.md"),
      `# Backlog\n| Voucher ID | Rule | Loc | Question | Conclusion | Source | Evidence | Signoff | Scope | Status |\n|---|---|---|---|---|---|---|---|---|---|\n| \`BL-01\` | Rule | ORD.STS | Meaning of 1 \\| 2? | Active \\| Paid | Human | Note | Alice | Global | Resolved |\n`,
      "utf8"
    );

    const verRes = verifySingleItem(workDir, "001");
    assert.equal(verRes.valid, true, `Multilingual + escaped pipe voucher should pass: ${verRes.errors.join("; ")}`);

    const commitRes = runCli(workDir, ["commit", "001"]);
    assert.equal(commitRes.status, 0, `commit failed: ${commitRes.stderr}`);

    const updatedAnalysis = fs.readFileSync(path.join(itemDir, "analysis.md"), "utf8");
    assert.doesNotMatch(updatedAnalysis, /`Pending`/);
    assert.match(updatedAnalysis, /- \*\*Current Status\*\*: `已完成`/);

    const dict = fs.readFileSync(path.join(workDir, "project", "system", "domain-dictionary.md"), "utf8");
    assert.match(dict, /Active \\\| Paid/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: pdf blocks direct db-connection.md export, and SQLite scandb ignores sshEnabled and matches codeTables case-insensitively", () => {
  const workDir = makeTempDir("ra-sec-");
  try {
    runCli(workDir, ["init"]);
    const pdfRes = runCli(workDir, ["pdf", "project/system/db-connection.md"]);
    assert.notEqual(pdfRes.status, 0, "Direct pdf export of db-connection.md must be blocked");
    assert.match(pdfRes.stderr, /禁止將包含資料庫連線憑證的 db-connection\.md 匯出為 PDF/);

    const whichSqlite = spawnSync("which", ["sqlite3"], { encoding: "utf8" });
    if (whichSqlite.status === 0) {
      const dbPath = path.join(workDir, "local.sqlite");
      spawnSync("sqlite3", [dbPath, "CREATE TABLE sys_code (k TEXT, v TEXT); INSERT INTO sys_code VALUES ('A', '1');"]);
      fs.writeFileSync(
        path.join(workDir, "project", "system", "db-connection.md"),
        `- **啟用資料庫掃描 (Enabled)**: \`true\`\n- **資料庫產品 (Database Product)**: \`sqlite\`\n- **連線主機或檔案路徑 (Host / Path)**: \`./local.sqlite\`\n- **共用代碼表清單 (Code Tables)**: \`SYS_CODE\`\n- **啟用跳板機 (SSH Enabled)**: \`true\`\n`,
        "utf8"
      );
      const scanRes = runCli(workDir, ["scandb"]);
      assert.equal(scanRes.status, 0, `SQLite scandb should ignore sshEnabled: ${scanRes.stderr}`);
      const codeDict = fs.readFileSync(path.join(workDir, "project", "system", "code-dictionary.md"), "utf8");
      assert.match(codeDict, /SYS_CODE/);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("regression: scan-entries skips comments/tests, deduplicates JSP, protects existing index.md without --force, and status supports multilingual labels", () => {
  const targetDir = makeTempDir("ra-scantarget-");
  const workDir = makeTempDir("ra-scanwork-");
  try {
    fs.mkdirSync(path.join(targetDir, "src", "api"), { recursive: true });
    fs.mkdirSync(path.join(targetDir, "tests"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "src", "api", "OrderController.java"),
      `@RestController\r\n// @GetMapping("/commented-out")\r\n@RequestMapping("/orders")\r\npublic class OrderController {\r\n  @PostMapping("/create")\r\n  public void create() {}\r\n}\r\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(targetDir, "src", "api", "routes.js"),
      `app.get("/health", (req, res) => res.send("ok"));\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(targetDir, "src", "api", "routes.test.js"),
      `app.get("/mock-only", () => {});\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(targetDir, "tests", "fake.js"),
      `app.post("/fake-test", () => {});\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(targetDir, "src", "api", "legacy.jsp"),
      `<servlet-mapping>dummy</servlet-mapping>\n`,
      "utf8"
    );

    runCli(workDir, ["init", "--target", targetDir]);
    const scanRes = runCli(workDir, ["scan-entries", "--write-index"]);
    assert.equal(scanRes.status, 0, `scan-entries failed: ${scanRes.stderr}`);
    // 3 in OrderController (comment skipped) + 1 in routes.js + 1 deduplicated in legacy.jsp = 5
    assert.match(scanRes.stdout, /候選進入點: 偵測到 5 處特徵/);

    const candidatesMd = fs.readFileSync(path.join(workDir, "project", "system", "entry-candidates.md"), "utf8");
    assert.doesNotMatch(candidatesMd, /commented-out/);
    assert.doesNotMatch(candidatesMd, /routes\.test\.js/);
    assert.doesNotMatch(candidatesMd, /fake\.js/);
    assert.equal((candidatesMd.match(/legacy\.jsp#L1/g) || []).length, 1);

    const items = parseIndexItems(workDir);
    assert.equal(items.length, 5);

    // Second --write-index without --force must refuse to overwrite existing index.md!
    fs.writeFileSync(
      path.join(workDir, "project", "index.md"),
      `# Index\n| ID | API | Loc | Complexity | Status |\n|---|---|---|---|---|\n| \`001\` | Custom Keep | \`a.js\` | High | Completed |\n| \`002\` | Pending API | \`b.js\` | Low | Pending |\n`,
      "utf8"
    );
    const blockedRes = runCli(workDir, ["scan-entries", "--write-index"]);
    assert.notEqual(blockedRes.status, 0, "Should block overwriting non-empty index.md without --force");
    assert.match(blockedRes.stderr, /安全保護/);
    assert.match(fs.readFileSync(path.join(workDir, "project", "index.md"), "utf8"), /Custom Keep/);

    // Verify multilingual status parsing on English overview.md and index.md
    fs.writeFileSync(
      path.join(workDir, "project", "system", "overview.md"),
      `# Overview\n- **Target System Path**: \`${targetDir}\`\n- **System Type**: \`Web\`\n- **Target System Git Branch**: \`main\`\n`,
      "utf8"
    );
    const statusRes = runCli(workDir, ["status"]);
    assert.equal(statusRes.status, 0);
    assert.match(statusRes.stdout, /系統型態判定: Web/);
    assert.match(statusRes.stdout, /已完成: 1 \| 待確認: 1 \| 待分析\/分析中: 0/);

    // With --force, --write-index overwrites cleanly
    const forceRes = runCli(workDir, ["scan-entries", "--write-index", "--force"]);
    assert.equal(forceRes.status, 0, `scan-entries --force failed: ${forceRes.stderr}`);
    assert.equal(parseIndexItems(workDir).length, 5);
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
