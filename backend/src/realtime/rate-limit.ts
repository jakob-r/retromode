/** Simple token bucket: `capacity` actions, refilled at `perSecond`. */
export class TokenBucket {
  private tokens: number
  private last = Date.now()

  constructor(
    private readonly capacity = 20,
    private readonly perSecond = 2,
  ) {
    this.tokens = capacity
  }

  take(): boolean {
    const now = Date.now()
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.perSecond)
    this.last = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }
}
