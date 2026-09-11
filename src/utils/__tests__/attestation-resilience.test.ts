import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AttestationResilienceManager } from '../attestation-resilience';

import { AttestationResilienceManager } from '../attestation-resilience';

describe('AttestationResilienceManager', () => {
  let manager: AttestationResilienceManager;

  beforeEach(() => {
    manager = new AttestationResilienceManager({
      maxAttempts: 3,
      initialDelayMs: 10,
      maxDelayMs: 50,
      backoffFactor: 2,
    });
  });

  it('should calculate jitter delay within expected bounds', () => {
    const delay = manager.calculateJitterDelay(1);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(50);
  });

  it('should successfully retrieve attestation when status is complete', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      status: 'complete',
      attestation: '0x123456789abcdef',
    });

    const result = await manager.executeResilientFetch(mockFetch);

    expect(result.attestation).toEqual('0x123456789abcdef');
    expect(result.telemetry.status).toEqual('COMPLETE');
    expect(result.telemetry.attempts).toEqual(1);
  });

  it('should retry until status becomes complete', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'complete', attestation: '0x87654321' });

    const result = await manager.executeResilientFetch(mockFetch);

    expect(result.attestation).toEqual('0x87654321');
    expect(result.telemetry.attempts).toEqual(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw an error when max attempts are exceeded', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ status: 'pending' });

    await expect(manager.executeResilientFetch(mockFetch)).rejects.toThrow(
      'Attestation polling timed out after 3 attempts.'
    );
  });
});
