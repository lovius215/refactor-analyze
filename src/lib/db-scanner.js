const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { formatLocalDateTime, fail } = require("./utils");

function parseDbConnectionConfig(cwd) {
  const configPath = path.join(cwd, "project", "system", "db-connection.md");
  if (!fs.existsSync(configPath)) {
    fail("找不到 project/system/db-connection.md，請先執行 refactor-analyze init。");
    return null;
  }

  const content = fs.readFileSync(configPath, "utf8");
  const extract = (labelRegex) => {
    const m = content.match(labelRegex);
    return m ? m[1].trim() : "";
  };

  return {
    enabled:
      extract(/(?:啟用資料庫掃描|启用数据库扫描|Enabled|DB スキャン有効化|DB 스캔 활성화)[^`]*`([^`]*)`/i).toLowerCase() ===
      "true",
    product: extract(/(?:資料庫產品|数据库产品|Database Product|DB 製品|DB 제품)[^`]*`([^`]*)`/i).toLowerCase(),
    host: extract(/(?:連線主機或檔案路徑|连接主机或文件路径|Host \/ Path|ホスト\/パス|호스트\/경로)[^`]*`([^`]*)`/i),
    port: extract(/(?:^|\n)-\s*\*\*(?:連接埠|端口|Port|ポート|포트)(?:\s*\(Port\))?\*\*[：:]\s*`([^`]*)`/i),
    database: extract(/(?:資料庫名稱|数据库名称|Database \/ Schema|データベース\/スキーマ|데이터베이스\/스키마)[^`]*`([^`]*)`/i),
    username: extract(/(?:^|\n)-\s*\*\*(?:帳號|账号|Username|ユーザー名|계정)(?:\s*\(Username\))?\*\*[：:]\s*`([^`]*)`/i),
    password: extract(/(?:^|\n)-\s*\*\*(?:密碼|密码|Password|パスワード|비밀번호)(?:\s*\(Password\))?\*\*[：:]\s*`([^`]*)`/i),
    sshEnabled:
      extract(/(?:啟用跳板機|启用跳板机|SSH Enabled|SSH 踏み台有効化|SSH 점프 호스트 활성화)[^`]*`([^`]*)`/i).toLowerCase() ===
      "true",
    sshHost: extract(/(?:跳板機主機|跳板机主机|SSH Host|SSH ホスト|SSH 호스트)[^`]*`([^`]*)`/i),
    sshPort: extract(/(?:跳板機連接埠|跳板机端口|SSH Port|SSH ポート|SSH 포트)[^`]*`([^`]*)`/i) || "22",
    sshUser: extract(/(?:跳板機帳號|跳板机账号|SSH Username|SSH ユーザー名|SSH 계정)[^`]*`([^`]*)`/i),
    sshPassword: extract(/(?:跳板機密碼|跳板机密码|SSH Password|SSH パスワード|SSH 비밀번호)[^`]*`([^`]*)`/i),
    sshKeyPath: extract(/(?:跳板機私鑰路徑|跳板机私钥路径|SSH Private Key Path|SSH 秘密鍵パス|SSH 개인키 경로)[^`]*`([^`]*)`/i),
    localTunnelPort:
      extract(/(?:本地轉發連接埠|本地转发端口|Local Tunnel Port|ローカル転送ポート|로컬 터널 포트)[^`]*`([^`]*)`/i) || "13306"
  };
}

function escapeSqlLiteral(val) {
  return String(val || "").replace(/'/g, "''");
}

function scanDatabase(cwd) {
  const cfg = parseDbConnectionConfig(cwd);
  if (!cfg) return;

  console.log("refactor-analyze scandb");
  console.log(`讀取設定檔: project/system/db-connection.md (資料庫產品: ${cfg.product || "未指定"})`);

  if (!cfg.enabled) {
    console.log("提示: project/system/db-connection.md 中的「啟用資料庫掃描 (Enabled)」目前為 false。");
    console.log(
      "請先在 project/system/db-connection.md 填寫唯讀資料庫帳號、路徑與密碼（與選填跳板機設定），並將 Enabled 改為 true 後再執行 scandb。"
    );
    return;
  }

  let connectHost = cfg.host;
  let connectPort = cfg.port;
  let controlSocketPath = null;

  if (cfg.sshEnabled && cfg.sshHost && cfg.sshUser) {
    controlSocketPath = path.join(os.tmpdir(), `ra-ssh-${process.pid}-${Date.now()}.sock`);
    console.log(
      `[SSH 跳板機] 正在透過 ${cfg.sshUser}@${cfg.sshHost}:${cfg.sshPort} 建立專屬安全通道 (Local Port: ${cfg.localTunnelPort} -> ${cfg.host}:${cfg.port})...`
    );
    const sshArgs = [
      "-M",
      "-S",
      controlSocketPath,
      "-f",
      "-N",
      "-L",
      `127.0.0.1:${cfg.localTunnelPort}:${cfg.host}:${cfg.port}`,
      "-p",
      String(cfg.sshPort),
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ExitOnForwardFailure=yes",
      "-o",
      "BatchMode=" + (cfg.sshPassword ? "no" : "yes")
    ];

    if (cfg.sshKeyPath) {
      const resolvedKey = cfg.sshKeyPath.startsWith("~")
        ? path.join(os.homedir(), cfg.sshKeyPath.slice(1))
        : path.resolve(cwd, cfg.sshKeyPath);
      if (fs.existsSync(resolvedKey)) {
        sshArgs.push("-i", resolvedKey);
      } else {
        console.warn(`[SSH 跳板機警告] 找不到指定的 SSH 私鑰檔案: ${resolvedKey}`);
      }
    }
    sshArgs.push(`${cfg.sshUser}@${cfg.sshHost}`);

    let sshRes;
    if (cfg.sshPassword) {
      const whichSshpass = spawnSync("which", ["sshpass"], { encoding: "utf8" });
      if (whichSshpass.status === 0) {
        const env = Object.assign({}, process.env, { SSHPASS: cfg.sshPassword });
        sshRes = spawnSync("sshpass", ["-e", "ssh", ...sshArgs], { cwd, env, encoding: "utf8" });
      } else {
        console.warn(
          `[SSH 跳板機提示] 設定了 SSH Password 但系統未安裝 sshpass；建議改用 SSH Private Key Path (-i) 或 ssh-agent。`
        );
        sshRes = spawnSync("ssh", sshArgs, { cwd, encoding: "utf8" });
      }
    } else {
      sshRes = spawnSync("ssh", sshArgs, { cwd, encoding: "utf8" });
    }

    if (sshRes.status === 0) {
      connectHost = "127.0.0.1";
      connectPort = cfg.localTunnelPort;
      console.log(`[SSH 跳板機] 通道建立成功，將透過 ${connectHost}:${connectPort} 唯讀連線至資料庫。`);
    } else {
      console.warn(`[SSH 跳板機警告] 無法建立背景 SSH 通道: ${(sshRes.stderr || "").trim()}`);
      controlSocketPath = null;
      fail("SSH 跳板機連線失敗，已中止資料庫掃描（為保護資安，請勿將密碼貼入 AI 對話框）。");
      return;
    }
  }

  try {
    runReadOnlySchemaScan(cwd, cfg, connectHost, connectPort);
  } finally {
    if (controlSocketPath && fs.existsSync(controlSocketPath)) {
      spawnSync("ssh", ["-S", controlSocketPath, "-O", "exit", `${cfg.sshUser}@${cfg.sshHost}`], {
        encoding: "utf8"
      });
      try {
        if (fs.existsSync(controlSocketPath)) fs.unlinkSync(controlSocketPath);
      } catch (_) {}
    }
  }
}

function runReadOnlySchemaScan(cwd, cfg, host, port) {
  const now = formatLocalDateTime(new Date());
  const dbDir = path.join(cwd, "project", "system", "db");
  fs.mkdirSync(dbDir, { recursive: true });

  const prod = cfg.product;
  if (prod === "sqlite" || prod === "sqlite3") {
    scanSqlite(cwd, cfg, now);
    return;
  }
  if (prod === "mysql" || prod === "mariadb") {
    scanMysql(cwd, cfg, host, port, now);
    return;
  }
  if (prod === "postgres" || prod === "postgresql" || prod === "pgsql") {
    scanPostgres(cwd, cfg, host, port, now);
    return;
  }
  if (prod === "mssql" || prod === "sqlserver" || prod === "sql-server") {
    scanMssql(cwd, cfg, host, port, now);
    return;
  }
  if (prod === "oracle") {
    scanOracle(cwd, cfg, host, port, now);
    return;
  }

  fail(
    `不支援的資料庫產品 "${prod}"。支援項目: sqlite, mysql, mariadb, postgresql, sqlserver (mssql), oracle。`
  );
}

function scanSqlite(cwd, cfg, now) {
  const dbFile = path.resolve(cwd, cfg.host);
  if (!fs.existsSync(dbFile)) {
    fail(`找不到 SQLite 資料庫檔案: ${dbFile}`);
    return;
  }

  const runSqlite = (sql) => {
    const res = spawnSync("sqlite3", ["-readonly", "-separator", "\t", dbFile, sql], { encoding: "utf8" });
    if (res.status !== 0) {
      // Fallback if older sqlite3 CLI doesn't support -readonly flag
      return spawnSync("sqlite3", ["-separator", "\t", dbFile, sql], { encoding: "utf8" });
    }
    return res;
  };

  const masterRes = runSqlite(
    "SELECT name, type, REPLACE(REPLACE(COALESCE(sql,''), CHAR(10), ' '), CHAR(13), ' ') FROM sqlite_master WHERE type IN ('table','view','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name;"
  );
  if (masterRes.status !== 0) {
    fail(`無法執行 sqlite3 CLI: ${(masterRes.stderr || "").trim()}`);
    return;
  }

  const rows = (masterRes.stdout || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const tableSummaryRows = [];
  const viewRows = [];
  const triggerRows = [];

  for (const row of rows) {
    const [name, type, sqlDef] = row.split("\t");
    if (type === "table") {
      const safeName = name.replace(/"/g, '""');
      const colRes = runSqlite(`PRAGMA table_info("${safeName}");`);
      const fkRes = runSqlite(`PRAGMA foreign_key_list("${safeName}");`);
      const idxListRes = runSqlite(`PRAGMA index_list("${safeName}");`);

      const fkMap = new Map();
      const fkList = [];
      for (const fkLine of (fkRes.stdout || "").split("\n").filter(Boolean)) {
        const p = fkLine.split("\t");
        // id, seq, table, from, to, on_update, on_delete, match
        if (p.length >= 5) {
          fkMap.set(p[3], `FK -> ${p[2]}.${p[4]}`);
          fkList.push({
            column: p[3],
            refTable: p[2],
            refColumn: p[4],
            rule: `ON UPDATE ${p[5] || "NO ACTION"} / ON DELETE ${p[6] || "NO ACTION"}`
          });
        }
      }

      const idxList = [];
      const colIdxSet = new Set();
      for (const idxLine of (idxListRes.stdout || "").split("\n").filter(Boolean)) {
        const p = idxLine.split("\t");
        // seq, name, unique, origin, partial
        if (p.length >= 2) {
          const idxName = p[1];
          const isUnique = p[2] === "1";
          const infoRes = runSqlite(`PRAGMA index_info("${idxName.replace(/"/g, '""')}");`);
          const idxCols = (infoRes.stdout || "")
            .split("\n")
            .filter(Boolean)
            .map((l) => l.split("\t")[2])
            .filter(Boolean);
          idxCols.forEach((c) => colIdxSet.add(c));
          idxList.push({
            name: idxName,
            unique: isUnique ? "UNIQUE" : "INDEX",
            columns: idxCols.join(", ")
          });
        }
      }

      const cols = (colRes.stdout || "")
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          const p = l.split("\t");
          const colName = p[1];
          const keyBadges = [];
          if (p[5] && p[5] !== "0") keyBadges.push("PK");
          if (fkMap.has(colName)) keyBadges.push(fkMap.get(colName));
          else if (colIdxSet.has(colName)) keyBadges.push("IDX");
          return {
            name: colName,
            type: p[2],
            nullable: p[3] === "1" ? "NO" : "YES",
            defaultVal: p[4] || "",
            pk: keyBadges.join(", "),
            comment: ""
          };
        });

      writeTableMarkdown(cwd, name, cols, "", now, fkList, idxList);
      tableSummaryRows.push({
        name,
        count: cols.length,
        pk: cols
          .filter((c) => c.pk.includes("PK"))
          .map((c) => c.name)
          .join(", "),
        comment: ""
      });
    } else if (type === "view") {
      viewRows.push({ name, desc: (sqlDef || "").slice(0, 160) });
    } else if (type === "trigger") {
      triggerRows.push({ name, table: "-", timing: "-", desc: (sqlDef || "").slice(0, 160) });
    }
  }

  writeDbSchemaSummary(cwd, cfg.product, cfg.database || cfg.host, tableSummaryRows, viewRows, [], triggerRows, now);
  console.log(
    `[scandb] 已完成 SQLite 唯讀掃描：${tableSummaryRows.length} 張表、${viewRows.length} 個 View、${triggerRows.length} 個 Trigger。`
  );
}

function scanMysql(cwd, cfg, host, port, now) {
  const schema = escapeSqlLiteral(cfg.database);
  const env = Object.assign({}, process.env, { MYSQL_PWD: cfg.password });
  const runMysql = (sql) =>
    spawnSync(
      "mysql",
      [
        "-h",
        host,
        "-P",
        String(port || 3306),
        "-u",
        cfg.username,
        "--default-character-set=utf8mb4",
        "-N",
        "-B",
        "-e",
        `SET SESSION TRANSACTION READ ONLY; ${sql}`
      ],
      { env, encoding: "utf8" }
    );

  const tblRes = runMysql(`
    SELECT TABLE_NAME, TABLE_TYPE, COALESCE(TABLE_COMMENT, '')
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = '${schema}'
    ORDER BY TABLE_NAME;
  `);

  if (tblRes.status !== 0) {
    fail(`[scandb] MySQL/MariaDB 唯讀連線失敗: ${(tblRes.stderr || "").trim()}`);
    return;
  }

  const tableComments = new Map();
  for (const line of (tblRes.stdout || "").split("\n").filter(Boolean)) {
    const [tName, tType, tComment] = line.split("\t");
    if (tType === "BASE TABLE") tableComments.set(tName, tComment || "");
  }

  const colRes = runMysql(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COALESCE(COLUMN_DEFAULT, ''), COLUMN_KEY, COALESCE(COLUMN_COMMENT, '')
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '${schema}'
    ORDER BY TABLE_NAME, ORDINAL_POSITION;
  `);

  const fkRes = runMysql(`
    SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
           CONCAT('ON UPDATE ', r.UPDATE_RULE, ' / ON DELETE ', r.DELETE_RULE)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
    JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r
      ON k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND k.CONSTRAINT_NAME = r.CONSTRAINT_NAME
    WHERE k.TABLE_SCHEMA = '${schema}' AND k.REFERENCED_TABLE_NAME IS NOT NULL;
  `);

  const idxRes = runMysql(`
    SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ')
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = '${schema}'
    GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE;
  `);

  const viewRes = runMysql(`
    SELECT TABLE_NAME, REPLACE(REPLACE(LEFT(COALESCE(VIEW_DEFINITION, ''), 160), CHAR(10), ' '), CHAR(13), ' ')
    FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_SCHEMA = '${schema}';
  `);

  const procRes = runMysql(`
    SELECT ROUTINE_NAME, ROUTINE_TYPE, COALESCE(ROUTINE_COMMENT, '')
    FROM INFORMATION_SCHEMA.ROUTINES
    WHERE ROUTINE_SCHEMA = '${schema}';
  `);

  const trigRes = runMysql(`
    SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, CONCAT(ACTION_TIMING, ' ', EVENT_MANIPULATION),
           REPLACE(REPLACE(LEFT(COALESCE(ACTION_STATEMENT, ''), 140), CHAR(10), ' '), CHAR(13), ' ')
    FROM INFORMATION_SCHEMA.TRIGGERS
    WHERE TRIGGER_SCHEMA = '${schema}';
  `);

  const fkByTable = new Map();
  for (const line of (fkRes.stdout || "").split("\n").filter(Boolean)) {
    const [tName, colName, refTable, refCol, rule] = line.split("\t");
    if (!fkByTable.has(tName)) fkByTable.set(tName, []);
    fkByTable.get(tName).push({ column: colName, refTable, refColumn: refCol, rule: rule || "" });
  }

  const idxByTable = new Map();
  for (const line of (idxRes.stdout || "").split("\n").filter(Boolean)) {
    const [tName, idxName, nonUnique, cols] = line.split("\t");
    if (!idxByTable.has(tName)) idxByTable.set(tName, []);
    idxByTable.get(tName).push({
      name: idxName,
      unique: nonUnique === "0" ? "UNIQUE" : "INDEX",
      columns: cols
    });
  }

  const tableMap = new Map();
  for (const line of (colRes.stdout || "").split("\n").filter(Boolean)) {
    const [tName, cName, cType, isNull, cDef, cKey, cComment] = line.split("\t");
    if (!tableComments.has(tName) && tableComments.size > 0) continue; // skip views in columns table
    if (!tableMap.has(tName)) tableMap.set(tName, []);
    tableMap.get(tName).push({
      name: cName,
      type: cType,
      nullable: isNull,
      defaultVal: cDef || "",
      pk: cKey || "",
      comment: cComment || ""
    });
  }

  const summaryRows = [];
  for (const [tName, cols] of tableMap.entries()) {
    const tComment = tableComments.get(tName) || "";
    writeTableMarkdown(cwd, tName, cols, tComment, now, fkByTable.get(tName) || [], idxByTable.get(tName) || []);
    summaryRows.push({
      name: tName,
      count: cols.length,
      pk: cols
        .filter((c) => c.pk === "PRI")
        .map((c) => c.name)
        .join(", "),
      comment: tComment
    });
  }

  const views = (viewRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, desc] = l.split("\t");
      return { name, desc: desc || "-" };
    });

  const procs = (procRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, type, desc] = l.split("\t");
      return { name, type, desc: desc || "-" };
    });

  const triggers = (trigRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, table, timing, desc] = l.split("\t");
      return { name, table, timing, desc: desc || "-" };
    });

  writeDbSchemaSummary(cwd, cfg.product, cfg.database, summaryRows, views, procs, triggers, now);
  console.log(
    `[scandb] 已完成 ${cfg.product} 唯讀掃描：${summaryRows.length} 張表、${views.length} 個 View、${procs.length} 個 SP/Function、${triggers.length} 個 Trigger。`
  );
}

function scanPostgres(cwd, cfg, host, port, now) {
  let dbName = cfg.database;
  let schemaFilter = "table_schema NOT IN ('pg_catalog', 'information_schema')";
  if (cfg.database && cfg.database.includes(".")) {
    const parts = cfg.database.split(".");
    dbName = parts[0];
    schemaFilter = `table_schema = '${escapeSqlLiteral(parts[1])}'`;
  }

  const env = Object.assign({}, process.env, {
    PGPASSWORD: cfg.password,
    PGOPTIONS: "-c default_transaction_read_only=on"
  });

  const runPsql = (sql) =>
    spawnSync(
      "psql",
      ["-h", host, "-p", String(port || 5432), "-U", cfg.username, "-d", dbName, "-t", "-A", "-F", "\t", "-c", sql],
      { env, encoding: "utf8" }
    );

  const colRes = runPsql(`
    SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable,
           COALESCE(c.column_default, ''),
           COALESCE(col_description(pgc.oid, c.ordinal_position), ''),
           COALESCE(obj_description(pgc.oid), '')
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON c.table_schema = t.table_schema AND c.table_name = t.table_name AND t.table_type = 'BASE TABLE'
    LEFT JOIN pg_catalog.pg_namespace pgn ON pgn.nspname = c.table_schema
    LEFT JOIN pg_catalog.pg_class pgc ON pgc.relname = c.table_name AND pgc.relnamespace = pgn.oid
    WHERE c.${schemaFilter}
    ORDER BY c.table_schema, c.table_name, c.ordinal_position;
  `);

  if (colRes.status !== 0) {
    fail(`[scandb] PostgreSQL 唯讀連線失敗: ${(colRes.stderr || "").trim()}`);
    return;
  }

  const pkFkRes = runPsql(`
    SELECT tc.table_name, kcu.column_name, tc.constraint_type,
           COALESCE(ccu.table_name, ''), COALESCE(ccu.column_name, '')
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.${schemaFilter.replace("table_schema", "table_schema")}
      AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY');
  `);

  const idxRes = runPsql(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
  `);

  const viewRes = runPsql(`
    SELECT table_name, REPLACE(REPLACE(LEFT(COALESCE(view_definition, ''), 160), CHR(10), ' '), CHR(13), ' ')
    FROM information_schema.views
    WHERE ${schemaFilter};
  `);

  const procRes = runPsql(`
    SELECT routine_name, routine_type, COALESCE(data_type, '')
    FROM information_schema.routines
    WHERE ${schemaFilter.replace("table_schema", "routine_schema")};
  `);

  const trigRes = runPsql(`
    SELECT trigger_name, event_object_table, CONCAT(action_timing, ' ', event_manipulation),
           REPLACE(REPLACE(LEFT(COALESCE(action_statement, ''), 140), CHR(10), ' '), CHR(13), ' ')
    FROM information_schema.triggers
    WHERE ${schemaFilter.replace("table_schema", "trigger_schema")};
  `);

  const pkSet = new Set();
  const fkByTable = new Map();
  for (const line of (pkFkRes.stdout || "").split("\n").filter(Boolean)) {
    const [tName, colName, cType, refTable, refCol] = line.split("\t");
    if (cType === "PRIMARY KEY") {
      pkSet.add(`${tName}.${colName}`);
    } else if (cType === "FOREIGN KEY" && refTable) {
      if (!fkByTable.has(tName)) fkByTable.set(tName, []);
      fkByTable.get(tName).push({ column: colName, refTable, refColumn: refCol, rule: "FK" });
    }
  }

  const idxByTable = new Map();
  for (const line of (idxRes.stdout || "").split("\n").filter(Boolean)) {
    const [tName, idxName, idxDef] = line.split("\t");
    if (!idxByTable.has(tName)) idxByTable.set(tName, []);
    idxByTable.get(tName).push({
      name: idxName,
      unique: (idxDef || "").includes("UNIQUE") ? "UNIQUE" : "INDEX",
      columns: idxDef || ""
    });
  }

  const tableMap = new Map();
  const tableComments = new Map();
  for (const line of (colRes.stdout || "").split("\n").filter(Boolean)) {
    const [schema, tName, cName, cType, isNull, cDef, cComment, tComment] = line.split("\t");
    const fullTableName = schema && schema !== "public" ? `${schema}.${tName}` : tName;
    if (!tableMap.has(fullTableName)) tableMap.set(fullTableName, { rawName: tName, cols: [] });
    if (tComment) tableComments.set(fullTableName, tComment);
    const isPk = pkSet.has(`${tName}.${cName}`);
    tableMap.get(fullTableName).cols.push({
      name: cName,
      type: cType,
      nullable: isNull,
      defaultVal: cDef || "",
      pk: isPk ? "PK" : "",
      comment: cComment || ""
    });
  }

  const summaryRows = [];
  for (const [fullTableName, info] of tableMap.entries()) {
    const tComment = tableComments.get(fullTableName) || "";
    writeTableMarkdown(
      cwd,
      fullTableName,
      info.cols,
      tComment,
      now,
      fkByTable.get(info.rawName) || [],
      idxByTable.get(info.rawName) || []
    );
    summaryRows.push({
      name: fullTableName,
      count: info.cols.length,
      pk: info.cols
        .filter((c) => c.pk === "PK")
        .map((c) => c.name)
        .join(", "),
      comment: tComment
    });
  }

  const views = (viewRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, desc] = l.split("\t");
      return { name, desc: desc || "-" };
    });

  const procs = (procRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, type, desc] = l.split("\t");
      return { name, type, desc: desc || "-" };
    });

  const triggers = (trigRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, table, timing, desc] = l.split("\t");
      return { name, table, timing, desc: desc || "-" };
    });

  writeDbSchemaSummary(cwd, "postgresql", cfg.database, summaryRows, views, procs, triggers, now);
  console.log(
    `[scandb] 已完成 PostgreSQL 唯讀掃描：${summaryRows.length} 張表、${views.length} 個 View、${procs.length} 個 SP/Function、${triggers.length} 個 Trigger。`
  );
}

function scanMssql(cwd, cfg, host, port, now) {
  const server = port ? `${host},${port}` : host;
  const runSqlcmd = (sql) =>
    spawnSync(
      "sqlcmd",
      [
        "-S",
        server,
        "-d",
        cfg.database,
        "-U",
        cfg.username,
        "-P",
        cfg.password,
        "-K",
        "ReadOnly",
        "-h",
        "-1",
        "-W",
        "-s",
        "\t",
        "-Q",
        `SET NOCOUNT ON; ${sql}`
      ],
      { encoding: "utf8" }
    );

  const colRes = runSqlcmd(`
    SELECT t.name, c.name, ty.name + '(' + CAST(c.max_length AS VARCHAR(10)) + ')',
           CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END,
           ISNULL(dc.definition, ''),
           CASE WHEN ic.column_id IS NOT NULL THEN 'PK' ELSE '' END,
           ISNULL(CAST(ep.value AS NVARCHAR(500)), '')
    FROM sys.tables t
    JOIN sys.columns c ON t.object_id = c.object_id
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
    LEFT JOIN sys.indexes pk ON t.object_id = pk.object_id AND pk.is_primary_key = 1
    LEFT JOIN sys.index_columns ic ON pk.object_id = ic.object_id AND pk.index_id = ic.index_id AND c.column_id = ic.column_id
    LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
    ORDER BY t.name, c.column_id;
  `);

  if (colRes.status !== 0) {
    fail(`[scandb] SQL Server (sqlcmd) 唯讀連線失敗: ${(colRes.stderr || colRes.stdout || "").trim()}`);
    return;
  }

  const fkRes = runSqlcmd(`
    SELECT tp.name, cp.name, tr.name, cr.name, fk.name
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
    JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
    JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
    JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id;
  `);

  const viewRes = runSqlcmd(`SELECT name, 'SQL Server View' FROM sys.views ORDER BY name;`);
  const procRes = runSqlcmd(`SELECT name, type_desc, 'Stored Procedure' FROM sys.procedures ORDER BY name;`);
  const trigRes = runSqlcmd(`
    SELECT tr.name, t.name, 'AFTER/INSTEAD OF', 'SQL Server Trigger'
    FROM sys.triggers tr JOIN sys.tables t ON tr.parent_id = t.object_id;
  `);

  const fkByTable = new Map();
  for (const line of (fkRes.stdout || "").split("\n").filter(Boolean)) {
    const [tName, colName, refTable, refCol, fkName] = line.trim().split("\t");
    if (!tName) continue;
    if (!fkByTable.has(tName)) fkByTable.set(tName, []);
    fkByTable.get(tName).push({ column: colName, refTable, refColumn: refCol, rule: fkName || "FK" });
  }

  const tableMap = new Map();
  for (const line of (colRes.stdout || "").split("\n").filter(Boolean)) {
    const parts = line.trim().split("\t");
    if (parts.length < 6) continue;
    const [tName, cName, cType, isNull, cDef, cPk, cComment] = parts;
    if (!tableMap.has(tName)) tableMap.set(tName, []);
    tableMap.get(tName).push({
      name: cName,
      type: cType,
      nullable: isNull,
      defaultVal: cDef || "",
      pk: cPk || "",
      comment: cComment || ""
    });
  }

  const summaryRows = [];
  for (const [tName, cols] of tableMap.entries()) {
    writeTableMarkdown(cwd, tName, cols, "", now, fkByTable.get(tName) || [], []);
    summaryRows.push({
      name: tName,
      count: cols.length,
      pk: cols
        .filter((c) => c.pk === "PK")
        .map((c) => c.name)
        .join(", "),
      comment: ""
    });
  }

  const views = (viewRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, desc] = l.trim().split("\t");
      return { name, desc: desc || "-" };
    });
  const procs = (procRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, type, desc] = l.trim().split("\t");
      return { name, type: type || "PROCEDURE", desc: desc || "-" };
    });
  const triggers = (trigRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, table, timing, desc] = l.trim().split("\t");
      return { name, table: table || "-", timing: timing || "-", desc: desc || "-" };
    });

  writeDbSchemaSummary(cwd, "sqlserver", cfg.database, summaryRows, views, procs, triggers, now);
  console.log(
    `[scandb] 已完成 SQL Server 唯讀掃描：${summaryRows.length} 張表、${views.length} 個 View、${procs.length} 個 SP、${triggers.length} 個 Trigger。`
  );
}

function scanOracle(cwd, cfg, host, port, now) {
  const connectStr = `${cfg.username}/"${cfg.password}"@//${host}:${port || 1521}/${cfg.database}`;
  const runSqlplus = (sql) => {
    const input = `SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF LINESIZE 2000 TRIMSPOOL ON\nSET TRANSACTION READ ONLY;\n${sql}\nEXIT;\n`;
    return spawnSync("sqlplus", ["-S", connectStr], { input, encoding: "utf8" });
  };

  const colRes = runSqlplus(`
    SELECT c.TABLE_NAME || CHR(9) || c.COLUMN_NAME || CHR(9) || c.DATA_TYPE || '(' || c.DATA_LENGTH || ')' || CHR(9) ||
           c.NULLABLE || CHR(9) || NVL(cc.COMMENTS, '')
    FROM USER_TAB_COLUMNS c
    LEFT JOIN USER_COL_COMMENTS cc ON c.TABLE_NAME = cc.TABLE_NAME AND c.COLUMN_NAME = cc.COLUMN_NAME
    ORDER BY c.TABLE_NAME, c.COLUMN_ID;
  `);

  if (colRes.status !== 0 || (colRes.stdout || "").includes("ORA-")) {
    fail(`[scandb] Oracle (sqlplus) 唯讀連線失敗: ${(colRes.stderr || colRes.stdout || "").trim()}`);
    return;
  }

  const viewRes = runSqlplus(`SELECT VIEW_NAME || CHR(9) || 'Oracle View' FROM USER_VIEWS ORDER BY VIEW_NAME;`);
  const procRes = runSqlplus(
    `SELECT OBJECT_NAME || CHR(9) || OBJECT_TYPE || CHR(9) || STATUS FROM USER_OBJECTS WHERE OBJECT_TYPE IN ('PROCEDURE','FUNCTION','PACKAGE') ORDER BY OBJECT_NAME;`
  );
  const trigRes = runSqlplus(
    `SELECT TRIGGER_NAME || CHR(9) || TABLE_NAME || CHR(9) || TRIGGER_TYPE || CHR(9) || TRIGGERING_EVENT FROM USER_TRIGGERS ORDER BY TRIGGER_NAME;`
  );

  const tableMap = new Map();
  for (const line of (colRes.stdout || "").split("\n").filter(Boolean)) {
    const parts = line.trim().split("\t");
    if (parts.length < 4) continue;
    const [tName, cName, cType, isNull, cComment] = parts;
    if (!tableMap.has(tName)) tableMap.set(tName, []);
    tableMap.get(tName).push({
      name: cName,
      type: cType,
      nullable: isNull === "N" ? "NO" : "YES",
      defaultVal: "",
      pk: "",
      comment: cComment || ""
    });
  }

  const summaryRows = [];
  for (const [tName, cols] of tableMap.entries()) {
    writeTableMarkdown(cwd, tName, cols, "", now, [], []);
    summaryRows.push({ name: tName, count: cols.length, pk: "-", comment: "" });
  }

  const views = (viewRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, desc] = l.trim().split("\t");
      return { name, desc: desc || "-" };
    });
  const procs = (procRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, type, desc] = l.trim().split("\t");
      return { name, type: type || "PROCEDURE", desc: desc || "-" };
    });
  const triggers = (trigRes.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, table, timing, desc] = l.trim().split("\t");
      return { name, table: table || "-", timing: timing || "-", desc: desc || "-" };
    });

  writeDbSchemaSummary(cwd, "oracle", cfg.database, summaryRows, views, procs, triggers, now);
  console.log(
    `[scandb] 已完成 Oracle 唯讀掃描：${summaryRows.length} 張表、${views.length} 個 View、${procs.length} 個 SP/Package、${triggers.length} 個 Trigger。`
  );
}

function writeTableMarkdown(cwd, tableName, cols, tableComment, now, foreignKeys = [], indexes = []) {
  const safeFileName = tableName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const filePath = path.join(cwd, "project", "system", "db", `${safeFileName}.md`);
  const rows = cols
    .map(
      (c) =>
        `| \`${c.name}\` | \`${c.type}\` | ${c.nullable} | \`${c.defaultVal}\` | ${c.pk || "-"} | ${c.comment || "-"} |`
    )
    .join("\n");

  const fkRows =
    foreignKeys.length > 0
      ? foreignKeys
          .map((fk) => `| \`${fk.column}\` | \`${fk.refTable}\` | \`${fk.refColumn}\` | ${fk.rule || "-"} |`)
          .join("\n")
      : "| 無外鍵 | - | - | - |";

  const idxRows =
    indexes.length > 0
      ? indexes.map((idx) => `| \`${idx.name}\` | ${idx.unique} | \`${idx.columns}\` |`).join("\n")
      : "| 無額外索引 | - | - |";

  const content = `# 資料表結構：\`${tableName}\`

- **掃描時間 (\`scandb\`)**：\`${now}\`
- **資料表說明 / 註解**：${tableComment || "無註解"}

## 1. 欄位清單 (Columns)

| 欄位名稱 | 資料型態 | 允許 Null | 預設值 | 鍵值 (PK/FK/Idx) | 欄位註解 (Comment) |
|---|---|---|---|---|---|
${rows}

## 2. 外鍵關聯 (Foreign Keys)

| 本表欄位 | 參照資料表 | 參照欄位 | 規則 / 說明 |
|---|---|---|---|
${fkRows}

## 3. 索引清單 (Indexes)

| 索引名稱 | 類型 | 涵蓋欄位 / 定義 |
|---|---|---|
${idxRows}
`;
  fs.writeFileSync(filePath, content, "utf8");
}

function writeDbSchemaSummary(cwd, product, dbName, tables, views, procedures, triggers, now) {
  const schemaPath = path.join(cwd, "project", "system", "db-schema.md");
  const tableLines =
    tables.length > 0
      ? tables
          .map((t) => {
            const safeFileName = t.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
            return `| \`${t.name}\` | ${t.count} | ${t.pk || "-"} | ${t.comment || "-"} | [db/${safeFileName}.md](./db/${safeFileName}.md) |`;
          })
          .join("\n")
      : "| 無資料表 | - | - | - | - |";

  const viewLines =
    views.length > 0 ? views.map((v) => `| \`${v.name}\` | ${v.desc || "-"} |`).join("\n") : "| 無 | - |";

  const procLines =
    procedures.length > 0
      ? procedures.map((p) => `| \`${p.name}\` | ${p.type || "-"} | ${p.desc || "-"} |`).join("\n")
      : "| 無 | - | - |";

  const triggerLines =
    triggers.length > 0
      ? triggers.map((tr) => `| \`${tr.name}\` | \`${tr.table}\` | ${tr.timing} | ${tr.desc || "-"} |`).join("\n")
      : "| 無 | - | - | - |";

  const content = `# 資料庫結構總覽索引 (Database Schema Inventory)

- **最近掃描時間 (\`scandb\`)**：\`${now}\`
- **資料庫產品 (DB Product)**：\`${product}\`
- **資料庫名稱 / Schema**：\`${dbName}\`

---

## 1. 資料表清單 (Tables — 共 ${tables.length} 張表)

| 資料表名稱 | 欄位數 | 主鍵 (PK) | 說明 / 註解 (Comment) | 欄位明細檔案 |
|---|---|---|---|---|
${tableLines}

---

## 2. 檢視表清單 (Views — 共 ${views.length} 個)

| View 名稱 | 說明 / 定義摘要 |
|---|---|
${viewLines}

---

## 3. 預存程序與函數 (Stored Procedures & Functions — 共 ${procedures.length} 個)

| 名稱 | 類型 | 參數與邏輯摘要 |
|---|---|---|
${procLines}

---

## 4. 資料庫觸發器 (Triggers — 共 ${triggers.length} 個)

| Trigger 名稱 | 綁定資料表 | 觸發時機 | 觸發邏輯說明 |
|---|---|---|---|
${triggerLines}
`;
  fs.writeFileSync(schemaPath, content, "utf8");
}

module.exports = {
  parseDbConnectionConfig,
  scanDatabase,
  runReadOnlySchemaScan,
  writeTableMarkdown,
  writeDbSchemaSummary
};
