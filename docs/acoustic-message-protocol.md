# ZionCore acoustic message protocol

## Text and prayer packets — version 1

The browser encodes UTF-8 text into a local, mono PCM16 WAV at 48 kHz. A binary
1 is a 2,400 Hz tone and a binary 0 is a 1,800 Hz tone; bits are sent most
significant bit first, at 20 ms per bit (50 bit/s). The waveform uses a 0.22
sample peak, short symbol ramps, 100 ms leading silence, and 300 ms trailing
silence. Playback is user-started, capped by the audio controller, and can be
stopped immediately.

The frame is:

| Field | Size | Meaning |
| --- | ---: | --- |
| Preamble | 4 bytes | `55 55 D3 91`, used for timing acquisition |
| Header | 24 bytes | `ZCFI` magic, version, payload type, 16-bit big-endian payload length, 16-byte message ID |
| Payload | 0–512 bytes | UTF-8 text or prayer label plus text |
| Checksum | 4 bytes | CRC-32/IEEE over header and payload, big-endian |

No payload fragmentation, gap filling, encryption, acknowledgement, or sender
authentication is defined. A receiver returns a message only after framing,
UTF-8 validation, and CRC verification. CRC is an accidental-corruption check,
not proof of sender, intent, distance, truth, or delivery to any person, animal,
environmental process, spiritual entity, or supernatural recipient.

## Voice packets — version 2

The current optional voice path is a separate protocol: recordings are limited
to 0.25–2 seconds, locally resampled to 8 kHz, compressed with IMA ADPCM, and
transmitted using the version 2 8-FSK profile in the implementation. It reuses
the bounded packet header and CRC checks. Voice capture stays in the browser
tab; it is not persisted by this feature.

## Receive and transfer behavior

The receiver accepts a user-selected audio file or user-started microphone
capture. It reports an unverified candidate separately from a CRC-verified
packet. A missing preamble, truncated frame, unsupported version, invalid UTF-8,
or failed checksum never produces a partial or padded message. Recent message
IDs may be flagged as repeats in the current page session; this is advisory,
not cryptographic replay protection.

Room noise, reverberation, speaker and microphone frequency response, automatic
gain control, and sample-rate conversion affect recovery. Deterministic software
fixtures test exact WAV round-trip and bounded synthetic noise levels; they do
not replace a real two-device acoustic test.

The protocol is audible acoustic output only. It does not encode radio
transmissions, run covert or continuous capture, or verify biological,
environmental, spiritual, or supernatural delivery.
