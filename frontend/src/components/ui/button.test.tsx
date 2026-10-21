import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from './button';

describe('Button component styling and variants', () => {
  it('renders standard primary button with approved Blue classes by default', () => {
    render(<Button>Save Growth Record</Button>);
    const btn = screen.getByRole('button', { name: 'Save Growth Record' });
    expect(btn).toHaveClass('bg-btn-primary');
    expect(btn).toHaveClass('text-btn-primary-foreground');
    expect(btn).toHaveClass('hover:bg-btn-primary-hover');
    expect(btn).toHaveClass('active:bg-btn-primary-active');
    expect(btn).toHaveClass('focus-visible:ring-btn-primary');
  });

  it('renders prediction button with approved Pink classes', () => {
    render(<Button variant="prediction">View Early Growth Prediction</Button>);
    const btn = screen.getByRole('button', { name: 'View Early Growth Prediction' });
    expect(btn).toHaveClass('bg-btn-prediction');
    expect(btn).toHaveClass('text-btn-prediction-foreground');
    expect(btn).toHaveClass('hover:bg-btn-prediction-hover');
    expect(btn).toHaveClass('active:bg-btn-prediction-active');
    expect(btn).toHaveClass('focus-visible:ring-btn-prediction');
  });

  it('preserves destructive variant for red delete and error actions', () => {
    render(<Button variant="destructive">Sign Out</Button>);
    const btn = screen.getByRole('button', { name: 'Sign Out' });
    expect(btn).toHaveClass('bg-destructive');
    expect(btn).toHaveClass('text-destructive-foreground');
  });

  it('supports prediction link variant', () => {
    render(<Button variant="prediction-link">View Forecast</Button>);
    const btn = screen.getByRole('button', { name: 'View Forecast' });
    expect(btn).toHaveClass('text-btn-prediction');
  });

  it('supports standard link variant with Blue button color', () => {
    render(<Button variant="link">Learn more</Button>);
    const btn = screen.getByRole('button', { name: 'Learn more' });
    expect(btn).toHaveClass('text-btn-primary');
  });

  it('maintains disabled functionality and styles', () => {
    render(<Button disabled>Disabled Action</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled Action' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass('disabled:opacity-50');
    expect(btn).toHaveClass('disabled:pointer-events-none');
  });
});
