import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import RiskExplanationPage from './RiskExplanationPage';

function TestTarget() {
  const location = useLocation();
  return (
    <div>
      <span data-testid="target-pathname">{location.pathname}</span>
      <span data-testid="target-hash">{location.hash}</span>
    </div>
  );
}

describe('RiskExplanationPage Redirect', () => {
  it('redirects from /growth/explanation to /growth/risk#why-this-risk-assessment', () => {
    render(
      <MemoryRouter initialEntries={['/growth/explanation']}>
        <Routes>
          <Route path="/growth/explanation" element={<RiskExplanationPage />} />
          <Route path="/growth/risk" element={<TestTarget />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('target-pathname').textContent).toBe('/growth/risk');
    expect(screen.getByTestId('target-hash').textContent).toBe('#why-this-risk-assessment');
  });
});
