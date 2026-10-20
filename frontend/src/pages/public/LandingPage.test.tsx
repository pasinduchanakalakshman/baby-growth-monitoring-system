import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LandingPage from './LandingPage';

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<h1>Login destination</h1>} />
        <Route path="/register" element={<h1>Registration destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Public BabyGrowth welcome page', () => {
  it('renders the requested welcome content and semantic public navigation', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1, name: /Every Little Moment Matters/i })).toBeInTheDocument();
    expect(screen.getByText("Track your baby's growth, get insights, and support their healthy development with confidence.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'BabyGrowth home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Footer navigation' })).toBeInTheDocument();
  });

  it('uses existing public routes and real fragment destinations, with no placeholder links', () => {
    renderLanding();
    screen.getAllByRole('link').forEach(link => {
      const destination = link.getAttribute('href')!;
      expect(destination).not.toBe('#');
      if (destination.startsWith('#')) {
        expect(document.getElementById(destination.slice(1))).not.toBeNull();
      } else {
        expect(['/', '/login', '/register']).toContain(destination);
      }
    });
    expect(screen.queryByRole('link', { name: 'Privacy' })).not.toBeInTheDocument();
  });

  it('describes implemented features with conditional estimates and retains the medical disclaimer', () => {
    renderLanding();
    ['Growth tracking', 'Growth predictions', 'Growth history'].forEach(name => {
      expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
    });
    expect(screen.getByText('Explore estimated growth over the next 30 days when enough measurements are available.')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'About the growth estimates' })).toHaveTextContent('not a medical diagnosis');
    expect(screen.getByRole('complementary', { name: 'About the growth estimates' })).toHaveTextContent('Always consult with a healthcare professional');
  });

  it('provides a skip destination and descriptive, dimensioned existing artwork', () => {
    renderLanding();
    const skipLink = screen.getByRole('link', { name: 'Skip to content' });
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    const illustration = screen.getByRole('img', { name: 'A mother gently holding her sleeping baby' });
    expect(illustration).toHaveAttribute('width', '900');
    expect(illustration).toHaveAttribute('height', '1125');
  });

  it.each([
    ['Create Account', 'Registration destination'],
    ['Sign In', 'Login destination'],
  ])('navigates from the hero %s action to the existing page', async (action, destination) => {
    renderLanding();
    const hero = screen.getByRole('region', { name: /Every Little Moment Matters/i });
    fireEvent.click(within(hero).getByRole('link', { name: action }));
    expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
  });

  it('opens a labeled mobile navigation dialog and restores focus after Escape', async () => {
    renderLanding();
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'BabyGrowth navigation' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Find out about BabyGrowth or access your account.');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes the mobile navigation with its explicit close control', async () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes the mobile navigation when selecting Home', async () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('link', { name: 'Home' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: /Every Little Moment Matters/i })).toBeInTheDocument();
  });

  it('focuses and scrolls to About after dismissing the mobile menu', async () => {
    renderLanding();
    const about = screen.getByRole('region', { name: "A clearer picture of your baby's growth" });
    about.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('link', { name: 'About' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(about).toHaveFocus());
    expect(about.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it.each([
    ['Create Account', 'Registration destination'],
    ['Sign In', 'Login destination'],
  ])('navigates from mobile %s to the existing route and dismisses the menu', async (action, destination) => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('link', { name: action }));
    expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
