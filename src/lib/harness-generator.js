const fs = require("fs");
const path = require("path");
const { normalizeItemId, fail } = require("./utils");

function sanitizeIdentifier(name) {
  return String(name || "Feature")
    .replace(/[^a-zA-Z0-9_]/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function sanitizeMethodName(name) {
  const pascal = sanitizeIdentifier(name);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "testCase";
}

function parseTestCasesFromBusinessLogic(content) {
  const testCases = [];
  const lines = (content || "").split("\n");
  let inTestSection = false;

  for (const line of lines) {
    if (line.includes("重構驗收測試情境") || line.includes("Acceptance Test Scenarios")) {
      inTestSection = true;
      continue;
    }
    if (inTestSection && line.startsWith("## ")) {
      break;
    }
    if (inTestSection && line.startsWith("|") && !line.includes("情境編號") && !line.includes("---")) {
      const parts = line
        .split("|")
        .map((p) => p.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 4) {
        const id = parts[0].replace(/`/g, "").trim();
        const name = parts[1].replace(/`/g, "").trim();
        if (!id || id.includes("待 AI") || name.includes("待 AI")) continue;
        testCases.push({
          id,
          name: name || id,
          given: parts[2] || "-",
          when: parts[3] || "-",
          then: parts[4] || "-",
          ruleRef: parts[5] || "-"
        });
      }
    }
  }

  // Fallback if no valid test cases found in document yet
  if (testCases.length === 0) {
    testCases.push({
      id: "TC-01",
      name: "should_execute_primary_business_flow_successfully",
      given: "Valid input payload matching legacy system preconditions",
      when: "Executing entrypoint with business requirements fulfilled",
      then: "Expected state transition completes and expected output is returned",
      ruleRef: "BR-01"
    });
    testCases.push({
      id: "TC-02",
      name: "should_intercept_invalid_preconditions_and_reject",
      given: "Input payload violating validation criteria",
      when: "Executing entrypoint with invalid parameters",
      then: "Error response returned and no state modification occurs",
      ruleRef: "VAL-01"
    });
  }

  return testCases;
}

function parseAnalysisMetadata(content) {
  const meta = {
    featureName: "LegacyFeature",
    entrypoint: "EntryPoint.execute",
    inputs: [],
    outputs: []
  };

  const nameMatch = (content || "").match(/#\s*(?:分析總覽[：:]\s*)?(?:編號\s*[0-9a-zA-Z_-]+\s*[—-]\s*)?(.+)$/m);
  if (nameMatch) {
    meta.featureName = nameMatch[1].trim();
  }

  const epMatch = (content || "").match(/-\s*\*\*程式進入點[^*]*\*\*：\s*`([^`]+)`/);
  if (epMatch) {
    meta.entrypoint = epMatch[1].trim();
  }

  // Parse input table
  const lines = (content || "").split("\n");
  let inInputSec = false;
  let inOutputSec = false;

  for (const line of lines) {
    if (line.includes("Request / Input Args") || line.includes("輸入參數")) {
      inInputSec = true;
      inOutputSec = false;
      continue;
    }
    if (line.includes("Response / Output") || line.includes("輸出結果")) {
      inInputSec = false;
      inOutputSec = true;
      continue;
    }
    if (line.startsWith("## ")) {
      inInputSec = false;
      inOutputSec = false;
    }

    if (inInputSec && line.startsWith("|") && !line.includes("參數名稱") && !line.includes("---")) {
      const parts = line.split("|").map((p) => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 3 && parts[0] && parts[0] !== "待分析") {
        meta.inputs.push({ name: parts[0], type: parts[2] || "String", required: parts[3] || "YES" });
      }
    }

    if (inOutputSec && line.startsWith("|") && !line.includes("欄位或狀態碼") && !line.includes("---")) {
      const parts = line.split("|").map((p) => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 2 && parts[0] && parts[0] !== "待分析") {
        meta.outputs.push({ name: parts[0], type: parts[1] || "Object" });
      }
    }
  }

  return meta;
}

function detectTargetFramework(cwd, userSpecified) {
  if (userSpecified) {
    const f = userSpecified.toLowerCase();
    if (["junit", "java"].includes(f)) return "junit";
    if (["jest", "vitest", "js", "ts", "javascript", "typescript"].includes(f)) return "jest";
    if (["pytest", "python", "py"].includes(f)) return "pytest";
  }

  // Auto-detect based on target directory artifacts
  const overviewPath = path.join(cwd, "project", "system", "overview.md");
  if (fs.existsSync(overviewPath)) {
    const ov = fs.readFileSync(overviewPath, "utf8").toLowerCase();
    if (ov.includes("java") || ov.includes("spring") || ov.includes("c#") || ov.includes(".net")) {
      return "junit";
    }
    if (ov.includes("python") || ov.includes("django") || ov.includes("flask")) {
      return "pytest";
    }
    if (ov.includes("node") || ov.includes("express") || ov.includes("react") || ov.includes("vue")) {
      return "jest";
    }
  }

  return "junit";
}

function generateJUnitHarness(itemId, meta, testCases) {
  const className = sanitizeIdentifier(meta.featureName) || `Feature${itemId}`;
  const testMethods = testCases
    .map((tc) => {
      const methodName = sanitizeMethodName(tc.name || tc.id);
      return `    /**
     * [${tc.id}] ${tc.name}
     * 對應規則: ${tc.ruleRef}
     * Given: ${tc.given}
     * When:  ${tc.when}
     * Then:  ${tc.then}
     */
    @Test
    @DisplayName("${tc.id}: ${tc.name}")
    void ${methodName}() {
        // [GIVEN] 前置條件與測試資料準備
        // Precondition: ${tc.given}

        // [WHEN] 執行被重構之目標業務邏輯
        // Target entrypoint: ${meta.entrypoint}
        // Action: ${tc.when}

        // [THEN] 斷言預期結果、狀態碼與資料庫變更
        // Expected outcome: ${tc.then}
        // assertEquals(expected, actual);
    }`;
    })
    .join("\n\n");

  return `package com.refactor.harness.item${itemId};

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 重構驗收測試治具 (Refactoring Test Harness)
 * 功能編號: ${itemId} — ${meta.featureName}
 * 原進入點: ${meta.entrypoint}
 * 
 * 💡 本治具依據 project/${itemId}/business-logic.md 與 analysis.md 自動產出，
 * 供重構開發者與 QA 團隊建立 Characterization / Unit / Integration Tests。
 */
@DisplayName("Refactor Harness: ${itemId} - ${meta.featureName}")
public class ${className}Test {

    @BeforeEach
    void setUp() {
        // 初始化重構測試環境與 Mock 依賴
    }

${testMethods}
}
`;
}

function generateJestHarness(itemId, meta, testCases) {
  const testBlocks = testCases
    .map((tc) => {
      return `  /**
   * [${tc.id}] ${tc.name}
   * 對應規則: ${tc.ruleRef}
   * Given: ${tc.given}
   * When:  ${tc.when}
   * Then:  ${tc.then}
   */
  test('${tc.id}: ${tc.name.replace(/'/g, "\\'")}', async () => {
    // [GIVEN] 前置條件與測試資料準備: ${tc.given}

    // [WHEN] 呼叫重構後的服務或 API 進入點 (${meta.entrypoint}): ${tc.when}

    // [THEN] 斷言回傳值、狀態與 DB 變更: ${tc.then}
    // expect(result).toBeDefined();
  });`;
    })
    .join("\n\n");

  return `/**
 * 重構驗收測試治具 (Refactoring Test Harness)
 * 功能編號: ${itemId} — ${meta.featureName}
 * 原進入點: ${meta.entrypoint}
 * 
 * 💡 本治具依據 project/${itemId}/business-logic.md 與 analysis.md 自動產出。
 */

describe('Refactor Harness [${itemId}]: ${meta.featureName.replace(/'/g, "\\'")}', () => {
  beforeEach(() => {
    // 初始化測試環境與 Mock 物件
  });

${testBlocks}
});
`;
}

function generatePytestHarness(itemId, meta, testCases) {
  const testFunctions = testCases
    .map((tc) => {
      const funcName = sanitizeMethodName(tc.name || tc.id)
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase();
      return `def test_${funcName}():
    """
    [${tc.id}] ${tc.name}
    對應規則: ${tc.ruleRef}
    Given: ${tc.given}
    When:  ${tc.when}
    Then:  ${tc.then}
    """
    # [GIVEN] 前置條件: ${tc.given}

    # [WHEN] 執行進入點 (${meta.entrypoint}): ${tc.when}

    # [THEN] 斷言預期結果: ${tc.then}
    assert True
`;
    })
    .join("\n\n");

  return `"""
重構驗收測試治具 (Refactoring Test Harness)
功能編號: ${itemId} — ${meta.featureName}
原進入點: ${meta.entrypoint}

💡 本治具依據 project/${itemId}/business-logic.md 與 analysis.md 自動產出。
"""

import pytest

${testFunctions}
`;
}

function generateTestHarness(cwd, rawId, frameworkArg = null, outputDirArg = null) {
  if (!rawId) {
    fail("請指定要產生測試治具的編號，例如：refactor-analyze gen-test 001");
    return null;
  }

  const itemId = normalizeItemId(rawId);
  const itemDir = path.join(cwd, "project", itemId);
  if (!fs.existsSync(itemDir)) {
    fail(`找不到編號目錄 project/${itemId}，請先執行 refactor-analyze analyze ${itemId}`);
    return null;
  }

  const bizPath = path.join(itemDir, "business-logic.md");
  const analysisPath = path.join(itemDir, "analysis.md");

  const bizContent = fs.existsSync(bizPath) ? fs.readFileSync(bizPath, "utf8") : "";
  const analysisContent = fs.existsSync(analysisPath) ? fs.readFileSync(analysisPath, "utf8") : "";

  const meta = parseAnalysisMetadata(analysisContent);
  const testCases = parseTestCasesFromBusinessLogic(bizContent);
  const framework = detectTargetFramework(cwd, frameworkArg);

  const targetDir = outputDirArg ? path.resolve(cwd, outputDirArg) : path.join(itemDir, "harness");
  fs.mkdirSync(targetDir, { recursive: true });

  let fileName = "";
  let fileContent = "";

  if (framework === "junit") {
    const className = sanitizeIdentifier(meta.featureName) || `Feature${itemId}`;
    fileName = `${className}Test.java`;
    fileContent = generateJUnitHarness(itemId, meta, testCases);
  } else if (framework === "pytest") {
    const baseName = sanitizeIdentifier(meta.featureName).toLowerCase();
    fileName = `test_${baseName || `feature_${itemId}`}.py`;
    fileContent = generatePytestHarness(itemId, meta, testCases);
  } else {
    // jest
    const baseName = sanitizeIdentifier(meta.featureName).toLowerCase();
    fileName = `${baseName || `feature-${itemId}`}.test.js`;
    fileContent = generateJestHarness(itemId, meta, testCases);
  }

  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, fileContent, "utf8");

  console.log(`[Harness] 已成功為編號 ${itemId} (${meta.featureName}) 產生測試治具代碼：`);
  console.log(`  - 框架類型: ${framework.toUpperCase()}`);
  console.log(`  - 驗收測試案例: ${testCases.length} 個 (來自 business-logic.md)`);
  console.log(`  - 檔案路徑: ${path.relative(cwd, filePath)}`);

  return {
    itemId,
    framework,
    filePath,
    testCasesCount: testCases.length
  };
}

module.exports = {
  sanitizeIdentifier,
  sanitizeMethodName,
  parseTestCasesFromBusinessLogic,
  parseAnalysisMetadata,
  detectTargetFramework,
  generateJUnitHarness,
  generateJestHarness,
  generatePytestHarness,
  generateTestHarness
};
