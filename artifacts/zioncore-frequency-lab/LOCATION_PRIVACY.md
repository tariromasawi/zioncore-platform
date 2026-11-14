# Location and ecology privacy

## Current collection behavior

- The app does not request browser geolocation.
- The normalized sensor-observation contract is strict and rejects unknown
  fields, including coordinates.
- Bioacoustic library entries link to source-level location policies; catalog
  access is not permission to copy or disclose precise locality metadata.
- The playback-study planner does not collect site coordinates.
- No exact location is written to a research record or shared collection by
  these paths.

## Future location-sharing boundary

`prepareResearchLocation` is a pure, local sanitizer. It does not request
location, read a device coordinate, persist a record, or send a network request.
It returns `omitted` unless the caller supplies purpose-specific consent that
is explicitly granted, active, and expires within one hour.

When a permitted approximate location is returned, the raw coordinate fields
are not included. Ordinary locations are generalized to a one-degree grid;
sensitive-ecology locations are generalized to a two-degree grid for private
session use and omitted from shared research. Precise precision is not accepted
by the consent schema. These rules are conservative defaults, not a universal
conservation-sensitivity classification or a guarantee that a coarse region is
safe to publish.

The helper is not yet connected to a location input, persistent archive, or
shared contribution flow. Any such integration needs explicit user controls,
source-policy review, and an assessment that the coarse region will not expose a
sensitive site. If that assessment cannot be made, omit the location.
