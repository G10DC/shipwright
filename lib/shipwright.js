// lib/shipwright.js
// shipwright Core Engine - ESM, zero-dependencies.
// Handles naming, safety verification, boilerplate generation, and atomic git operations.

import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';

// Repo names are used as CLI arguments (never shell-interpolated) but are
// still validated against GitHub's allowed charset to fail fast on bad input.
const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

const MIT_LICENSE_TEXT = (owner) => `MIT License

Copyright (c) ${new Date().getFullYear()} ${owner}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const DEFAULT_GITIGNORE = `# Dependency directories
node_modules/
jspm_packages/
web_modules/

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Environment and secrets
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.pem
*.key

# Operating System Files
.DS_Store
Thumbs.db

# Cache and build folders
.cache/
dist/
build/
coverage/
.system_generated/
`;

const DEFAULT_ESLINT_CONFIG = `import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];
`;

/**
 * Normalizes project name to kebab-case.
 * @param {string} name 
 * @returns {string}
 */
export function normalizeProjectName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Validates if the commit message conforms to Conventional Commits.
 * @param {string} msg 
 * @returns {boolean}
 */
export function validateCommitMessage(msg) {
  // The scope is case-insensitive on purpose. Conventional Commits does not
  // restrict scope casing, and issue/ticket identifiers -- the most common scope
  // in practice -- are conventionally uppercase: feat(T-001), fix(JIRA-42),
  // refactor(RFC-7). A lowercase-only scope silently rejected every one of them
  // while accepting the unscoped form, so callers had to choose between a valid
  // commit and a traceable one.
  const pattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|opt)(\([A-Za-z0-9._/-]+\))?!?: .+/;
  return pattern.test(msg.trim());
}

/**
 * Generates initial boilerplate files in the target directory.
 * @param {string} targetDir 
 * @param {Object} options 
 * @param {string} options.projectName 
 * @param {string} options.owner 
 */
export function generateBoilerplate(targetDir, { projectName, owner }) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const normalized = normalizeProjectName(projectName);

  // README.md
  const readmePath = path.join(targetDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, `# ${normalized}\n\nGenerated with shipwright.\n`);
  }

  // LICENSE (MIT)
  const licensePath = path.join(targetDir, 'LICENSE');
  if (!fs.existsSync(licensePath)) {
    fs.writeFileSync(licensePath, MIT_LICENSE_TEXT(owner || 'G10DC'));
  }

  // .gitignore
  const gitignorePath = path.join(targetDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, DEFAULT_GITIGNORE);
  }

  // eslint.config.js
  const eslintPath = path.join(targetDir, 'eslint.config.js');
  if (!fs.existsSync(eslintPath)) {
    fs.writeFileSync(eslintPath, DEFAULT_ESLINT_CONFIG);
  }
}

/**
 * Scans files in targetDir for potential secrets or PII.
 * @param {string} targetDir 
 * @returns {string[]} List of warnings
 */
export function runSafetyCheck(targetDir) {
  const warnings = [];

  // The keyword form: a name that sounds like a credential, followed by a separator.
  // `:` is here because JSON exists — `{"apiKey": "sk-proj-..."}` used to pass a scan
  // that only accepted `=`, which is most of the configuration files in a repository.
  const secretPatterns = [
    /api[-_]?key/i,
    /secret/i,
    /password/i,
    /private[-_]?key/i,
    /bearer/i,
    /db[-_]?password/i
  ];

  // The value form: what a credential looks like regardless of what it is called.
  // The keyword patterns above only fire when someone names the variable helpfully, and
  // a leaked key does not require a helpful name to be leaked.
  const secretValuePatterns = [
    { name: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
    { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
    { name: 'AWS access key id', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
    { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
    { name: 'Google API key', re: /\bAIza[A-Za-z0-9_-]{35}\b/ },
    { name: 'private key block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  ];

  // Named in the description, and never checked. A published repository carrying these
  // is not zero-trace, which is the one thing this function exists to certify.
  /**
   * Does the line assign an actual value, or only name a place one would go?
   *
   * A credential-shaped name plus a separator was enough to raise a warning, so
   * `.env.example` — a file whose entire purpose is listing key names with no values,
   * and which the env-file check exempts by name two branches earlier — was flagged
   * anyway. So were `token: process.env.TOKEN` and every placeholder in a template.
   *
   * A scan that cries wolf on the file you are meant to commit is a scan people learn
   * to skip, and the last line of the description says never to skip it.
   */
  const PLACEHOLDER = /^(?:<.*>|\.{3,}|x{3,}|changeme|your[-_].*|todo|null|none|true|false)$/i;
  const hasRealValue = (line) => {
    const m = line.match(/[=:]\s*(.*)$/);
    if (!m) return false;
    const value = m[1].trim().replace(/^['"`]|['"`][,;]?$/g, '').trim();
    if (value.length < 8) return false;
    if (PLACEHOLDER.test(value)) return false;
    // A reference is not a secret: it is the correct way to avoid having one here.
    if (/^(?:process\.env|import\.meta\.env|os\.environ|\$\{|\$[A-Z_]+$)/.test(value)) return false;
    return true;
  };

  const osMetadata = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', '.Spotlight-V100', '.Trashes']);
  const buildArtefacts = new Set(['node_modules', 'dist', 'build', 'out', '.next', '.nuxt', 'coverage', '.parcel-cache', '__pycache__']);

  const piiPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{3}-\d{2}-\d{4}\b/                                 // SSN/General ID shapes
  ];

  const traverse = (dir) => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item === '.git') continue;

      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      // Reported, then skipped. Skipping a build directory silently was the reason a
      // scan promising that build artefacts do not leak never mentioned the largest one
      // in the tree: not walking into it was read as nothing being wrong with it.
      if (stat.isDirectory() && buildArtefacts.has(item)) {
        warnings.push(`Build artefact directory present: ${path.relative(targetDir, fullPath) || item}`);
        continue;
      }
      if (item === '.cache') continue;

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else {
        if (osMetadata.has(item)) {
          warnings.push(`OS metadata file detected: ${path.relative(targetDir, fullPath)}`);
          continue;
        }
        // Warning on env files
        if (item.startsWith('.env') && item !== '.env.example') {
          warnings.push(`Sensitive environment file detected: ${path.relative(targetDir, fullPath)}`);
          continue;
        }
        // Warning on key files, by name. Content is checked below as well: a private key
        // is a private key whether or not somebody gave it a helpful extension, and
        // `id_rsa` has none.
        if (item.endsWith('.pem') || item.endsWith('.key') || /^id_(rsa|dsa|ecdsa|ed25519)$/.test(item)) {
          warnings.push(`Cryptographic key file detected: ${path.relative(targetDir, fullPath)}`);
          continue;
        }

        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            secretPatterns.forEach(pattern => {
              if (pattern.test(line) && hasRealValue(line)) {
                warnings.push(`Potential secret match in ${path.relative(targetDir, fullPath)}:L${idx + 1}`);
              }
            });
            secretValuePatterns.forEach(({ name, re }) => {
              if (re.test(line)) {
                warnings.push(`Credential value (${name}) in ${path.relative(targetDir, fullPath)}:L${idx + 1}`);
              }
            });
            piiPatterns.forEach(pattern => {
              if (pattern.test(line)) {
                warnings.push(`Potential PII match in ${path.relative(targetDir, fullPath)}:L${idx + 1}`);
              }
            });
          });
        } catch {
          // Skip binary files
        }
      }
    }
  };

  traverse(targetDir);
  return [...new Set(warnings)];
}

/**
 * Detects the active local branch. Fallback to 'main'.
 * @param {string} targetDir 
 * @returns {string}
 */
export function detectBranch(targetDir) {
  try {
    const head = fs.readFileSync(path.join(targetDir, '.git', 'HEAD'), 'utf8');
    const m = head.match(/ref: refs\/heads\/(.+)/);
    if (m && m[1]) return m[1].trim();
  } catch {
    try {
      return execSync('git branch --show-current', { cwd: targetDir, encoding: 'utf8' }).trim();
    } catch {
      // noop
    }
  }
  return 'main';
}

/**
 * Automates GitHub repository creation and setup using the gh CLI.
 * @param {Object} options 
 * @param {string} options.targetDir 
 * @param {string} options.repoName 
 * @param {string} options.description 
 * @param {boolean} options.isPublic 
 * @param {string[]} options.topics 
 */
export function createGitHubRepo({ targetDir, repoName, description, isPublic, topics }) {
  if (!REPO_NAME_PATTERN.test(repoName)) {
    throw new Error(`Invalid repo name '${repoName}'. Allowed: letters, digits, '.', '_', '-' (max 100 chars).`);
  }

  const visFlag = isPublic ? '--public' : '--private';

  // Initialize git if not initialized
  if (!fs.existsSync(path.join(targetDir, '.git'))) {
    execFileSync('git', ['init'], { cwd: targetDir });
  }

  // No shell: each value is a separate argv entry, so repoName/description can't inject.
  const createArgs = ['repo', 'create', repoName, visFlag, '--source=.', '--confirm'];
  if (description) createArgs.push('--description', description);
  try {
    execFileSync('gh', createArgs, { cwd: targetDir });
  } catch (err) {
    if (err.message.includes('already exists')) {
      // If it already exists, just link/edit
      execFileSync('gh', ['repo', 'edit', '--description', description ?? ''], { cwd: targetDir });
    } else {
      throw err;
    }
  }

  // Set topics
  if (topics && topics.length > 0) {
    const topicArgs = ['repo', 'edit'];
    for (const t of topics) topicArgs.push('--add-topic', t);
    execFileSync('gh', topicArgs, { cwd: targetDir });
  }
}

/**
 * Adds, commits, and pushes to remote with validation.
 * @param {string} targetDir 
 * @param {string} commitMessage 
 * @returns {{success:boolean, branch:string}}
 */
export function commitAndPush(targetDir, commitMessage) {
  if (!validateCommitMessage(commitMessage)) {
    throw new Error(`Invalid commit message format: '${commitMessage}'. Must conform to Conventional Commits.`);
  }

  const branch = detectBranch(targetDir);

  execFileSync('git', ['add', '.'], { cwd: targetDir });

  // Only commit if there are changes
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: targetDir, encoding: 'utf8' });
  if (status.trim().length > 0) {
    execFileSync('git', ['commit', '-m', commitMessage], { cwd: targetDir });
  }

  // Check if remote is configured
  try {
    execFileSync('git', ['push', '-u', 'origin', branch], { cwd: targetDir });
  } catch (err) {
    // If no remote, warn or handle gracefully
    console.warn(`⚠️ Warning: git push failed. Remote origin may not be set yet: ${err.message}`);
  }

  return { success: true, branch };
}
