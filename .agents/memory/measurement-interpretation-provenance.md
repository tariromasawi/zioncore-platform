---
name: Measurement interpretation provenance
description: Preserve the distinction between observed signal data and AI interpretation.
---

Keep measured values and AI interpretation in separate optional fields on the same observation. Interpret only a stopped, stable capture. Saving or revising an interpretation must preserve the observation ID and every measurement field; never save audio, spectrum bins, or notes as AI input.

**Why:** ZionCore's research loop must distinguish observable signal, information encoded in a signal, and meaning attributed by an interpreter. The user explicitly requires disciplined experimentation without fabricated discoveries.

**How to apply:** Add bounded, schema-validated interpretation fields, label them as model output, and allow owner-only writes that cannot change the underlying measurement.
