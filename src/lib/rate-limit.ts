// Fixed-window in-memory throttle — Laravel's ThrottleRequests.
// Fine for a single office PC deployment; swap for Redis if clustered.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= max;
}

// Periodically drop stale windows so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}, 60_000).unref?.();
