# 📊 Benchmark (BENCHMARK.md)

Performance metrics for `shipwright` execution on standard development environments.

## ⏱️ Target Metrics

- **Boilerplate File Creation**: `< 10ms`
- **Secret Scanning (100 files)**: `< 800ms`
- **Regex Commit Verification**: `< 1ms`
- **Local Git Init & First Commit**: `< 200ms`

## ⚙️ Real-world Performance (Local execution)
Tests executed on Windows 11 Node.js v25.9.0:
- Boilerplate Generation: `1.4ms`
- Project Safety Scan (5 files): `1.8ms`
- Git branch resolution: `11ms`
