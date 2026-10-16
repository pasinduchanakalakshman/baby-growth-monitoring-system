import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { ApiClientError } from '@/api/client';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';

const { refreshUser } = vi.hoisted(() => ({ refreshUser: vi.fn() }));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ refreshUser }) }));
vi.mock('@/api/auth', () => ({
  authApi: { loginMother: vi.fn(), registerMother: vi.fn() },
}));

function renderLogin(state?: object, pathname = '/login') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[{ pathname, state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/app" element={<h1>App destination</h1>} />
          <Route path="/growth/history" element={<h1>History destination</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillLogin() {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mother@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
}

function submitLogin() {
  fireEvent.submit(screen.getByRole('form', { name: 'Welcome Back!' }));
}

describe('Login presentation and existing authentication behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    refreshUser.mockResolvedValue(undefined);
  });

  it('provides labeled required fields and password manager hints', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: 'BabyGrowth home' })).toHaveAttribute('href', '/');
    expect(screen.getByLabelText('Email address')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Email address')).toBeRequired();
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password|Google|Apple/i)).not.toBeInTheDocument();
  });

  it('toggles password visibility without submitting or losing the value', () => {
    renderLogin();
    fillLogin();
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle.tabIndex).toBe(0);
    toggle.focus();
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Password')).toHaveValue('password123');
    expect(authApi.loginMother).not.toHaveBeenCalled();
  });

  it.each([
    ['', '', 'Email is required', 'Email address'],
    ['   ', 'password123', 'Email is required', 'Email address'],
    ['mother@example.com', '', 'Password is required', 'Password'],
  ])('preserves empty-field validation (%s, %s)', async (email, password, message, label) => {
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
    submitLogin();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message);
    expect(authApi.loginMother).not.toHaveBeenCalled();
  });

  it('retains native email format validation', () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'invalid-email' } });
    expect(screen.getByLabelText('Email address')).toBeInvalid();
    expect(authApi.loginMother).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, 'App destination'],
    [{ from: { pathname: '/growth/history' } }, 'History destination'],
  ])('sends the existing payload and waits for current-user refresh before redirecting (%j)', async (state, destination) => {
    let finishRefresh!: () => void;
    refreshUser.mockImplementation(() => new Promise<void>(resolve => { finishRefresh = resolve; }));
    vi.mocked(authApi.loginMother).mockResolvedValue({});
    renderLogin(state);
    fillLogin();
    submitLogin();
    await waitFor(() => expect(refreshUser).toHaveBeenCalledOnce());
    expect(vi.mocked(authApi.loginMother).mock.calls[0][0]).toEqual({ email: 'mother@example.com', password: 'password123' });
    expect(screen.queryByText(destination)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    await act(async () => finishRefresh());
    expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
  });

  it('disables controls and announces a pending login request', async () => {
    let rejectLogin!: (error: Error) => void;
    vi.mocked(authApi.loginMother).mockImplementation(() => new Promise((_, reject) => { rejectLogin = reject; }));
    renderLogin();
    fillLogin();
    submitLogin();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled());
    expect(screen.getByLabelText('Email address')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Signing in. Please wait.');
    await act(async () => rejectLogin(new Error('Offline')));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled());
  });

  it.each([
    [new ApiClientError('Unauthorized', 401), 'Incorrect email or password'],
    [new ApiClientError('Bad request', 400, { detail: 'Account unavailable' }), 'Account unavailable'],
    [new ApiClientError('Bad request', 422, { detail: [] }), 'Invalid credentials'],
    [new Error('Offline'), 'Network error or server unavailable'],
  ])('announces authentication errors and allows retry (%s)', async (error, message) => {
    vi.mocked(authApi.loginMother).mockRejectedValueOnce(error).mockResolvedValueOnce({});
    renderLogin();
    fillLogin();
    submitLogin();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(refreshUser).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
    submitLogin();
    expect(await screen.findByRole('heading', { name: 'App destination' })).toBeInTheDocument();
  });

  it('navigates to the existing registration page', async () => {
    renderLogin();
    const links = screen.getAllByRole('link', { name: 'Create Account' });
    links.forEach(link => expect(link).toHaveAttribute('href', '/register'));
    fireEvent.click(links[links.length - 1]);
    expect(await screen.findByLabelText('Full Name')).toBeInTheDocument();
  });

  it('preserves the real registration-to-login handoff and prefills email', async () => {
    vi.mocked(authApi.registerMother).mockResolvedValue({ id: 1, email: 'mother@example.com', name: 'Mother', is_active: true, created_at: '' });
    renderLogin(undefined, '/register');
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Mother' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'mother@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByLabelText('Full Name').closest('form')!);
    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveValue('mother@example.com'));
    expect(screen.getAllByRole('status').some(status => status.textContent?.includes('Account created successfully. Please sign in.'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    vi.mocked(authApi.loginMother).mockRejectedValue(new ApiClientError('Unauthorized', 401));
    submitLogin();
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(screen.queryByText('Account created successfully. Please sign in.')).not.toBeInTheDocument();
  });
});
