import { Navigate } from 'react-router-dom';

/**
 * Backward compatibility redirect:
 * The separate Risk Explanation page has been merged into the primary Growth Risk & Insights page.
 * Any navigation to /growth/explanation redirects directly to the explanation section on /growth/risk.
 */
export default function RiskExplanationPage() {
  return <Navigate to="/growth/risk#why-this-risk-assessment" replace />;
}
