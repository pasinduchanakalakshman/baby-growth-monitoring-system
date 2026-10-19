import { afterEach, describe, expect, it, vi } from 'vitest';
import { growthApi } from './growth';
import response from '@/test/fixtures/newbornWeightJourney.json';

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
