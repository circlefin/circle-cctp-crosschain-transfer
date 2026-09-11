/**
 * AttestationResilienceManager
 * 
 * Production-grade resilience wrapper for Circle IRIS Attestation API.
 * Implements Exponential Backoff with Jitter, retry thresholds, and telemetry tracking.
 */

export interface TelemetryMetrics {
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attempts: number;
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
}

export interface ResilienceConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

export class AttestationResilienceManager {
  private maxAttempts: number;
  private initialDelayMs: number;
  private maxDelayMs: number;
  private backoffFactor: number;

  constructor(config: ResilienceConfig = {}) {
    this.maxAttempts = config.maxAttempts ?? 15;
    this.initialDelayMs = config.initialDelayMs ?? 2000;
    this.maxDelayMs = config.maxDelayMs ?? 30000;
    this.backoffFactor = config.backoffFactor ?? 1.5;
  }

  /**
   * Calculates backoff delay using Full Jitter algorithm to prevent Thundering Herd problem.
   */
  public calculateJitterDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.maxDelayMs,
      this.initialDelayMs * Math.pow(this.backoffFactor, attempt)
    );
    // Full Jitter: random value between 0 and calculated exponential delay
    return Math.floor(Math.random() * exponentialDelay);
  }

  /**
   * Wraps attestation fetch with resilient retry logic & metrics collection.
   */
  public async executeResilientFetch<T>(
    fetchFn: () => Promise<{ status: string; attestation?: string; message?: string }>,
    onProgress?: (attempt: number, metrics: TelemetryMetrics) => void
  ): Promise<{ attestation: string; telemetry: TelemetryMetrics }> {
    const metrics: TelemetryMetrics = {
      startTime: Date.now(),
      attempts: 0,
      status: 'PENDING',
    };

    let attempt = 0;

    while (attempt < this.maxAttempts) {
      attempt++;
      metrics.attempts = attempt;

      try {
        const result = await fetchFn();

        if (result.status === 'complete' && result.attestation) {
          metrics.endTime = Date.now();
          metrics.durationMs = metrics.endTime - metrics.startTime;
          metrics.status = 'COMPLETE';

          if (onProgress) onProgress(attempt, metrics);

          return {
            attestation: result.attestation,
            telemetry: metrics,
          };
        }

        if (onProgress) onProgress(attempt, metrics);
      } catch (error) {
        // Log network error / rate limit but don't break immediately until max attempts
        if (attempt >= this.maxAttempts) {
          metrics.endTime = Date.now();
          metrics.durationMs = metrics.endTime - metrics.startTime;
          metrics.status = 'FAILED';
          throw new Error(
            `Attestation polling failed after ${this.maxAttempts} attempts: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }

      const delay = this.calculateJitterDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    metrics.endTime = Date.now();
    metrics.durationMs = metrics.endTime - metrics.startTime;
    metrics.status = 'FAILED';

    throw new Error(`Attestation polling timed out after ${this.maxAttempts} attempts.`);
  }
}
