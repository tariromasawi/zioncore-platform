---
name: Capture ownership during recovery
description: Error-boundary scope must not separate media controls from their capture owner.
---

A recovery boundary that removes microphone controls must also unmount or stop
the component that owns the active media stream.

**Why:** an inner display boundary can hide the controls while leaving a parent
capture engine mounted. That would leave the user without visible control of
an active microphone.

**How to apply:** keep the live capture owner inside the outer recovery scope.
Use local boundaries only around self-contained instruments whose media
resources are cleaned up when that instrument unmounts. Check ownership and
cleanup before moving or adding recovery boundaries.
