export const PACKET_REPLAY_WINDOW_SIZE = 256;

/**
 * Tracks recent packet IDs only for duplicate awareness in the current page
 * session. It is not cryptographic replay protection or sender authentication.
 */
export class PacketReplayWindow {
  private readonly seen = new Set<string>();

  constructor(private readonly maxEntries = PACKET_REPLAY_WINDOW_SIZE) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 4_096) {
      throw new RangeError('Replay window size must be between 1 and 4,096 entries.');
    }
  }

  observe(messageId: string): boolean {
    if (!/^[0-9a-f]{32}$/i.test(messageId)) {
      throw new TypeError('Packet ID must contain 16 bytes of hexadecimal data.');
    }
    if (this.seen.has(messageId)) return true;
    if (this.seen.size >= this.maxEntries) {
      const oldest = this.seen.values().next().value;
      if (oldest) this.seen.delete(oldest);
    }
    this.seen.add(messageId);
    return false;
  }
}
