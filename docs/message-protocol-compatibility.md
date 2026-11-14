# ZionCore Messages protocol compatibility record

## Source and confidence

The owner supplied `ca6ff0b252155295315beae1f65fc8e71029ebc1` as the
production source commit. It exists in local Git. The codec, tests, and
protocol-document blob IDs at that commit exactly match the corresponding files
at `main-repl/main` (`d4be0c767ae0cbe075ac0bce5e40191e32bc2a1d`), whose subject
is `Published your App`:

- `artifacts/zioncore-frequency-lab/src/lib/acoustic-message.ts`
- `artifacts/zioncore-frequency-lab/src/lib/acoustic-message.test.ts`
- `docs/acoustic-message-protocol.md`

The verified file blobs are `b11a306135d3ec88503db8c59b6d26870a2054e8`
(codec), `365b9992a4b14babb3e967347ed4b7ef5376c2f9` (tests), and
`491b78c2b1659aa10bedd841460c6e9c559e68fc` (protocol document). The exact
production-commit test suite was run from an isolated copy: **15 tests passed**.
This validates the recovered source's deterministic round-trip, corruption,
truncation, noise-fixture, and protocol-version checks. Deployment metadata
independently confirms that `https://zioncore.replit.app` is public and has a
successful build, but does not itself expose a commit identifier.

## Historical packet versions

| Version | Payload | Encoding | Frame and validation |
| --- | --- | --- | --- |
| 1 | UTF-8 text or prayer, up to 512 bytes | Mono BFSK at 48 kHz; 1,800 Hz for 0 and 2,400 Hz for 1; 20 ms per bit | Preamble `55 55 D3 91`, 24-byte `ZCFI` header, 16-byte message ID, CRC-32/IEEE |
| 2 | Voice, 0.25–2 seconds | IMA ADPCM payload resampled to 8 kHz; 8-FSK acoustic symbols at 48 kHz | Separate 8-FSK preamble and version-2 header, CRC-32/IEEE; up to 9,000 payload bytes |

The historical decoder reports checksum integrity separately from sender
identity: packets do not authenticate their sender. The CRC is not proof of
delivery, intent, or meaning.

## Compatibility boundary

The current research-lab `ZC-EXP-DTMF-v1` symbolic packet format is a separate
experimental protocol. It uses a different symbol alphabet and CRC-16 format;
it is not a replacement decoder for the historical Messages BFSK/8-FSK
packets. Keep the formats and their identifiers separate. Do not revise packet
fields, timing, carrier frequencies, preambles, checksums, or audio decoding
behavior without compatibility fixtures derived from the recovered
implementation.

The recovered `/messages` page is not present in the current research-lab
checkout. Its historical receiver passes the browser/audio-file sample rate
into `decodeAcousticSamples`; the recovered decoder now normalizes voice input
for carrier analysis. This restores the compatible codec path, but does not
claim that the Messages page itself is connected in the current lab.

## Phase 47 sample-rate matrix

The original production-commit suite has 15 tests. The recovered current codec
adds seven sample-rate, WAV, and resampling tests plus fixed encoder-byte
fixtures.
`bash scripts/verify-message-protocol-compat.sh` runs both the pinned historical
baseline and the current receiver tests. All current codec tests pass. The
sample-rate harness uses deterministic resampling and the Messages page's mono
downmix; these are simulated formats, not physical-device measurements.

| Packet | Simulated input rate | Result |
| --- | ---: | --- |
| Text/prayer v1 | 8, 16, 22.05, 24, 32, 44.1, 48, 96 kHz | Unicode round-trip passed |
| Voice v2 | 16, 22.05, 24, 32, 44.1, 48, 96 kHz | Round-trip and CRC verification passed after 48 kHz normalization |
| Voice v2 | 8 kHz | Rejected with an explicit Nyquist/sample-rate explanation; 6,800 Hz cannot be represented at 8 kHz |
| Text/prayer v1 with version changed to 3 | 48 kHz | Explicitly rejected as unsupported |

The baseline v2 decoder failed at 22.05 and 44.1 kHz because its 3 ms symbols
span fractional sample counts. The current receiver now uses a 48-tap
Blackman-windowed sinc resampler to normalize carrier samples to 48 kHz before
8-FSK detection; the transmitter, packet fields, timing, checksum, and versions
are unchanged. An in-band tone and an above-Nyquist tone test the resampler's
passband and anti-alias attenuation. SHA-256 fixtures confirm that the v1 and
v2 encoded WAV bytes exactly match the supplied production source.

The 8 kHz limit applies only to voice v2: its 6,800 Hz carrier exceeds the
4,000 Hz Nyquist limit. Text/prayer v1 passes at 8 kHz. No real recording or
physical speaker/microphone pair was available, so hardware playback and
capture remain unverified.
