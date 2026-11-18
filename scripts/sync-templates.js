#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const templatesDir = path.join(rootDir, "templates");
const checkOnly = process.argv.includes("--check");

const syncPairs = [
  { src: "AGENTS.md", dest: "AGENTS.md" },
  { src: path.join("skills", "refactor-analyze", "SKILL.md"), dest: path.join("skills", "refactor-analyze", "SKILL.md") }
];

const templateRulesDir = path.join(templatesDir, "rules");
if (fs.existsSync(templateRulesDir)) {
  for (const file of fs.readdirSync(templateRulesDir)) {
    if (file.endsWith(".md")) {
      syncPairs.push({
        src: path.join("rules", file),
        dest: path.join("rules", file)
      });
    }
  }
}

let hasDrift = false;

for (const pair of syncPairs) {
  const srcPath = path.join(templatesDir, pair.src);
  const destPath = path.join(rootDir, pair.dest);

  if (!fs.existsSync(srcPath)) {
    console.error(`[sync-templates] Missing source template: ${pair.src}`);
    process.exitCode = 1;
    continue;
  }

  const srcContent = fs.readFileSync(srcPath, "utf8");
  const destExists = fs.existsSync(destPath);
  const destContent = destExists ? fs.readFileSync(destPath, "utf8") : null;

  if (srcContent !== destContent) {
    if (checkOnly) {
      hasDrift = true;
      console.error(
        `[sync-templates] DRIFT: ${pair.dest} differs from templates/${pair.src}. Run "npm run sync-templates" to synchronize.`
      );
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, srcContent, "utf8");
      console.log(`[sync-templates] SYNCED: templates/${pair.src} -> ${pair.dest}`);
    }
  }
}

if (checkOnly) {
  if (hasDrift) {
    process.exitCode = 1;
  } else {
    console.log(`[sync-templates] OK: All ${syncPairs.length} files match templates/ single source of truth.`);
  }
}
