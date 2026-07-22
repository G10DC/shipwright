# ⚠️ Risks & Mitigations (RISKS.md)

Identified operational and security risks associated with automated repository management and git operations.

| Risk ID | Description | Impact | Mitigation |
|---|---|---|---|
| **R-1** | Accidental publication of API Keys or Secrets to public GitHub. | High | **M-1**: Pre-push safety checks block execution and require manual verification. |
| **R-2** | Rate limits or authentication failures on the `gh` CLI. | Medium | **M-2**: Verify authentication state prior to repository creation. |
| **R-3** | Non-conforming commit messages polluting the git history. | Low | **M-3**: Enforce regex checks inside `commitAndPush` to reject non-conventional formats. |
| **R-4** | Accidental creation of a public repository instead of private. | High | **M-4**: Explicitly prompt the user for visibility preferences on every project launch. |
