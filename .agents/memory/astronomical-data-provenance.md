---
name: Astronomical dataset provenance
description: Preserve source, time, units, processing, calibration availability, and reuse terms for external space-weather data.
---

Represent an astronomical or geophysical value according to the source product. A provider-estimated index is not raw instrument output; when a feed omits calibration metadata, record that it is unavailable instead of inventing calibration. Preserve the original timestamp and timezone convention, units, processing description, provider attribution, and product-specific reuse guidance.

**Why:** A derived index can be useful for exploration but must not be presented as an instrument reading, calibrated sensor measurement, or evidence of a message.

**How to apply:** Add a dataset adapter only after verifying its live schema and source terms. Retain enough provenance to reproduce the import and keep browser imports bounded and opt-in.
