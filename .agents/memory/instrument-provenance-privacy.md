---
name: Instrument provenance and privacy
description: How saved audio provenance distinguishes a usable source record from physical-device identity.
---

For browser microphone measurements, record the generic instrument adapter, negotiated technical settings when known, acquisition method, units, calibration state, and software version. Do not persist physical microphone IDs or device labels. For local audio imports, identify the file-import path and avoid guessing the original recording hardware or calibration.

**Why:** Physical device identifiers and labels are unnecessary for the measured spectrum and may expose device information; imported audio rarely carries trustworthy calibration provenance.

**How to apply:** Add only metadata the application can observe or validate. Keep new provenance optional when reading older records, and clearly distinguish adapter identity from physical hardware identity.
