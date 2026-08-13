# Shipwright Repository Safety & Publishing Honesty Bounds

The honesty layer is the operational expression of the **G10DC Trellis Standard**: **the LLM reasons over verified evidence with stated confidence, never hallucinates capabilities or impact.**

## Domain & Scope
**Domain**: Zero-Trace GitHub Publishing & Pre-Push Scan

## Core Epistemic Rules

1. **Pre-Publish Safety Scan: Scans repository for secrets, node_modules, build artifacts, and OS metadata (.DS_Store).**
2. **Conventional Commit Enforcement: Guarantees clean commit history format before pushing to origin.**
3. **Confidence Rating: High (0 secret violations & clean git status), Medium (minor warnings), Low (unverified publish).**

## Three-Tier Confidence Model

- **High Confidence**: Full AST/schema validation passing, deterministic evidence available, verified state.
- **Medium Confidence**: Heuristic analysis or partial indexing; requires agent verification step.
- **Low Confidence**: Inferred or unindexed target; candidate output ONLY, never auto-committed.

## Epistemic Invariant

> Absence of evidence is not evidence of absence. Output is presented as a structured candidate set with confidence scores so caveats cannot be silently dropped downstream.
