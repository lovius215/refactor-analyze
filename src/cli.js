const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  rootDir,
  templatesDir,
  SUPPORTED_LANGS,
  ensureGitIgnore,
  ensureGitRepository,
  inspectTargetSystem,
  calculateFileComplexity,
  getTargetSystemPathFromOverview,
  normalizeItemId,
  parseIndexItems,
  updateIndexRowStatus,
  detectProjectLanguage,
  getDefaultRemote,
  getCurrentBranch,
  formatLocalDateTime,
  ensureDir,
  ensureFileFromTemplate,
  updateFileFromTemplate,
  listFilesRecursive,
  getOption,
  printResultList,
  fail
} = require("./lib/utils");

const { scanDatabase } = require("./lib/db-scanner");
const { verifySingleItem, verifyCommand } = require("./lib/verifier");
const { exportMarkdownToPdf } = require("./lib/pdf-exporter");

const cwd = process.cwd();

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init":
      initProject(args.slice(1));
      return;
    case "scandb":
      scanDatabase(cwd);
      return;
    case "analyze":
      analyzeItem(args.slice(1), false);
      return;
    case "reanalyze":
      analyzeItem(args.slice(1), true);
      return;
    case "verify":
      verifyCommand(cwd, args.slice(1));
      return;
    case "commit":
      commitItem(args.slice(1));
      return;
    case "upgrade":
    case "update":
      upgradeProject(args.slice(1));
      return;
    case "pdf":
    case "md2pdf":
    case "export-pdf":
      exportMarkdownToPdf(cwd, args.slice(1));
      return;
    case "status":
      showStatus();
      return;
    case "check":
      runCheck();
      return;
    case "doctor":
      runDoctor();
      return;
    case "version":
    case "--version":
    case "-v":
      showVersion();
      return;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      showHelp();
      return;
    default:
      fail(`Unknown command: ${command}`);
  }
}

function initProject(args = []) {
  const includeRules = args.includes("--full");
  const langArg = getOption(args, "--lang");
  const targetArg = getOption(args, "--target") || args.find((a) => !a.startsWith("-"));

  let langConfig = SUPPORTED_LANGS["zh-tw"];
  if (langArg) {
    const key = langArg.toLowerCase();
    if (SUPPORTED_LANGS[key]) {
      langConfig = SUPPORTED_LANGS[key];
    } else {
      console.log(`警告: 不支援的語言代碼 "${langArg}"，支援語系: zh-TW, zh-CN, en, ja, ko。已預設使用繁體中文。`);
    }
  }

  const now = formatLocalDateTime(new Date());
  const targetInfo = inspectTargetSystem(cwd, targetArg);

  const replacements = {
    LANG_LABEL: langConfig.label,
    LANG_CODE: langConfig.code,
    TARGET_PATH: targetInfo.targetPath || "待設定（請於 refactor:init / rai 指定目標系統路徑）",
    GIT_BRANCH: targetInfo.gitBranch,
    GIT_COMMIT: targetInfo.gitCommit,
    GIT_STATUS: targetInfo.gitStatus,
    ANALYSIS_TIME: now,
    SYSTEM_TYPE: targetInfo.systemType
  };

  const results = [
    ensureGitIgnore(cwd),
    ensureGitRepository(cwd),
    ensureDir(cwd, "skills"),
    ensureDir(cwd, path.join("skills", "refactor-analyze")),
    ensureDir(cwd, "project"),
    ensureDir(cwd, path.join("project", "system")),
    ensureDir(cwd, path.join("project", "system", "db")),
    ensureDir(cwd, path.join("project", "shared")),
    ensureFileFromTemplate(cwd, "AGENTS.md", "AGENTS.md", replacements),
    ensureFileFromTemplate(cwd, "readme.md", "readme.md", replacements),
    ensureFileFromTemplate(
      cwd,
      path.join("skills", "refactor-analyze", "SKILL.md"),
      path.join("skills", "refactor-analyze", "SKILL.md"),
      replacements
    ),
    ensureFileFromTemplate(cwd, path.join("project", "index.md"), path.join("project", "index.md"), replacements),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "system", "db-connection.md"),
      path.join("project", "system", "db-connection.md"),
      replacements
    ),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "system", "overview.md"),
      path.join("project", "system", "overview.md"),
      replacements
    ),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "system", "tech-stack.md"),
      path.join("project", "system", "tech-stack.md"),
      replacements
    ),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "system", "architecture.md"),
      path.join("project", "system", "architecture.md"),
      replacements
    ),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "system", "domain-flows.md"),
      path.join("project", "system", "domain-flows.md"),
      replacements
    ),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "system", "dead-code.md"),
      path.join("project", "system", "dead-code.md"),
      replacements
    ),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "system", "db-schema.md"),
      path.join("project", "system", "db-schema.md"),
      replacements
    ),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "shared", "README.md"),
      path.join("project", "shared", "README.md"),
      replacements
    )
  ];

  if (includeRules) {
    results.push(ensureDir(cwd, "rules"));
    for (const file of listFilesRecursive(path.join(templatesDir, "rules"))) {
      const relativePath = path.relative(templatesDir, file);
      results.push(ensureFileFromTemplate(cwd, relativePath, relativePath, replacements));
    }
  }

  printResultList("init", results);
  console.log(`\n專案主要語言已設定為: ${langConfig.label}`);
  if (targetInfo.targetPath) {
    console.log(`已連結目標系統路徑: ${targetInfo.targetPath}`);
    console.log(`目標系統初步型態判定: ${targetInfo.systemType}`);
    console.log(`目標系統 Git 分支/版本: ${targetInfo.gitBranch} @ ${targetInfo.gitCommit}`);
    if (targetInfo.hasRemote) {
      console.log(
        `提示: 偵測到目標系統設有 Git remote (${targetInfo.remoteName})，請確認是否需要先向 remote 對齊 (git fetch / git pull)。`
      );
    }
  } else {
    console.log(
      `提示: 接下來可在 AI 對話框輸入 "refactor:init" (或簡寫 "rai")，由 AI 詢問目標系統路徑並產出系統大概與分類編號清單。`
    );
  }
}

function analyzeItem(args = [], isReanalyze = false) {
  const rawId = args.find((a) => !a.startsWith("-")) || getOption(args, "--id");
  const label = isReanalyze ? "reanalyze" : "analyze";
  if (!rawId) {
    fail(`Usage: refactor-analyze ${label} <編號> [--target <path>]`);
    return;
  }

  const itemId = normalizeItemId(rawId);
  const indexItems = parseIndexItems(cwd);
  const matched = indexItems.find((item) => item.id === itemId || item.rawId === rawId);

  const targetPathArg = getOption(args, "--target") || getTargetSystemPathFromOverview(cwd);
  const targetInfo = inspectTargetSystem(cwd, targetPathArg);
  const now = formatLocalDateTime(new Date());

  const itemName = matched ? matched.name : `編號 ${itemId} 業務功能`;
  const itemCategory = matched ? matched.category : "其他 (Other)";
  const itemLocation = matched ? matched.location : "待從 project/index.md 確認";

  let complexityInfo = {
    level: matched && matched.complexity ? matched.complexity : "待評估",
    metrics: "待計算"
  };

  if (targetInfo.targetPath && itemLocation && !itemLocation.includes("待")) {
    const cleanFileRel = itemLocation.split("#")[0].trim();
    const absCodeFile = path.resolve(targetInfo.targetPath, cleanFileRel);
    const calc = calculateFileComplexity(absCodeFile);
    if (calc.level !== "待評估") {
      complexityInfo = calc;
    }
  }

  const itemRelDir = path.join("project", itemId);
  const itemAbsDir = path.join(cwd, itemRelDir);

  if (isReanalyze) {
    if (!fs.existsSync(itemAbsDir)) {
      fail(`找不到編號資料夾 ${itemRelDir}，請先執行: refactor-analyze analyze ${itemId}`);
      return;
    }

    const updatedFiles = refreshItemMetadata(itemRelDir, {
      ANALYSIS_TIME: now,
      GIT_BRANCH: targetInfo.gitBranch,
      GIT_COMMIT: targetInfo.gitCommit,
      GIT_STATUS: targetInfo.gitStatus
    });

    updateIndexRowStatus(cwd, itemId, complexityInfo.level, "分析中 (Reanalyzing)");
    printResultList("reanalyze", updatedFiles);
    console.log(
      `\n[Reanalyze] 已更新 ${itemRelDir} 的執行時間 (${now}) 與目標 Git 基準 (${targetInfo.gitBranch} @ ${targetInfo.gitCommit})。`
    );
    console.log(`請在 AI 對話框輸入 "refactor:reanalyze ${itemId}" (或 "rar ${itemId}") 結合 backlog.md 補充說明再分析一次。`);
    return;
  }

  const replacements = {
    ITEM_ID: itemId,
    ITEM_NAME: itemName,
    ITEM_CATEGORY: itemCategory,
    ITEM_LOCATION: itemLocation,
    ANALYSIS_TIME: now,
    GIT_BRANCH: targetInfo.gitBranch,
    GIT_COMMIT: targetInfo.gitCommit,
    GIT_STATUS: targetInfo.gitStatus,
    ITEM_COMPLEXITY: complexityInfo.level,
    COMPLEXITY_METRICS: complexityInfo.metrics,
    ITEM_STATUS: "分析中"
  };

  const results = [
    ensureDir(cwd, itemRelDir),
    ensureFileFromTemplate(cwd, path.join("project", "item", "analysis.md"), path.join(itemRelDir, "analysis.md"), replacements),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "item", "business-logic.md"),
      path.join(itemRelDir, "business-logic.md"),
      replacements
    ),
    ensureFileFromTemplate(cwd, path.join("project", "item", "data-flow.md"), path.join(itemRelDir, "data-flow.md"), replacements),
    ensureFileFromTemplate(cwd, path.join("project", "item", "sql.md"), path.join(itemRelDir, "sql.md"), replacements),
    ensureFileFromTemplate(
      cwd,
      path.join("project", "item", "dependencies.md"),
      path.join(itemRelDir, "dependencies.md"),
      replacements
    ),
    ensureFileFromTemplate(cwd, path.join("project", "item", "dead-code.md"), path.join(itemRelDir, "dead-code.md"), replacements),
    ensureFileFromTemplate(cwd, path.join("project", "item", "backlog.md"), path.join(itemRelDir, "backlog.md"), replacements)
  ];

  updateIndexRowStatus(cwd, itemId, complexityInfo.level, "分析中");
  printResultList("analyze", results);
  console.log(`\n已建立獨立業務邏輯資料夾: ${itemRelDir}/（含自動產出的 backlog.md、sql.md、dead-code.md）`);
  console.log(`分析時間: ${now} | 目標 Git: ${targetInfo.gitBranch} @ ${targetInfo.gitCommit}`);
  console.log(`接下來可在 AI 對話框輸入 "refactor:analyze ${itemId}" (或 "raa ${itemId}") 進行深度分析。`);
}

function refreshItemMetadata(itemRelDir, meta) {
  const itemAbsDir = path.join(cwd, itemRelDir);
  const files = listFilesRecursive(itemAbsDir);
  const results = [];

  for (const filePath of files) {
    if (!filePath.endsWith(".md")) continue;
    let content = fs.readFileSync(filePath, "utf8");
    content = content.replace(/(執行分析的時間日期\*\*：`)[^`]+(`)/g, `$1${meta.ANALYSIS_TIME}$2`);
    if (meta.GIT_BRANCH && meta.GIT_BRANCH !== "待確認") {
      content = content.replace(/(目標系統 Git 分支 \(Branch\)\*\*：`)[^`]+(`)/g, `$1${meta.GIT_BRANCH}$2`);
    }
    if (meta.GIT_COMMIT && meta.GIT_COMMIT !== "待確認") {
      content = content.replace(
        /(目標系統 Git (?:版本 \(Commit Hash \/ Tag\)|Commit Hash)\*\*：`)[^`]+(`)/g,
        `$1${meta.GIT_COMMIT}$2`
      );
    }
    fs.writeFileSync(filePath, content, "utf8");
    results.push({ action: "update", target: path.relative(cwd, filePath) });
  }
  return results;
}

function commitItem(args = []) {
  const forceCommit = args.includes("--force");
  const rawId = args.find((a) => !a.startsWith("-")) || getOption(args, "--id");
  const itemId = rawId ? normalizeItemId(rawId) : null;

  ensureGitIgnore(cwd);

  if (itemId) {
    const itemDir = path.join(cwd, "project", itemId);
    if (!fs.existsSync(itemDir)) {
      fail(`找不到編號資料夾 project/${itemId}，請確認編號是否正確。`);
      return;
    }

    // 執行 0-Token 來源引用與完整性驗證
    const verifyRes = verifySingleItem(cwd, itemId);
    if (!verifyRes.valid) {
      console.warn(`[Verify 警告] 編號 ${itemId} 尚有 ${verifyRes.errors.length} 項來源引用或未完成項目：`);
      for (const err of verifyRes.errors) {
        console.warn(`  - ${err}`);
      }
    }
    for (const warn of verifyRes.warnings) {
      console.warn(`[Verify 提示] ${warn}`);
    }

    const backlogPath = path.join(itemDir, "backlog.md");
    const analysisPath = path.join(itemDir, "analysis.md");
    let finalStatus = "已完成";
    let finalComplexity = null;

    if (!verifyRes.valid && !forceCommit) {
      finalStatus = "待確認 (需補齊來源引用)";
    } else if (fs.existsSync(backlogPath)) {
      const backlogContent = fs.readFileSync(backlogPath, "utf8");
      const pendingLines = backlogContent
        .split("\n")
        .filter((l) => l.startsWith("|") && l.includes("待確認") && !l.includes("待分析"));
      if (pendingLines.length > 0) {
        finalStatus = "待確認 (Backlog)";
      }
    }

    if (fs.existsSync(analysisPath)) {
      let analysisContent = fs.readFileSync(analysisPath, "utf8");
      const compMatch = analysisContent.match(/-\s*\*\*複雜度等級\*\*：`([^`]+)`/);
      if (compMatch && compMatch[1]) {
        finalComplexity = compMatch[1].trim();
      }
      analysisContent = analysisContent.replace(/(-\s*\*\*目前的狀態\*\*：`)[^`]+(`)/, `$1${finalStatus}$2`);
      fs.writeFileSync(analysisPath, analysisContent, "utf8");
    }

    updateIndexRowStatus(cwd, itemId, finalComplexity, finalStatus);
    console.log(`[Commit] 已更新 project/index.md 中編號 ${itemId} 的狀態為: ${finalStatus}`);
  } else {
    console.log(`[Commit] 準備提交目前工作區分析結果...`);
  }

  // 安全防護：確保 db-connection.md 絕不被加入 Git commit
  spawnSync("git", ["reset", "HEAD", "project/system/db-connection.md"], { cwd, encoding: "utf8" });

  const candidatePaths = ["project", "AGENTS.md", "skills", "rules", ".gitignore", "readme.md"].filter((p) =>
    fs.existsSync(path.join(cwd, p))
  );
  if (candidatePaths.length > 0) {
    spawnSync("git", ["add", ...candidatePaths], {
      cwd,
      encoding: "utf8"
    });
  }
  spawnSync("git", ["reset", "HEAD", "project/system/db-connection.md"], { cwd, encoding: "utf8" });

  const commitMsg = itemId
    ? `docs(${itemId}): 確認編號 ${itemId} 重構分析並更新 index.md 狀態`
    : `docs(project): 更新重構分析文件與 index.md 狀態`;

  const commitRes = spawnSync("git", ["commit", "-m", commitMsg], { cwd, encoding: "utf8" });
  if (commitRes.status === 0) {
    console.log(`[Git] 已建立本機 commit: ${commitMsg}`);
  } else {
    const out = (commitRes.stdout || commitRes.stderr || "").trim();
    if (out.includes("nothing to commit")) {
      console.log(`[Git] 本機目前無新增變更需 commit。`);
    } else {
      console.log(`[Git] Commit 訊息: ${out}`);
    }
  }

  const remote = getDefaultRemote(cwd);
  const currentBranch = getCurrentBranch(cwd);
  if (remote && currentBranch) {
    syncWithRemoteSafely(remote, currentBranch);
  }
}

function syncWithRemoteSafely(remote, branch) {
  console.log(`[Git Sync] 偵測到遠端 (${remote})，正在同步分支 ${branch}...`);
  spawnSync("git", ["fetch", remote], { cwd, encoding: "utf8" });

  const pullRes = spawnSync("git", ["pull", "--no-rebase", "--no-edit", remote, branch], { cwd, encoding: "utf8" });
  if (pullRes.status !== 0) {
    const pullOutput = `${pullRes.stdout || ""}\n${pullRes.stderr || ""}`;
    const diffRes = spawnSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd, encoding: "utf8" });
    const conflictedFiles = (diffRes.stdout || "")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    if (
      conflictedFiles.length > 0 ||
      pullOutput.includes("CONFLICT") ||
      pullOutput.includes("Automatic merge failed")
    ) {
      console.error(`[Git 衝突停止] 與遠端 ${remote}/${branch} 同步時偵測到合併衝突，為防止破壞分析文件，CLI 已安全中止自動合併！`);
      if (conflictedFiles.length > 0) {
        console.error(`發生衝突的檔案清單：`);
        for (const cf of conflictedFiles) {
          console.error(`  - ${cf}`);
        }
      }
      console.error(
        `請在 AI 對話框輸入 "refactor:commit" ("rac") 由 AI 進行語意解析合併，或手動解決衝突標記 (<<<<<<< / ======= / >>>>>>>) 後再次執行 refactor-analyze commit。`
      );
      process.exitCode = 1;
      return;
    }
  }

  const pushRes = spawnSync("git", ["push", "-u", remote, branch], { cwd, encoding: "utf8" });
  if (pushRes.status === 0) {
    console.log(`[Git Sync] 已成功將變更同步推送至 ${remote}/${branch}！`);
  } else {
    console.warn(`[Git 警告] 推送至 ${remote}/${branch} 失敗: ${(pushRes.stderr || pushRes.stdout || "").trim()}`);
  }
}

function upgradeProject(args = []) {
  const dryRun = args.includes("--dry-run");
  const langConfig = detectProjectLanguage(cwd);
  console.log(`專案目前語言: ${langConfig.label}（依現有語言升級，不變更設定）`);

  const now = formatLocalDateTime(new Date());
  const replacements = {
    LANG_LABEL: langConfig.label,
    LANG_CODE: langConfig.code,
    TARGET_PATH: getTargetSystemPathFromOverview(cwd) || "待確認",
    GIT_BRANCH: "待確認",
    GIT_COMMIT: "待確認",
    GIT_STATUS: "待確認",
    ANALYSIS_TIME: now,
    SYSTEM_TYPE: "待確認"
  };

  const results = [];
  if (!dryRun) {
    results.push(ensureGitIgnore(cwd));
    results.push(ensureDir(cwd, "skills"));
    results.push(ensureDir(cwd, path.join("skills", "refactor-analyze")));
    results.push(ensureDir(cwd, path.join("project", "system")));
    results.push(ensureDir(cwd, path.join("project", "system", "db")));
    results.push(ensureDir(cwd, path.join("project", "shared")));
  }

  results.push(updateFileFromTemplate(cwd, "AGENTS.md", "AGENTS.md", dryRun));
  results.push(
    updateFileFromTemplate(
      cwd,
      path.join("skills", "refactor-analyze", "SKILL.md"),
      path.join("skills", "refactor-analyze", "SKILL.md"),
      dryRun
    )
  );

  const rulesTargetDir = path.join(cwd, "rules");
  if (fs.existsSync(rulesTargetDir)) {
    const templateRulesDir = path.join(templatesDir, "rules");
    for (const file of listFilesRecursive(templateRulesDir)) {
      const relativePath = path.relative(templatesDir, file);
      results.push(updateFileFromTemplate(cwd, relativePath, relativePath, dryRun));
    }
  }

  const systemTemplates = [
    path.join("project", "system", "db-connection.md"),
    path.join("project", "system", "overview.md"),
    path.join("project", "system", "tech-stack.md"),
    path.join("project", "system", "architecture.md"),
    path.join("project", "system", "domain-flows.md"),
    path.join("project", "system", "dead-code.md"),
    path.join("project", "system", "db-schema.md"),
    path.join("project", "shared", "README.md")
  ];

  for (const relPath of systemTemplates) {
    if (!fs.existsSync(path.join(cwd, relPath))) {
      if (!dryRun) {
        ensureFileFromTemplate(cwd, relPath, relPath, replacements);
      }
      results.push({ action: "create", target: relPath, message: "補齊新版系統模板檔案" });
    }
  }

  const projectDir = path.join(cwd, "project");
  if (fs.existsSync(projectDir)) {
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    const itemFiles = [
      "analysis.md",
      "business-logic.md",
      "data-flow.md",
      "sql.md",
      "dependencies.md",
      "dead-code.md",
      "backlog.md"
    ];
    for (const entry of entries) {
      if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
        for (const fName of itemFiles) {
          const targetRel = path.join("project", entry.name, fName);
          if (!fs.existsSync(path.join(cwd, targetRel))) {
            if (!dryRun) {
              ensureFileFromTemplate(cwd, path.join("project", "item", fName), targetRel, {
                ITEM_ID: entry.name,
                ITEM_NAME: `編號 ${entry.name}`,
                ITEM_CATEGORY: "待確認",
                ITEM_LOCATION: "待確認",
                ANALYSIS_TIME: now,
                GIT_BRANCH: "待確認",
                GIT_COMMIT: "待確認",
                GIT_STATUS: "待確認",
                ITEM_COMPLEXITY: "待評估",
                COMPLEXITY_METRICS: "待評估",
                ITEM_STATUS: "待確認"
              });
            }
            results.push({ action: "create", target: targetRel, message: "為既有編號資料夾補齊新版文件" });
          }
        }
      }
    }
  }

  printResultList(dryRun ? "upgrade (dry-run)" : "upgrade", results);
}

function runDoctor() {
  return checkRequiredPaths("refactor-analyze doctor");
}

function checkRequiredPaths(heading) {
  const requiredPaths = [
    ".gitignore",
    "AGENTS.md",
    path.join("skills", "refactor-analyze", "SKILL.md"),
    path.join("project", "index.md"),
    path.join("project", "system", "db-connection.md"),
    path.join("project", "system", "overview.md"),
    path.join("project", "system", "tech-stack.md"),
    path.join("project", "system", "architecture.md"),
    path.join("project", "system", "domain-flows.md"),
    path.join("project", "system", "dead-code.md"),
    path.join("project", "system", "db-schema.md")
  ];

  let hasMissing = false;
  if (heading) {
    console.log(heading);
  }

  for (const relativePath of requiredPaths) {
    const exists = fs.existsSync(path.join(cwd, relativePath));
    console.log(`${exists ? "OK" : "MISSING"} ${relativePath}`);
    if (!exists) {
      hasMissing = true;
    }
  }

  if (hasMissing) {
    process.exitCode = 1;
  }

  return !hasMissing;
}

function runCheck() {
  console.log("refactor-analyze check");
  if (!checkRequiredPaths(null)) {
    return;
  }
  console.log("");
  showStatus(false);
}

function showStatus(showHeading = true) {
  if (showHeading) {
    console.log("refactor-analyze status");
  }

  const overviewPath = path.join(cwd, "project", "system", "overview.md");
  const indexPath = path.join(cwd, "project", "index.md");

  if (fs.existsSync(overviewPath)) {
    const content = fs.readFileSync(overviewPath, "utf8");
    const typeMatch = content.match(/-\s*\*\*判定結果\*\*：`([^`]+)`/);
    const pathMatch = content.match(/-\s*\*\*目標系統路徑\*\*：`([^`]+)`/);
    const gitMatch = content.match(/-\s*\*\*目標系統 Git 分支 \(Branch\)\*\*：`([^`]+)`/);
    console.log(`目標系統路徑: ${pathMatch ? pathMatch[1] : "未標示"}`);
    console.log(`系統型態判定: ${typeMatch ? typeMatch[1] : "未判定"}`);
    console.log(`目標 Git 分支: ${gitMatch ? gitMatch[1] : "未標示"}`);
  } else {
    console.log("系統總覽狀態: 缺少 project/system/overview.md");
    process.exitCode = 1;
  }

  if (!fs.existsSync(indexPath)) {
    console.log("功能與 API 清單: 缺少 project/index.md");
    process.exitCode = 1;
    return;
  }

  const items = parseIndexItems(cwd);
  console.log(`清單功能/API 總數: ${items.length}`);

  if (items.length === 0) {
    console.log("目前清單尚無項目（請執行 refactor:init / rai 進行初步盤點）。");
    return;
  }

  const completed = items.filter((i) => i.status.includes("已完成") || i.status.toLowerCase().includes("completed")).length;
  const pendingBacklog = items.filter((i) => i.status.includes("待確認") || i.status.includes("Backlog")).length;
  console.log(`已完成: ${completed} | 待確認: ${pendingBacklog} | 待分析/分析中: ${items.length - completed - pendingBacklog}`);

  for (const item of items.slice(0, 10)) {
    console.log(`- [${item.id}] (${item.category}) ${item.name} | 複雜度: ${item.complexity} | 狀態: ${item.status}`);
  }
}

function showHelp() {
  console.log(`refactor-analyze

Usage (CLI Commands):
  refactor-analyze init [--full] [--lang zh-TW|zh-CN|en|ja|ko] [--target <path>]
  refactor-analyze scandb
  refactor-analyze analyze <編號> [--target <path>]
  refactor-analyze reanalyze <編號> [--target <path>]
  refactor-analyze verify [編號] [--target <path>]
  refactor-analyze commit [編號] [--force]
  refactor-analyze pdf [檔案路徑|目錄|編號] [--merge] [--output <file.pdf>]
  refactor-analyze upgrade [--dry-run]   (or: refactor-analyze update)
  refactor-analyze status
  refactor-analyze check
  refactor-analyze doctor
  refactor-analyze --version

AI Workflow Commands (Gemini / Claude / GPT):
  refactor:init [路徑]      (alias: rai) - 詢問目標系統路徑與 remote 對齊，產出系統大概與分類編號清單
  refactor:scandb           (alias: ras) - 呼叫 CLI scandb 依 db-connection.md (唯讀連線 + 跳板機) 抓取結構
  refactor:analyze <編號>   (alias: raa) - 新建 project/<編號>/ 深入分析業務邏輯、資料流、SQL、依賴、死程式碼與 backlog.md
  refactor:reanalyze <編號> (alias: rar) - 根據 backlog.md 補充說明再分析一次並更新文件
  refactor:verify [編號]    (alias: rav) - 0-Token 驗證原始碼檔案/行號引用真實性，並偵測目標系統 Git 版本飄移
  refactor:commit [編號]    (alias: rac) - 驗證通過後更新 index.md 狀態、自動 Git commit 與安全 remote sync
  refactor:pdf [目標]       (alias: rap) - 將指定 .md、編號資料夾或整個 project/ 轉換為 PDF 文件
  refactor:upgrade          (alias: rau) - 更新現有分析項目規則與模板
`);
}

function showVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  console.log(pkg.version);
}

main();
