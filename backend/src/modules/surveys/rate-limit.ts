/**
 * Small in-memory sliding-window limiter (one API process). Keys are never stored in the DB.
 * Generous on purpose: a whole class may answer from the same university Wi-Fi.
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** true when the call is allowed (and counted). */
  take(key: string, now = Date.now()): boolean {
    const from = now - this.windowMs;
    const list = (this.hits.get(key) || []).filter((t) => t > from);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5000) this.sweep(from);
    return true;
  }

  private sweep(from: number) {
    for (const [k, list] of this.hits) {
      if (!list.some((t) => t > from)) this.hits.delete(k);
    }
  }
}
