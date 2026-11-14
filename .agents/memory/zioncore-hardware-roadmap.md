---
name: ZionCore hardware roadmap
description: The user's standing scope for device integrations and physical hardware verification.
---

The user will not supply or purchase physical receivers for implementation. Build the software architecture, device profiles, adapters, importers, parsers, signal processing, discovery tools, and customer-facing explanations that can be completed without hardware. Keep ordinary microphone and recording paths useful independently of optional specialist sensors.

**Why:** The user explicitly said the project will provide no physical hardware and asked that this not block implementation of software capabilities.

**How to apply:** Implement documented, testable file and browser paths; label a live adapter as bridge-required when its device protocol or companion software is absent; keep real hardware connection, calibration, and performance marked pending until physical evidence exists. Never represent synthetic fixtures as connected hardware.
