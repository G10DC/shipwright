# 🎓 State of the Art (STATE_OF_THE_ART.md)

Analysis of existing tools in the category of automated repository bootstrapping, linting, and commit verification.

## 🔍 Existing Alternatives

### 1. Yeoman / Copier
- **Pros**: Rich templating engines.
- **Cons**: High dependency footprint, steep learning curve.

### 2. Husky & Commitlint
- **Pros**: Industry standards for pre-commit checks.
- **Cons**: Complex configuration, requires extensive node_modules installation.

### 3. Gitleaks / GitGuardian
- **Pros**: Deep, enterprise-grade secret scanning.
- **Cons**: Requires external binary installations or cloud subscriptions.

## 💡 The shipwright Approach
`shipwright` consolidates these concerns into a single, zero-dependency Node.js ES module tailored for agentic AI workflows. It prioritizes offline speed, zero trace, and clean Git mechanics.
