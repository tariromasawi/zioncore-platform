# ZionCore Device Adapter SDK

SDK contract version: **1.0.0**

This document defines the shared software contract for device and recording
adapters in ZionCore. A registry entry is not evidence that a physical receiver
has been connected or calibrated. Each adapter manifest states whether its
current path is a working browser path, a file-import path, or requires a
separately installed bridge.

## Signal-domain contract

Every normalized observation uses `UniversalSignalEnvelope`:

- `schemaVersion`: currently `1`.
- `adapterId`: stable adapter identifier.
- `signalDomain`: `acoustic-pressure`, `radio-iq`, `acceleration`, or
  `environmental`.
- `capturedAt`: ISO-8601 timestamp.
- `sampleRateHz`: actual or explicitly inferred sample rate.
- `calibration`: `calibrated`, `uncalibrated`, or `unknown`, with an optional
  calibration-profile identifier.
- `payload`: domain-specific values and units.

The payload type must match `signalDomain`. Acoustic waveform samples use
`Float32Array`; RF samples retain their IQ framing and declared representation;
accelerometer axes remain separate arrays with units of `g` or `m/s²`.
Environmental values carry their own declared unit. ZionCore must not convert
these domains into one another or label relative amplitude as calibrated power.

The validator rejects mismatched adapter/domain identifiers, invalid dates,
non-positive sample rates, malformed sample arrays, and payloads above the
current defensive limits (five million scalar samples, 64 MB IQ frame, or 128
environmental values).

## Adapter manifest requirements

Each `AdapterManifest` declares:

1. A stable identifier and supported model names.
2. Sensor category and connection types.
3. Supported operating systems and browsers.
4. Acquisition methods and measurement units.
5. Sample-rate and bandwidth ranges, including how actual values are derived.
6. Calibration status and how device discovery works.
7. Permission requirements and connection lifecycle.
8. Error recovery, supported data formats, and driver/firmware dependencies.
9. A documentation link and an honest implementation status.

The registry rejects duplicate adapter IDs and incompatible SDK major versions.
An adapter must validate each incoming envelope before passing it to analysis.

## Current software paths

| Device or source | Implemented path | Still requires physical/device verification |
| --- | --- | --- |
| Browser microphone, USB/Bluetooth microphone, audio interface | Existing user-authorized MediaDevices + Web Audio capture | Per-device response, calibration, and platform testing |
| AudioMoth 1.2.0 | WAV metadata inspection and supported local WAV analysis; identity is based on file metadata, otherwise generic | Recorder/firmware acquisition, USB behavior, and calibrated ultrasonic response |
| RTL-SDR Blog V4 | Local CU8, CS8, and CF32 IQ import; relative spectrum estimate; AM envelope and FM discriminator export | V4 driver operation, tuning, actual bridge stream, demodulator comparison, and RF calibration |
| PhidgetAccelerometer MOT0100 | Timestamped X/Y/Z CSV import; inferred rate; jitter validation; axis and vector-magnitude spectral peaks | VINT hub discovery, Phidgets runtime, live bridge, sensor rate/bandwidth, and calibration |
| Echo Meter Touch 2 Pro | WAV metadata inspection and supported local recording analysis | Manufacturer app/device export and physical ultrasound response |
| Environmental loggers | Timestamped numeric CSV summary retaining each column name and unit, with range, latest value, and trend | Vendor-specific import formats, sensor calibration, and live logger discovery |

File import is local. The source recording is not uploaded by this page. A
successful file parse does not certify the named hardware: ZionCore identifies
AudioMoth/Echo Meter only when recording metadata contains an identifying hint.

Environmental time series are summarized in their declared units. ZionCore does
not infer a frequency spectrum from irregular environmental readings.

## Local receiver bridge boundary

The current app contains no running receiver bridge and makes no arbitrary LAN
connections. A future bridge must be separately installed and must:

- Bind to loopback by default and use an explicit user-approved origin.
- Authenticate with a short-lived, scoped credential; never put credentials in
  URLs, logs, or saved observation text.
- Use a versioned handshake and adapter identifier before sending data.
- Enforce frame-size, sample-rate, domain, and processing-time limits.
- Reject command execution, remote shell access, and transmitter controls.
- Surface disconnects and require user-authorized reconnects.

The web app must not silently scan networks or treat browser API availability as
device discovery. A browser API chooser alone does not constitute a functioning
device integration; a documented protocol and validated payload are required.

## Adding an adapter

1. Add a manifest with the complete capability and dependency declaration.
2. Implement a source-specific parser/connector without changing the signal
   domain or discarding metadata.
3. Validate source data and construct a versioned `UniversalSignalEnvelope`.
4. Register the adapter with the current SDK major and a strict payload
   validator.
5. Add deterministic tests for valid data, malformed data, permission denial,
   disconnects, units, sample rates, and domain separation.
6. Add the adapter to the Device Connection Centre with capability states that
   distinguish working, file-based, and bridge-required paths.
7. Record any physical validation separately; software fixtures are not
   physical-device evidence.
