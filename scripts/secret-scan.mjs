/**
 * A bounded, dependency-free check for accidentally committed credentials.
 * This is a supplemental pattern scan, not a guarantee that all secrets are found.
 * Findings contain only a repository-relative path, line number, and rule name.
 */
import assert from "node:assert/strict";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(
  fileURLToPath(new URL("../", import.meta.url)),
);
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  ".vercel",
  ".local",
  ".codex",
  ".agents",
  ".portfolio-audit",
  ".npm-cache",
  ".cache",
  ".turbo",
  ".pnpm-store",
  ".yarn",
  "coverage",
  "test-results",
  "playwright-report",
  "dist",
  "build",
]);
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".md",
  ".mdx",
  ".txt",
  ".yml",
  ".yaml",
  ".toml",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".svg",
  ".xml",
  ".sh",
  ".bash",
  ".ps1",
  ".bat",
  ".cmd",
  ".sql",
  ".graphql",
  ".gql",
  ".ini",
  ".conf",
  ".config",
  ".properties",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".php",
]);
const TEXT_FILENAMES = new Set([
  ".gitignore",
  ".vercelignore",
  ".npmrc",
  ".yarnrc",
  ".netrc",
  ".pypirc",
  "dockerfile",
  "makefile",
  "license",
]);
const ENV_EXAMPLES = new Set([".env.example", ".env.sample", ".env.template"]);

const TOKEN_RULES = [
  {
    id: "private-key",
    pattern:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
  },
  {
    id: "github-token",
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b/g,
  },
  { id: "gitlab-token", pattern: /\bglpat-[A-Za-z0-9_-]{20,255}\b/g },
  {
    id: "slack-token",
    pattern:
      /\b(?:xox[baprs]-[A-Za-z0-9-]{10,200}|xapp-\d-[A-Za-z0-9-]{20,200})\b/g,
  },
  {
    id: "stripe-secret",
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,255}\b/g,
  },
  {
    id: "ai-api-token",
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,255}\b/g,
  },
  { id: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { id: "google-api-key", pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g },
  {
    id: "sendgrid-token",
    pattern: /\bSG\.[A-Za-z0-9_-]{16,255}\.[A-Za-z0-9_-]{16,255}\b/g,
  },
  { id: "npm-token", pattern: /\bnpm_[A-Za-z0-9]{36,255}\b/g },
  {
    id: "jwt-token",
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,255}\.[A-Za-z0-9_-]{10,255}\.[A-Za-z0-9_-]{10,255}\b/g,
  },
  {
    id: "authorization-value",
    pattern: /\b(?:Bearer|Basic)\s+[A-Za-z0-9/+_.=-]{20,512}\b/g,
  },
];
const CREDENTIAL_ASSIGNMENT =
  /\b[A-Za-z0-9_-]*(?:api[_-]?key|client[_-]?secret|secret|password|passwd|access[_-]?token|auth[_-]?token|refresh[_-]?token|private[_-]?key|credentials?|token)["']?\s*[:=]\s*(?:(["'\x60])([^"'\x60\r\n]{4,})\1|([A-Za-z0-9_./+=@:-]{8,}))/gi;
const CREDENTIAL_URL =
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|https?):\/\/[^/\s:@]+:([^@\s]{4,})@/gi;

function isPlaceholder(value) {
  const trimmed = value.trim();
  return (
    /^(?:true|false|null|undefined|omit|include|same-origin|REDACTED)$/i.test(
      trimmed,
    ) ||
    /^(?:your[-_]|replace[-_]|example[-_]|dummy[-_]|placeholder|changeme)/i.test(
      trimmed,
    ) ||
    /^<[^>]+>$/.test(trimmed) ||
    /^\$\{[\s\S]+\}$/.test(trimmed) ||
    /^(?:process\.env\.|import\.meta\.env\.|secrets\.|github\.|env\.)/.test(
      trimmed,
    )
  );
}

function safePath(filename) {
  // JSON quoting keeps Windows separators and control characters safe in logs.
  return JSON.stringify(filename.split(path.sep).join("/"));
}

function lineAt(contents, index) {
  return contents.slice(0, index).split(/\r\n|\r|\n/).length;
}

export function scanText(contents, filename) {
  const findings = [];
  const seen = new Set();
  function add(index, rule) {
    const line = lineAt(contents, index);
    const key = line + ":" + rule;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ path: filename.split(path.sep).join("/"), line, rule });
  }

  for (const rule of TOKEN_RULES) {
    for (const match of contents.matchAll(rule.pattern))
      add(match.index, rule.id);
  }
  for (const match of contents.matchAll(CREDENTIAL_ASSIGNMENT)) {
    const value = match[2] ?? match[3];
    if (!isPlaceholder(value)) add(match.index, "credential-assignment");
  }
  for (const match of contents.matchAll(CREDENTIAL_URL)) {
    if (!isPlaceholder(match[1])) add(match.index, "credential-in-url");
  }
  return findings;
}

function withinRoot(root, candidate, paths = path) {
  const relative = paths.relative(root, candidate);
  return (
    relative === "" ||
    (!paths.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(".." + paths.sep))
  );
}

function isCredentialFile(filename) {
  const name = filename.toLowerCase();
  if (ENV_EXAMPLES.has(name)) return false;
  return (
    /^\.env(?:\.|$)/.test(name) ||
    /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/.test(name) ||
    /\.(?:pem|key|p12|pfx)$/.test(name)
  );
}

function isTextFile(filename) {
  const name = filename.toLowerCase();
  return (
    TEXT_FILENAMES.has(name) ||
    ENV_EXAMPLES.has(name) ||
    TEXT_EXTENSIONS.has(path.extname(name))
  );
}

async function scanRepository() {
  const root = await realpath(PROJECT_ROOT);
  const project = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  if (project.name !== "apology-ai") throw new Error("Unexpected project");
  const findings = [];
  let checkedFiles = 0;
  let skippedEntries = 0;

  async function walk(directory) {
    const relativeDirectory = path.relative(root, directory) || ".";
    let entries;
    try {
      const resolvedDirectory = await realpath(directory);
      if (!withinRoot(root, resolvedDirectory)) {
        findings.push({
          path: relativeDirectory,
          line: 0,
          rule: "outside-project",
        });
        return;
      }
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      findings.push({
        path: relativeDirectory,
        line: 0,
        rule: "unreadable-directory",
      });
      return;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (
        EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase()) ||
        entry.isSymbolicLink()
      ) {
        skippedEntries += 1;
        continue;
      }
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) {
        skippedEntries += 1;
        continue;
      }
      if (isCredentialFile(entry.name)) {
        // Flag the presence of a local credential file without reading its contents.
        findings.push({
          path: relative,
          line: 0,
          rule: "credential-file-present",
        });
        continue;
      }
      if (!isTextFile(entry.name)) {
        skippedEntries += 1;
        continue;
      }
      try {
        const metadata = await lstat(absolute);
        if (metadata.isSymbolicLink()) {
          skippedEntries += 1;
          continue;
        }
        const resolved = await realpath(absolute);
        if (!withinRoot(root, resolved)) {
          findings.push({ path: relative, line: 0, rule: "outside-project" });
          continue;
        }
        if (metadata.size > MAX_TEXT_BYTES) {
          findings.push({
            path: relative,
            line: 0,
            rule: "unscanned-oversized-text",
          });
          continue;
        }
        const bytes = await readFile(resolved);
        if (bytes.includes(0)) {
          findings.push({
            path: relative,
            line: 0,
            rule: "unexpected-binary-text",
          });
          continue;
        }
        checkedFiles += 1;
        findings.push(...scanText(bytes.toString("utf8"), relative));
      } catch {
        findings.push({ path: relative, line: 0, rule: "unreadable-file" });
      }
    }
  }

  await walk(root);
  for (const finding of findings) {
    console.error(
      safePath(finding.path) + ":" + finding.line + " " + finding.rule,
    );
  }
  if (findings.length > 0) {
    console.error(
      "Secret scan failed: " +
        findings.length +
        " finding(s). Values are never printed.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Secret scan passed: " +
        checkedFiles +
        " text files checked; " +
        skippedEntries +
        " entries excluded.",
    );
    console.log(
      "No supported secret patterns found. This scan does not guarantee the absence of secrets.",
    );
  }
}

function runSelfTests() {
  // Synthetic fixtures are assembled in memory and are never written or printed.
  const generated = "A".repeat(40);
  const assignment = (name, value) =>
    "const " + name + " = " + JSON.stringify(value) + ";";
  const fixtures = [
    { text: ["-----BEGIN ", "PRIVATE KEY-----"].join(""), rule: "private-key" },
    { text: ["gh", "p_", "A".repeat(36)].join(""), rule: "github-token" },
    { text: ["gl", "pat-", generated].join(""), rule: "gitlab-token" },
    { text: ["xo", "xb-", generated].join(""), rule: "slack-token" },
    { text: ["sk", "_live_", generated].join(""), rule: "stripe-secret" },
    { text: ["sk", "-proj-", generated].join(""), rule: "ai-api-token" },
    { text: ["AK", "IA", "A".repeat(16)].join(""), rule: "aws-access-key" },
    { text: ["AI", "za", "A".repeat(35)].join(""), rule: "google-api-key" },
    {
      text: ["S", "G.", generated, ".", generated].join(""),
      rule: "sendgrid-token",
    },
    { text: ["np", "m_", generated].join(""), rule: "npm-token" },
    {
      text: ["ey", "J", generated, ".", generated, ".", generated].join(""),
      rule: "jwt-token",
    },
    { text: ["Bear", "er ", generated].join(""), rule: "authorization-value" },
    { text: assignment("apiKey", generated), rule: "credential-assignment" },
    {
      text: ["DATABASE_PASS", "WORD=", generated].join(""),
      rule: "credential-assignment",
    },
    {
      text: ["postgresql://user:", generated, "@example.invalid/db"].join(""),
      rule: "credential-in-url",
    },
  ];
  for (const fixture of fixtures) {
    const findings = scanText(
      "first line\r\n" + fixture.text,
      path.join("src", "fixture.ts"),
    );
    assert(
      findings.some(
        (finding) => finding.rule === fixture.rule && finding.line === 2,
      ),
    );
    assert(
      findings.every(
        (finding) => Object.keys(finding).sort().join(",") === "line,path,rule",
      ),
    );
    assert(!JSON.stringify(findings).includes(generated));
  }
  const safeExamples = [
    assignment("apiKey", "your-api-key"),
    assignment("password", "<replace-me>"),
    "const apiKey = process.env.EXAMPLE_API_KEY;",
    "GITHUB_TOKEN: " + "$" + "{{ github.token }}",
    "const token = import.meta.env.EXAMPLE_TOKEN;",
    'const credentials = "same-origin";',
    assignment("Secret", "REDACTED"),
  ];
  for (const example of safeExamples)
    assert.equal(scanText(example, "example.ts").length, 0);
  assert(withinRoot("C:\\repo", "C:\\repo\\src\\app.ts", path.win32));
  assert(!withinRoot("C:\\repo", "C:\\repository\\private.txt", path.win32));
  assert(!withinRoot("C:\\repo", "D:\\private.txt", path.win32));
  assert(!withinRoot("/repo", "/private.txt", path.posix));
  assert(isCredentialFile(".env.local"));
  assert(!isCredentialFile(".env.example"));
  console.log(
    "Secret scanner self-test passed: " +
      fixtures.length +
      " detection cases, " +
      safeExamples.length +
      " safe cases, and path-boundary checks.",
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--self-test") {
    runSelfTests();
  } else if (args.length === 0) {
    await scanRepository();
  } else {
    console.error("Usage: node scripts/secret-scan.mjs [--self-test]");
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);
const directlyInvoked =
  process.platform === "win32"
    ? invokedPath.toLowerCase() === modulePath.toLowerCase()
    : invokedPath === modulePath;
if (directlyInvoked) {
  main().catch(() => {
    // Avoid printing stack traces or filesystem contents from a failed scan.
    console.error(
      "Secret scan could not complete. Check repository access and scanner configuration.",
    );
    process.exitCode = 2;
  });
}
