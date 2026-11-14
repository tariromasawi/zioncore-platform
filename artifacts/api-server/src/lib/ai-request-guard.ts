export type AIRequestGuardResult =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: 'cooldown' | 'capacity' };

export function createAIRequestGuard(options: {
  cooldownMs?: number;
  maxConcurrent?: number;
  maxTrackedUsers?: number;
  now?: () => number;
} = {}) {
  const cooldownMs = options.cooldownMs ?? 15_000;
  const maxConcurrent = options.maxConcurrent ?? 4;
  const maxTrackedUsers = Number.isInteger(options.maxTrackedUsers) && (options.maxTrackedUsers ?? 0) > 0
    ? options.maxTrackedUsers!
    : 5_000;
  const now = options.now ?? Date.now;
  const lastRequestByUid = new Map<string, number>();
  let activeRequests = 0;

  return {
    acquire(uid: string): AIRequestGuardResult {
      const timestamp = now();
      const lastRequest = lastRequestByUid.get(uid);
      if (lastRequest != null && timestamp - lastRequest < cooldownMs) {
        return { allowed: false, reason: 'cooldown' };
      }
      if (activeRequests >= maxConcurrent) {
        return { allowed: false, reason: 'capacity' };
      }

      // Refresh insertion order so the map is a bounded LRU of recent users.
      lastRequestByUid.delete(uid);
      lastRequestByUid.set(uid, timestamp);
      activeRequests += 1;
      while (lastRequestByUid.size > maxTrackedUsers) {
        const oldestUid = lastRequestByUid.keys().next().value;
        if (oldestUid === undefined) break;
        lastRequestByUid.delete(oldestUid);
      }

      let released = false;
      return {
        allowed: true,
        release() {
          if (released) return;
          released = true;
          activeRequests = Math.max(0, activeRequests - 1);
        },
      };
    },
  };
}
