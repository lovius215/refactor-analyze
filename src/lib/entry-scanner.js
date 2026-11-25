const fs = require("fs");
const path = require("path");
const {
  getTargetSystemPathFromOverview,
  parseIndexItems,
  formatLocalDateTime,
  getOption,
  getPositionalArgs,
  fail
} = require("./utils");

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "bin",
  "obj",
  "vendor",
  ".next",
  ".nuxt",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
  ".idea",
  ".vscode",
  "test",
  "tests",
  "__tests__"
]);

const WORKSPACE_SELF_DIRS = new Set(["project", "skills", "rules", "templates"]);

const CODE_EXTENSIONS = new Set([
  ".java",
  ".kt",
  ".cs",
  ".vb",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".php",
  ".go",
  ".rb",
  ".jsp",
  ".aspx",
  ".ashx",
  ".asmx",
  ".xml",
  ".yaml",
  ".yml"
]);

const ENTRY_PATTERNS = [
  { stack: "Java/Spring", kind: "HTTP/Controller", regex: /@(?:RestController|Controller|RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|WebServlet)\b/ },
  { stack: "Java/Batch", kind: "Scheduled/Job", regex: /@(?:Scheduled|RabbitListener|KafkaListener|JmsListener)\b/ },
  { stack: "C#/.NET", kind: "HTTP/Controller", regex: /\[(?:ApiController|Controller|Route|HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)\b/ },
  { stack: "C#/.NET", kind: "MinimalAPI", regex: /\.(?:MapGet|MapPost|MapPut|MapDelete|MapPatch)\s*\(/ },
  { stack: "JS/TS", kind: "HTTP/Router", regex: /\b(?:app|router|fastify)\.(?:get|post|put|delete|patch|all)\s*\(/i },
  { stack: "JS/TS/Nest", kind: "Controller/Method", regex: /@(?:Controller|Get|Post|Put|Delete|Patch)\s*\(/ },
  { stack: "Next.js", kind: "AppRouter", regex: /^\s*export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|DELETE|PATCH)\b/ },
  { stack: "Python", kind: "HTTP/Route", regex: /@(?:app|router|bp|blueprint)\.(?:route|get|post|put|delete|patch)\s*\(/ },
  { stack: "Python/Django", kind: "URLPattern", regex: /\b(?:path|re_path|url)\s*\(\s*['"]/ },
  { stack: "PHP", kind: "HTTP/Route", regex: /\bRoute::(?:get|post|put|delete|patch|any|match)\s*\(/ },
  { stack: "Go", kind: "HTTP/Handler", regex: /(?:http\.HandleFunc|\.(?:HandleFunc|GET|POST|PUT|DELETE|PATCH))\s*\(/ },
  { stack: "Ruby/Rails", kind: "Route", regex: /^\s*(?:resources?|get|post|put|patch|delete)\s+[:'"]/ },
  { stack: "Legacy/Config", kind: "XML/Route", regex: /<(?:servlet-mapping|action\s+path=|url-pattern)\b/i }
];

function walkSourceFiles(rootDir, currentDir = rootDir, acc = { totalFiles: 0, sourceFiles: [] }, extraIgnoredDirs = null) {
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch (_) {
    return acc;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    if (extraIgnoredDirs && currentDir === rootDir && extraIgnoredDirs.has(entry.name)) continue;
    const absPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(rootDir, absPath, acc, extraIgnoredDirs);
    } else if (entry.isFile()) {
      acc.totalFiles += 1;
      if (/\.(?:test|spec)\.[a-z0-9]+$/i.test(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.has(ext)) {
        acc.sourceFiles.push({
          absPath,
          relPath: path.relative(rootDir, absPath).replace(/\\/g, "/"),
          ext
        });
      }
    }
  }
  return acc;
}

function isCommentLine(trimmedLine) {
  return (
    trimmedLine.startsWith("//") ||
    trimmedLine.startsWith("/*") ||
    trimmedLine.startsWith("*") ||
    trimmedLine.startsWith("#") ||
    trimmedLine.startsWith("<!--")
  );
}

function scanEntryCandidates(cwd, args = []) {
  const writeIndex = args.includes("--write-index");
  const forceOverwrite = args.includes("--force");
  const jsonMode = args.includes("--json");
  const targetOpt = getOption(args, "--target");
  const positionals = getPositionalArgs(args, ["--target"]);
  const rawTarget = targetOpt || positionals[0] || getTargetSystemPathFromOverview(cwd);

  if (!rawTarget) {
    fail("找不到目標系統路徑，請指定路徑或先執行 init --target <path>：\n  refactor-analyze scan-entries <目標系統路徑> [--write-index] [--force]");
    return null;
  }

  const resolvedTarget = path.resolve(cwd, rawTarget);
  if (!fs.existsSync(resolvedTarget) || !fs.statSync(resolvedTarget).isDirectory()) {
    fail(`目標系統路徑不存在或不是資料夾: ${resolvedTarget}`);
    return null;
  }

  const sameAsWorkspace = resolvedTarget === path.resolve(cwd);
  const walked = walkSourceFiles(
    resolvedTarget,
    resolvedTarget,
    { totalFiles: 0, sourceFiles: [] },
    sameAsWorkspace ? WORKSPACE_SELF_DIRS : null
  );
  const candidates = [];
  const seenKeys = new Set();

  const pushCandidate = (cand) => {
    const key = `${cand.file}#L${cand.line}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    candidates.push(cand);
  };

  for (const file of walked.sourceFiles) {
    // Legacy JSP / ASPX direct page entry points
    if ([".jsp", ".aspx", ".ashx", ".asmx"].includes(file.ext)) {
      pushCandidate({
        file: file.relPath,
        line: 1,
        stack: "LegacyPage",
        kind: "Page/Handler",
        snippet: path.basename(file.relPath)
      });
    }

    let content = "";
    try {
      const stat = fs.statSync(file.absPath);
      if (stat.size > 1024 * 1024) continue; // skip >1MB generated/minified files
      content = fs.readFileSync(file.absPath, "utf8");
    } catch (_) {
      continue;
    }

    const lines = content.replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || isCommentLine(trimmed)) continue;
      for (const pat of ENTRY_PATTERNS) {
        if (pat.regex.test(trimmed)) {
          pushCandidate({
            file: file.relPath,
            line: i + 1,
            stack: pat.stack,
            kind: pat.kind,
            snippet: trimmed.slice(0, 120)
          });
          break;
        }
      }
    }
  }

  const now = formatLocalDateTime(new Date());
  const sysDir = path.join(cwd, "project", "system");
  fs.mkdirSync(sysDir, { recursive: true });
  const outPath = path.join(sysDir, "entry-candidates.md");

  const recommendedMode =
    walked.sourceFiles.length <= 200
      ? "1. 全 AI 掃描 或 3. 混合掃描（中小型專案）"
      : "3. 混合掃描（先讀本候選清單，再由 AI 語意分類與補漏）";

  const rows =
    candidates.length > 0
      ? candidates
          .map(
            (c, idx) =>
              `| ${idx + 1} | \`${c.stack}\` | ${c.kind} | \`${c.file}#L${c.line}\` | \`${c.snippet.replace(/`/g, "'").replace(/\|/g, "\\|")}\` |`
          )
          .join("\n")
      : "| - | - | - | - | *(未偵測到常見標準路由關鍵字，建議改用「1. 全 AI 掃描」檢查動態路由或設定檔)* |";

  const md = `# 候選進入點與程式規模預掃描清單 (Entry Candidates)

- **掃描時間**：\`${now}\`
- **目標系統路徑**：\`${resolvedTarget}\`
- **專案總檔案數**：\`${walked.totalFiles}\`（程式碼/設定檔 \`${walked.sourceFiles.length}\` 支）
- **偵測到候選進入點特徵數**：\`${candidates.length}\`
- **建議掃描模式**：${recommendedMode}

> **使用說明**：本檔案由 CLI \`refactor-analyze scan-entries\` 以 **0-Token** 規則掃描產出。若採用「3. 混合掃描」，AI 可直接依據下方 \`#L行號\` 清單進行語意判讀、業務模組分類與補漏，遇到動態路由或疑似廢棄項目時主動向使用者提問。

| 序號 | 技術類型 | 類型 | 程式位置 | 偵測片段 |
|---|---|---|---|---|
${rows}
`;
  fs.writeFileSync(outPath, md, "utf8");

  let wroteIndex = false;
  if (writeIndex) {
    const existingItems = parseIndexItems(cwd);
    if (existingItems.length > 0 && !forceOverwrite) {
      fail(
        `安全保護：project/index.md 已包含 ${existingItems.length} 筆既有項目，為避免遺失既有分析進度已中止覆寫（候選清單仍已輸出至 project/system/entry-candidates.md）。若確定要覆寫，請加上 --force。`
      );
    } else {
      const indexPath = path.join(cwd, "project", "index.md");
      const indexRows =
        candidates.length > 0
          ? candidates
              .map((c, idx) => {
                const id = String(idx + 1).padStart(3, "0");
                const safeLabel = `${path.basename(c.file)} (${c.kind})`.replace(/\|/g, "\\|");
                return `| \`${id}\` | ${safeLabel} | \`${c.file}#L${c.line}\` | 待評估 | 待分析 |`;
              })
              .join("\n")
          : "| `001` | *(未偵測到標準路由，請改用全 AI 掃描或手動補充)* | `待確認` | 待評估 | 待分析 |";

      const indexMd = `# 功能與 API 分類編號總清單

> **說明**：本清單由 \`refactor-analyze scan-entries --write-index\`（程式掃描模式）自動產出初版。建議仍由 AI 或人工檢視業務模組分類與動態路由缺漏。

## 分類：程式掃描初版清單 (Programmatic Scan)

| 編號 | 功能或 API | 程式的位置（進入點） | 複雜度 | 目前的狀態 |
|---|---|---|---|---|
${indexRows}
`;
      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
      fs.writeFileSync(indexPath, indexMd, "utf8");
      wroteIndex = true;
    }
  }

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          targetPath: resolvedTarget,
          totalFiles: walked.totalFiles,
          sourceFiles: walked.sourceFiles.length,
          candidateCount: candidates.length,
          outputFile: "project/system/entry-candidates.md",
          wroteIndex
        },
        null,
        2
      )
    );
  } else {
    console.log("refactor-analyze scan-entries (0-Token 程式規模與候選進入點掃描)");
    console.log(`目標系統: ${resolvedTarget}`);
    console.log(`檔案規模: 共 ${walked.totalFiles} 檔（程式碼/設定檔 ${walked.sourceFiles.length} 支）`);
    console.log(`候選進入點: 偵測到 ${candidates.length} 處特徵`);
    console.log(`已輸出候選清單: project/system/entry-candidates.md`);
    if (wroteIndex) {
      console.log(`已自動寫入初版清單: project/index.md`);
    }
  }

  return {
    totalFiles: walked.totalFiles,
    sourceFiles: walked.sourceFiles.length,
    candidates
  };
}

module.exports = {
  scanEntryCandidates
};
