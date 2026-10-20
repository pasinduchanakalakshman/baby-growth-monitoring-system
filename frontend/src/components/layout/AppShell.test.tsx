import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { babyApi } from '@/api/baby';
import { ApiClientError } from '@/api/client';
import AppShell from './AppShell';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/baby', () => ({ babyApi: { getBabyProfile: vi.fn() } }));

const mother = { id: 1, name: 'Jane Doe', email: 'jane@example.com', is_active: true, created_at: '' };
const baby = { id: 1, owner_id: 1, name: 'Emma', sex: 'Female' as const, date_of_birth: '2026-10-01', birth_weight_kg: 3.2 };
const destinations = [
  ['/app', 'Dashboard'],
  ['/baby', 'Baby Profile'],
  ['/growth', 'Growth Overview'],
  ['/growth/charts', 'Growth Charts'],
  ['/growth/forecast', 'Growth Forecast'],
  ['/growth/history', 'Growth History'],
  ['/growth/add', 'Add Measurement'],
  ['/growth/risk', 'Growth Risk'],
  ['/growth/risk/history', 'Risk History'],
  ['/growth/explanation', 'Risk Explanation'],
  ['/account', 'Account'],
];
const logout = vi.fn();
const authenticatedState: ReturnType<typeof useAuth> = { user: mother, isAuthenticated: true, isLoading: false, authState: 'AUTHENTICATED', refreshUser: vi.fn(), logout };

function renderShell(path = '/app') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<h1>Login destination</h1>} />
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            {destinations.map(([href, title]) => <Route key={href} path={href} element={<h1>{title} content</h1>} />)}
            <Route path="/baby/register" element={<h1>Baby registration content</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openAccountMenu() {
  const trigger = screen.getByRole('button', { name: 'Open account menu' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu');
}

async function openDrawer() {
  const trigger = screen.getByRole('button', { name: 'Open application navigation' });
  trigger.focus();
  fireEvent.click(trigger);
  return screen.findByRole('dialog', { name: 'BabyGrowth navigation' });
}

describe('Authenticated shell and navigation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    logout.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(authenticatedState);
    vi.mocked(babyApi.getBabyProfile).mockResolvedValue(baby);
  });

  it.each(destinations)('marks only the current destination active at %s', async (path, title) => {
    renderShell(path);
    const navigation = await screen.findByRole('navigation', { name: 'Desktop navigation' });
    const active = within(navigation).getAllByRole('link').filter(link => link.getAttribute('aria-current') === 'page');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute('href', path);
    expect(active[0]).toHaveTextContent(title);
    expect(screen.getByLabelText('Current page')).toHaveTextContent(title);
    expect(screen.getByRole('heading', { level: 1, name: `${title} content` })).toBeInTheDocument();
  });

  it('lists all eleven implemented destinations without unsupported placeholder routes', async () => {
    renderShell();
    const navigation = await screen.findByRole('navigation', { name: 'Desktop navigation' });
    expect(within(navigation).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(destinations.map(([path]) => path));
    expect(screen.getByRole('link', { name: 'BabyGrowth dashboard' })).toHaveAttribute('href', '/app');
    expect(screen.queryByText(/Notifications|Reminders|Health Records|Search/i)).not.toBeInTheDocument();
  });

  it('keeps nested route selection exact with query strings and hashes', async () => {
    renderShell('/growth/risk/history?range=30#visits');
    const navigation = await screen.findByRole('navigation', { name: 'Desktop navigation' });
    expect(within(navigation).getByRole('link', { name: 'Risk History' })).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getByRole('link', { name: 'Growth Risk' })).not.toHaveAttribute('aria-current');
    expect(within(navigation).getByRole('link', { name: 'Growth Overview' })).not.toHaveAttribute('aria-current');
  });

  it('updates the header, active link and outlet after desktop navigation', async () => {
    renderShell();
    const navigation = await screen.findByRole('navigation', { name: 'Desktop navigation' });
    fireEvent.click(within(navigation).getByRole('link', { name: 'Growth Charts' }));
    expect(await screen.findByRole('heading', { name: 'Growth Charts content' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current page')).toHaveTextContent('Growth Charts');
    expect(within(navigation).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('shows only real current-user information in the account menu', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const menu = await openAccountMenu();
    expect(menu).toHaveTextContent(mother.name);
    expect(menu).toHaveTextContent(mother.email);
    expect(within(menu).getByRole('menuitem', { name: 'Account' })).toHaveAttribute('href', '/account');
    expect(within(menu).getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
  });

  it('uses generic account labels when name and email are absent instead of inventing a profile', async () => {
    vi.mocked(useAuth).mockReturnValue({ ...authenticatedState, user: { ...mother, name: '', email: '' } });
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const menu = await openAccountMenu();
    expect(menu).toHaveTextContent('Your account');
    expect(menu).not.toHaveTextContent(mother.name);
    expect(menu).not.toHaveTextContent('@');
  });

  it('opens the existing Account route from the profile menu', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const menu = await openAccountMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Account' }));
    expect(await screen.findByRole('heading', { name: 'Account content' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('delegates sidebar logout to the existing auth context', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
  });

  it('delegates profile-menu logout to the same auth context', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const menu = await openAccountMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Logout' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
  });

  it('disables logout while the real logout promise is pending', async () => {
    let completeLogout!: () => void;
    logout.mockImplementation(() => new Promise<void>(resolve => { completeLogout = resolve; }));
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(await screen.findByRole('button', { name: 'Signing out...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Signing out...' }));
    expect(logout).toHaveBeenCalledOnce();
    await act(async () => completeLogout());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Logout' })).toBeEnabled());
  });

  it('opens a labeled mobile drawer and restores trigger focus on Escape', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const trigger = screen.getByRole('button', { name: 'Open application navigation' });
    const dialog = await openDrawer();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription("Your baby's growth, all in one place.");
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('has a keyboard-accessible drawer close control', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const dialog = await openDrawer();
    const close = within(dialog).getByRole('button', { name: 'Close' });
    close.focus();
    expect(close).toHaveFocus();
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each([['Growth Charts', 'Growth Charts content'], ['Risk History', 'Risk History content']])('closes the drawer and focuses content after selecting %s', async (title, heading) => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const content = screen.getByRole('main');
    content.scrollIntoView = vi.fn();
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole('link', { name: title }));
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(content).toHaveFocus());
    expect(content.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('closes the drawer when its dashboard branding is selected', async () => {
    renderShell('/baby');
    await screen.findByRole('heading', { name: 'Baby Profile content' });
    screen.getByRole('main').scrollIntoView = vi.fn();
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole('link', { name: 'BabyGrowth dashboard' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard content' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('preserves access to every existing destination in the mobile drawer', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const dialog = await openDrawer();
    const navigation = within(dialog).getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(navigation).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(destinations.map(([path]) => path));
  });

  it('closes the drawer and calls the existing logout behavior', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    const dialog = await openDrawer();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps unauthenticated users behind the existing ProtectedRoute', async () => {
    vi.mocked(useAuth).mockReturnValue({ ...authenticatedState, user: null, isAuthenticated: false, authState: 'UNAUTHENTICATED' });
    renderShell('/growth/charts');
    expect(await screen.findByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
    expect(babyApi.getBabyProfile).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', { name: 'Desktop navigation' })).not.toBeInTheDocument();
  });

  it('retains the baby-profile loading state before rendering the shell', () => {
    vi.mocked(babyApi.getBabyProfile).mockImplementation(() => new Promise(() => {}));
    renderShell();
    expect(screen.getByRole('status')).toHaveTextContent('Loading application data...');
    expect(screen.queryByRole('navigation', { name: 'Desktop navigation' })).not.toBeInTheDocument();
  });

  it('retains the missing-baby onboarding redirect and does not retry 404', async () => {
    vi.mocked(babyApi.getBabyProfile).mockRejectedValue(new ApiClientError('Not found', 404));
    renderShell();
    expect(await screen.findByRole('heading', { name: 'Baby registration content' })).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(babyApi.getBabyProfile).toHaveBeenCalledOnce();
  });

  it('keeps baby registration outside the shell navigation', async () => {
    vi.mocked(babyApi.getBabyProfile).mockRejectedValue(new ApiClientError('Not found', 404));
    renderShell('/baby/register');
    expect(await screen.findByRole('heading', { name: 'Baby registration content' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open application navigation' })).not.toBeInTheDocument();
  });

  it('retains the existing redirect away from onboarding when a baby exists', async () => {
    renderShell('/baby/register');
    expect(await screen.findByRole('heading', { name: 'Dashboard content' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Baby registration content' })).not.toBeInTheDocument();
  });

  it('preserves the existing non-404 error behavior without treating it as missing-baby onboarding', async () => {
    vi.mocked(babyApi.getBabyProfile).mockRejectedValue(new ApiClientError('Unavailable', 503));
    renderShell();
    expect(await screen.findByRole('heading', { name: 'Dashboard content' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Baby registration content' })).not.toBeInTheDocument();
  });

  it('provides a skip link and a focusable reusable main container', async () => {
    renderShell();
    await screen.findByRole('heading', { name: 'Dashboard content' });
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#app-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'app-content');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });
});
