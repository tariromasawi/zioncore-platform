# Local observation archive protection

## Risks addressed

Previously, unreadable browser data was returned as an empty list. Saving a
new observation could then replace the original unreadable archive. Saves
also used a page's in-memory snapshot, which could omit observations saved by
another tab since that page loaded.

## Behavior

- Missing, damaged and inaccessible storage now have distinct states.
- Readable entries from a partially damaged archive remain available.
- Invalid entries and duplicate identities are not automatically discarded
  from the stored original.
- New saves refuse to overwrite damaged or unreadable archives.
- A recovery download returns the original archive bytes, without filtering,
  repair, upload or encryption. The UI warns that it can contain private notes.
- An explicit recheck lets a user recover after permissions/data are corrected
  without abandoning the current capture.
- Saving reads the latest archive under an origin-scoped Web Lock when the
  browser supports it. The explicit confirmed clear action uses the same lock.
- Storage events refresh other open lab/history pages.
- Success is shown after the write completes. Storage-full failures show an
  inline message, not a success indicator.
- Detail pages distinguish an unreadable archive from a genuinely absent item.
- Clearing a partially damaged archive requires the existing confirmation,
  with an additional warning that unreadable entries will also be removed.

## Limits kept explicit

Web Locks coordinate cooperating current-version tabs on the same origin.
Older browsers without Web Locks re-read immediately before writing but do
not gain a cross-tab atomicity guarantee. Browser storage is not a cloud
backup and can still be cleared by browser/user settings. A raw recovery copy
preserves evidence for recovery; it does not automatically repair malformed
records or restore them.

These records contain measurement metadata and optional notes, not original
audio or the full paid interpretation. No wallet, cloud history, production
index, production configuration or live payment behavior was changed.

## Verification

Ten new regression cases cover damaged archives, duplicate identities, stale
snapshots, quota failures, unavailable storage, strict validation, serialized
saves/clear and byte-exact recovery copies. All 108 frontend unit tests and
frontend type checking pass.

The anonymous development-browser pass verified a four-second imported test
tone, successful saving without losing seeded observations, exact archive
preservation under a simulated storage quota failure, cross-tab damage
notification, a byte-exact 916-byte recovery download, readable history and
notes surviving a detail-page reload. Original browser test state was restored.
No real customer data, accounts, purchases or cloud writes were used.

That pass identified mobile horizontal overflow. Grid tracks and panels now
allow their contents to shrink without forcing the whole page wider. A targeted
recheck with an analyzed audio file and damaged archive confirmed a 375px
document width against a 375px layout viewport at a 390px browser width.
Both recovery controls remained visible and usable without horizontal scroll.

The optional simultaneous cross-tab browser write test was not executed.
Concurrency is covered by the injected shared-mutex regression; the browser
pass exercised the real lock during ordinary successful writes, not a
simultaneous-write race. Do not report that optional scenario as browser-tested.
