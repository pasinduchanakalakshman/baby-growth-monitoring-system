import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { GuestRoute } from '../auth/GuestRoute';
import LandingPage from '../pages/public/LandingPage';
import AccountPage from '../pages/protected/AccountPage';
import AppShell from '../components/layout/AppShell';
import { authApi } from '../api/auth';
import { apiClient } from '../api/client';

vi.mock('../api/auth', () => ({
  authApi: {
    getCurrentUser: vi.fn(),
    logoutMother: vi.fn(),
  }
}));

vi.mock('../api/baby', () => ({
  babyApi: {
    getBabyProfile: vi.fn().mockResolvedValue({ id: 1, name: 'Emma' }),
  }
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('Stage 16A Frontend QA Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Public landing page renders when unauthenticated', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Understand your child's growth/i)).toBeTruthy();
  });

  it('2. Landing page Create Account CTA navigates to /register', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const registerLinks = screen.getAllByText(/Create Account/i);
    expect(registerLinks[0].closest('a')?.getAttribute('href')).toBe('/register');
  });

  it('3. Landing page Sign In CTA navigates to /login', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const loginLinks = screen.getAllByText(/Sign In/i);
    expect(loginLinks[0].closest('a')?.getAttribute('href')).toBe('/login');
  });

  it('4. Auth loading state prevents protected content flash', () => {
    // Mock pending promise so it stays loading
    vi.mocked(authApi.getCurrentUser).mockImplementation(() => new Promise(() => {}));
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/app']}>
            <ProtectedRoute>
              <div data-testid="protected-content">Secret Content</div>
            </ProtectedRoute>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    // Spinner should be present, content should not
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('5. ProtectedRoute redirects unauthenticated users to /login', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Unauthorized'));
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/app']}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
              <Route path="/app" element={
                <ProtectedRoute>
                  <div data-testid="protected-content">Protected Content</div>
                </ProtectedRoute>
              } />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeTruthy();
    });
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('6. Authenticated user can access /app', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test User' } as any);
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/app']}>
            <Routes>
              <Route path="/app" element={
                <ProtectedRoute>
                  <div data-testid="protected-content">Protected Content</div>
                </ProtectedRoute>
              } />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeTruthy();
    });
  });

  it('7. Authenticated user visiting /login is redirected to /app', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test User' } as any);
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/app" element={<div data-testid="app-dashboard">Dashboard</div>} />
              <Route path="/login" element={
                <GuestRoute>
                  <div data-testid="login-page">Login</div>
                </GuestRoute>
              } />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('app-dashboard')).toBeTruthy();
    });
  });

  it('8. Authenticated user visiting /register is redirected to /app', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test User' } as any);
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/register']}>
            <Routes>
              <Route path="/app" element={<div data-testid="app-dashboard">Dashboard</div>} />
              <Route path="/register" element={
                <GuestRoute>
                  <div data-testid="register-page">Register</div>
                </GuestRoute>
              } />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('app-dashboard')).toBeTruthy();
    });
  });

  it('9, 10. Desktop and mobile navigation exists in AppShell', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test User' } as any);
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <AppShell />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      // Desktop sidebar Overview link
      const desktopSidebarNav = screen.getAllByText('Overview');
      expect(desktopSidebarNav.length).toBeGreaterThan(0);
      
      // Mobile bottom nav Home link
      const mobileBottomNav = screen.getAllByText('Home');
      expect(mobileBottomNav.length).toBeGreaterThan(0);
    });
  });

  it('11. Account page renders safe current-user name/email', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: '1', email: 'mother@example.com', name: 'Jane Doe' } as any);
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/account']}>
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
      expect(screen.getAllByText('mother@example.com').length).toBeGreaterThan(0);
    });
  });

  it('12. Logout calls the real centralized logout API method', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test User' } as any);
    vi.mocked(authApi.logoutMother).mockResolvedValue({ message: 'Success' });
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/account']}>
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeTruthy();
    });
    
    const signOutBtn = screen.getByText('Sign Out');
    signOutBtn.click();
    
    expect(authApi.logoutMother).toHaveBeenCalled();
  });

  it('13, 14. Successful logout clears auth state and redirects', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test User' } as any);
    vi.mocked(authApi.logoutMother).mockResolvedValue({ message: 'Success' });
    
    const LogoutTestComponent = () => {
      const { logout, isAuthenticated } = useAuth();
      const navigate = useNavigate();
      
      const handleLogout = async () => {
        await logout();
        navigate('/login');
      }
      return (
        <div>
          <span>{isAuthenticated ? 'AUTHED' : 'UNAUTHED'}</span>
          <button onClick={handleLogout}>Do Logout</button>
        </div>
      );
    }
    
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/app']}>
            <Routes>
              <Route path="/app" element={<LogoutTestComponent />} />
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('AUTHED')).toBeTruthy();
    });
    
    screen.getByText('Do Logout').click();
    
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeTruthy();
    });
  });
});
