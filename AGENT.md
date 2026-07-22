# 🤖 Agent Integration Guide (AGENT.md)

As an Antigravity Agent, you must leverage `shipwright` to structure new projects and commits.

## 🧭 Operational Rules

1. **Naming Standard**: Always sanitize proposed names using `normalizeProjectName()`.
2. **Pre-commit Scan**: Execute `runSafetyCheck()` before committing or pushing. If warnings are raised:
   - Present the warnings to the user.
   - Halt execution and ask for explicit permission to ignore or fix the issues.
3. **Commit Messages**: Format commit messages strictly to Conventional Commits:
   - `feat(scope): ...` for new features.
   - `fix(scope): ...` for bug fixes.
   - `docs(scope): ...` for documentation updates.
   - `opt(scope): ...` for performance optimizations.
4. **Zero-Trace**: Never mention "AI-generated", "Gemini", "Antigravity", or similar LLM phrases in code comments, commit messages, or Git history.
