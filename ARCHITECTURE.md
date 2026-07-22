# 🏗️ Architecture (ARCHITECTURE.md)

`shipwright` is structured as a lightweight, zero-dependency Node.js ESM module.

```
shipwright/
├── lib/
│   └── shipwright.js    # Core utilities (Naming, Boilerplate, Checks, Git integration)
├── tests/
│   └── shipwright.test.js # Offline verification and tests
├── SKILL.md             # Antigravity skill declaration
├── AGENT.md             # Agent directives
├── ARCHITECTURE.md      # This document
├── REQUIREMENTS.md      # Specification and criteria
├── RISKS.md             # Security and operational risks
├── ROADMAP.md           # Future enhancement paths
└── STATE_OF_THE_ART.md  # Domain-specific research comparison
```

## ⚙️ Design Decisions
- **Zero Dependencies**: Keeps the skill fast and extremely secure, avoiding NPM supply-chain attack vectors.
- **Node.js Native Test Runner**: Relies on the native test runner (`node --test`) to avoid third-party libraries.
- **ESM Native**: Strict ESM modules (`type: "module"`) to align with modern JavaScript runtime practices.
