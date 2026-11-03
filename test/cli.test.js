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
    assert.ok(fs.existsSync(path.join(workDir, "project", "001", "backlog.md")));

    // 5. Verify should FAIL on unfilled template placeholders
    const verifyUnfilled = runCli(workDir, ["verify", "001"]);
    assert.notEqual(verifyUnfilled.status, 0, "verify should fail when templates are unfilled");
    assert.match(verifyUnfilled.stdout, /FAIL \[001\]/);

    // 6. Write hallucinated file path & out-of-range line numbers -> Verify should catch both!
    const itemDir = path.join(workDir, "project", "001");
    for (const f of ["analysis.md", "data-flow.md", "sql.md", "dependencies.md", "dead-code.md", "backlog.md"]) {
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
    const verifyValid = runCli(workDir, ["verify", "001"]);
    assert.equal(verifyValid.status, 0, `verify should pass: ${verifyValid.stdout}`);
    assert.match(verifyValid.stdout, /PASS \[001\]/);

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
    `;
    spawnSync("sqlite3", [dbPath, initSql], { encoding: "utf8" });

    const connPath = path.join(workDir, "project", "system", "db-connection.md");
    let connText = fs.readFileSync(connPath, "utf8");
    connText = connText
      .replace(/\(Enabled\)\*\*:\s*`false`/, "(Enabled)**: `true`")
      .replace(/\(Database Product\)\*\*:\s*`[^`]*`/, "(Database Product)**: `sqlite`")
      .replace(/\(Host \/ Path\)\*\*:\s*`[^`]*`/, "(Host / Path)**: `./legacy.sqlite`");
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
