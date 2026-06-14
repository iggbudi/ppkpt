const DEFAULT_OUTAGE_MS = Number(process.env.MIMO_OUTAGE_THRESHOLD_MS || 5 * 60 * 1000);

class MimoCircuitBreaker {
  constructor(outageThresholdMs = DEFAULT_OUTAGE_MS) {
    this.outageThresholdMs = outageThresholdMs;
    this.downSince = null;
    this.lastSuccessAt = Date.now();
    this.lastFailureAt = null;
    this.consecutiveFailures = 0;
  }

  recordSuccess() {
    this.lastSuccessAt = Date.now();
    this.lastFailureAt = null;
    this.downSince = null;
    this.consecutiveFailures = 0;
  }

  recordFailure() {
    const now = Date.now();
    this.lastFailureAt = now;
    this.consecutiveFailures += 1;
    if (!this.downSince) this.downSince = now;
  }

  isOpen() {
    if (!this.downSince) return false;
    return Date.now() - this.downSince >= this.outageThresholdMs;
  }

  shouldSkipProviderCall() {
    return this.isOpen();
  }

  getStatus() {
    return {
      open: this.isOpen(),
      downSince: this.downSince,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      consecutiveFailures: this.consecutiveFailures,
      outageThresholdMs: this.outageThresholdMs
    };
  }

  reset() {
    this.downSince = null;
    this.lastFailureAt = null;
    this.consecutiveFailures = 0;
    this.lastSuccessAt = Date.now();
  }
}

const circuitBreaker = new MimoCircuitBreaker();

module.exports = {
  MimoCircuitBreaker,
  circuitBreaker
};