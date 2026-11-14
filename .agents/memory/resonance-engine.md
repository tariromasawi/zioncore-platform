---
name: Resonance profile consistency
description: Shared deterministic signal descriptors for ZionCore's monitor and AI interpretation.
---

The versioned resonance profile must be derived by one shared function used by both the live monitor and AI interpretation prompt. Keep its signal-texture, temporal, and matrix descriptions consistent; change the profile version when their interpretation rules change. These labels describe measured patterns and must not identify a source or assign spiritual meaning.

**Why:** Independent monitor and prompt implementations could label the same measurement differently, undermining trust and making generated reports harder to audit.

**How to apply:** Update the shared profile function, prompt-inclusion tests, and monitor tests together whenever thresholds or profile labels change. Preserve explicit insufficient-data states and the boundary between measured features and user-led interpretation.

Resonance-library catalog entries must be checked against the actual audio asset (duration and spectral fingerprint), not inferred from filenames or numbering.

**Why:** Similar source filenames can conceal swapped recordings, which makes an otherwise healthy player serve the wrong sound without producing an error.

**How to apply:** When adding or changing a library mapping, compare the served bytes with the intended source file and verify the recording's measured duration and dominant spectral profile before release.
