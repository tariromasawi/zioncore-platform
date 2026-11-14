---
name: MediaRecorder MP4 chunking
description: A Chromium MediaRecorder edge case when time-sliced MP4 fragments are joined into one downloadable audio Blob.
---

For Chromium's `audio/mp4` MediaRecorder output, requesting periodic chunks and concatenating them into a standalone Blob produced a truncated decodable file in local browser testing: a 3.5-second capture decoded to about 1.4 seconds. Calling `start()` without a timeslice produced a complete file. WebM chunking decoded for the full capture duration in the same environment.

**Why:** A MIME support probe alone does not prove that the emitted chunk sequence forms a complete standalone file. Playback and decoding must be checked against the final Blob.

**How to apply:** When changing recorder formats or chunk intervals, decode and inspect the final saved file, not only MediaRecorder events or wall-clock capture time. For MP4, avoid fragment concatenation unless verified in the target browser; keep resource bounds and report actual file duration separately from elapsed capture time.
