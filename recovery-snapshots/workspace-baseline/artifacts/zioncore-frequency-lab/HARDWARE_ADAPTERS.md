# ZionCore sensor adapter contract

`zc-sensor-observation/v1` is the normalized boundary between an instrument or
data-source adapter and downstream research processing. It complements the
device lifecycle in `hardware-instruments.ts`: discovery and permission remain
separate from normalization, and normalization never requests hardware access.

## Required observation fields

- **Identity:** a stable observation ID and adapter-level instrument ID. Browser
  hardware IDs, device labels, filesystem paths, and coordinates are not part
  of this contract.
- **Modality and source:** a registered CIG modality plus `live`, `imported`,
  `simulated`, or `provider-derived` source classification.
- **Time:** observed start/end and receipt timestamps in ISO 8601 with an
  explicit UTC offset, a clock-source label, and optional uncertainty. End
  cannot precede start.
- **Permission:** status (`granted`, `not-required`, or `unknown`), scope, and
  whether the measurement was user-initiated. File imports, synthetic data,
  and provider feeds cannot claim live sensor permission.
- **Calibration:** calibration state, check time, and a bounded reference
  description. Unknown calibration must remain uncalibrated or not applicable;
  adapters must not infer absolute physical units from uncalibrated values.
- **Channels:** finite numeric values and an explicit unit from
  `SENSOR_MEASUREMENT_UNITS`; one observation is limited to 32 channels and
  50,000 total values.
- **Provenance:** stable adapter ID/version, acquisition method, classification,
  software version, a descriptive source label, and the fixed
  `physicalDeviceIdentity: "not-collected"` marker.

`SensorMeasurementAdapter<TInput>` defines the typed normalizer interface;
`InstrumentSensorAdapter<TInput>` combines it with the existing discover,
acquire, and release lifecycle. `normalizeInstrumentMeasurement` checks that
the lifecycle descriptor's ID, source type, and supported modality match the
capture context. `normalizeSensorObservation` validates the output and checks
that adapter ID/version, modality, observation/instrument identity, time,
permission, calibration, and source type still match the supplied context.
Source classification is constrained: an adapter cannot relabel imported or
generated values as measured live input.

The contract is currently a tested boundary for future adapters; it does not
add new hardware integrations, store measurements, or grant permission. The
browser microphone and local WAV paths remain the only existing acoustic
inputs, and physical instrument calibration/interoperability still requires
separate verification.
