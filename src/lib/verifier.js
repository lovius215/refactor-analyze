const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  normalizeItemId,
  getTargetSystemPathFromOverview,
  getOption,
  fail
} = require("./utils");

const CITATION_REGEX = /`([^`\n]+?\.[a-zA-Z0-9]{1,10})#L(\d+)(?:-(?:L)?(\d+))?`/g;
const DB_REF_REGEX = /(?:project\/system\/)?db\/([a-zA-Z0-9_.-]+\.md)/g;

function extractCitationsFromText(text, docName) {
  const citations = [];
  const nonBlockquoteText = text
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n");
  let match;
  CITATION_REGEX.lastIndex = 0;
  while ((match = CITATION_REGEX.exec(nonBlockquoteText)) !== null) {
    const filePath = match[1].trim();
    if (
      filePath.includes("{{") ||
      filePath.startsWith("path/to/") ||
      filePath === "src/service/OrderService.java" ||
      filePath === "src/views/OrderForm.vue" ||
      filePath === "OrderEditForm.cs" ||
      filePath === "order_edit.jsp"
    ) {
      continue;
    }
    const startLine = parseInt(match[2], 10);
    const endLine = match[3] ? parseInt(match[3], 10) : startLine;
    citations.push({
      docName,
      raw: match[0],
      filePath,
      startLine,
      endLine
    });
  }
  return citations;
}

function getFileLineCount(targetDir, relFilePath, recordedCommitHash) {
  const absPath = path.resolve(targetDir, relFilePath);
  if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
    const content = fs.readFileSync(absPath, "utf8");
    return { exists: true, source: "worktree", lines: content.split("\n").length };
  }

  if (recordedCommitHash && /^[0-9a-f]{7,40}$/i.test(recordedCommitHash)) {
    const cleanRel = relFilePath.replace(/\\/g, "/").replace(/^\.\//, "");
    const gitShow = spawnSync("git", ["show", `${recordedCommitHash}:${cleanRel}`], {
      cwd: targetDir,
      encoding: "utf8"
    });
    if (gitShow.status === 0 && gitShow.stdout != null) {
      return { exists: true, source: `git:${recordedCommitHash}`, lines: gitShow.stdout.split("\n").length };
    }
  }

  return { exists: false, source: null, lines: 0 };
}

function verifySingleItem(cwd, rawId, targetPathOverride = null) {
  const itemId = normalizeItemId(rawId);
  const itemDir = path.join(cwd, "project", itemId);
  if (!fs.existsSync(itemDir)) {
    return {
      itemId,
      valid: false,
      errors: [`找不到編號資料夾 project/${itemId}`],
      warnings: [],
      driftedFiles: [],
      citationCount: 0
    };
  }

  const targetDir = targetPathOverride
    ? path.resolve(cwd, targetPathOverride)
    : getTargetSystemPathFromOverview(cwd);
  const hasValidTargetDir = Boolean(targetDir && fs.existsSync(targetDir));

  const coreDocs = [
    "analysis.md",
    "business-logic.md",
    "ui-behavior.md",
    "data-flow.md",
    "sql.md",
    "dependencies.md",
    "dead-code.md"
  ];

  const errors = [];
  const warnings = [];
  const allCitations = [];
  const dbRefs = new Set();

  let recordedCommitHash = null;
  const analysisPath = path.join(itemDir, "analysis.md");
  if (fs.existsSync(analysisPath)) {
    const analysisText = fs.readFileSync(analysisPath, "utf8");
    const commitMatch = analysisText.match(
      /(?:Commit Hash|Git 版本)[^`]*`([0-9a-f]{7,40})/i
    );
    if (commitMatch) {
      recordedCommitHash = commitMatch[1].trim();
    }
  }

  for (const docName of coreDocs) {
    const docPath = path.join(itemDir, docName);
    if (!fs.existsSync(docPath)) {
      errors.push(`[${docName}] 缺少必要分析文件`);
      continue;
    }

    const content = fs.readFileSync(docPath, "utf8");
    if (content.includes("*(待 AI 分析填寫)*") || content.includes("{{ITEM_")) {
      errors.push(`[${docName}] 仍包含尚未填寫的模板佔位符 *(待 AI 分析填寫)*`);
    }

    const docCitations = extractCitationsFromText(content, docName);
    allCitations.push(...docCitations);

    if (docName === "business-logic.md" && docCitations.length === 0) {
      errors.push(
        `[business-logic.md] 未偵測到任何原始碼檔案與行號引用（格式如 \`src/Foo.java#L10-L25\`），違反禁止 AI 幻想鐵律`
      );
    }

    let dbMatch;
    DB_REF_REGEX.lastIndex = 0;
    while ((dbMatch = DB_REF_REGEX.exec(content)) !== null) {
      const refFile = dbMatch[1];
      if (!refFile.includes("<table>")) {
        dbRefs.add(refFile);
      }
    }
  }

  // Verify citations against actual target codebase
  if (hasValidTargetDir) {
    for (const cite of allCitations) {
      const fileCheck = getFileLineCount(targetDir, cite.filePath, recordedCommitHash);
      if (!fileCheck.exists) {
        errors.push(
          `[${cite.docName}] 找不到引用的原始碼檔案 ${cite.raw}（於目標路徑 ${targetDir} 中不存在，疑似幻覺路徑）`
        );
        continue;
      }
      if (cite.startLine < 1 || cite.endLine < cite.startLine || cite.endLine > fileCheck.lines) {
        errors.push(
          `[${cite.docName}] 引用行號超出範圍 ${cite.raw}（檔案實際總行數為 ${fileCheck.lines} 行）`
        );
      }
    }
  } else if (allCitations.length > 0) {
    warnings.push(
      `尚未設定有效的目標系統路徑，僅完成語法格式檢查（共 ${allCitations.length} 處引用），未驗證目標檔案實體行數`
    );
  }

  // Verify DB schema references if project/system/db has scanned tables
  const dbDir = path.join(cwd, "project", "system", "db");
  if (fs.existsSync(dbDir)) {
    const existingDbFiles = fs.readdirSync(dbDir).filter((f) => f.endsWith(".md"));
    if (existingDbFiles.length > 0) {
      for (const refFile of dbRefs) {
        if (!fs.existsSync(path.join(dbDir, refFile))) {
          errors.push(`[DB 引用] 引用的資料表結構檔 project/system/db/${refFile} 不存在`);
        }
      }
    }
  }

  // Git Commit Drift Detection (偵測目標系統改版導致行號飄移)
  const driftedFiles = [];
  if (hasValidTargetDir && recordedCommitHash) {
    const headRes = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: targetDir,
      encoding: "utf8"
    });
    if (headRes.status === 0) {
      const currentHead = headRes.stdout.trim();
      if (
        currentHead &&
        !currentHead.startsWith(recordedCommitHash) &&
        !recordedCommitHash.startsWith(currentHead)
      ) {
        const diffRes = spawnSync(
          "git",
          ["diff", "--name-only", `${recordedCommitHash}..HEAD`],
          { cwd: targetDir, encoding: "utf8" }
        );
        if (diffRes.status === 0 && diffRes.stdout) {
          const changedSet = new Set(
            diffRes.stdout
              .split("\n")
              .map((l) => l.trim().replace(/\\/g, "/"))
              .filter(Boolean)
          );
          const citedFiles = Array.from(
            new Set(allCitations.map((c) => c.filePath.replace(/\\/g, "/").replace(/^\.\//, "")))
          );
          for (const cf of citedFiles) {
            if (changedSet.has(cf)) {
              driftedFiles.push(cf);
            }
          }
          if (driftedFiles.length > 0) {
            warnings.push(
              `[版本飄移警告] 目標系統已從 ${recordedCommitHash} 更新至 ${currentHead}，且本編號引用的 ${driftedFiles.length} 個檔案已變更 (${driftedFiles.join(", ")})，行號可能已偏移，建議執行 reanalyze ${itemId}`
            );
          }
        }
      }
    }
  }

  return {
    itemId,
    valid: errors.length === 0,
    errors,
    warnings,
    driftedFiles,
    citationCount: allCitations.length
  };
}

function verifyCommand(cwd, args = []) {
  const targetOverride = getOption(args, "--target");
  const rawId = args.find((a) => !a.startsWith("-") && a !== targetOverride);

  const projectDir = path.join(cwd, "project");
  if (!fs.existsSync(projectDir)) {
    fail("找不到 project/ 目錄，請先執行 refactor-analyze init。");
    return;
  }

  let itemIds = [];
  if (rawId) {
    itemIds = [normalizeItemId(rawId)];
  } else {
    itemIds = fs
      .readdirSync(projectDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
      .map((e) => e.name)
      .sort();
  }

  if (itemIds.length === 0) {
    console.log("refactor-analyze verify");
    console.log("目前尚無已建立的 project/<編號>/ 資料夾可驗證。");
    return;
  }

  console.log("refactor-analyze verify (0-Token 來源引用與防幻覺驗證)");
  let hasError = false;

  for (const id of itemIds) {
    const res = verifySingleItem(cwd, id, targetOverride);
    if (res.valid) {
      console.log(`PASS [${id}] 驗證通過（共核對 ${res.citationCount} 處原始碼行號引用）`);
    } else {
      hasError = true;
      console.log(`FAIL [${id}] 發現 ${res.errors.length} 項來源引用或完整性問題：`);
      for (const err of res.errors) {
        console.log(`  ❌ ${err}`);
      }
    }
    for (const warn of res.warnings) {
      console.log(`  ⚠️  ${warn}`);
    }
  }

  if (hasError) {
    process.exitCode = 1;
  }
}

module.exports = {
  verifySingleItem,
  verifyCommand,
  extractCitationsFromText
};
