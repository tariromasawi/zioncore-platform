# ZionCore protocol registry

**Registry contract:** `1.0.0`  
**Scope:** Local protocol descriptions and typed adapters. This registry does not
add a transport, network service, cryptographic protection, or hardware
receiver.

The code source of truth is `src/lib/protocol-registry.ts`. Its descriptors
refer to the existing encoders and decoders; they do not change packet bytes.
The registry is versioned separately from each protocol's on-wire version.
`ProtocolRegistry.register()` validates descriptor metadata only. It does not
load or execute code supplied by a descriptor; adding an executable protocol
requires a reviewed typed adapter and tests.

## Implemented protocols

| Registry ID | Wire version | Status | Payload | Encoder → decoder |
|---|---:|---|---|---|
| `zioncore.acoustic-message` | 1 | Locally verified | UTF-8 text or prayer, maximum 512 bytes | `encodeAcousticMessage` → `decodeAcousticSamples` |
| `zioncore.acoustic-voice` | 2 | Locally verified | IMA ADPCM 4-bit mono audio, 8 kHz reconstruction, maximum 9,000 payload bytes | `encodeAcousticVoiceMessage` → `decodeAcousticSamples` |
| `ZC-EXP-DTMF-v1` | 1 | Experimental local | UTF-8 text, maximum 120 bytes, represented as DTMF nibbles | `encodeCelestialMessage` → `decodeCelestialSymbols` |

“Locally verified” refers to automated local round-trip and regression fixtures.
It does not claim reliable exchange between different physical devices,
compatibility with third-party software, or understanding by an external
recipient.

The compatibility tests pin deterministic text-v1 and Voice-V2 WAV hashes and
a literal DTMF-v1 symbol sequence, then decode those exact baselines. They
protect the current software packet formats; they are not hardware
interoperability tests.

## `zioncore.acoustic-message` wire version 1

- **Payload:** UTF-8 text or prayer, at most 512 bytes.
- **Frame:** Four-byte preamble `55 55 D3 91`; 24-byte `ZCFI` header; payload;
  four-byte CRC-32/IEEE (reflected polynomial `0xEDB88320`, initial and final
  XOR `0xFFFFFFFF`). The header carries the wire version, payload type, payload
  length, and message ID.
- **Modulation:** BFSK, 1,800 Hz for zero and 2,400 Hz for one, 48 kHz output,
  20 ms per bit (50 bit/s nominal), with 100 ms leading and 300 ms trailing
  silence.
- **Maximum frame:** 4,352 symbols (bits), about 87.44 seconds including the
  configured silences at the 512-byte payload limit.
- **Decoder input:** Declared sample rates from 8 kHz through 192 kHz. The rate
  must describe the supplied samples; this decoder does not resample text
  packets.
- **Compatibility:** The existing unified audio decoder also recognizes
  supported Voice V2 packets. Their modulation and payload formats are
  different; they are not wire-interchangeable.

## `zioncore.acoustic-voice` wire version 2

- **Payload:** IMA ADPCM 4-bit mono audio reconstructed at 8 kHz. The payload
  includes an eight-byte codec header and is limited to 9,000 bytes. Source
  recordings are limited to 0.25–2 seconds before encoding.
- **Frame:** The 24-byte `ZCFI` header contains wire version 2 and voice payload
  type, followed by the voice payload and CRC-32/IEEE (reflected polynomial
  `0xEDB88320`, initial and final XOR `0xFFFFFFFF`). The version-2 waveform uses
  its own 24-symbol 8-FSK preamble.
- **Modulation:** Eight carriers from 1,200 Hz through 6,800 Hz in 800 Hz
  steps, 48 kHz output, 3 ms per symbol, 1,000 bit/s nominal before framing.
  The preamble has 24 symbols; configured silence is 120 ms leading and 300 ms
  trailing.
- **Maximum frame:** 24,099 8-FSK symbols, about 72.717 seconds including
  configured silences at the maximum payload size.
- **Decoder input:** Declared source sample rates from 16 kHz through 192 kHz.
  Receive-side samples are converted to 48 kHz for carrier detection.
- **Compatibility:** The shared decoder dispatches supported version-1 text and
  version-2 voice frames. The transmitter, version byte, ADPCM payload and
  packet layout remain unchanged.

## `ZC-EXP-DTMF-v1`

- **Payload:** UTF-8 text up to 120 bytes.
- **Frame:** Nibble synchronization `F F A 5`; five-byte header with magic `ZC`,
  version, and two-byte payload length; payload; two-byte CRC-16/CCITT
  (polynomial `0x1021`, initial `0xFFFF`, no reflection or final XOR).
- **Modulation:** Each nibble selects one low and one high DTMF tone from the
  4-by-4 frequency grid. The sample rate is 44.1 kHz. Supported tone durations
  are 50, 75, or 100 ms, each followed by a 12 ms inter-symbol gap.
- **Maximum frame:** 258 nibble symbols, or about 28.896 seconds at the
  100 ms tone setting and maximum payload.
- **Decoder inputs:** The symbol decoder accepts a numeric nibble sequence or
  hexadecimal symbol text. A companion browser-local audio decoder accepts
  mono samples from supported PCM or IEEE-float WAV, with the file's declared
  sample rate between 8 and 96 kHz; it auto-detects the 50/75/100 ms timing
  choices, sync, header, payload, and CRC. The UI does not activate a microphone.
- **Compatibility:** This experimental symbol frame is separate from both
  `ZCFI` acoustic formats.

## Local protocol benchmark

The Access page can run the fixed benchmark in the browser. It reports clean
packet recovery, payload goodput (payload bits divided by configured encoded
duration), local encode/decode time, and exact-message/CRC recovery under
deterministic uniform noise at target SNRs of 40, 25, and 15 dB. Each condition
has three trials. The noise is added to unclipped `Float32Array` samples; this
does not model room acoustics, speakers, microphones, codecs, or clipping.
Benchmark reports are temporary and are not uploaded or saved.

One local software run produced these results for the fixed test payload:

| Protocol | Clean audio recovery | 40 dB | 25 dB | 15 dB | Symbol-array recovery | Payload goodput |
|---|---:|---:|---:|---:|---:|---:|
| `zioncore.acoustic-message` | 3/3 | 3/3 | 3/3 | 3/3 | Not applicable | 24.44 bit/s |
| `zioncore.acoustic-voice` | 3/3 | 3/3 | 3/3 | 0/3 | Not applicable | 918.35 bit/s |
| `ZC-EXP-DTMF-v1` | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 36.12 bit/s |

The Voice V2 result at 15 dB is a useful synthetic robustness signal, not a
general operating threshold. Three trials are insufficient to estimate field
error rates. DTMF's 3/3 result at 15 dB is likewise only a fixed synthetic
fixture outcome. No physical device compatibility matrix or loopback test is
available in this benchmark. Cloud provider requests are zero; local execution
time is measured, but device energy is not priced.

## Integrity and security

CRC-32 and CRC-16 detect some accidental corruption; they do not authenticate
the sender or encrypt content. All three registered formats are unauthenticated
and unencrypted. Do not use them for secrets or as security controls.

## Local declarative prototype workbench

The Access page contains a draft-only tone-grid workbench. Its strict recipe
defines a 16-tone frequency table, symbol timing, sample rate, and output level.
An audited fixed kernel converts bounded UTF-8 text to a length-prefixed
symbol frame with CRC-16, reconstructs text from that symbol sequence, and
generates a low-level downloadable WAV.

Recipes accept no source-code field and reject unknown properties. The app does
not use `eval`, `Function`, dynamic imports, or generated-code execution.
Candidates remain outside the registered protocol list and can be exported as
JSON for review. This is a bounded declarative interpreter, not an operating
system sandbox or a place to run arbitrary AI-generated encoders. Promoting a
candidate requires a separate reviewed implementation, new compatibility
tests, and an explicit registry version. Symbol decoding does not decode the
prototype WAV back into symbols.

The prototype is limited to 24 UTF-8 bytes, 64 symbols, 18 seconds, sample
rates from 8 to 96 kHz, tones below 3,500 Hz and below Nyquist, and an amplitude
ceiling of 0.08 full scale. Processing and exports stay in the browser; no
network, account storage, microphone, playback, or transmission is used.

## Adding a future protocol

1. Assign a stable registry ID and a distinct wire version; never reinterpret
   an existing version's bytes.
2. Define bounded payload, encoder/decoder inputs, framing, timing, sample-rate
   requirements, integrity properties, and backward-compatibility behavior.
3. Add a validated descriptor and a typed adapter in the code registry.
4. Add round-trip, malformed-input, integrity, and compatibility tests.
5. Label prototypes and experimental decoders accurately; do not claim
   device-to-device interoperability without evidence.
