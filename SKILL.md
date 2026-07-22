---
name: shipwright
description: Automated repository initialization, safety checks, clean conventional commits, and zero-trace GitHub publishing.
---

# 🛠️ shipwright Skill Specification

Provides commands, helpers, and workflow gates to manage GitHub repositories, enforce conventional commit messaging, perform pre-push privacy and security checks, and generate initial project boilerplate files.

## 🎯 Usage Guidelines

Activate this skill when:
- Creating a new project, workspace, or module.
- Initializing a Git repository or creating a remote GitHub repository.
- Crafting commit messages, performing git staging, or pushing local code.
- Editing GitHub "About" metadata (description, topics, tags).
- Auditing the project codebase for credentials, private keys, or PII before publishing.

---

## 🚀 Core Workflows

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
