import { afterEach, describe, expect, it, vi } from 'vitest';
import { growthApi } from './growth';
import response from '@/test/fixtures/newbornWeightJourney.json';
import hybridExplanation from '@/test/fixtures/hybridExplanation.json';

afterEach(() => vi.unstubAllGlobals());

describe('newborn journey API', () => {
  it('retrieves the complete FastAPI response with authentication cookies', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => response,
    });
    vi.stubGlobal('fetch', fetch);
    expect(await growthApi.getNewbornWeightJourney()).toBe(response);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/growth/newborn-weight-journey', expect.objectContaining({
      method: 'GET', credentials: 'include',
    }));
  });
});

it('retrieves the unchanged hybrid explanation response and forwards cancellation with cookies', async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => hybridExplanation,
  });
  vi.stubGlobal('fetch', fetch);
  const { signal } = new AbortController();
  expect(await growthApi.getRiskExplanation(signal)).toBe(hybridExplanation);
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/growth/risk/explanation', expect.objectContaining({
    method: 'GET', credentials: 'include', signal,
  }));
});
