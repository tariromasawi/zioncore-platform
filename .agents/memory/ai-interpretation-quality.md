---
name: AI interpretation quality gates
description: Durable quality requirements for model-generated frequency analysis reports.
---

Every generated interpretation needs deterministic semantic validation after schema parsing; a strong prompt and valid JSON schema alone do not ensure factual quality.

**Why:** Real Gemini outputs remained schema-valid while treating relative spectral contrast as a noise-floor/SNR measure, inferring source proximity or pressure, overstating matrix-derived stability, and repeating internal creator attribution despite prompt guidance.

**How to apply:** Validate risky claim classes before returning a report, test both rejection cases and careful uncertainty language, allow one bounded provider fallback, and fail safely if the fallback also fails. Coordinate failure handling with the wallet reservation lifecycle so invalid reports are never charged as completed work.

Spiritual readings are opt-in. Treat beliefs a listener shares as their context,
not as evidence from the sensor. Keep measured findings separate from personal
or comparative reflection; never claim that a signal proves divine origin,
animal intent, danger, or healing, and avoid coercive or disparaging religious
guidance.

**Why:** ZionCore is intended to explore spiritual meaning while preserving
evidence boundaries, listener autonomy, and respect across traditions.

**How to apply:** Keep the user’s requested context explicit, use separate
reflection output, validate risky claims after parsing, and cover both careful
interpretations and rejected overclaims in tests.
