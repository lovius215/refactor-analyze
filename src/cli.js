const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const cwd = process.cwd();
const rootDir = path.resolve(__dirname, "..");
const templatesDir = path.join(rootDir, "templates");

const SUPPORTED_LANGS = {
  "zh-tw": { code: "zh-TW", name: "繁體中文", label: "繁體中文 (zh-TW)" },
  "zh-cn": { code: "zh-CN", name: "简体中文", label: "简体中文 (zh-CN)" },
  "en": { code: "en", name: "English", label: "English (en)" },
  "ja": { code: "ja", name: "日本語", label: "日本語 (ja)" },
  "ko": { code: "ko", name: "한국어", label: "한국어 (ko)" }
};

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init":
      initProject(args.slice(1));
      return;
    case "scandb":
      scanDatabase(args.slice(1));
      return;
    case "analyze":
      analyzeItem(args.slice(1), false);
      return;
    case "reanalyze":
      analyzeItem(args.slice(1), true);
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
      exportMarkdownToPdf(args.slice(1));
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
  const targetInfo = inspectTargetSystem(targetArg);

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
    ensureGitIgnore(),
    ensureGitRepository(),
    ensureDir("skills"),
    ensureDir(path.join("skills", "refactor-analyze")),
    ensureDir("project"),
    ensureDir(path.join("project", "system")),
    ensureDir(path.join("project", "system", "db")),
    ensureDir(path.join("project", "shared")),
    ensureFileFromTemplate("AGENTS.md", "AGENTS.md", replacements),
    ensureFileFromTemplate("readme.md", "readme.md", replacements),
    ensureFileFromTemplate(
      path.join("skills", "refactor-analyze", "SKILL.md"),
      path.join("skills", "refactor-analyze", "SKILL.md"),
      replacements
    ),
    ensureFileFromTemplate(path.join("project", "index.md"), path.join("project", "index.md"), replacements),
    ensureFileFromTemplate(
      path.join("project", "system", "db-connection.md"),
      path.join("project", "system", "db-connection.md"),
      replacements
    ),
    ensureFileFromTemplate(
      path.join("project", "system", "overview.md"),
      path.join("project", "system", "overview.md"),
      replacements
    ),
    ensureFileFromTemplate(
      path.join("project", "system", "tech-stack.md"),
      path.join("project", "system", "tech-stack.md"),
      replacements
    ),
    ensureFileFromTemplate(
      path.join("project", "system", "architecture.md"),
      path.join("project", "system", "architecture.md"),
      replacements
    ),
    ensureFileFromTemplate(
      path.join("project", "system", "domain-flows.md"),
      path.join("project", "system", "domain-flows.md"),
      replacements
    ),
    ensureFileFromTemplate(
      path.join("project", "system", "dead-code.md"),
      path.join("project", "system", "dead-code.md"),
      replacements
    ),
    ensureFileFromTemplate(
      path.join("project", "system", "db-schema.md"),
      path.join("project", "system", "db-schema.md"),
      replacements
    ),
    ensureFileFromTemplate(
      path.join("project", "shared", "README.md"),
      path.join("project", "shared", "README.md"),
      replacements
    )
  ];

  if (includeRules) {
    results.push(ensureDir("rules"));
    for (const file of listFilesRecursive(path.join(templatesDir, "rules"))) {
      const relativePath = path.relative(templatesDir, file);
      results.push(ensureFileFromTemplate(relativePath, relativePath, replacements));
    }
  }

  printResultList("init", results);
  console.log(`\n專案主要語言已設定為: ${langConfig.label}`);
  if (targetInfo.targetPath) {
    console.log(`已連結目標系統路徑: ${targetInfo.targetPath}`);
    console.log(`目標系統初步型態判定: ${targetInfo.systemType}`);
    console.log(`目標系統 Git 分支/版本: ${targetInfo.gitBranch} @ ${targetInfo.gitCommit}`);
    if (targetInfo.hasRemote) {
      console.log(`提示: 偵測到目標系統設有 Git remote (${targetInfo.remoteName})，請確認是否需要先向 remote 對齊 (git fetch / git pull)。`);
    }
  } else {
    console.log(`提示: 接下來可在 AI 對話框輸入 "refactor:init" (或簡寫 "rai")，由 AI 詢問目標系統路徑並產出系統大概與分類編號清單。`);
  }
}

function ensureGitIgnore() {
  const gitignorePath = path.join(cwd, ".gitignore");
  const requiredEntry = "project/system/db-connection.md";

  if (!fs.existsSync(gitignorePath)) {
    const content = readTemplate(".gitignore");
    writeFileIfMissing(gitignorePath, content);
    return { action: "create", target: ".gitignore" };
  }

  const current = fs.readFileSync(gitignorePath, "utf8");
  if (!current.includes(requiredEntry)) {
    const next = current.endsWith("\n") ? `${current}${requiredEntry}\n` : `${current}\n${requiredEntry}\n`;
    fs.writeFileSync(gitignorePath, next, "utf8");
    return { action: "update", target: ".gitignore", message: `已加入 ${requiredEntry} 防止帳密外洩` };
  }

  return { action: "skip", target: ".gitignore" };
}

function ensureGitRepository() {
  const gitVersion = spawnSync("git", ["--version"], { cwd, encoding: "utf8" });
  if (gitVersion.error && gitVersion.error.code === "ENOENT") {
    return {
      action: "warn",
      target: "git",
      message: "Git 未安裝；後續歸檔與同步會使用版本管理，請先安裝 Git。"
    };
  }

  if (gitVersion.status !== 0) {
    return {
      action: "warn",
      target: "git",
      message: "無法確認 Git 是否可用。"
    };
  }

  const workTree = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, encoding: "utf8" });
  if (workTree.status === 0 && workTree.stdout.trim() === "true") {
    const remote = getDefaultRemote(cwd);
    return {
      action: "skip",
      target: "git repository",
      message: remote ? `已偵測到 remote (${remote})，可詢問是否向 remote 對齊` : "本機 Git 已啟用（尚未設定 remote）"
    };
  }

  const init = spawnSync("git", ["init"], { cwd, encoding: "utf8" });
  if (init.status !== 0) {
    process.exitCode = 1;
    return {
      action: "warn",
      target: "git init",
      message: (init.stderr || init.stdout || "git init 執行失敗。").trim()
    };
  }

  return { action: "create", target: ".git", message: "已建立本機 Git repository（如需與遠端同步，請設定 remote 並對齊）" };
}

function inspectTargetSystem(targetPathInput) {
  const defaultInfo = {
    targetPath: null,
    gitBranch: "待確認",
    gitCommit: "待確認",
    gitStatus: "待確認",
    hasRemote: false,
    remoteName: null,
    systemType: "待判定（APP / 桌面應用程式 / 網頁）"
  };

  if (!targetPathInput) return defaultInfo;
  const resolved = path.resolve(cwd, targetPathInput);
  if (!fs.existsSync(resolved)) return defaultInfo;

  defaultInfo.targetPath = resolved;

  const branchRes = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: resolved, encoding: "utf8" });
  if (branchRes.status === 0) {
    defaultInfo.gitBranch = branchRes.stdout.trim() || "HEAD";
  } else {
    defaultInfo.gitBranch = "無 Git 版本控制";
  }

  const commitRes = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: resolved, encoding: "utf8" });
  if (commitRes.status === 0) {
    const hash = commitRes.stdout.trim();
    const tagRes = spawnSync("git", ["describe", "--tags", "--exact-match"], { cwd: resolved, encoding: "utf8" });
    const tag = tagRes.status === 0 && tagRes.stdout.trim() ? ` (tag: ${tagRes.stdout.trim()})` : "";
    defaultInfo.gitCommit = `${hash}${tag}`;
  } else {
    defaultInfo.gitCommit = "無 Git Commit";
  }

  const statusRes = spawnSync("git", ["status", "--porcelain"], { cwd: resolved, encoding: "utf8" });
  if (statusRes.status === 0) {
    defaultInfo.gitStatus = statusRes.stdout.trim() ? "Modified (有未提交變更)" : "Clean (工作區乾淨)";
  } else {
    defaultInfo.gitStatus = "無 Git 狀態";
  }

  const remoteName = getDefaultRemote(resolved);
  if (remoteName) {
    defaultInfo.hasRemote = true;
    defaultInfo.remoteName = remoteName;
  }

  defaultInfo.systemType = detectSystemType(resolved);
  return defaultInfo;
}

function detectSystemType(targetDir) {
  const hasFile = (name) => fs.existsSync(path.join(targetDir, name));
  const types = [];

  if (
    hasFile("pubspec.yaml") ||
    hasFile("AndroidManifest.xml") ||
    hasFile("app/src/main/AndroidManifest.xml") ||
    hasFile("ios/Runner/Info.plist") ||
    hasFile("app.json")
  ) {
    types.push("Mobile APP");
  }

  if (hasFile("src-tauri")) {
    types.push("桌面應用程式 (Desktop Application)");
  }

  if (hasFile("package.json")) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, "package.json"), "utf8"));
      const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      if (deps["electron"] || deps["@tauri-apps/cli"]) {
        types.push("桌面應用程式 (Electron / Tauri)");
      } else if (deps["react-native"] || deps["expo"]) {
        types.push("Mobile APP (React Native / Expo)");
      } else {
        types.push("網頁系統 (Web / Node.js)");
      }
    } catch (_) {
      types.push("網頁系統 (Web / Node.js)");
    }
  }

  if (hasFile("pom.xml") || hasFile("build.gradle") || hasFile("build.gradle.kts") || hasFile("composer.json")) {
    types.push("網頁系統 / 後端與批次服務 (Web / API / Batch)");
  }

  try {
    const entries = fs.readdirSync(targetDir);
    if (entries.some((e) => e.endsWith(".sln") || e.endsWith(".csproj"))) {
      types.push(".NET 系統（待進一步區分 Web 或 桌面應用程式 WPF/WinForms）");
    }
  } catch (_) {}

  return types.length > 0 ? Array.from(new Set(types)).join(" + ") : "待判定（APP / 桌面應用程式 / 網頁）";
}

function calculateFileComplexity(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { level: "待評估", metrics: "尚未讀取原始碼檔案" };
  }
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").length;
    const branchMatches = content.match(/\b(if|else\s+if|for|while|case|catch)\b|\&\&|\|\|/g);
    const branches = branchMatches ? branchMatches.length : 0;
    let level = "低";
    if (branches > 25 || lines > 500) {
      level = "高";
    } else if (branches >= 10 || lines >= 200) {
      level = "中";
    }
    return {
      level,
      metrics: `行數 (LOC): ${lines}, 條件與迴圈分支數 (Cyclomatic Branches): ${branches}`
    };
  } catch (_) {
    return { level: "待評估", metrics: "無法讀取檔案" };
  }
}

function getTargetSystemPathFromOverview() {
  const overviewPath = path.join(cwd, "project", "system", "overview.md");
  if (!fs.existsSync(overviewPath)) return null;
  const content = fs.readFileSync(overviewPath, "utf8");
  const match = content.match(/目標系統路徑\*\*：`([^`]+)`/);
  if (match && match[1] && !match[1].includes("待設定") && !match[1].includes("{{")) {
    return match[1].trim();
  }
  return null;
}

function normalizeItemId(rawId) {
  if (!rawId) return null;
  const cleaned = String(rawId).trim();
  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(3, "0");
  }
  return cleaned;
}

function parseIndexItems() {
  const indexPath = path.join(cwd, "project", "index.md");
  if (!fs.existsSync(indexPath)) return [];
  const content = fs.readFileSync(indexPath, "utf8");
  const lines = content.split("\n");
  let currentCategory = "其他 (Other)";
  const items = [];

  for (const line of lines) {
    const catMatch = line.match(/^##\s*(?:分類[：:]\s*)?(.+)$/);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      continue;
    }
    if (!line.startsWith("|") || line.includes("---") || line.includes("編號") || line.includes("功能或 API")) {
      continue;
    }
    const parts = line
      .split("|")
      .map((p) => p.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (parts.length >= 5) {
      const rawId = parts[0].replace(/`/g, "").trim();
      if (!rawId) continue;
      items.push({
        id: normalizeItemId(rawId),
        rawId,
        category: currentCategory,
        name: parts[1],
        location: parts[2].replace(/`/g, "").trim(),
        complexity: parts[3].replace(/`/g, "").trim(),
        status: parts[4].replace(/`/g, "").trim()
      });
    }
  }
  return items;
}

function analyzeItem(args = [], isReanalyze = false) {
  const rawId = args.find((a) => !a.startsWith("-")) || getOption(args, "--id");
  const label = isReanalyze ? "reanalyze" : "analyze";
  if (!rawId) {
    fail(`Usage: refactor-analyze ${label} <編號> [--target <path>]`);
    return;
  }

  const itemId = normalizeItemId(rawId);
  const indexItems = parseIndexItems();
  const matched = indexItems.find((item) => item.id === itemId || item.rawId === rawId);

  const targetPathArg = getOption(args, "--target") || getTargetSystemPathFromOverview();
  const targetInfo = inspectTargetSystem(targetPathArg);
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

    updateIndexRowStatus(itemId, complexityInfo.level, "分析中 (Reanalyzing)");
    printResultList("reanalyze", updatedFiles);
    console.log(`\n[Reanalyze] 已更新 ${itemRelDir} 的執行時間 (${now}) 與目標 Git 基準 (${targetInfo.gitBranch} @ ${targetInfo.gitCommit})。`);
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
    ensureDir(itemRelDir),
    ensureFileFromTemplate(path.join("project", "item", "analysis.md"), path.join(itemRelDir, "analysis.md"), replacements),
    ensureFileFromTemplate(
      path.join("project", "item", "business-logic.md"),
      path.join(itemRelDir, "business-logic.md"),
      replacements
    ),
    ensureFileFromTemplate(path.join("project", "item", "data-flow.md"), path.join(itemRelDir, "data-flow.md"), replacements),
    ensureFileFromTemplate(path.join("project", "item", "sql.md"), path.join(itemRelDir, "sql.md"), replacements),
    ensureFileFromTemplate(
      path.join("project", "item", "dependencies.md"),
      path.join(itemRelDir, "dependencies.md"),
      replacements
    ),
    ensureFileFromTemplate(path.join("project", "item", "dead-code.md"), path.join(itemRelDir, "dead-code.md"), replacements),
    ensureFileFromTemplate(path.join("project", "item", "backlog.md"), path.join(itemRelDir, "backlog.md"), replacements)
  ];

  updateIndexRowStatus(itemId, complexityInfo.level, "分析中");
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
      content = content.replace(/(目標系統 Git (?:版本 \(Commit Hash \/ Tag\)|Commit Hash)\*\*：`)[^`]+(`)/g, `$1${meta.GIT_COMMIT}$2`);
    }
    fs.writeFileSync(filePath, content, "utf8");
    results.push({ action: "update", target: path.relative(cwd, filePath) });
  }
  return results;
}

function updateIndexRowStatus(targetId, newComplexity, newStatus) {
  const indexPath = path.join(cwd, "project", "index.md");
  if (!fs.existsSync(indexPath)) return false;

  const lines = fs.readFileSync(indexPath, "utf8").split("\n");
  let updated = false;

  const nextLines = lines.map((line) => {
    if (!line.startsWith("|") || line.includes("---") || line.includes("編號")) return line;
    const parts = line.split("|");
    if (parts.length < 6) return line;
    const cellId = parts[1].replace(/`/g, "").trim();
    if (normalizeItemId(cellId) === targetId || cellId === targetId) {
      if (newComplexity && newComplexity !== "待評估") {
        parts[4] = ` ${newComplexity} `;
      }
      if (newStatus) {
        parts[5] = ` ${newStatus} `;
      }
      updated = true;
      return parts.join("|");
    }
    return line;
  });

  if (updated) {
    fs.writeFileSync(indexPath, nextLines.join("\n"), "utf8");
  }
  return updated;
}

function commitItem(args = []) {
  const rawId = args.find((a) => !a.startsWith("-")) || getOption(args, "--id");
  const itemId = rawId ? normalizeItemId(rawId) : null;

  ensureGitIgnore();

  if (itemId) {
    const itemDir = path.join(cwd, "project", itemId);
    if (!fs.existsSync(itemDir)) {
      fail(`找不到編號資料夾 project/${itemId}，請確認編號是否正確。`);
      return;
    }

    const backlogPath = path.join(itemDir, "backlog.md");
    const analysisPath = path.join(itemDir, "analysis.md");
    let finalStatus = "已完成";
    let finalComplexity = null;

    if (fs.existsSync(backlogPath)) {
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

    updateIndexRowStatus(itemId, finalComplexity, finalStatus);
    console.log(`[Commit] 已更新 project/index.md 中編號 ${itemId} 的狀態為: ${finalStatus}`);
  } else {
    console.log(`[Commit] 準備提交目前工作區分析結果...`);
  }

  // 安全防護：確保 db-connection.md 絕不被加入 Git commit
  spawnSync("git", ["reset", "HEAD", "project/system/db-connection.md"], { cwd, encoding: "utf8" });

  spawnSync("git", ["add", "project/", "AGENTS.md", "skills/", "rules/", ".gitignore", "readme.md"], {
    cwd,
    encoding: "utf8"
  });
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

  // 若有設定 Git remote，自動執行 sync (pull + 衝突協助處理 + push)
  const remote = getDefaultRemote(cwd);
  const currentBranch = getCurrentBranch(cwd);
  if (remote && currentBranch) {
    syncWithRemoteAndResolveConflicts(remote, currentBranch, itemId);
  }
}

function syncWithRemoteAndResolveConflicts(remote, branch, itemId) {
  console.log(`[Git Sync] 偵測到遠端 (${remote})，正在同步分支 ${branch}...`);
  spawnSync("git", ["fetch", remote], { cwd, encoding: "utf8" });

  const pullRes = spawnSync("git", ["pull", "--no-rebase", "--no-edit", remote, branch], { cwd, encoding: "utf8" });
  if (pullRes.status !== 0) {
    const pullOutput = `${pullRes.stdout || ""}\n${pullRes.stderr || ""}`;
    if (pullOutput.includes("CONFLICT") || pullOutput.includes("Automatic merge failed")) {
      console.warn(`[Git 衝突處理] 同步時偵測到合併衝突，正在協助自動處理衝突...`);
      const resolved = autoResolveConflicts();
      if (resolved) {
        spawnSync("git", ["reset", "HEAD", "project/system/db-connection.md"], { cwd, encoding: "utf8" });
        const mergeCommitMsg = itemId
          ? `chore(sync): 自動解決遠端同步衝突並合併編號 ${itemId}`
          : `chore(sync): 自動解決遠端同步衝突`;
        spawnSync("git", ["commit", "-m", mergeCommitMsg], { cwd, encoding: "utf8" });
        console.log(`[Git 衝突處理] 衝突已處理完成並完成 commit！`);
      } else {
        console.warn(`[Git 衝突提醒] 部分檔案包含複雜文字衝突，請在 AI 對話輸入 "rac" 讓 AI 協助合併後再自動 commit 與 sync。`);
        return;
      }
    }
  }

  const pushRes = spawnSync("git", ["push", "-u", remote, branch], { cwd, encoding: "utf8" });
  if (pushRes.status === 0) {
    console.log(`[Git Sync] 已成功將變更同步推送至 ${remote}/${branch}！`);
  } else {
    console.warn(`[Git 警告] 推送至 ${remote}/${branch} 失敗: ${(pushRes.stderr || pushRes.stdout || "").trim()}`);
  }
}

function autoResolveConflicts() {
  const diffRes = spawnSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd, encoding: "utf8" });
  if (diffRes.status !== 0 || !diffRes.stdout.trim()) return true;

  const conflictedFiles = diffRes.stdout
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  let allResolved = true;
  for (const relFile of conflictedFiles) {
    const absFile = path.join(cwd, relFile);
    if (!fs.existsSync(absFile)) continue;
    const content = fs.readFileSync(absFile, "utf8");
    if (content.includes("<<<<<<<")) {
      const merged = content
        .replace(/^<<<<<<< .*$\n?/gm, "")
        .replace(/^=======$\n?/gm, "")
        .replace(/^>>>>>>> .*$\n?/gm, "");
      fs.writeFileSync(absFile, merged, "utf8");
      spawnSync("git", ["add", relFile], { cwd, encoding: "utf8" });
      console.log(`  - 已協助合併衝突檔案: ${relFile}`);
    } else {
      allResolved = false;
    }
  }
  return allResolved;
}

function parseDbConnectionConfig() {
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
    enabled: extract(/啟用資料庫掃描 \(Enabled\)\*\*:\s*`([^`]*)`/i).toLowerCase() === "true",
    product: extract(/資料庫產品 \(Database Product\)\*\*:\s*`([^`]*)`/i).toLowerCase(),
    host: extract(/連線主機或檔案路徑 \(Host \/ Path\)\*\*:\s*`([^`]*)`/i),
    port: extract(/連接埠 \(Port\)\*\*:\s*`([^`]*)`/i),
    database: extract(/資料庫名稱 \/ Schema \(Database \/ Schema\)\*\*:\s*`([^`]*)`/i),
    username: extract(/帳號 \(Username\)\*\*:\s*`([^`]*)`/i),
    password: extract(/密碼 \(Password\)\*\*:\s*`([^`]*)`/i),
    sshEnabled: extract(/啟用跳板機 \(SSH Enabled\)\*\*:\s*`([^`]*)`/i).toLowerCase() === "true",
    sshHost: extract(/跳板機主機 \(SSH Host\)\*\*:\s*`([^`]*)`/i),
    sshPort: extract(/跳板機連接埠 \(SSH Port\)\*\*:\s*`([^`]*)`/i) || "22",
    sshUser: extract(/跳板機帳號 \(SSH Username\)\*\*:\s*`([^`]*)`/i),
    sshPassword: extract(/跳板機密碼 \(SSH Password\)\*\*:\s*`([^`]*)`/i),
    sshKeyPath: extract(/跳板機私鑰路徑 \(SSH Private Key Path\)\*\*:\s*`([^`]*)`/i),
    localTunnelPort: extract(/本地轉發連接埠 \(Local Tunnel Port\)\*\*:\s*`([^`]*)`/i) || "13306"
  };
}

function scanDatabase() {
  const cfg = parseDbConnectionConfig();
  if (!cfg) return;

  console.log("refactor-analyze scandb");
  console.log(`讀取設定檔: project/system/db-connection.md (資料庫產品: ${cfg.product || "未指定"})`);

  if (!cfg.enabled) {
    console.log("提示: project/system/db-connection.md 中的「啟用資料庫掃描 (Enabled)」目前為 false。");
    console.log("請先在 project/system/db-connection.md 填寫資料庫產品、路徑、帳號、密碼（與跳板機設定），並將 Enabled 改為 true 後再執行 scandb。");
    return;
  }

  let connectHost = cfg.host;
  let connectPort = cfg.port;

  if (cfg.sshEnabled && cfg.sshHost && cfg.sshUser) {
    console.log(`[SSH 跳板機] 正在透過 ${cfg.sshUser}@${cfg.sshHost}:${cfg.sshPort} 建立本地安全通道 (Local Port: ${cfg.localTunnelPort} -> ${cfg.host}:${cfg.port})...`);
    const sshArgs = [
      "-f",
      "-N",
      "-L",
      `${cfg.localTunnelPort}:${cfg.host}:${cfg.port}`,
      "-p",
      cfg.sshPort,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ExitOnForwardFailure=yes"
    ];
    if (cfg.sshKeyPath) {
      const resolvedKey = cfg.sshKeyPath.startsWith("~")
        ? path.join(process.env.HOME || "", cfg.sshKeyPath.slice(1))
        : cfg.sshKeyPath;
      if (fs.existsSync(resolvedKey)) {
        sshArgs.push("-i", resolvedKey);
      }
    }
    sshArgs.push(`${cfg.sshUser}@${cfg.sshHost}`);

    const sshRes = spawnSync("ssh", sshArgs, { cwd, encoding: "utf8" });
    if (sshRes.status === 0) {
      connectHost = "127.0.0.1";
      connectPort = cfg.localTunnelPort;
      console.log(`[SSH 跳板機] 通道建立成功，將透過 ${connectHost}:${connectPort} 連線至資料庫。`);
    } else {
      console.warn(`[SSH 跳板機警告] 無法自動建立背景 SSH 通道: ${(sshRes.stderr || "").trim()}`);
      console.warn(`提示: 若跳板機需要互動式輸入密碼，可在 AI 對話框執行 "refactor:scandb" ("ras") 協助連線。`);
    }
  }

  try {
    runReadOnlySchemaScan(cfg, connectHost, connectPort);
  } finally {
    if (cfg.sshEnabled && connectHost === "127.0.0.1") {
      spawnSync("pkill", ["-f", `${cfg.localTunnelPort}:${cfg.host}:${cfg.port}`], { encoding: "utf8" });
    }
  }
}

function runReadOnlySchemaScan(cfg, host, port) {
  const now = formatLocalDateTime(new Date());
  const dbDir = path.join(cwd, "project", "system", "db");
  fs.mkdirSync(dbDir, { recursive: true });

  if (cfg.product === "sqlite") {
    const dbFile = path.resolve(cwd, cfg.host);
    if (!fs.existsSync(dbFile)) {
      fail(`找不到 SQLite 資料庫檔案: ${dbFile}`);
      return;
    }
    const tablesRes = spawnSync(
      "sqlite3",
      [dbFile, "SELECT name, type FROM sqlite_master WHERE type IN ('table','view','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name;"],
      { encoding: "utf8" }
    );
    if (tablesRes.status !== 0) {
      console.warn(`無法執行 sqlite3 CLI: ${(tablesRes.stderr || "").trim()}`);
      return;
    }
    const rows = tablesRes.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const tableSummaryRows = [];
    const triggerRows = [];

    for (const row of rows) {
      const [name, type] = row.split("|");
      if (type === "table") {
        const colRes = spawnSync("sqlite3", [dbFile, `PRAGMA table_info("${name}");`], { encoding: "utf8" });
        const cols = (colRes.stdout || "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const p = l.split("|");
            return {
              name: p[1],
              type: p[2],
              nullable: p[3] === "1" ? "NO" : "YES",
              defaultVal: p[4] || "",
              pk: p[5] === "1" ? "PK" : "",
              comment: ""
            };
          });
        writeTableMarkdown(name, cols, "", now);
        tableSummaryRows.push({ name, count: cols.length, pk: cols.filter((c) => c.pk).map((c) => c.name).join(", "), comment: "" });
      } else if (type === "trigger") {
        triggerRows.push({ name, table: "-", timing: "-", desc: "SQLite Trigger" });
      }
    }
    writeDbSchemaSummary(cfg.product, cfg.database || cfg.host, tableSummaryRows, [], [], triggerRows, now);
    console.log(`[scandb] 已完成 SQLite 掃描，共產出 ${tableSummaryRows.length} 張資料表檔案於 project/system/db/。`);
    return;
  }

  if (cfg.product === "mysql" || cfg.product === "mariadb") {
    const query = `
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${cfg.database}'
      ORDER BY TABLE_NAME, ORDINAL_POSITION;
    `;
    const env = Object.assign({}, process.env, { MYSQL_PWD: cfg.password });
    const res = spawnSync(
      "mysql",
      ["-h", host, "-P", String(port || 3306), "-u", cfg.username, "-N", "-B", "-e", query],
      { env, encoding: "utf8" }
    );
    if (res.status === 0 && res.stdout) {
      const tableMap = new Map();
      for (const line of res.stdout.split("\n")) {
        if (!line.trim()) continue;
        const [tName, cName, cType, isNull, cDef, cKey, cComment] = line.split("\t");
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
        writeTableMarkdown(tName, cols, "", now);
        summaryRows.push({
          name: tName,
          count: cols.length,
          pk: cols.filter((c) => c.pk === "PRI").map((c) => c.name).join(", "),
          comment: ""
        });
      }
      writeDbSchemaSummary(cfg.product, cfg.database, summaryRows, [], [], [], now);
      console.log(`[scandb] 已完成 ${cfg.product} 資料庫掃描，共產出 ${summaryRows.length} 張資料表結構於 project/system/db/。`);
      return;
    }
  }

  if (cfg.product === "postgres" || cfg.product === "postgresql") {
    const query = `
      SELECT table_name, column_name, data_type, is_nullable, COALESCE(column_default, '')
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;
    const env = Object.assign({}, process.env, { PGPASSWORD: cfg.password });
    const res = spawnSync(
      "psql",
      ["-h", host, "-p", String(port || 5432), "-U", cfg.username, "-d", cfg.database, "-t", "-A", "-F", "\t", "-c", query],
      { env, encoding: "utf8" }
    );
    if (res.status === 0 && res.stdout) {
      const tableMap = new Map();
      for (const line of res.stdout.split("\n")) {
        if (!line.trim()) continue;
        const [tName, cName, cType, isNull, cDef] = line.split("\t");
        if (!tableMap.has(tName)) tableMap.set(tName, []);
        tableMap.get(tName).push({
          name: cName,
          type: cType,
          nullable: isNull,
          defaultVal: cDef || "",
          pk: "",
          comment: ""
        });
      }
      const summaryRows = [];
      for (const [tName, cols] of tableMap.entries()) {
        writeTableMarkdown(tName, cols, "", now);
        summaryRows.push({ name: tName, count: cols.length, pk: "-", comment: "" });
      }
      writeDbSchemaSummary(cfg.product, cfg.database, summaryRows, [], [], [], now);
      console.log(`[scandb] 已完成 PostgreSQL 資料庫掃描，共產出 ${summaryRows.length} 張資料表結構於 project/system/db/。`);
      return;
    }
  }

  console.log(`[scandb] 已讀取 project/system/db-connection.md 設定（${cfg.product} @ ${host}:${port}/${cfg.database}）。`);
  console.log(`提示: 若本機未安裝對應資料庫 CLI 或需透過 AI Agent 驅動連線，請於 AI 對話框輸入 "refactor:scandb" (或 "ras") 執行抓取。`);
}

function writeTableMarkdown(tableName, cols, tableComment, now) {
  const filePath = path.join(cwd, "project", "system", "db", `${tableName}.md`);
  const rows = cols
    .map(
      (c) =>
        `| \`${c.name}\` | \`${c.type}\` | ${c.nullable} | \`${c.defaultVal}\` | ${c.pk} | ${c.comment || "-"} |`
    )
    .join("\n");

  const content = `# 資料表結構：\`${tableName}\`

- **掃描時間 (\`scandb\`)**：\`${now}\`
- **資料表說明 / 註解**：${tableComment || "無註解"}

## 欄位清單 (Columns)

| 欄位名稱 | 資料型態 | 允許 Null | 預設值 | 鍵值 (PK/FK/Idx) | 欄位註解 (Comment) |
|---|---|---|---|---|---|
${rows}
`;
  fs.writeFileSync(filePath, content, "utf8");
}

function writeDbSchemaSummary(product, dbName, tables, views, procedures, triggers, now) {
  const schemaPath = path.join(cwd, "project", "system", "db-schema.md");
  const tableLines =
    tables.length > 0
      ? tables
          .map(
            (t) =>
              `| \`${t.name}\` | ${t.count} | ${t.pk || "-"} | ${t.comment || "-"} | [db/${t.name}.md](./db/${t.name}.md) |`
          )
          .join("\n")
      : "| 無資料表 | - | - | - | - |";

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

## 2. 檢視表清單 (Views)

| View 名稱 | 說明 / 定義摘要 |
|---|---|
| ${views.length > 0 ? views.map((v) => `${v.name} | ${v.desc}`).join("\n| ") : "無 | -"} |

---

## 3. 預存程序與函數 (Stored Procedures & Functions)

| 名稱 | 類型 | 參數與邏輯摘要 |
|---|---|---|
| ${procedures.length > 0 ? procedures.map((p) => `${p.name} | ${p.type} | ${p.desc}`).join("\n| ") : "無 | - | -"} |

---

## 4. 資料庫觸發器 (Triggers)

| Trigger 名稱 | 綁定資料表 | 觸發時機 | 觸發邏輯說明 |
|---|---|---|---|
| ${triggers.length > 0 ? triggers.map((tr) => `${tr.name} | ${tr.table} | ${tr.timing} | ${tr.desc}`).join("\n| ") : "無 | - | - | -"} |
`;
  fs.writeFileSync(schemaPath, content, "utf8");
}

function detectProjectLanguage() {
  const overviewPath = path.join(cwd, "project", "system", "overview.md");
  if (fs.existsSync(overviewPath)) {
    const content = fs.readFileSync(overviewPath, "utf8");
    const match = content.match(/^-\s*\*\*(?:主要語言|語言|Language)\*\*[：:]\s*(.+)$/im);
    if (match) {
      const val = match[1].trim();
      for (const key of Object.keys(SUPPORTED_LANGS)) {
        if (
          val.toLowerCase().includes(key) ||
          val.includes(SUPPORTED_LANGS[key].label) ||
          val.includes(SUPPORTED_LANGS[key].name) ||
          val.includes(SUPPORTED_LANGS[key].code)
        ) {
          return SUPPORTED_LANGS[key];
        }
      }
      return { code: "custom", label: val };
    }
  }
  return SUPPORTED_LANGS["zh-tw"];
}

function upgradeProject(args = []) {
  const dryRun = args.includes("--dry-run");
  const langConfig = detectProjectLanguage();
  console.log(`專案目前語言: ${langConfig.label}（依現有語言升級，不變更設定）`);

  const now = formatLocalDateTime(new Date());
  const replacements = {
    LANG_LABEL: langConfig.label,
    LANG_CODE: langConfig.code,
    TARGET_PATH: getTargetSystemPathFromOverview() || "待確認",
    GIT_BRANCH: "待確認",
    GIT_COMMIT: "待確認",
    GIT_STATUS: "待確認",
    ANALYSIS_TIME: now,
    SYSTEM_TYPE: "待確認"
  };

  const results = [];
  if (!dryRun) {
    results.push(ensureGitIgnore());
    results.push(ensureDir("skills"));
    results.push(ensureDir(path.join("skills", "refactor-analyze")));
    results.push(ensureDir(path.join("project", "system")));
    results.push(ensureDir(path.join("project", "system", "db")));
    results.push(ensureDir(path.join("project", "shared")));
  }

  results.push(updateFileFromTemplate("AGENTS.md", "AGENTS.md", dryRun));
  results.push(
    updateFileFromTemplate(
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
      results.push(updateFileFromTemplate(relativePath, relativePath, dryRun));
    }
  }

  // 無損補齊 system/ 與 shared/ 下可能缺少的新版模板檔案
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
        ensureFileFromTemplate(relPath, relPath, replacements);
      }
      results.push({ action: "create", target: relPath, message: "補齊新版系統模板檔案" });
    }
  }

  // 檢查既有 project/<編號>/ 資料夾是否缺少 sql.md 或 dead-code.md 等新版檔案
  const projectDir = path.join(cwd, "project");
  if (fs.existsSync(projectDir)) {
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    const itemFiles = ["analysis.md", "business-logic.md", "data-flow.md", "sql.md", "dependencies.md", "dead-code.md", "backlog.md"];
    for (const entry of entries) {
      if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
        for (const fName of itemFiles) {
          const targetRel = path.join("project", entry.name, fName);
          if (!fs.existsSync(path.join(cwd, targetRel))) {
            if (!dryRun) {
              ensureFileFromTemplate(path.join("project", "item", fName), targetRel, {
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

  const items = parseIndexItems();
  console.log(`清單功能/API 總數: ${items.length}`);

  if (items.length === 0) {
    console.log("目前清單尚無項目（請執行 refactor:init / rai 進行初步盤點）。");
    return;
  }

  const completed = items.filter((i) => i.status.includes("已完成")).length;
  const pendingBacklog = items.filter((i) => i.status.includes("待確認") || i.status.includes("Backlog")).length;
  console.log(`已完成: ${completed} | 待確認 (Backlog): ${pendingBacklog} | 待分析: ${items.length - completed - pendingBacklog}`);

  for (const item of items.slice(0, 10)) {
    console.log(`- [${item.id}] (${item.category}) ${item.name} | 複雜度: ${item.complexity} | 狀態: ${item.status}`);
  }
}

function getDefaultRemote(targetCwd = cwd) {
  const res = spawnSync("git", ["remote"], { cwd: targetCwd, encoding: "utf8" });
  if (res.status === 0 && res.stdout) {
    const remotes = res.stdout
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    if (remotes.includes("origin")) return "origin";
    if (remotes.length > 0) return remotes[0];
  }
  return null;
}

function getCurrentBranch(targetCwd = cwd) {
  const res = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: targetCwd, encoding: "utf8" });
  if (res.status === 0) {
    const b = res.stdout.trim();
    return b === "HEAD" ? null : b;
  }
  return null;
}

function formatLocalDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") +
    " " +
    [pad(date.getHours()), pad(date.getMinutes())].join(":")
  );
}

function ensureDir(relativeDir) {
  const absoluteDir = path.join(cwd, relativeDir);
  if (fs.existsSync(absoluteDir)) {
    return { action: "skip", target: relativeDir };
  }

  fs.mkdirSync(absoluteDir, { recursive: true });
  return { action: "create", target: relativeDir };
}

function ensureFileFromTemplate(templateRelativePath, targetRelativePath, replacements = {}) {
  const targetAbsolutePath = path.join(cwd, targetRelativePath);
  if (fs.existsSync(targetAbsolutePath)) {
    return { action: "skip", target: targetRelativePath };
  }

  const content = applyReplacements(readTemplate(templateRelativePath), replacements);
  writeFileIfMissing(targetAbsolutePath, content);
  return { action: "create", target: targetRelativePath };
}

function updateFileFromTemplate(templateRelativePath, targetRelativePath, dryRun = false) {
  const targetAbsolutePath = path.join(cwd, targetRelativePath);
  const templateAbsolutePath = path.join(templatesDir, templateRelativePath);
  if (!fs.existsSync(templateAbsolutePath)) {
    return { action: "skip", target: targetRelativePath };
  }

  let templateContent = readTemplate(templateRelativePath);
  if (!fs.existsSync(targetAbsolutePath)) {
    if (!dryRun) {
      writeFileIfMissing(targetAbsolutePath, templateContent);
    }
    return { action: "create", target: targetRelativePath };
  }

  const currentContent = fs.readFileSync(targetAbsolutePath, "utf8");
  if (currentContent.includes("<claude-mem-context>")) {
    const memMatch = currentContent.match(/(<claude-mem-context>[\s\S]*?<\/claude-mem-context>)/);
    if (memMatch && !templateContent.includes("<claude-mem-context>")) {
      templateContent = `${templateContent.trimEnd()}\n\n\n${memMatch[1]}\n`;
    }
  }

  if (currentContent.trim() === templateContent.trim()) {
    return { action: "skip", target: targetRelativePath };
  }

  if (!dryRun) {
    fs.writeFileSync(targetAbsolutePath, templateContent, "utf8");
  }
  return { action: "update", target: targetRelativePath };
}

function writeFileIfMissing(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readTemplate(relativePath) {
  return fs.readFileSync(path.join(templatesDir, relativePath), "utf8");
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFilesRecursive(absolutePath) : [absolutePath];
  });
}

function applyReplacements(content, replacements) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(value != null ? String(value) : ""),
    content
  );
}

function getOption(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || null : null;
}

function printResultList(label, results) {
  console.log(`refactor-analyze ${label}`);
  for (const result of results) {
    const action =
      result.action === "create"
        ? "CREATED"
        : result.action === "update"
        ? "UPDATED"
        : result.action === "warn"
        ? "WARNING"
        : "SKIPPED";
    console.log(`${action} ${result.target}${result.message ? ` - ${result.message}` : ""}`);
  }
}

function exportMarkdownToPdf(args = []) {
  const os = require("os");
  const outputOpt = getOption(args, "--output") || getOption(args, "-o");
  const mergeMode = args.includes("--merge");
  const targetArg = args.find((a) => !a.startsWith("-") && a !== outputOpt);

  let mdFiles = [];
  let defaultMergedPdfPath = null;

  if (!targetArg) {
    const projDir = path.join(cwd, "project");
    if (!fs.existsSync(projDir)) {
      fail("找不到 project/ 目錄，請指定要轉換的 .md 檔案路徑，例如: refactor-analyze pdf README.md");
      return;
    }
    mdFiles = listFilesRecursive(projDir).filter(
      (f) => f.endsWith(".md") && !f.endsWith(path.join("system", "db-connection.md"))
    );
    defaultMergedPdfPath = path.join(projDir, "refactor-analysis-report.pdf");
  } else {
    const normalizedId = normalizeItemId(targetArg);
    const candidateItemDir = path.join(cwd, "project", normalizedId || "");
    const candidateDirect = path.resolve(cwd, targetArg);

    if (normalizedId && fs.existsSync(candidateItemDir) && fs.statSync(candidateItemDir).isDirectory()) {
      const order = [
        "analysis.md",
        "business-logic.md",
        "data-flow.md",
        "sql.md",
        "dependencies.md",
        "dead-code.md",
        "backlog.md"
      ];
      const existing = listFilesRecursive(candidateItemDir).filter((f) => f.endsWith(".md"));
      existing.sort((a, b) => {
        const ia = order.indexOf(path.basename(a));
        const ib = order.indexOf(path.basename(b));
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      mdFiles = existing;
      defaultMergedPdfPath = path.join(candidateItemDir, `${normalizedId}-report.pdf`);
    } else if (fs.existsSync(candidateDirect)) {
      const stat = fs.statSync(candidateDirect);
      if (stat.isDirectory()) {
        mdFiles = listFilesRecursive(candidateDirect).filter(
          (f) => f.endsWith(".md") && !f.endsWith(path.join("system", "db-connection.md"))
        );
        defaultMergedPdfPath = path.join(candidateDirect, `${path.basename(candidateDirect)}-report.pdf`);
      } else if (candidateDirect.endsWith(".md")) {
        mdFiles = [candidateDirect];
      } else {
        fail(`目標檔案不是 Markdown (.md) 檔案: ${targetArg}`);
        return;
      }
    } else {
      fail(`找不到指定的檔案、目錄或編號: ${targetArg}`);
      return;
    }
  }

  if (mdFiles.length === 0) {
    fail("找不到可轉換的 .md 檔案。");
    return;
  }

  const browserBin = findBrowserBinaryForPdf();
  const results = [];

  if (mergeMode || (outputOpt && mdFiles.length > 1)) {
    const finalPdf = outputOpt ? path.resolve(cwd, outputOpt) : defaultMergedPdfPath;
    const sections = mdFiles.map((f) => {
      const rel = path.relative(cwd, f);
      const raw = fs.readFileSync(f, "utf8");
      return `<div class="doc-section"><div class="doc-source-badge">${escapeHtml(rel)}</div>\n${markdownToHtmlBody(raw)}</div>`;
    });
    const combinedHtml = wrapHtmlDocument(sections.join('\n<div class="page-break"></div>\n'), "Refactor Analysis Report");
    const ok = renderHtmlToPdf(combinedHtml, finalPdf, browserBin, os);
    if (ok) {
      results.push({ action: "create", target: path.relative(cwd, finalPdf), message: `已合併 ${mdFiles.length} 份 Markdown 為單一 PDF` });
    } else {
      fail(`無法產生 PDF: ${finalPdf}`);
      return;
    }
  } else {
    for (const mdFile of mdFiles) {
      const outPdf =
        mdFiles.length === 1 && outputOpt
          ? path.resolve(cwd, outputOpt)
          : mdFile.replace(/\.md$/i, ".pdf");
      const raw = fs.readFileSync(mdFile, "utf8");
      const html = wrapHtmlDocument(markdownToHtmlBody(raw), path.basename(mdFile, ".md"));
      const ok = renderHtmlToPdf(html, outPdf, browserBin, os);
      if (ok) {
        results.push({ action: "create", target: path.relative(cwd, outPdf) });
      } else {
        results.push({ action: "warn", target: path.relative(cwd, outPdf), message: "PDF 轉換失敗" });
      }
    }
  }

  printResultList("pdf", results);
}

function findBrowserBinaryForPdf() {
  const platform = process.platform;
  const candidates = [];

  if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    );
  } else if (platform === "win32") {
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pfx86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const localAppData = process.env["LOCALAPPDATA"] || "";
    candidates.push(
      path.join(pf, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(pfx86, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(localAppData, "Google\\Chrome\\Application\\chrome.exe"),
      path.join(pf, "Microsoft\\Edge\\Application\\msedge.exe"),
      path.join(pfx86, "Microsoft\\Edge\\Application\\msedge.exe")
    );
  } else {
    const linuxBins = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];
    for (const bin of linuxBins) {
      const whichRes = spawnSync("which", [bin], { encoding: "utf8" });
      if (whichRes.status === 0 && whichRes.stdout.trim()) {
        return whichRes.stdout.trim();
      }
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function renderHtmlToPdf(htmlContent, outputPdfPath, browserBin, os) {
  fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true });
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpHtmlPath = path.join(os.tmpdir(), `refactor-analyze-${runId}.html`);
  const tmpProfileDir = path.join(os.tmpdir(), `refactor-analyze-profile-${runId}`);
  fs.writeFileSync(tmpHtmlPath, htmlContent, "utf8");

  try {
    if (browserBin) {
      fs.mkdirSync(tmpProfileDir, { recursive: true });
      const fileUrl = `file://${tmpHtmlPath.replace(/\\/g, "/")}`;
      const args = [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-crash-reporter",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${tmpProfileDir}`,
        "--no-pdf-header-footer",
        `--print-to-pdf=${outputPdfPath}`,
        fileUrl
      ];
      const res = spawnSync(browserBin, args, { encoding: "utf8" });
      if (fs.existsSync(outputPdfPath) && fs.statSync(outputPdfPath).size > 0) {
        return true;
      }
      if (res.status === 0 && fs.existsSync(outputPdfPath)) {
        return true;
      }
    }

    const wkRes = spawnSync("wkhtmltopdf", ["--enable-local-file-access", tmpHtmlPath, outputPdfPath], { encoding: "utf8" });
    if (wkRes.status === 0 && fs.existsSync(outputPdfPath)) {
      return true;
    }

    if (process.platform === "darwin" && fs.existsSync("/usr/sbin/cupsfilter")) {
      const tmpTxtPath = path.join(os.tmpdir(), `refactor-analyze-${runId}.txt`);
      const plainText = htmlContent
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<\/(h[1-6]|p|div|tr|li|blockquote|pre)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&rarr;/g, "->");
      fs.writeFileSync(tmpTxtPath, plainText, "utf8");
      const cupsRes = spawnSync("/usr/sbin/cupsfilter", ["-m", "application/pdf", tmpTxtPath]);
      try {
        if (fs.existsSync(tmpTxtPath)) fs.unlinkSync(tmpTxtPath);
      } catch (_) {}
      if (cupsRes.status === 0 && cupsRes.stdout && cupsRes.stdout.length > 0) {
        fs.writeFileSync(outputPdfPath, cupsRes.stdout);
        return true;
      }
    }

    console.error("提示: 未偵測到可用的 PDF 渲染器（請確認系統已安裝 Chrome / Edge 瀏覽器或 wkhtmltopdf）。");
    return false;
  } finally {
    try {
      if (fs.existsSync(tmpHtmlPath)) fs.unlinkSync(tmpHtmlPath);
      if (fs.existsSync(tmpProfileDir)) fs.rmSync(tmpProfileDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\$\\to\$/g, "&rarr;");
  return out;
}

function markdownToHtmlBody(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeLines = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listType = "ul";
  let inBlockquote = false;

  const flushTable = () => {
    if (!inTable) return;
    inTable = false;
    if (tableRows.length === 0) return;
    let t = "<table>";
    tableRows.forEach((row, idx) => {
      const tag = idx === 0 ? "th" : "td";
      const cells = row.map((c) => `<${tag}>${formatInlineMarkdown(c)}</${tag}>`).join("");
      t += idx === 0 ? `<thead><tr>${cells}</tr></thead><tbody>` : `<tr>${cells}</tr>`;
    });
    t += "</tbody></table>";
    html.push(t);
    tableRows = [];
  };

  const flushList = () => {
    if (!inList) return;
    inList = false;
    html.push(`</${listType}>`);
  };

  const flushBlockquote = () => {
    if (!inBlockquote) return;
    inBlockquote = false;
    html.push("</blockquote>");
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      flushTable();
      flushList();
      flushBlockquote();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        html.push(
          `<pre><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList();
      flushBlockquote();
      const rawCells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (rawCells.every((c) => /^[-:]+$/.test(c))) {
        continue;
      }
      inTable = true;
      tableRows.push(rawCells);
      continue;
    } else {
      flushTable();
    }

    if (/^---+$/.test(line.trim())) {
      flushList();
      flushBlockquote();
      html.push("<hr/>");
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      flushBlockquote();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (line.trim().startsWith(">")) {
      flushList();
      if (!inBlockquote) {
        inBlockquote = true;
        html.push("<blockquote>");
      }
      html.push(`<p>${formatInlineMarkdown(line.trim().replace(/^>\s?/, ""))}</p>`);
      continue;
    } else {
      flushBlockquote();
    }

    const ulMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ulMatch || olMatch) {
      const targetType = ulMatch ? "ul" : "ol";
      if (!inList) {
        inList = true;
        listType = targetType;
        html.push(`<${listType}>`);
      } else if (listType !== targetType) {
        html.push(`</${listType}><${targetType}>`);
        listType = targetType;
      }
      html.push(`<li>${formatInlineMarkdown((ulMatch || olMatch)[1])}</li>`);
      continue;
    } else {
      flushList();
    }

    if (!line.trim()) {
      continue;
    }

    html.push(`<p>${formatInlineMarkdown(line)}</p>`);
  }

  flushTable();
  flushList();
  flushBlockquote();
  return html.join("\n");
}

function wrapHtmlDocument(bodyHtml, title) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", "PingFang SC", "Microsoft JhengHei", "Microsoft YaHei", "Hiragino Sans", "Noto Sans CJK TC", "Malgun Gothic", sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #1f2328;
  }
  h1, h2, h3, h4 { color: #0f172a; margin-top: 1.2em; margin-bottom: 0.5em; font-weight: 600; }
  h1 { font-size: 22px; border-bottom: 2px solid #d0d7de; padding-bottom: 6px; }
  h2 { font-size: 17px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 14.5px; }
  p { margin: 0.4em 0; }
  ul, ol { margin: 0.4em 0; padding-left: 22px; }
  li { margin: 0.2em 0; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    background: #f3f4f6;
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 12px;
  }
  pre {
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    padding: 10px 12px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  pre code { background: none; padding: 0; font-size: 11.5px; }
  blockquote {
    margin: 0.6em 0;
    padding: 6px 12px;
    border-left: 4px solid #2563eb;
    background: #eff6ff;
    color: #1e3a8a;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.8em 0;
    font-size: 12px;
    table-layout: auto;
    word-break: break-word;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f1f5f9; font-weight: 600; }
  tr:nth-child(even) td { background: #f8fafc; }
  hr { border: none; border-top: 1px solid #d0d7de; margin: 14px 0; }
  .page-break { page-break-after: always; }
  .doc-source-badge {
    display: inline-block;
    font-size: 11px;
    background: #e2e8f0;
    color: #334155;
    padding: 2px 8px;
    border-radius: 4px;
    margin-bottom: 6px;
    font-family: monospace;
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function showHelp() {
  console.log(`refactor-analyze

Usage (CLI Commands):
  refactor-analyze init [--full] [--lang zh-TW|zh-CN|en|ja|ko] [--target <path>]
  refactor-analyze scandb
  refactor-analyze analyze <編號> [--target <path>]
  refactor-analyze reanalyze <編號> [--target <path>]
  refactor-analyze commit [編號]
  refactor-analyze pdf [檔案路徑|目錄|編號] [--merge] [--output <file.pdf>]
  refactor-analyze upgrade [--dry-run]   (or: refactor-analyze update)
  refactor-analyze status
  refactor-analyze check
  refactor-analyze doctor
  refactor-analyze --version

AI Workflow Commands (Gemini / Claude / GPT):
  refactor:init [路徑]      (alias: rai) - 詢問目標系統路徑與 remote 對齊，產出系統大概與分類編號清單
  refactor:scandb           (alias: ras) - 依據 db-connection.md (含跳板機) 實際連進資料庫抓取所有欄位與 Trigger
  refactor:analyze <編號>   (alias: raa) - 新建 project/<編號>/ 深入分析業務邏輯、資料流、SQL、依賴、死程式碼與 backlog.md
  refactor:reanalyze <編號> (alias: rar) - 根據 backlog.md 補充說明再分析一次並更新文件
  refactor:commit [編號]    (alias: rac) - 確認後更新 index.md 狀態、自動 Git commit 與 remote sync (含衝突協助處理)
  refactor:pdf [目標]       (alias: rap) - 將指定 .md、編號資料夾或整個 project/ 轉換為 PDF 文件
  refactor:upgrade          (alias: rau) - 更新現有分析項目規則與模板
`);
}

function showVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  console.log(pkg.version);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

main();
