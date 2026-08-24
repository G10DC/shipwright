// tests/shipwright.test.js
// Offline test suite for shipwright. Ensures all helpers and pipeline validations pass.

import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  normalizeProjectName,
  validateCommitMessage,
  generateBoilerplate,
  runSafetyCheck,
  detectBranch,
  commitAndPush
} from '../lib/shipwright.js';

const TEST_DIR = path.resolve('temp_test_shipwright');

test('normalizeProjectName converts spaces and casing to kebab-case', () => {
  assert.equal(normalizeProjectName('My Awesome Project '), 'my-awesome-project');
  assert.equal(normalizeProjectName('---Dirty---Name---'), 'dirty-name');
  assert.equal(normalizeProjectName('CamelCaseProject'), 'camelcaseproject');
});

test('validateCommitMessage enforces conventional commits structure', () => {
  assert.ok(validateCommitMessage('feat: add core functionality'));
  assert.ok(validateCommitMessage('fix(parser): resolve json crash'));
  assert.ok(validateCommitMessage('docs: update readmes'));
  assert.ok(validateCommitMessage('opt(engine): optimize loop'));
  assert.ok(validateCommitMessage('revert: undo previous commit'));

  // Invalid messages
  assert.ok(!validateCommitMessage('added a feature'));
  assert.ok(!validateCommitMessage('WIP: something'));
  assert.ok(!validateCommitMessage('fix:no space'));
  assert.ok(!validateCommitMessage('random commit message'));
});

test('generateBoilerplate creates all core repository files', () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  generateBoilerplate(TEST_DIR, { projectName: 'Test-Proj', owner: 'TestOwner' });

  assert.ok(fs.existsSync(path.join(TEST_DIR, 'README.md')));
  assert.ok(fs.existsSync(path.join(TEST_DIR, 'LICENSE')));
  assert.ok(fs.existsSync(path.join(TEST_DIR, '.gitignore')));
  assert.ok(fs.existsSync(path.join(TEST_DIR, 'eslint.config.js')));

  const readme = fs.readFileSync(path.join(TEST_DIR, 'README.md'), 'utf8');
  assert.ok(readme.includes('# test-proj'));

  const license = fs.readFileSync(path.join(TEST_DIR, 'LICENSE'), 'utf8');
  assert.ok(license.includes('MIT License'));
  assert.ok(license.includes('TestOwner'));

  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test('runSafetyCheck flags env files, keys, and credentials', () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Create normal file
  fs.writeFileSync(path.join(TEST_DIR, 'index.js'), 'console.log("hello");\n');

  // Create sensitive files
  fs.writeFileSync(path.join(TEST_DIR, '.env'), 'PORT=3000\nDATABASE_URL=postgres://user:password@localhost/db\n');
  fs.writeFileSync(path.join(TEST_DIR, 'server.key'), '-----BEGIN PRIVATE KEY-----\n...\n');

  // Write file with inline API Key / Email
  fs.writeFileSync(
    path.join(TEST_DIR, 'config.js'),
    'const apiKey = "12345-abcde";\nconst mail = "user@example.com";\n'
  );

  const warnings = runSafetyCheck(TEST_DIR);

  assert.ok(warnings.some(w => w.includes('.env')), 'Should flag env files');
  assert.ok(warnings.some(w => w.includes('server.key')), 'Should flag key files');
  assert.ok(warnings.some(w => w.includes('config.js') && w.includes('secret')), 'Should flag potential api keys');
  assert.ok(warnings.some(w => w.includes('config.js') && w.includes('PII')), 'Should flag email/PII matches');

  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test('detectBranch returns the active git branch', () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  execSync('git init', { cwd: TEST_DIR });
  execSync('git checkout -b test-branch', { cwd: TEST_DIR });

  const branch = detectBranch(TEST_DIR);
  assert.equal(branch, 'test-branch');

  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test('commitAndPush commits files and detects active branch', () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Init Git repo
  execSync('git init', { cwd: TEST_DIR });
  execSync('git config user.name "Test"', { cwd: TEST_DIR });
  execSync('git config user.email "test@example.com"', { cwd: TEST_DIR });

  // Create file
  fs.writeFileSync(path.join(TEST_DIR, 'main.js'), 'console.log("hello");\n');

  // Run commit and push
  const result = commitAndPush(TEST_DIR, 'feat: add main script');

  assert.ok(result.success);
  
  const log = execSync('git log -1 --pretty=%B', { cwd: TEST_DIR, encoding: 'utf8' }).trim();
  assert.equal(log, 'feat: add main script');

  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

// --- regression: scope casing --------------------------------------------
//
// The scope pattern was [a-z0-9-]+ with no case-insensitive flag, so every
// uppercase ticket identifier was rejected: feat(T-001), fix(JIRA-42). Callers
// pairing a commit with its work item had to drop either the scope or the
// convention. Conventional Commits places no casing restriction on scopes, and
// beacon -- the changelog generator downstream -- already parsed them
// case-insensitively, so the two skills disagreed on what a valid commit was.

test('accepts uppercase ticket identifiers as scopes', () => {
  assert.equal(validateCommitMessage('feat(T-001): add upload validation'), true);
  assert.equal(validateCommitMessage('fix(JIRA-42): correct the parser'), true);
});

test('accepts the breaking-change marker', () => {
  assert.equal(validateCommitMessage('feat(api)!: drop v1 endpoints'), true);
});

test('still rejects messages without a conventional type', () => {
  assert.equal(validateCommitMessage('T-001: add upload validation'), false);
  assert.equal(validateCommitMessage('random text'), false);
});

// The description promises that "no secrets, build artifacts, or OS metadata leak into
// the published repository". Each case below is one of those categories, and each one
// used to pass the scan.
describe('runSafetyCheck covers every category it promises', () => {
  const build = (files, dirs = []) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipwright-safety-'));
    for (const d of dirs) fs.mkdirSync(path.join(dir, d), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      const full = path.join(dir, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    return dir;
  };
  const scan = (...args) => runSafetyCheck(build(...args)).join('\n');

  it('flags OS metadata', () => {
    assert.match(scan({ '.DS_Store': 'junk', 'Thumbs.db': 'junk' }), /OS metadata.*\.DS_Store/s);
  });

  // Skipping a build directory silently was the reason a scan promising build artefacts
  // do not leak never mentioned the largest one in the tree.
  it('flags a build artefact directory instead of silently skipping it', () => {
    assert.match(scan({ 'index.js': '1' }, ['node_modules', 'dist']), /Build artefact.*node_modules/s);
    assert.match(scan({ 'index.js': '1' }, ['node_modules', 'dist']), /Build artefact.*dist/s);
  });

  it('flags a private key with no helpful extension', () => {
    assert.match(scan({ id_rsa: '-----BEGIN RSA PRIVATE KEY-----\nMIIE\n' }), /key file detected.*id_rsa/s);
  });

  it('flags a private key block inside an ordinary file', () => {
    assert.match(scan({ 'notes.md': 'here it is:\n-----BEGIN OPENSSH PRIVATE KEY-----\n' }), /private key block/);
  });

  // JSON uses `:`, not `=`, which is most of the configuration in a repository.
  it('flags a credential in JSON', () => {
    const out = scan({ 'config.json': JSON.stringify({ apiKey: 'sk-proj-abc123DEF456ghi789JKL012mno345PQR678' }) });
    assert.match(out, /config\.json/);
  });

  it('flags a credential value even when nothing names it helpfully', () => {
    assert.match(scan({ 'a.js': 'const x = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";' }), /GitHub token/);
  });

  // A scan that cries wolf on the file you are meant to commit is a scan people learn to
  // skip, and the description ends by saying never to skip it.
  it('stays quiet on a repository that is safe to publish', () => {
    const out = scan({
      '.env.example': 'OPENAI_API_KEY=\nDB_PASSWORD=<your-password>\n',
      'src/a.mjs': 'const token = process.env.TOKEN;\n',
      'README.md': '# project\n\nSet your api key in .env before running.\n',
      'index.mjs': 'export const run = () => 1;\n',
    });
    assert.strictEqual(out, '', `false positives:\n${out}`);
  });
});
