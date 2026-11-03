const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  normalizeItemId,
  listFilesRecursive,
  getOption,
  printResultList,
  fail
} = require("./utils");

function exportMarkdownToPdf(cwd, args = []) {
  const outputOpt = getOption(args, "--output") || getOption(args, "-o");
  const mergeMode = args.includes("--merge") || args.includes("-m");
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
    const combinedHtml = wrapHtmlDocument(
      sections.join('\n<div class="page-break"></div>\n'),
      "Refactor Analysis Report"
    );
    const ok = renderHtmlToPdf(combinedHtml, finalPdf, browserBin);
    if (ok) {
      results.push({
        action: "create",
        target: path.relative(cwd, finalPdf),
        message: `已合併 ${mdFiles.length} 份 Markdown 為單一 PDF`
      });
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
      const ok = renderHtmlToPdf(html, outPdf, browserBin);
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

function renderHtmlToPdf(htmlContent, outputPdfPath, browserBin) {
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

    const wkRes = spawnSync("wkhtmltopdf", ["--enable-local-file-access", tmpHtmlPath, outputPdfPath], {
      encoding: "utf8"
    });
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

module.exports = {
  exportMarkdownToPdf,
  markdownToHtmlBody,
  wrapHtmlDocument
};
