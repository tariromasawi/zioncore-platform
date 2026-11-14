# Bioacoustic source library

Reviewed 12 November 2026. This is a source directory, not a collection of audio assets. The app does not download recordings or call these providers.

## Xeno-canto recording catalog

- Terms: <https://xeno-canto.org/about/terms>
- API documentation: <https://xeno-canto.org/explore/api>
- Search and license fields: <https://xeno-canto.org/help/search>
- **Reuse:** every recording has its own Creative Commons license. Check the individual record’s license and comply with its attribution, commercial-use, and derivative-work conditions. A catalog or API response is not a blanket reuse license.
- **Species context:** the recordist is responsible for the species identification. Item metadata may describe questioned, unconfirmed, or unidentified records; background species and annotations can be incomplete.
- **Location:** catalog data can contain locality and coordinates. Avoid copying precise locations into shared research records, especially when the species or site may be sensitive.
- ZionCore does not request browser geolocation, and its normalized sensor record rejects coordinate fields. Do not copy catalog coordinates into records; for a future explicitly shared region, follow `LOCATION_PRIVACY.md` and omit the site if its sensitivity is uncertain.
- **Attribution:** retain the recordist, catalog number, and item-level license where reuse is permitted.

## Macaulay Library media archive

- Media access and requests: <https://support.ebird.org/en/support/solutions/articles/48001064551-using-and-requesting-media>
- Media copyright FAQ: <https://support.ebird.org/en/support/solutions/articles/48000960529-ebird-media-upload-faq>
- **Reuse:** public listening or viewing does not grant download or redistribution rights. Media requests and licensing are handled by the archive; embedding is subject to the archive’s stated non-commercial conditions. Check permission for the exact asset and intended use.
- **Species context:** descriptions and species labels belong to individual assets and should not be treated as standardized experimental ground truth.
- **Location:** asset-level access and location detail vary. Public playback is not permission to disclose collection coordinates.
- **Attribution:** follow the archive’s asset-specific permission and credit requirements.

## eBird sensitive-species location guidance

- Sensitive Species policy: <https://support.ebird.org/en/support/solutions/articles/48000803210-sensitive-species-in-ebird>
- Privacy and data-use guidance: <https://support.ebird.org/en/support/solutions/articles/48001078113-how-can-your-ebird-data-be-used->
- **Scope:** this is conservation and location-handling guidance, not a media license. It describes risks such as targeted capture or disturbance and notes that treatment can vary by region and season.
- **Use:** suppress exact locations for potentially sensitive observations and consult the current source policy. Do not use rarity alone as a proxy for sensitivity, and do not treat this as a complete universal list.

## Implementation boundaries

- Entries link to authoritative source terms; they do not mirror source media or API results.
- No Xeno-canto API key or Macaulay Library credential is stored or required for this directory.
- Species labels, contextual notes, and any later user analyses must preserve uncertainty and source provenance.
- User recordings remain separate from this directory. Do not add them to a shared collection without explicit authorization and a rights/privacy review.

## Local event-structure tools

The Bioacoustics page also supports local PCM/IEEE-float WAV inspection (mono/stereo, 8–96 kHz, 24 MiB combined input budget, up to 60 seconds per file). It segments candidate spans using 20 ms RMS frames, 10 ms hops, a measured low-percentile noise floor, and a release threshold; short gaps are merged. At most 100 candidates are retained per file.

Recording A events can be grouped with deterministic k-means over log-scaled duration, dominant frequency, spectral centroid, and mean RMS. A second recording can be compared with a one-to-one greedy feature-distance match. The comparison scales use duration tolerance max(40 ms, 25%), peak-frequency tolerance max(40 Hz, 20%), centroid tolerance max(80 Hz, 25%), and a twofold RMS ratio scale, with a normalized-distance cutoff of 1.5. These exploratory numerical groupings do not identify animals, call types, behavior, meaning, or a response. They do not compute sample-level correlation or use an AI model. All input remains in browser memory and is not uploaded or saved by this page.

## Playback study review planner

The local planner records a target taxon and habitat category, stimulus provenance, calibrated sound-pressure level at the target, ambient level, measurement distance and calibration reference, trial duration and repetition schedule, baseline/control, monitoring, stop criteria, permit/ethics review reference, and site-privacy checks. A zero rest interval requires a written study-specific rationale. Exact site coordinates are not collected. It computes planned sound-on seconds and scheduled-window seconds only; those arithmetic totals are not welfare limits.

A complete record is labelled **ready for qualified human review**, never approved. It does not validate the measurements, determine whether a permit applies, or authorize sound playback. It does not generate or play audio and stores no study data; export is a user-initiated local JSON download. Browser output volume is not calibrated dB SPL and must not be used as a wildlife exposure measurement. No universal safe playback level is supplied.

Guidance links are shown in the planner:

- ASAB ethics guidance and 2025 behavioural-research guidelines: <https://www.asab.org/ethics> and <https://doi.org/10.1016/j.anbehav.2025.123421>.
- La Trobe University wildlife Animal Ethics Committee guide (one jurisdiction-specific example, not universal law): <https://www.latrobe.edu.au/research/researcher-support/documents/AEC-Guide-for-Wildlife-Researchers_v1_July-2023.pdf>.
