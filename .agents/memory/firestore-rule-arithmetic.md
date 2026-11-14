---
name: Firestore rule arithmetic
description: Avoid integer division truncation in Firestore Security Rules.
---

Cast an operand to floating point before dividing when validating fractional measurement values in Firestore rules.

**Why:** Firestore Rules can truncate integer division, causing valid FFT resolution values to be rejected.

**How to apply:** Check rule arithmetic anywhere integer-valued inputs produce a fractional expected value, such as sample rate divided by FFT size.
