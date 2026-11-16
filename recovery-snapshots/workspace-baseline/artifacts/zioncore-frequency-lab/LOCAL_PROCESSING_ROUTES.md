# Local processing routes

Phase 62 was checked against the current client code on 12 November 2026. The work below runs in the browser; none of these paths calls a model provider or sends sample data to a server.

| User task | Local implementation | Boundary |
| --- | --- | --- |
| Microphone measurement | Browser microphone adapter, Web Audio `AnalyserNode`, and local frame interpretation | Starts only after microphone permission; no raw recording is saved or uploaded. |
| WAV inspection and segmentation | Local RIFF/WAVE parser, PCM decoding, FFT, RMS, and bounded event segmentation | PCM/float WAV only; 24 MiB and 60-second limits; no file upload. |
| Waveform generation and export | Validated DSP synthesis, modulation/filter processing, PCM16 WAV serialization | Up to 10 seconds, 480,000 samples, and 0.25 full-scale peak amplitude. |
| Acoustic message encoding/decoding | Local protocol framing, tone generation, resampling, checksum, and packet recovery | No remote receiver is contacted; browser playback is user initiated. |
| Repeated-session comparison | Local alignment and comparison of stored measurement summaries | Uses saved summaries, not remote AI or raw-sample correlation. |
| Research-grid summary | Deterministic browser statistics agent | The current registry has no cloud model agent. |
| AI measurement explanation | Explicit, signed-in Firebase AI Logic request | The only connected cloud model path; see `AI_PROVIDER_INVENTORY.md`. |

The local modules listed above have a regression guard that rejects direct imports or calls to Firebase AI, `fetch`, `XMLHttpRequest`, or Axios. Existing functional tests continue to cover local DSP, WAV processing, message recovery, checksum validation, and comparison behavior.

This routing description does not cover cloud account authentication, AI interpretation, or Firestore. Browser-local storage remains unencrypted, and saving a measurement locally is separate from processing it.
