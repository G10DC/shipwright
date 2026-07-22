# 📋 Requirements (REQUIREMENTS.md)

This specification outlines the functional and non-functional requirements for `shipwright`.

## ⚙️ Functional Requirements
- **FR-1 (Boilerplate)**: Must generate a working boilerplate including `README.md`, `LICENSE` (MIT), `.gitignore`, and `eslint.config.js`.
- **FR-2 (Safety Scan)**: Must scan for potential API keys, passwords, database URLs, emails, and active `.env*` or `.pem`/`.key` files.
- **FR-3 (Naming)**: Must normalize input project names into URL-safe kebab-case.
- **FR-4 (Branch Detection)**: Must identify the active branch name dynamically to target pushes.
- **FR-5 (GitHub Integration)**: Must integrate with `gh` CLI to initialize and publish repositories.
- **FR-6 (Conventional Commit Enforcement)**: Must validate that commit messages follow Conventional Commits formatting rules.

## ⚡ Non-Functional Requirements
- **NFR-1 (Security)**: Zero third-party dependencies.
- **NFR-2 (Performance)**: Pre-push safety checks must complete in under 5 seconds for moderate codebases (<100 files).
- **NFR-3 (Zero Trace)**: Standard output and git message formatting must be completely free of LLM metadata.
