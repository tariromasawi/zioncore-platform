# ZionCore bioacoustic and environmental interpretation — Phase 15

## Current status

**Software claim safeguards: implemented. Empirical source-classification
accuracy: not tested.**

ZionCore computes local audio measurements and can request a consented,
provider-generated listening review. That review is exploratory. The repository
and attached audio examined for this phase contain tonal/resonance material,
not labeled wildlife or environmental reference recordings. No validated
species-identification model, labeled reference set, or ecological-context
service is integrated.

Accordingly, ZionCore may describe measured acoustic structure and present a
clearly qualified source possibility. It must not present an animal species,
behavior, intent, or translated message as an established finding. A personal
or spiritual reflection remains distinct from an audio-source claim.

## Implemented safeguards

- Shared analysis prompts now disclose the absence of a validated labeled
  reference set and require source possibilities to be identified as
  unverified hypotheses.
- The server quality gate rejects common unqualified source-identification,
  environmental-event, animal-behavior, and animal-intent phrasings.
- The raw-audio segment review passes the same claim check before its
  observations are included in the paid result.
- The audio-review UI labels model notes as exploratory and says that species,
  behavior, source, and intent suggestions are unverified.
- Regression tests cover direct animal/environment labels, animal intent and
  behavior, cautious hypotheses, and integration with the main report quality
  gate.

These pattern-based checks are defense-in-depth, not a complete semantic
classifier; they cannot guarantee that every provider hallucination or
rephrased claim will be detected.

## Evidence needed before claiming classification accuracy

1. Select a labeled dataset whose license explicitly permits the intended
   commercial use and document each source, attribution, and permitted use.
2. Define a limited, measurable label taxonomy. Keep “unknown,” “mixed,” and
   “insufficient evidence” as valid outcomes.
3. Split by recording source, location, and recorder where available, so
   segments from the same original recording cannot leak between development
   and evaluation sets.
4. Evaluate noisy, ambiguous, quiet, overlapping, and non-target recordings;
   report per-class precision, recall, F1, false-positive rate, calibration,
   and abstention rate.
5. Check performance across sample rates, microphones, recording conditions,
   and relevant frequency bands.
6. Add only supported labels to product copy after independent review of the
   evaluation results. Keep behavior and communication claims outside the
   supported taxonomy unless separate evidence validates them.

No such reference data or license evidence was available during this phase.
The existing tests validate safe output handling, not animal recognition or
environmental classification accuracy.
