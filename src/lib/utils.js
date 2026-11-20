const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..");
const templatesDir = path.join(rootDir, "templates");

const SUPPORTED_LANGS = {
  "zh-tw": { code: "zh-TW", name: "繁體中文", label: "繁體中文 (zh-TW)" },
  "zh-cn": { code: "zh-CN", name: "简体中文", label: "简体中文 (zh-CN)" },
  "en": { code: "en", name: "English", label: "English (en)" },
  "ja": { code: "ja", name: "日本語", label: "日本語 (ja)" },
  "ko": { code: "ko", name: "한국어", label: "한국어 (ko)" }
};

function ensureGitIgnore(cwd) {
  const gitignorePath = path.join(cwd, ".gitignore");
  const requiredEntry = "project/system/db-connection.md";

  if (!fs.existsSync(gitignorePath)) {
    const tplName = fs.existsSync(path.join(templatesDir, "gitignore.template"))
      ? "gitignore.template"
      : ".gitignore";
    const content = readTemplate(tplName);
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

function ensureGitRepository(cwd) {
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

function inspectTargetSystem(cwd, targetPathInput) {
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

function getTargetSystemPathFromOverview(cwd) {
  const overviewPath = path.join(cwd, "project", "system", "overview.md");
  if (!fs.existsSync(overviewPath)) return null;
  const content = fs.readFileSync(overviewPath, "utf8");
  const match = content.match(/(?:目標系統路徑|目标系统路径|Target System Path|対象システムパス|대상 시스템 경로)[^`]*`([^`]+)`/i);
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

function isIndexHeaderRow(line) {
  return (
    line.includes("---") ||
    line.includes("編號") ||
    line.includes("编号") ||
    line.includes("功能或 API") ||
    /\|\s*ID\s*\|/i.test(line) ||
    line.includes("番号") ||
    line.includes("번호")
  );
}

function parseIndexItems(cwd) {
  const indexPath = path.join(cwd, "project", "index.md");
  if (!fs.existsSync(indexPath)) return [];
  const content = fs.readFileSync(indexPath, "utf8");
  const lines = content.split("\n");
  let currentCategory = "其他 (Other)";
  const items = [];

  for (const line of lines) {
    const catMatch = line.match(/^##\s*(?:分類[：:]\s*|分类[：:]\s*|Category:\s*|カテゴリ[：:]\s*|분류[：:]\s*)?(.+)$/i);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      continue;
    }
    if (!line.startsWith("|") || isIndexHeaderRow(line)) {
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

function updateIndexRowStatus(cwd, targetId, newComplexity, newStatus) {
  const indexPath = path.join(cwd, "project", "index.md");
  if (!fs.existsSync(indexPath)) return false;

  const lines = fs.readFileSync(indexPath, "utf8").split("\n");
  let updated = false;

  const nextLines = lines.map((line) => {
    if (!line.startsWith("|") || isIndexHeaderRow(line)) return line;
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

function detectProjectLanguage(cwd) {
  const overviewPath = path.join(cwd, "project", "system", "overview.md");
  if (fs.existsSync(overviewPath)) {
    const content = fs.readFileSync(overviewPath, "utf8");
    const match = content.match(/^-\s*\*\*(?:主要語言|主要语言|語言|语言|Language|主要言語|주요 언어)\*\*[：:]\s*(.+)$/im);
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

function getDefaultRemote(targetCwd) {
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

function getCurrentBranch(targetCwd) {
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

function ensureDir(cwd, relativeDir) {
  const absoluteDir = path.join(cwd, relativeDir);
  if (fs.existsSync(absoluteDir)) {
    return { action: "skip", target: relativeDir };
  }

  fs.mkdirSync(absoluteDir, { recursive: true });
  return { action: "create", target: relativeDir };
}

function ensureFileFromTemplate(cwd, templateRelativePath, targetRelativePath, replacements = {}) {
  const targetAbsolutePath = path.join(cwd, targetRelativePath);
  if (fs.existsSync(targetAbsolutePath)) {
    return { action: "skip", target: targetRelativePath };
  }

  const content = applyReplacements(readTemplate(templateRelativePath), replacements);
  writeFileIfMissing(targetAbsolutePath, content);
  return { action: "create", target: targetRelativePath };
}

function updateFileFromTemplate(cwd, templateRelativePath, targetRelativePath, dryRun = false) {
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

function getPositionalArgs(args, valueFlags = []) {
  const flagSet = new Set(valueFlags);
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (flagSet.has(token)) {
      i++; // skip flag value
      continue;
    }
    if (token.startsWith("-")) continue;
    positionals.push(token);
  }
  return positionals;
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

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function aggregateDomainFlowsAndDeadCode(cwd, itemId) {
  const normId = normalizeItemId(itemId);
  const itemDir = path.join(cwd, "project", normId);
  if (!fs.existsSync(itemDir)) return;

  // 1. Parse data-flow.md for CRUD mappings
  const dataFlowPath = path.join(itemDir, "data-flow.md");
  const domainFlowsPath = path.join(cwd, "project", "system", "domain-flows.md");

  if (fs.existsSync(dataFlowPath) && fs.existsSync(domainFlowsPath)) {
    const dataFlowContent = fs.readFileSync(dataFlowPath, "utf8");
    const lines = dataFlowContent.split("\n");
    const tableOps = new Map();
    let inDbTableSection = false;
    let hasSectionHeadings = false;

    for (const line of lines) {
      if (/^##\s+/.test(line)) {
        hasSectionHeadings = true;
        inDbTableSection = /資料庫資料表|DB Tables|資料表與欄位讀寫/i.test(line);
        continue;
      }
      if (hasSectionHeadings && !inDbTableSection) continue;
      if (!line.startsWith("|") || line.includes("資料表名稱") || line.includes("---")) continue;
      const parts = line
        .split("|")
        .map((p) => p.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 2) {
        const tName = parts[0].replace(/`/g, "").trim();
        const opRaw = parts[1].replace(/`/g, "").trim().toUpperCase();
        if (!tName || tName === "待分析" || tName === "-" || tName.startsWith("*(")) continue;
        // Only accept valid CRUD operation cells like "C/R", "R, U", "CRUD", not arbitrary type words like "String"
        if (!/^[CRUD/\s,]+$/.test(opRaw)) continue;
        if (!tableOps.has(tName)) tableOps.set(tName, new Set());
        for (const char of ["C", "R", "U", "D"]) {
          if (opRaw.includes(char)) tableOps.get(tName).add(char);
        }
      }
    }

    if (tableOps.size > 0) {
      let domainFlows = fs.readFileSync(domainFlowsPath, "utf8");
      const matrixHeader = "## 2. 資料表與功能編號 CRUD 對照矩陣 (Table CRUD Matrix)";
      const secIdx = domainFlows.indexOf(matrixHeader);
      if (secIdx !== -1) {
        const beforeSec = domainFlows.slice(0, secIdx + matrixHeader.length);
        const afterSec = domainFlows.slice(secIdx + matrixHeader.length);
        const afterLines = afterSec.split("\n");
        const existingTableRows = new Map();
        const nonTableLines = [];

        for (const l of afterLines) {
          if (l.startsWith("|") && !l.includes("資料表名稱") && !l.includes("---")) {
            const p = l
              .split("|")
              .map((x) => x.trim())
              .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (p.length >= 5 && p[0] !== "待補充") {
              const cleanT = p[0].replace(/`/g, "");
              existingTableRows.set(cleanT, {
                c: p[1],
                r: p[2],
                u: p[3],
                d: p[4]
              });
              continue;
            }
          }
          if (l.trim() && l.trim() !== "| 待補充 | - | - | - | - |") {
            nonTableLines.push(l);
          }
        }

        for (const [tName, ops] of tableOps.entries()) {
          const current = existingTableRows.get(tName) || { c: "-", r: "-", u: "-", d: "-" };
          const appendId = (cell, opChar) => {
            if (!ops.has(opChar)) return cell;
            if (cell === "-") return `\`${normId}\``;
            const ids = cell.split(",").map((x) => x.trim()).filter(Boolean);
            if (!ids.includes(`\`${normId}\``)) ids.push(`\`${normId}\``);
            return ids.join(", ");
          };
          current.c = appendId(current.c, "C");
          current.r = appendId(current.r, "R");
          current.u = appendId(current.u, "U");
          current.d = appendId(current.d, "D");
          existingTableRows.set(tName, current);
        }

        let newTableRows = "";
        for (const [tName, row] of existingTableRows.entries()) {
          newTableRows += `| \`${tName}\` | ${row.c} | ${row.r} | ${row.u} | ${row.d} |\n`;
        }

        const tableHeader =
          "\n\n| 資料表名稱 (`project/system/db/`) | `C` (新增編號) | `R` (查詢編號) | `U` (更新編號) | `D` (刪除編號) |\n|---|---|---|---|---|\n";
        domainFlows =
          beforeSec +
          tableHeader +
          newTableRows +
          "\n" +
          nonTableLines.filter((l) => !l.startsWith("|") && l.trim()).join("\n");
        fs.writeFileSync(domainFlowsPath, domainFlows.trimEnd() + "\n", "utf8");
      }
    }
  }

  // 2. Parse dead-code.md for newly discovered dead code snippets
  const deadCodePath = path.join(itemDir, "dead-code.md");
  const sysDeadCodePath = path.join(cwd, "project", "system", "dead-code.md");
  if (fs.existsSync(deadCodePath) && fs.existsSync(sysDeadCodePath)) {
    const itemDeadCode = fs.readFileSync(deadCodePath, "utf8");
    const nonQuoteDeadCode = itemDeadCode
      .split("\n")
      .filter((l) => !l.trim().startsWith(">"))
      .join("\n");
    if (
      !nonQuoteDeadCode.includes("未發現死程式碼") &&
      !nonQuoteDeadCode.includes("無死程式碼") &&
      !nonQuoteDeadCode.includes("(待 AI 分析填寫)")
    ) {
      const lines = nonQuoteDeadCode.split("\n");
      const foundRows = [];
      for (const line of lines) {
        if (line.startsWith("|") && !line.includes("程式檔案名稱") && !line.includes("---") && !line.includes("待分析")) {
          const parts = line
            .split("|")
            .map((p) => p.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          if (parts.length >= 6) {
            // Official 6-column template: 序號 | Git 分支 | Git Commit Hash | 程式檔案名稱 | 行數範圍 | 判定原因
            foundRows.push({
              branch: parts[1].replace(/`/g, "").trim(),
              commit: parts[2].replace(/`/g, "").trim(),
              filePath: parts[3].replace(/`/g, "").trim(),
              lineRange: parts[4].replace(/`/g, "").trim(),
              reason: parts[5].trim()
            });
          } else if (parts.length >= 4) {
            // Compact 4-column format: 程式檔案名稱 | 行數範圍 | 判定原因 | 代碼
            foundRows.push({
              branch: "",
              commit: "",
              filePath: parts[0].replace(/`/g, "").trim(),
              lineRange: parts[1].replace(/`/g, "").trim(),
              reason: parts[2].trim()
            });
          }
        }
      }

      if (foundRows.length > 0) {
        // Extract fallback Git branch & commit hash from item dead-code.md metadata
        let itemBranch = "-";
        let itemCommit = "-";
        const combinedGit = itemDeadCode.match(/目標系統 Git 分支\s*\/\s*Commit Hash\*\*：[ \t]*`([^`]+)`\s*@\s*`([^`]+)`/);
        if (combinedGit) {
          itemBranch = combinedGit[1].trim();
          itemCommit = combinedGit[2].trim();
        } else {
          const bMatch = itemDeadCode.match(/目標系統 Git 分支[^`]*`([^`]+)`/);
          const cMatch = itemDeadCode.match(/目標系統 Git (?:Commit Hash|版本)[^`]*`([^`]+)`/);
          if (bMatch) itemBranch = bMatch[1].trim();
          if (cMatch) itemCommit = cMatch[1].trim();
        }

        let sysDeadCode = fs.readFileSync(sysDeadCodePath, "utf8");
        const sepMarker = "|---|---|---|---|---|---|";
        const sepIdx = sysDeadCode.indexOf(sepMarker);
        for (const r of foundRows) {
          const filePath = r.filePath;
          if (!filePath || filePath === "-" || filePath === "無") continue;
          const rowBranch = r.branch && r.branch !== "-" ? r.branch : itemBranch;
          const rowCommit = r.commit && r.commit !== "-" ? r.commit : itemCommit;
          const alreadyExists = sysDeadCode
            .split("\n")
            .some((l) => l.startsWith("|") && l.includes(`\`${normId}\``) && l.includes(`\`${filePath}\``));
          if (alreadyExists) continue;
          const tableRow = `| \`${normId}\` | \`${rowBranch}\` | \`${rowCommit}\` | \`${filePath}\` | ${r.lineRange || "-"} | ${r.reason || "-"} |\n`;
          if (sysDeadCode.includes("| `system` |")) {
            sysDeadCode = sysDeadCode.replace("| `system` |", tableRow + "| `system` |");
          } else if (sepIdx !== -1) {
            const insertPos = sysDeadCode.indexOf(sepMarker) + sepMarker.length;
            sysDeadCode = sysDeadCode.slice(0, insertPos) + "\n" + tableRow.trimEnd() + sysDeadCode.slice(insertPos);
          }
        }
        fs.writeFileSync(sysDeadCodePath, sysDeadCode, "utf8");
      }
    }
  }

  // 3. Parse backlog.md for resolved global vouchers and promote to domain-dictionary.md
  aggregateDomainDictionary(cwd, itemId);
}

function aggregateDomainDictionary(cwd, itemId) {
  const normId = normalizeItemId(itemId);
  const itemDir = path.join(cwd, "project", normId);
  const backlogPath = path.join(itemDir, "backlog.md");
  const dictPath = path.join(cwd, "project", "system", "domain-dictionary.md");

  if (!fs.existsSync(backlogPath) || !fs.existsSync(dictPath)) return;

  const content = fs.readFileSync(backlogPath, "utf8");
  const lines = content.split("\n");
  const vouchersToPromote = [];

  for (const line of lines) {
    if (
      !line.startsWith("|") ||
      line.includes("憑證編號") ||
      line.includes("憑證 ID") ||
      line.includes("待確認問題") ||
      line.includes("---")
    ) {
      continue;
    }
    const parts = line
      .split("|")
      .map((p) => p.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (parts.length < 10) continue;
    const id = parts[0].replace(/`/g, "").trim();
    if (!id || id.includes("待分析") || id.includes("{{") || id.startsWith("*(")) continue;
    const type = parts[1].replace(/`/g, "").trim();
    const location = parts[2].replace(/`/g, "").trim();
    const question = parts[3].replace(/`/g, "").trim();
    const conclusion = parts[4].replace(/`/g, "").trim();
    const sourceType = parts[5].replace(/`/g, "").trim();
    const evidence = parts[6].replace(/`/g, "").trim();
    const signoff = parts[7].replace(/`/g, "").trim();
    const scope = parts[8].replace(/`/g, "").trim();
    const status = parts[9].replace(/`/g, "").trim();

    if (
      status.includes("已釐清") &&
      (scope.includes("全系統通用") || scope.includes("全域") || scope.toLowerCase().includes("global"))
    ) {
      vouchersToPromote.push({
        id,
        type,
        location,
        question,
        conclusion,
        sourceType,
        evidence,
        signoff,
        scope,
        status
      });
    }
  }

  if (vouchersToPromote.length === 0) return;

  let dictContent = fs.readFileSync(dictPath, "utf8");

  function insertRowToSection(secTitle, rowStr) {
    const secIdx = dictContent.indexOf(secTitle);
    if (secIdx === -1) return;
    const tableHeaderStr = "|---|---|---|---|---|---|";
    const sepIdx = dictContent.indexOf(tableHeaderStr, secIdx);
    if (sepIdx === -1) return;

    const afterSep = sepIdx + tableHeaderStr.length;
    const placeholderStr = "| *(待由各編號 commit 自動匯總)* | - | - | - | - | - |\n";
    if (dictContent.includes(placeholderStr)) {
      dictContent = dictContent.replace(placeholderStr, "");
    }
    dictContent = dictContent.slice(0, afterSep) + "\n" + rowStr + dictContent.slice(afterSep);
  }

  for (const v of vouchersToPromote) {
    const voucherTag = `\`${v.id}\``;
    const itemTag = `| \`${normId}\` |`;
    const alreadyExists = dictContent
      .split("\n")
      .some((l) => l.startsWith("|") && l.includes(voucherTag) && l.includes(itemTag));
    if (alreadyExists) {
      continue;
    }

    const isRule = v.type.includes("規則") || v.type.includes("公式") || v.type.includes("流程");
    if (isRule) {
      const label = v.question || v.location || v.type;
      const row = `| \`${label}\` (${voucherTag}) | ${v.conclusion} | ${v.sourceType || "官方規範"} | ${v.evidence || "-"} | ${v.signoff || "-"} | \`${normId}\` |`;
      insertRowToSection("## 2. 跨模組通用商業計算公式與規則", row);
    } else {
      const label = v.location || v.question || v.type;
      const row = `| \`${label}\` (${voucherTag}) | ${v.conclusion} | ${v.sourceType || "人工調查"} | ${v.evidence || "-"} | ${v.signoff || "-"} | \`${normId}\` |`;
      insertRowToSection("## 1. 全域業務狀態碼與縮寫欄位辭典", row);
    }
  }

  fs.writeFileSync(dictPath, dictContent, "utf8");
}

module.exports = {
  rootDir,
  templatesDir,
  SUPPORTED_LANGS,
  ensureGitIgnore,
  ensureGitRepository,
  inspectTargetSystem,
  detectSystemType,
  calculateFileComplexity,
  getTargetSystemPathFromOverview,
  normalizeItemId,
  isIndexHeaderRow,
  parseIndexItems,
  updateIndexRowStatus,
  aggregateDomainFlowsAndDeadCode,
  aggregateDomainDictionary,
  detectProjectLanguage,
  getDefaultRemote,
  getCurrentBranch,
  formatLocalDateTime,
  ensureDir,
  ensureFileFromTemplate,
  updateFileFromTemplate,
  writeFileIfMissing,
  readTemplate,
  listFilesRecursive,
  applyReplacements,
  getOption,
  getPositionalArgs,
  printResultList,
  fail
};
