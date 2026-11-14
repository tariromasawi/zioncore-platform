---
name: Audio provider consent
description: The owner's direction for optional paid external-provider analysis of ZionCore recordings.
---

Keep microphone and imported-audio measurement local by default. The owner approved allowing customers to send recordings to external AI providers for more advanced analysis, with customers paying through credits. Ask for explicit, per-request consent and show the full price before any raw audio leaves the device. The current direct-audio path sends only an eligible imported PCM WAV to Gemini; any OpenAI fallback receives text, not the WAV. Grok is not configured.

**Why:** Recordings are sensitive and provider calls incur cost, while the owner wants an optional, paid advanced-analysis service.

**How to apply:** Keep the standard feature-derived path intact. Never auto-send live microphone audio. Fail closed until the audio price is owner-approved; disclose the selected provider and fallback behavior, and do not claim unconfigured providers are available.
