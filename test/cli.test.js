const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const cliBin = path.resolve(__dirname, "..", "bin", "refactor-analyze.js");

function runCli(cwd, args = []) {
  return spawnSync(process.execPath, [cliBin, ...args], {
    cwd,
    encoding: "utf8"
  });
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("1. init, analyze, 0-Token verify (anti-hallucination & drift detection), and commit gate", () => {
  const targetDir = makeTempDir("ra-target-");
  const workDir = makeTempDir("ra-work-");

  try {
    // 1. Setup mock legacy target repository with Git
    spawnSync("git", ["init"], { cwd: targetDir });
    spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: targetDir });
    spawnSync("git", ["config", "user.name", "Tester"], { cwd: targetDir });

    fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });
    const serviceCode = [
      "class OrderService {",
      "  createOrder(req) {",
      "    if (!req || !req.items) {",
      "      throw new Error('Invalid order');",
      "    }",
      "    const total = req.items.reduce((s, i) => s + i.price * i.qty, 0);",
      "    return { status: 'CREATED', total };",
      "  }",
      "}",
      "module.exports = OrderService;"
    ].join("\n");
    fs.writeFileSync(path.join(targetDir, "src", "OrderService.js"), serviceCode, "utf8");
    fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify({ name: "legacy-web" }), "utf8");

    spawnSync("git", ["add", "."], { cwd: targetDir });
    spawnSync("git", ["commit", "-m", "initial legacy commit"], { cwd: targetDir });

    // 2. Run refactor-analyze init --full --lang en --target <targetDir>
    const initRes = runCli(workDir, ["init", "--full", "--lang", "en", "--target", targetDir]);
    assert.equal(initRes.status, 0, `init failed: ${initRes.stderr}`);
    assert.ok(fs.existsSync(path.join(workDir, ".gitignore")));
    assert.ok(fs.existsSync(path.join(workDir, "AGENTS.md")));
    assert.ok(fs.existsSync(path.join(workDir, "rules", "zero-hallucination-rule.md")));

    // 3. Add item 001 to project/index.md
    const indexPath = path.join(workDir, "project", "index.md");
    const indexContent = `# Feature Inventory

## Category: Order Management
| 編號 | 功能或 API | 程式的位置（進入點） | 複雜度 | 目前的狀態 |
|---|---|---|---|---|
| \`001\` | Create Order API | \`src/OrderService.js#createOrder\` | 低 | 待分析 |
`;
    fs.writeFileSync(indexPath, indexContent, "utf8");

    // 4. Run refactor-analyze analyze 1
    const analyzeRes = runCli(workDir, ["analyze", "1"]);
    assert.equal(analyzeRes.status, 0, `analyze failed: ${analyzeRes.stderr}`);
    assert.ok(fs.existsSync(path.join(workDir, "project", "001", "analysis.md")));
    assert.ok(fs.existsSync(path.join(workDir, "project", "001", "business-logic.md")));
    assert.ok(fs.existsSync(path.join(workDir, "project", "001", "ui-behavior.md")));
    assert.ok(fs.existsSync(path.join(workDir, "project", "001", "backlog.md")));

    // 5. Verify should FAIL on unfilled template placeholders
    const verifyUnfilled = runCli(workDir, ["verify", "001"]);
    assert.notEqual(verifyUnfilled.status, 0, "verify should fail when templates are unfilled");
    assert.match(verifyUnfilled.stdout, /FAIL \[001\]/);

    // 6. Write hallucinated file path & out-of-range line numbers -> Verify should catch both!
    const itemDir = path.join(workDir, "project", "001");
    for (const f of ["analysis.md", "ui-behavior.md", "data-flow.md", "sql.md", "dependencies.md", "dead-code.md", "backlog.md"]) {
      const p = path.join(itemDir, f);
      const cleaned = fs.readFileSync(p, "utf8").replace(/\*\(待 AI 分析填寫\)\*/g, "已填寫分析內容").replace(/待確認/g, "已釐清");
      fs.writeFileSync(p, cleaned, "utf8");
    }
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# Business Logic\n- Rule 1: `src/NonExistentFile.js#L1-L5`\n- Rule 2: `src/OrderService.js#L1-L999`\n",
      "utf8"
    );

    const verifyHallucinated = runCli(workDir, ["verify", "001"]);
    assert.notEqual(verifyHallucinated.status, 0, "verify should fail on hallucinated file and line range");
    assert.match(verifyHallucinated.stdout, /NonExistentFile\.js/);
    assert.match(verifyHallucinated.stdout, /超出範圍/);

    // 7. Fix citations to valid file & line range (1..10) -> Verify should PASS!
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# Business Logic\n- Rule 1: Validate order items and calculate total (`src/OrderService.js#L2-L8`).\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(itemDir, "data-flow.md"),
      "# Data Flow\n\n## 2. DB Tables\n| 資料表名稱 (`project/system/db/`) | 操作 (`C`/`R`/`U`/`D`) | 涉及欄位名稱 | 欄位型態與說明 | 對應程式位置與行號 |\n|---|---|---|---|---|\n| `orders` | `C` | `id, total` | BIGINT | `src/OrderService.js#L2-L8` |\n",
      "utf8"
    );
    const verifyValid = runCli(workDir, ["verify", "001"]);
    assert.equal(verifyValid.status, 0, `verify should pass: ${verifyValid.stdout}`);
    assert.match(verifyValid.stdout, /PASS \[001\]/);

    // Commit 001 and verify automatic aggregation to domain-flows.md
    const commitItemRes = runCli(workDir, ["commit", "001"]);
    assert.equal(commitItemRes.status, 0, `commit failed: ${commitItemRes.stderr}`);
    const domainFlowsAfterCommit = fs.readFileSync(path.join(workDir, "project", "system", "domain-flows.md"), "utf8");
    assert.match(domainFlowsAfterCommit, /`orders`/);
    assert.match(domainFlowsAfterCommit, /`001`/);

    // 8. Modify target repo file and commit -> Verify should detect Git commit drift!
    fs.writeFileSync(
      path.join(targetDir, "src", "OrderService.js"),
      serviceCode + "\n// Newly added comment line\n",
      "utf8"
    );
    spawnSync("git", ["add", "."], { cwd: targetDir });
    spawnSync("git", ["commit", "-m", "modify OrderService"], { cwd: targetDir });

    const verifyDrift = runCli(workDir, ["verify", "001"]);
    assert.equal(verifyDrift.status, 0);
    assert.match(verifyDrift.stdout, /版本飄移警告/);
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("2. scandb extracts tables, columns, foreign keys, indexes, views, and triggers from SQLite in read-only mode", () => {
  const whichSqlite = spawnSync("which", ["sqlite3"], { encoding: "utf8" });
  if (whichSqlite.status !== 0) return;

  const workDir = makeTempDir("ra-scandb-");
  try {
    runCli(workDir, ["init"]);
    const dbPath = path.join(workDir, "legacy.sqlite");
    const initSql = `
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        total_amount NUMERIC DEFAULT 0,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_orders_customer ON orders(customer_id);
      CREATE VIEW v_customer_orders AS SELECT c.email, o.total_amount FROM customers c JOIN orders o ON c.id = o.customer_id;
      CREATE TRIGGER trg_orders_audit AFTER INSERT ON orders BEGIN SELECT 1; END;
      CREATE TABLE sys_code (code_type TEXT, code_id TEXT, code_name TEXT);
      INSERT INTO sys_code VALUES ('ORDER_STS', '01', '草稿'), ('ORDER_STS', '02', '已審核');
    `;
    spawnSync("sqlite3", [dbPath, initSql], { encoding: "utf8" });

    const connPath = path.join(workDir, "project", "system", "db-connection.md");
    let connText = fs.readFileSync(connPath, "utf8");
    connText = connText
      .replace(/\(Enabled\)\*\*:\s*`false`/, "(Enabled)**: `true`")
      .replace(/\(Database Product\)\*\*:\s*`[^`]*`/, "(Database Product)**: `sqlite`")
      .replace(/\(Host \/ Path\)\*\*:\s*`[^`]*`/, "(Host / Path)**: `./legacy.sqlite`")
      .replace(/\(Code Tables\)\*\*:\s*`[^`]*`/, "(Code Tables)**: `sys_code`");
    fs.writeFileSync(connPath, connText, "utf8");

    const scanRes = runCli(workDir, ["scandb"]);
    assert.equal(scanRes.status, 0, `scandb failed: ${scanRes.stderr}`);

    const schemaDoc = fs.readFileSync(path.join(workDir, "project", "system", "db-schema.md"), "utf8");
    assert.match(schemaDoc, /`customers`/);
    assert.match(schemaDoc, /`orders`/);
    assert.match(schemaDoc, /`v_customer_orders`/);
    assert.match(schemaDoc, /`trg_orders_audit`/);

    const ordersDoc = fs.readFileSync(path.join(workDir, "project", "system", "db", "orders.md"), "utf8");
    assert.match(ordersDoc, /FK -> customers\.id/);
    assert.match(ordersDoc, /idx_orders_customer/);

    const routinesDoc = fs.readFileSync(path.join(workDir, "project", "system", "db", "_routines.md"), "utf8");
    assert.match(routinesDoc, /View: `v_customer_orders`/);
    assert.match(routinesDoc, /Trigger: `trg_orders_audit`/);

    const codeDictDoc = fs.readFileSync(path.join(workDir, "project", "system", "code-dictionary.md"), "utf8");
    assert.match(codeDictDoc, /sys_code/);
    assert.match(codeDictDoc, /ORDER_STS/);
    assert.match(codeDictDoc, /已審核/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("3. commit stops safely on Git merge conflict instead of corrupting files", () => {
  const remoteDir = makeTempDir("ra-remote-");
  const workDir = makeTempDir("ra-local-");
  const otherCloneDir = makeTempDir("ra-other-");

  try {
    spawnSync("git", ["init", "--bare"], { cwd: remoteDir });

    runCli(workDir, ["init"]);
    spawnSync("git", ["config", "user.email", "a@example.com"], { cwd: workDir });
    spawnSync("git", ["config", "user.name", "UserA"], { cwd: workDir });
    spawnSync("git", ["remote", "add", "origin", remoteDir], { cwd: workDir });

    spawnSync("git", ["add", "."], { cwd: workDir });
    spawnSync("git", ["commit", "-m", "init workspace"], { cwd: workDir });
    const branch =
      spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: workDir, encoding: "utf8" }).stdout.trim() ||
      "main";
    spawnSync("git", ["push", "-u", "origin", branch], { cwd: workDir });

    // Clone second workspace and push a conflicting change to project/index.md
    spawnSync("git", ["clone", "-b", branch, remoteDir, otherCloneDir]);
    spawnSync("git", ["config", "user.email", "b@example.com"], { cwd: otherCloneDir });
    spawnSync("git", ["config", "user.name", "UserB"], { cwd: otherCloneDir });
    fs.writeFileSync(path.join(otherCloneDir, "project", "index.md"), "# Remote Conflicting Change\n| `001` | Remote | `a.js` | 高 | 已完成 |\n", "utf8");
    spawnSync("git", ["add", "project/index.md"], { cwd: otherCloneDir });
    spawnSync("git", ["commit", "-m", "remote update index"], { cwd: otherCloneDir });
    spawnSync("git", ["push", "origin", branch], { cwd: otherCloneDir });

    // Modify project/index.md locally and run refactor-analyze commit
    fs.writeFileSync(path.join(workDir, "project", "index.md"), "# Local Conflicting Change\n| `001` | Local | `a.js` | 低 | 待確認 |\n", "utf8");
    const commitRes = runCli(workDir, ["commit"]);

    // Must exit non-zero and preserve conflict markers for safe resolution instead of blindly stripping them
    assert.notEqual(
      commitRes.status,
      0,
      `commit should exit non-zero when remote pull conflicts. stdout=${commitRes.stdout} stderr=${commitRes.stderr}`
    );
    const combinedOut = `${commitRes.stdout}\n${commitRes.stderr}`;
    assert.match(combinedOut, /Git 衝突停止/);
    const indexAfter = fs.readFileSync(path.join(workDir, "project", "index.md"), "utf8");
    assert.match(indexAfter, /<<<<<<< /);
  } finally {
    fs.rmSync(remoteDir, { recursive: true, force: true });
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(otherCloneDir, { recursive: true, force: true });
  }
});

test("4. gen-test generates runnable test harness code for JUnit, Jest, and PyTest", () => {
  const workDir = makeTempDir("ra-harness-");

  try {
    runCli(workDir, ["init"]);
    const indexPath = path.join(workDir, "project", "index.md");
    fs.writeFileSync(
      indexPath,
      "# Index\n| `001` | Create Order API | `src/OrderService.js#createOrder` | 低 | 待分析 |\n",
      "utf8"
    );

    runCli(workDir, ["analyze", "001"]);
    const bizPath = path.join(workDir, "project", "001", "business-logic.md");
    fs.writeFileSync(
      bizPath,
      `# Business Logic
## 5. 重構驗收測試情境 (Acceptance Test Scenarios — Given / When / Then)
| 情境編號 | 測試案例名稱 / 目的 | 前置條件 (Given) | 觸發動作與輸入參數 (When) | 預期結果、狀態碼與 DB 變更 (Then) | 對應規則編號 (\`BR-xx\` / \`VAL-xx\`) |
|---|---|---|---|---|---|
| \`TC-01\` | should_create_order_successfully | Valid customer and cart items | Calling createOrder with items | Order status CREATED | \`BR-01\` |
| \`TC-02\` | should_fail_when_cart_is_empty | Empty cart | Calling createOrder with empty items | Throws Invalid order | \`VAL-01\` |
`,
      "utf8"
    );

    // 1. Generate Jest test harness
    const jestRes = runCli(workDir, ["gen-test", "001", "--framework", "jest"]);
    assert.equal(jestRes.status, 0, `gen-test jest failed: ${jestRes.stderr}`);
    const harnessDir = path.join(workDir, "project", "001", "harness");
    const filesAfterJest = fs.readdirSync(harnessDir);
    assert.ok(filesAfterJest.some((f) => f.endsWith(".test.js")), "jest test file should exist");
    const jestContent = fs.readFileSync(path.join(harnessDir, filesAfterJest.find((f) => f.endsWith(".test.js"))), "utf8");
    assert.match(jestContent, /TC-01/);
    assert.match(jestContent, /should_create_order_successfully/);
    assert.match(jestContent, /\[GIVEN\]/);

    // 2. Generate JUnit 5 test harness
    const junitRes = runCli(workDir, ["gen-test", "001", "--framework", "junit"]);
    assert.equal(junitRes.status, 0, `gen-test junit failed: ${junitRes.stderr}`);
    const filesAfterJunit = fs.readdirSync(harnessDir);
    assert.ok(filesAfterJunit.some((f) => f.endsWith("Test.java")), "junit test file should exist");
    const junitContent = fs.readFileSync(path.join(harnessDir, filesAfterJunit.find((f) => f.endsWith("Test.java"))), "utf8");
    assert.match(junitContent, /@Test/);
    assert.match(junitContent, /TC-01/);
    assert.match(junitContent, /@DisplayName/);

    // 3. Generate PyTest harness
    const pytestRes = runCli(workDir, ["gen-test", "001", "--framework", "pytest"]);
    assert.equal(pytestRes.status, 0, `gen-test pytest failed: ${pytestRes.stderr}`);
    const filesAfterPytest = fs.readdirSync(harnessDir);
    assert.ok(filesAfterPytest.some((f) => f.startsWith("test_") && f.endsWith(".py")), "pytest file should exist");
    const pyContent = fs.readFileSync(path.join(harnessDir, filesAfterPytest.find((f) => f.startsWith("test_") && f.endsWith(".py"))), "utf8");
    assert.match(pyContent, /def test_/);
    assert.match(pyContent, /TC-01/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("5. voucher verification detects missing/unconfirmed vouchers, passes confirmed vouchers, and promotes global vouchers to domain-dictionary.md on commit", () => {
  const workDir = makeTempDir("ra-voucher-");
  try {
    runCli(workDir, ["init"]);
    assert.ok(
      fs.existsSync(path.join(workDir, "project", "system", "domain-dictionary.md")),
      "domain-dictionary.md should be initialized"
    );

    runCli(workDir, ["analyze", "001"]);
    const itemDir = path.join(workDir, "project", "001");

    // Clean templates
    fs.writeFileSync(path.join(itemDir, "analysis.md"), "# 分析\n- **Git 版本**：`abcdef1`\n- **複雜度等級**：`低`\n- **目前的狀態**：`待分析`\n", "utf8");
    fs.writeFileSync(path.join(itemDir, "ui-behavior.md"), "# UI 行為\n無畫面操作（純後端 API / 批次作業）\n", "utf8");
    fs.writeFileSync(path.join(itemDir, "data-flow.md"), "# 資料流\n無資料流\n", "utf8");
    fs.writeFileSync(path.join(itemDir, "sql.md"), "# SQL\n無 SQL 操作\n", "utf8");
    fs.writeFileSync(path.join(itemDir, "dependencies.md"), "# 依賴\n無特殊外部依賴\n", "utf8");
    fs.writeFileSync(path.join(itemDir, "dead-code.md"), "# 死程式碼\n無死程式碼\n", "utf8");

    // 1. Business logic cites BL-01, but backlog has BL-01 as 待確認
    fs.writeFileSync(
      path.join(itemDir, "business-logic.md"),
      "# 業務邏輯\n- 訂單超時取消規則：`[Human: 訪談維運主管]#BL-01` 當超過 30 分鐘未付款時自動標記為取消。\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(itemDir, "backlog.md"),
      `# Backlog
| 憑證編號 | 類型 | 程式/資料庫位置 | 疑問與待釐清事項 | 調查結果與拍板決策 | 來源類型 | 佐證依據/訪談記錄 | 拍板人 | 適用範圍 | 狀態 |
|---|---|---|---|---|---|---|---|---|---|
| \`BL-01\` | 狀態碼/魔術數字 | ORDERS.STS_CD | STS_CD = '9' 含義為何 | 待確認 | Human/Interview | 會議訪談 | - | 全系統通用 | 待確認 |
`,
      "utf8"
    );

    const verifyFail = runCli(workDir, ["verify", "001"]);
    assert.notEqual(verifyFail.status, 0, "verify should fail on unconfirmed voucher");
    assert.match(verifyFail.stdout, /尚未釐清的 Backlog 業務憑證/);

    // 2. Resolve voucher with signoff, conclusion, and mark as 已釐清
    fs.writeFileSync(
      path.join(itemDir, "backlog.md"),
      `# Backlog
| 憑證編號 | 類型 | 程式/資料庫位置 | 疑問與待釐清事項 | 調查結果與拍板決策 | 來源類型 | 佐證依據/訪談記錄 | 拍板人 | 適用範圍 | 狀態 |
|---|---|---|---|---|---|---|---|---|---|
| \`BL-01\` | 狀態碼/魔術數字 | ORDERS.STS_CD | STS_CD = '9' 含義為何 | 經確認代表系統逾時自動取消 | Human/Interview | 2026-03-31 運營產銷週會記錄 | 王小明 (PM) | 全系統通用 | 已釐清 |
`,
      "utf8"
    );

    const verifyPass = runCli(workDir, ["verify", "001"]);
    assert.equal(verifyPass.status, 0, `verify should pass on confirmed voucher: ${verifyPass.stdout}`);
    assert.match(verifyPass.stdout, /1 處業務憑證/);

    // 3. Commit item 001 -> should auto-promote BL-01 to project/system/domain-dictionary.md
    const commitRes = runCli(workDir, ["commit", "001"]);
    assert.equal(commitRes.status, 0, `commit should succeed: ${commitRes.stderr}`);

    const dictContent = fs.readFileSync(path.join(workDir, "project", "system", "domain-dictionary.md"), "utf8");
    assert.match(dictContent, /BL-01/);
    assert.match(dictContent, /經確認代表系統逾時自動取消/);
    assert.match(dictContent, /王小明 \(PM\)/);
    assert.match(dictContent, /`001`/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
