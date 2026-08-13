---
name: shipwright
status: implemented
description: >-
  Automated repository initialization, safety checks, clean conventional
  commits, and zero-trace GitHub publishing. Validates that no secrets, build
  artifacts, or OS metadata leak into the published repository. Use when setting
  up a new repo or publishing to GitHub for the first time. Never use for
  ongoing CI/CD -- use a proper pipeline; never skip the pre-publish safety
  scan.
---

# ️ shipwright Skill Specification

Provides commands, helpers, and workflow gates to manage GitHub repositories, enforce conventional commit messaging, perform pre-push privacy and security checks, and generate initial project boilerplate files.

## Usage Guidelines

Activate this skill when:
- Creating a new project, workspace, or module.
- Initializing a Git repository or creating a remote GitHub repository.
- Crafting commit messages, performing git staging, or pushing local code.
- Editing GitHub "About" metadata (description, topics, tags).
- Auditing the project codebase for credentials, private keys, or PII before publishing.

---

## Core Workflows

### 1. Repository Setup & Boilerplate
Automatically creates the following files:
- **`README.md`**: Initialized with normalized project title.
- **`LICENSE`**: MIT License by default.
- **`.gitignore`**: Prepared for Node.js, caching, systems generation, and secrets prevention.
- **`eslint.config.js`**: Standard ESLint configuration.

### 2. Privacy & Security Scans
Scans code files and logs warnings if:
- Files named `.env*` or cryptography keys (`.pem`, `.key`) are found in tracked/unstaged regions.
- Potential credentials or tokens (e.g., matching `api_key = ...`) are present.
- Raw PII such as email addresses or structural IDs are leaked.

### 3. Conventional Commit Enforcement
Validates all commit messages against conventional prefixes:
`^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|opt)(\([a-z0-9-]+\))?: .+$`

*Zero-Trace Rule*: Commit histories and comments must not contain any reference to AI assistant generation. All comments and commit messages must remain short, professional, and technical.

## When to use

- Initializing a new repo (boilerplate files), or publishing to GitHub for the first time via the
  `gh` CLI, with a pre-publish scan for secrets/keys/PII in tracked files.
- Enforcing Conventional Commit messages on a commit-and-push step.

## When NOT to use

- **Ongoing CI/CD** — this is a one-time setup/publish tool, not a pipeline; use a proper CI system.
- **Skipping the pre-publish safety scan** — always run it before a first push; it's the one check
  standing between a workspace `.env` file and a public repo.
