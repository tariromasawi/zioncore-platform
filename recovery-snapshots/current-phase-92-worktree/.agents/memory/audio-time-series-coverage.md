---
name: Audio time-series coverage
description: Preserve representative temporal coverage when summarizing long imported recordings.
---

For long imported recordings, a capped temporal summary must represent the beginning, middle, and end of the source rather than keeping only the latest samples. Keep the full spectrogram and frame analysis intact; reduce only the summary series evenly across its source timeline. Live microphone capture may remain a rolling recent window because it represents an ongoing session.

**Why:** Tail-only summaries can omit earlier events and make a long recording’s interpretation unrepresentative even when the underlying spectrogram was analyzed.

**How to apply:** When changing imported-audio temporal caps, retain the full timeline through uniform sampling and test both endpoints. Do not apply this rule to intentionally live, rolling capture views.
