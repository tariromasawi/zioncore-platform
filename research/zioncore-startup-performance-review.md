# Startup performance review

## Identified overhead

The production entry bundle contained the full Genesis seed module, even
though browser consumers only needed shared schemas and deterministic
measurement helpers. An eager module-level character count assembled the
entire seed during import and prevented its unused content being tree-shaken.

The character count is now computed and cached on first use. Server prompt
construction and the full seed content are unchanged. Browser startup no
longer includes the unused seed module.

## Build-size evidence

| Initial JavaScript | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Uncompressed bytes | 709,954 | 625,709 | 11.87% |
| Gzip bytes | 216,182 | 186,069 | 13.93% |

These figures compare the production entry files using the same gzip method.
They are not whole-page transfer totals, measured browser load-time
improvements or claims about the proxy's compression settings.

A build guard now traverses entry chunks and static dependencies and rejects
rendered Genesis seed code in that initial graph. It does not incorrectly
count deferred chunks as initial downloads. Builds also print initial
JavaScript byte totals.

## Verification

- 93 frontend and 52 API unit tests passed, including four new build-guard
  regression tests and the existing full-seed/prompt checks.
- Workspace-wide type checking passed, including shared libraries, both
  application services, the mockup sandbox and scripts.
- The production frontend build passed its new guard.
- Models, output-token allowance, prices, authentication and privacy
  protections were not reduced.

## Remaining concerns

Large JavaScript chunk warnings still exist; this pass reduces real startup
code rather than hiding those warnings or claiming all performance work is
complete. Known storage-library warnings, Firebase configuration requirements
and live authentication/payment verification remain separate outstanding work.

No real paid generation, purchase, production-data write or publication was
performed.
