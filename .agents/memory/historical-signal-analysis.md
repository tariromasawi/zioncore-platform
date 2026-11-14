---
name: Historical signal-analysis branch
description: Recoverable DSP analysis code exists on a retained branch but is absent from current main.
---

The retained `main-repl/main` history contains a tested `analyzeSignalFrame` implementation for spectral shape, harmonicity, silence, and short-window frequency/amplitude trends. It is not in current `main`, whose browser capture computes a narrower set of values.

**Why:** ZionCore's earlier analysis work is project intellectual property; a branch divergence must not be mistaken for an intentional feature retirement.

**How to apply:** Before expanding or replacing the current analyzer, compare the historical implementation and tests with the present capture contract, then selectively restore compatible functionality with updated tests.
