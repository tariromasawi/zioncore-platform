# Local DSP configuration — ZionCore Frequency Lab

The Live Lab’s local signal studio uses a validated configuration before it
generates a signal or enables WAV export.

## Supported bounds

- Mono sample rates: 22.05, 44.1, or 48 kHz.
- Duration: 0.1–10 seconds; at most 480,000 samples.
- Waveforms: sine, triangle, square, and sawtooth.
- Carrier frequency: 20–10,000 Hz and below Nyquist.
- Peak amplitude: 0–0.25 normalized full scale (FS).
- Modulation: none, amplitude modulation (AM), or frequency modulation (FM);
  modulation rate is 0.1–20 Hz and depth is 0–1.
- Filters: none, one-pole low-pass, one-pole high-pass, or cascaded
  high-pass/low-pass band-pass. Cutoffs must be ordered and below Nyquist.
- Output: user-triggered mono PCM16 RIFF/WAVE download, no larger than the
  configured sample and duration bounds.

FM deviation is bounded to half the carrier frequency times modulation depth
and is rejected if the configured maximum would reach Nyquist. Generated
signals receive short edge fades. Filtering, modulation, synthesis, and export
are deterministic local operations based on the validated preview settings.

Playback requires a separate user action after explicit consent. It uses the
browser-selected audio output, a fixed 0.5 gain, and an immediate stop control;
with the 0.25 FS generated-signal ceiling, the software output is capped at
0.125 FS. Device loudness can still vary, so users are advised to start at low
system volume. No signal is transmitted over radio, saved to an account, or
uploaded. Downloading or playing a WAV is not evidence that a receiver
understands its contents.
