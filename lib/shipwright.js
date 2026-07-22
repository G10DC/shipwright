// lib/shipwright.js
// shipwright Core Engine - ESM, zero-dependencies.
// Handles naming, safety verification, boilerplate generation, and atomic git operations.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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
  const pattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|opt)(\([a-z0-9-]+\))?: .+/;
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
  const secretPatterns = [
    /api[-_]?key/i,
    /secret/i,
    /password/i,
    /private[-_]?key/i,
    /bearer/i,
    /db[-_]?password/i
  ];

  const piiPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{3}-\d{2}-\d{4}\b/                                 // SSN/General ID shapes
  ];

  const traverse = (dir) => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === '.cache') continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else {
        // Warning on env files
        if (item.startsWith('.env') && item !== '.env.example') {
          warnings.push(`Sensitive environment file detected: ${path.relative(targetDir, fullPath)}`);
          continue;
        }
        // Warning on key files
        if (item.endsWith('.pem') || item.endsWith('.key')) {
          warnings.push(`Cryptographic key file detected: ${path.relative(targetDir, fullPath)}`);
          continue;
        }

        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            secretPatterns.forEach(pattern => {
              if (pattern.test(line) && line.includes('=')) {
                warnings.push(`Potential secret match in ${path.relative(targetDir, fullPath)}:L${idx + 1}`);
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
  const visFlag = isPublic ? '--public' : '--private';
  const descFlag = description ? `--description "${description}"` : '';

  // Initialize git if not initialized
  if (!fs.existsSync(path.join(targetDir, '.git'))) {
    execSync('git init', { cwd: targetDir });
  }

  // Create repo via gh CLI
  try {
    execSync(`gh repo create "${repoName}" ${visFlag} ${descFlag} --source=. --confirm`, { cwd: targetDir });
  } catch (err) {
    if (err.message.includes('already exists')) {
      // If it already exists, just link/edit
      execSync(`gh repo edit --description "${description}"`, { cwd: targetDir });
    } else {
      throw err;
    }
  }

  // Set topics
  if (topics && topics.length > 0) {
    const topicsCsv = topics.join(',');
    execSync(`gh repo edit --add-topic "${topicsCsv}"`, { cwd: targetDir });
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

  execSync('git add .', { cwd: targetDir });
  
  // Only commit if there are changes
  const status = execSync('git status --porcelain', { cwd: targetDir, encoding: 'utf8' });
  if (status.trim().length > 0) {
    execSync(`git commit -m "${commitMessage}"`, { cwd: targetDir });
  }

  // Check if remote is configured
  try {
    execSync(`git push -u origin ${branch}`, { cwd: targetDir });
  } catch (err) {
    // If no remote, warn or handle gracefully
    console.warn(`⚠️ Warning: git push failed. Remote origin may not be set yet: ${err.message}`);
  }

  return { success: true, branch };
}
