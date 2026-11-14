/** Test-only: never permit integration writes outside an explicit loopback emulator. */
export function assertLocalFirestoreEmulator(target: string | undefined): void {
  const match = /^(?:127\.0\.0\.1|localhost|\[::1\]):([0-9]+)$/.exec(target ?? '');
  const port = Number(match?.[1]);
  if (!match || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Database integration tests require an explicit loopback Firestore emulator host and valid port.');
  }
}
