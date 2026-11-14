# Astronomical data adapters

## Implemented adapter

`astronomy.noaa-swpc-planetary-kp-1m` reads the public NOAA Space Weather Prediction Center JSON feed for estimated Planetary Kp. Import is explicitly user-triggered; the browser fetches the feed directly and retains the normalized rows in page memory only.

- Endpoint: <https://services.swpc.noaa.gov/json/planetary_k_index_1m.json>
- Product details: <https://www.swpc.noaa.gov/products/planetary-k-index>
- Data-use note: NOAA data-use guidance describes government-server information as public domain unless specifically annotated otherwise. Preserve provider credit, check product-specific notices, and do not imply NOAA endorsement: <https://psl.noaa.gov/disclaimer>.
- Adapter version: `1.0.0`.
- Source timestamp: NOAA `time_tag`, interpreted as UTC and retained alongside its normalized ISO timestamp.
- Value: `estimated_kp`, in a dimensionless Kp-index unit; provider `kp_index` and `kp` label are also retained.
- Calibration: the feed does not provide instrument-level calibration metadata. The adapter records `not-provided`; it does not infer calibration or treat the index as a raw magnetometer reading.

The feed is bounded to 512 KiB and 2,000 observations, validates timestamps and Kp ranges, rejects duplicate timestamps, and fails explicitly on HTTP or format errors. There is no automatic polling, AI interpretation, account-history write, Firebase write, or upload. Exported JSON and CSV retain source and measurement context. The page does not treat anomalies as evidence of intelligent communication.

## Extension rule

Each future adapter must verify its live schema and reuse terms, version its normalizer, preserve original timestamps and timezone, attach units and source attribution, and represent calibration availability honestly. A provider-derived index must remain distinguishable from raw instrument data.
