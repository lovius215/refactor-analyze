const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const { parseDbConnectionConfig, escapeSqlLiteral } = require("../src/lib/db-scanner");

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

function writeExecutable(dir, name, jsBody) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `#!/usr/bin/env node\n${jsBody}\n`, { mode: 0o755 });
  return filePath;
}

test("db-scanner: parseDbConnectionConfig parses backticks, unquoted fallback, and StrictHostKeyChecking", () => {
  const workDir = makeTempDir("ra-dbcfg-");
  try {
    fs.mkdirSync(path.join(workDir, "project", "system"), { recursive: true });
    fs.writeFileSync(
      path.join(workDir, "project", "system", "db-connection.md"),
      `# DB Connection
- **啟用資料庫掃描 (Enabled)**：true
- **資料庫產品 (Database Product)**：mysql
- **連線主機或檔案路徑 (Host / Path)**：\`10.0.0.5\`
- **連接埠 (Port)**：\`3307\`
- **資料庫名稱 (Database / Schema)**：\`legacy_erp\`
- **帳號 (Username)**：\`ro_user\`
- **密碼 (Password)**：\`secret123\`
- **共用代碼表清單 (Code Tables)**：\`sys_code, bad table name, order_type\`
- **啟用跳板機 (SSH Enabled)**：\`true\`
- **跳板機主機 (SSH Host)**：\`bastion.internal\`
- **跳板機連接埠 (SSH Port)**：\`2222\`
- **跳板機帳號 (SSH Username)**：\`ops\`
`,
      "utf8"
    );

    const cfg = parseDbConnectionConfig(workDir);
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.product, "mysql");
    assert.equal(cfg.host, "10.0.0.5");
    assert.equal(cfg.port, "3307");
    assert.equal(cfg.database, "legacy_erp");
    assert.equal(cfg.username, "ro_user");
    assert.equal(cfg.password, "secret123");
    assert.deepEqual(cfg.codeTables, ["sys_code", "order_type"]);
    assert.equal(cfg.sshEnabled, true);
    assert.equal(cfg.sshHost, "bastion.internal");
    assert.equal(cfg.sshPort, "2222");
    assert.equal(cfg.sshUser, "ops");
    assert.equal(cfg.sshStrictHostKeyChecking, "yes");

    assert.equal(escapeSqlLiteral("o'reilly"), "o''reilly");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("db-scanner: fails clearly when enabled=true but required fields are missing or malformed", () => {
  const workDir = makeTempDir("ra-dbval-");
  try {
    runCli(workDir, ["init"]);
    const connPath = path.join(workDir, "project", "system", "db-connection.md");
    fs.writeFileSync(
      connPath,
      `- **啟用資料庫掃描 (Enabled)**：\`true\`
- **資料庫產品 (Database Product)**：*(請填寫)*
- **連線主機或檔案路徑 (Host / Path)**：\`127.0.0.1\`
`,
      "utf8"
    );

    const res = runCli(workDir, ["scandb"]);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /找不到有效的「資料庫產品/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("db-scanner: MySQL read-only scan with mock mysql CLI and SSH StrictHostKeyChecking=yes", () => {
  const workDir = makeTempDir("ra-mysql-");
  const mockBin = makeTempDir("ra-mockbin-");
  try {
    runCli(workDir, ["init"]);
    const connPath = path.join(workDir, "project", "system", "db-connection.md");
    fs.writeFileSync(
      connPath,
      `- **啟用資料庫掃描 (Enabled)**：\`true\`
- **資料庫產品 (Database Product)**：\`mysql\`
- **連線主機或檔案路徑 (Host / Path)**：\`db.internal\`
- **連接埠 (Port)**：\`3306\`
- **資料庫名稱 (Database / Schema)**：\`shop_db\`
- **帳號 (Username)**：\`readonly\`
- **密碼 (Password)**：\`pw\`
- **啟用跳板機 (SSH Enabled)**：\`true\`
- **跳板機主機 (SSH Host)**：\`jump.internal\`
- **跳板機帳號 (SSH Username)**：\`tunnel\`
`,
      "utf8"
    );

    const sshLog = path.join(workDir, "ssh-args.log");
    writeExecutable(
      mockBin,
      "ssh",
      `const fs = require("fs");
const args = process.argv.slice(2);
if (args.includes("-O")) process.exit(0);
fs.writeFileSync(${JSON.stringify(sshLog)}, JSON.stringify(args));
process.exit(0);`
    );

    writeExecutable(
      mockBin,
      "mysql",
      `const args = process.argv.slice(2);
const sql = args[args.indexOf("-e") + 1] || "";
if (!sql.includes("SET SESSION TRANSACTION READ ONLY")) process.exit(2);
if (sql.includes("FROM INFORMATION_SCHEMA.TABLES")) {
  console.log("orders\\tBASE TABLE\\t訂單主檔");
} else if (sql.includes("FROM INFORMATION_SCHEMA.COLUMNS")) {
  console.log("orders\\tid\\tbigint\\tNO\\t\\tPRI\\t主鍵");
  console.log("orders\\ttotal_amt\\tdecimal(10,2)\\tNO\\t0.00\\t\\t總金額");
} else if (sql.includes("KEY_COLUMN_USAGE")) {
  console.log("");
} else if (sql.includes("STATISTICS")) {
  console.log("orders\\tPRIMARY\\t1\\tid");
} else if (sql.includes("VIEWS")) {
  console.log("v_orders\\tSELECT id FROM orders");
} else if (sql.includes("ROUTINES")) {
  console.log("sp_close_order\\tPROCEDURE\\tBEGIN END");
} else if (sql.includes("TRIGGERS")) {
  console.log("trg_ord\\torders\\tAFTER INSERT\\tBEGIN END");
}`
    );

    const res = runCli(workDir, ["scandb"], {
      PATH: `${mockBin}${path.delimiter}${process.env.PATH}`
    });
    assert.equal(res.status, 0, `mysql scandb failed: ${res.stderr}`);
    assert.match(res.stdout, /已完成 mysql 唯讀掃描：1 張表、1 個 View、1 個 SP\/Function、1 個 Trigger/i);

    const sshArgs = JSON.parse(fs.readFileSync(sshLog, "utf8"));
    assert.ok(sshArgs.includes("StrictHostKeyChecking=yes"), "SSH should default to StrictHostKeyChecking=yes");

    const ordersMd = fs.readFileSync(path.join(workDir, "project", "system", "db", "orders.md"), "utf8");
    assert.match(ordersMd, /訂單主檔/);
    assert.match(ordersMd, /`total_amt`/);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(mockBin, { recursive: true, force: true });
  }
});

test("db-scanner: PostgreSQL, SQL Server, and Oracle read-only scans with mock CLI fixtures", () => {
  const workDir = makeTempDir("ra-multidb-");
  const mockBin = makeTempDir("ra-mockbin2-");
  try {
    runCli(workDir, ["init"]);
    const connPath = path.join(workDir, "project", "system", "db-connection.md");

    writeExecutable(
      mockBin,
      "psql",
      `const args = process.argv.slice(2);
const sql = args[args.indexOf("-c") + 1] || "";
if (!(process.env.PGOPTIONS || "").includes("default_transaction_read_only=on")) process.exit(2);
if (sql.includes("information_schema.columns")) {
  console.log("public\\tpg_users\\tid\\tinteger\\tNO\\t\\tID\\t用戶表");
} else if (sql.includes("table_constraints")) {
  console.log("pg_users\\tid\\tPRIMARY KEY\\t\\t");
} else if (sql.includes("pg_indexes")) {
  console.log("pg_users\\tpk_pg_users\\tCREATE UNIQUE INDEX pk_pg_users ON public.pg_users (id)");
} else if (sql.includes("information_schema.views")) {
  console.log("v_pg_users\\tSELECT id FROM pg_users");
} else if (sql.includes("pg_proc")) {
  console.log("fn_pg_test\\tFUNCTION\\tSELECT 1");
} else if (sql.includes("information_schema.triggers")) {
  console.log("trg_pg\\tpg_users\\tAFTER INSERT\\tEXECUTE FUNCTION fn_pg_test()");
}`
    );

    writeExecutable(
      mockBin,
      "sqlcmd",
      `const args = process.argv.slice(2);
const sql = args[args.indexOf("-Q") + 1] || "";
if (sql.includes("sys.columns")) {
  console.log("mssql_inv\\tinv_id\\tint\\tNO\\t\\tPK\\t發票號");
} else if (sql.includes("sys.foreign_keys")) {
  console.log("");
} else if (sql.includes("sys.indexes")) {
  console.log("mssql_inv\\tpk_inv\\tUNIQUE\\tinv_id");
} else if (sql.includes("sys.views")) {
  console.log("v_inv\\tSELECT inv_id FROM mssql_inv");
} else if (sql.includes("sys.procedures")) {
  console.log("sp_inv\\tPROCEDURE\\tSELECT 1");
} else if (sql.includes("sys.triggers")) {
  console.log("trg_inv\\tmssql_inv\\tAFTER INSERT\\tSELECT 1");
}`
    );

    writeExecutable(
      mockBin,
      "sqlplus",
      `const fs = require("fs");
const sql = fs.readFileSync(0, "utf8");
if (!sql.includes("SET TRANSACTION READ ONLY;")) process.exit(2);
if (sql.includes("USER_TAB_COLUMNS")) {
  console.log("ORA_ACCT\\tACCT_ID\\tNUMBER(10)\\tN\\t帳號ID");
} else if (sql.includes("USER_CONSTRAINTS")) {
  console.log("ORA_ACCT\\tACCT_ID\\tP");
} else if (sql.includes("USER_INDEXES")) {
  console.log("ORA_ACCT\\tPK_ORA_ACCT\\tUNIQUE\\tACCT_ID");
} else if (sql.includes("USER_VIEWS")) {
  console.log("V_ORA_ACCT\\tSELECT ACCT_ID FROM ORA_ACCT");
} else if (sql.includes("USER_PROCEDURES")) {
  console.log("PKG_ACCT\\tPACKAGE");
} else if (sql.includes("USER_TRIGGERS")) {
  console.log("TRG_ACCT\\tORA_ACCT\\tBEFORE INSERT\\tNULL;");
}`
    );

    const env = { PATH: `${mockBin}${path.delimiter}${process.env.PATH}` };

    // 1. PostgreSQL
    fs.writeFileSync(
      connPath,
      `- **啟用資料庫掃描 (Enabled)**：\`true\`
- **資料庫產品 (Database Product)**：\`postgres\`
- **連線主機或檔案路徑 (Host / Path)**：\`127.0.0.1\`
- **資料庫名稱 (Database / Schema)**：\`pgdb\`
- **帳號 (Username)**：\`pg\`
- **密碼 (Password)**：\`pw\`
`,
      "utf8"
    );
    const pgRes = runCli(workDir, ["scandb"], env);
    assert.equal(pgRes.status, 0, `postgres failed: ${pgRes.stderr}`);
    assert.match(pgRes.stdout, /已完成 PostgreSQL 唯讀掃描：1 張表/);
    assert.ok(fs.existsSync(path.join(workDir, "project", "system", "db", "pg_users.md")));

    // 2. SQL Server
    fs.writeFileSync(
      connPath,
      `- **啟用資料庫掃描 (Enabled)**：\`true\`
- **資料庫產品 (Database Product)**：\`sqlserver\`
- **連線主機或檔案路徑 (Host / Path)**：\`127.0.0.1\`
- **資料庫名稱 (Database / Schema)**：\`msdb\`
- **帳號 (Username)**：\`sa\`
- **密碼 (Password)**：\`pw\`
`,
      "utf8"
    );
    const msRes = runCli(workDir, ["scandb"], env);
    assert.equal(msRes.status, 0, `sqlserver failed: ${msRes.stderr}`);
    assert.match(msRes.stdout, /已完成 SQL Server 唯讀掃描：1 張表/);
    assert.ok(fs.existsSync(path.join(workDir, "project", "system", "db", "mssql_inv.md")));

    // 3. Oracle
    fs.writeFileSync(
      connPath,
      `- **啟用資料庫掃描 (Enabled)**：\`true\`
- **資料庫產品 (Database Product)**：\`oracle\`
- **連線主機或檔案路徑 (Host / Path)**：\`127.0.0.1\`
- **資料庫名稱 (Database / Schema)**：\`ORCL\`
- **帳號 (Username)**：\`scott\`
- **密碼 (Password)**：\`tiger\`
`,
      "utf8"
    );
    const oraRes = runCli(workDir, ["scandb"], env);
    assert.equal(oraRes.status, 0, `oracle failed: ${oraRes.stderr}`);
    assert.match(oraRes.stdout, /已完成 Oracle 唯讀掃描：1 張表/);
    assert.ok(fs.existsSync(path.join(workDir, "project", "system", "db", "ORA_ACCT.md")));
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(mockBin, { recursive: true, force: true });
  }
});
