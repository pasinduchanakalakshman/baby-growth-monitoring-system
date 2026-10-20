import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { ApiClientError } from '@/api/client';
import RegisterPage from './RegisterPage';
import LoginPage from './LoginPage';

const { refreshUser } = vi.hoisted(() => ({ refreshUser: vi.fn() }));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ refreshUser }) }));
vi.mock('@/api/auth', () => ({ authApi: { registerMother: vi.fn(), loginMother: vi.fn() } }));

const mother = { id: 1, name: 'Mother', email: 'mother@example.com', is_active: true, created_at: '' };

function renderRegistration() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<h1>Home destination</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillRegistration(password = 'password123', confirmation = password) {
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Mother' } });
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: mother.email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: confirmation } });
}

function submitRegistration() {
  fireEvent.submit(screen.getByRole('form', { name: 'Create Your Account' }));
}

describe('Registration presentation and existing workflow', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('provides only the four existing fields, password hints, and correct active navigation', () => {
    const { container } = renderRegistration();
    expect(container.querySelectorAll('input')).toHaveLength(4);
    ['Full Name', 'Email Address', 'Password', 'Confirm Password'].forEach(label => {
      expect(screen.getByLabelText(label)).toBeRequired();
    });
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Use at least 6 characters.');
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(navigation).getByText('Create Account')).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'BabyGrowth home' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Google|Apple/i)).not.toBeInTheDocument();
  });

  it('shows and hides the two passwords independently without submitting or losing values', () => {
    renderRegistration();
    fillRegistration();
    const passwordToggle = screen.getByRole('button', { name: 'Show password' });
    const confirmationToggle = screen.getByRole('button', { name: 'Show confirmation password' });
    expect(passwordToggle.tabIndex).toBe(0);
    expect(confirmationToggle.tabIndex).toBe(0);
    passwordToggle.focus();
    expect(passwordToggle).toHaveFocus();
    fireEvent.click(passwordToggle);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-controls', 'password');
    confirmationToggle.focus();
    expect(confirmationToggle).toHaveFocus();
    fireEvent.click(confirmationToggle);
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide confirmation password' })).toHaveAttribute('aria-controls', 'confirmPassword');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide confirmation password' }));
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Password')).toHaveValue('password123');
    expect(screen.getByLabelText('Confirm Password')).toHaveValue('password123');
    expect(authApi.registerMother).not.toHaveBeenCalled();
  });

  it.each([
    ['Full Name', '', 'Name is required'],
    ['Full Name', '   ', 'Name is required'],
    ['Email Address', '', 'Email is required'],
    ['Email Address', '   ', 'Email is required'],
    ['Password', '', 'Password is required'],
  ])('preserves required-field validation for %s (%j)', async (label, value, message) => {
    renderRegistration();
    fillRegistration();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    submitRegistration();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(label).getAttribute('aria-describedby')).toContain('register-error');
    expect(authApi.registerMother).not.toHaveBeenCalled();
  });

  it('retains native email format validation', () => {
    renderRegistration();
    fillRegistration();
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'invalid-email' } });
    expect(screen.getByLabelText('Email Address')).toBeInvalid();
    expect(authApi.registerMother).not.toHaveBeenCalled();
  });

  it('preserves the existing six-character password rule', async () => {
    renderRegistration();
    fillRegistration('12345');
    submitRegistration();
    expect(await screen.findByRole('alert')).toHaveTextContent('Password must be at least 6 characters');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(authApi.registerMother).not.toHaveBeenCalled();
  });

  it.each(['', 'different'])('preserves confirmation validation (%j)', async confirmation => {
    renderRegistration();
    fillRegistration('password123', confirmation);
    submitRegistration();
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Confirm Password')).toHaveAccessibleDescription('Passwords do not match');
    expect(authApi.registerMother).not.toHaveBeenCalled();
  });

  it('accepts six-character passwords, sends only the existing payload, and hands off to the real Login page', async () => {
    vi.mocked(authApi.registerMother).mockResolvedValue(mother);
    renderRegistration();
    fillRegistration('123456');
    submitRegistration();
    await waitFor(() => expect(authApi.registerMother).toHaveBeenCalledOnce());
    expect(vi.mocked(authApi.registerMother).mock.calls[0][0]).toEqual({ name: mother.name, email: mother.email, password: '123456' });
    expect(await screen.findByRole('heading', { name: 'Welcome Back!' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveValue(mother.email));
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getAllByRole('status').some(status => status.textContent?.includes('Account created successfully. Please sign in.'))).toBe(true);
    expect(authApi.loginMother).not.toHaveBeenCalled();
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('disables inputs and both visibility controls while a real mutation is pending', async () => {
    let rejectRegistration!: (error: Error) => void;
    vi.mocked(authApi.registerMother).mockImplementation(() => new Promise((_, reject) => { rejectRegistration = reject; }));
    renderRegistration();
    fillRegistration();
    submitRegistration();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled());
    ['Full Name', 'Email Address', 'Password', 'Confirm Password'].forEach(label => expect(screen.getByLabelText(label)).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show confirmation password' })).toBeDisabled();
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Creating your account. Please wait.');
    fireEvent.click(screen.getByRole('button', { name: 'Creating account...' }));
    expect(authApi.registerMother).toHaveBeenCalledOnce();
    await act(async () => rejectRegistration(new Error('Offline')));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Account' })).toBeEnabled());
  });

  it.each([
    [new ApiClientError('Duplicate', 400, { detail: 'Email already registered' }), 'Email already registered'],
    [new ApiClientError('Validation', 422, { detail: [] }), 'Validation error occurred'],
    [new ApiClientError('Unavailable', 503), 'Network error or server unavailable'],
    [new Error('Offline'), 'Network error or server unavailable'],
  ])('preserves API error handling and form values (%s)', async (error, message) => {
    vi.mocked(authApi.registerMother).mockRejectedValue(error);
    renderRegistration();
    fillRegistration();
    submitRegistration();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Email Address')).toHaveValue(mother.email);
    expect(screen.getByLabelText('Password')).toHaveValue('password123');
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeEnabled();
  });

  it('clears a previous API error on retry and preserves the successful handoff', async () => {
    vi.mocked(authApi.registerMother).mockRejectedValueOnce(new ApiClientError('Duplicate', 400, { detail: 'Email already registered' })).mockResolvedValueOnce(mother);
    renderRegistration();
    fillRegistration();
    submitRegistration();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered');
    submitRegistration();
    expect(await screen.findByRole('heading', { name: 'Welcome Back!' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveValue(mother.email));
    expect(authApi.registerMother).toHaveBeenCalledTimes(2);
  });

  it('uses the existing Login route from the account link', async () => {
    renderRegistration();
    const links = screen.getAllByRole('link', { name: 'Sign In' });
    links.forEach(link => expect(link).toHaveAttribute('href', '/login'));
    fireEvent.click(links[links.length - 1]);
    expect(await screen.findByRole('heading', { name: 'Welcome Back!' })).toBeInTheDocument();
    expect(authApi.registerMother).not.toHaveBeenCalled();
  });
});
