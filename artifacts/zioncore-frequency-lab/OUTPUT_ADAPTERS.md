# Output adapter boundary

The supported `output.browser-local-speaker` adapter wraps ZionCore's existing
bounded DSP playback path. It requires a versioned consent record created only
after the local playback control is explicitly authorized, then delegates
sample, duration, and amplitude validation to `startDspPlayback`. Its
descriptor reports the browser-selected local output, up to 10 seconds, a
0.125 full-scale digital peak after playback gain, and no collected physical
device identity.

The authorization record is application metadata, not a security credential.
The interface does not bypass browser user-gesture or device permissions.
Current playback remains local; it is not a remote or radio transmission.

External hardware and radio-frequency output are **disabled**, not mocked or
registered as working adapters. They require a concrete device and output
limits, jurisdiction-specific transmission review where applicable, safety
assessment, an explicit authorized use case, user-facing controls, and
independent verification before an implementation can be registered. The
current registry does not offer a runtime switch to enable these channels.
