import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from '../api/auth';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  }
}));

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('16. Authentication restoration uses centralized GET /auth/me', () => {
    authApi.getCurrentUser();
    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
  });
});
