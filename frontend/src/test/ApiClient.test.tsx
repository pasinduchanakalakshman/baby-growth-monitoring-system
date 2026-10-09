import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../api/client';

describe('Stage 16A API Client Tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: 'ok' })
    } as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('15. Central API client uses credentials: include', async () => {
    await apiClient.get('/test');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        credentials: 'include'
      })
    );
  });
});
