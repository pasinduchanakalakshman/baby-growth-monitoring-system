import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { GuestRoute } from '@/auth/GuestRoute';

// Layout
import AppShell from '@/components/layout/AppShell';

// Public Pages
import LandingPage from '@/pages/public/LandingPage';
import LoginPage from '@/pages/public/LoginPage';
import RegisterPage from '@/pages/public/RegisterPage';

// Protected Pages
import Dashboard from '@/pages/protected/Dashboard';
import AccountPage from '@/pages/protected/AccountPage';
import BabyRegistrationPage from '@/pages/protected/BabyRegistrationPage';
import BabyProfilePage from '@/pages/protected/BabyProfilePage';
import AddMeasurementPage from '@/pages/protected/AddMeasurementPage';
import HistoryPage from '@/pages/protected/HistoryPage';
import GrowthOverviewPage from '@/pages/protected/GrowthOverviewPage';
import GrowthChartsPage from '@/pages/protected/GrowthChartsPage';
import GrowthForecastPage from '@/pages/protected/GrowthForecastPage';
import RiskLatestPage from '@/pages/protected/RiskLatestPage';
import RiskHistoryPage from '@/pages/protected/RiskHistoryPage';
import RiskExplanationPage from '@/pages/protected/RiskExplanationPage';
import NutritionPage from '@/pages/protected/NutritionPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public/Guest Routes */}
            <Route path="/" element={<GuestRoute><LandingPage /></GuestRoute>} />
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

            {/* Protected Routes Wrapper with Onboarding Logic */}
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              {/* App Shell content - Onboarding */}
              <Route path="/baby/register" element={<BabyRegistrationPage />} />
              
              {/* Main App Content */}
              <Route path="/app" element={<Dashboard />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/baby" element={<BabyProfilePage />} />
              <Route path="/nutrition" element={<NutritionPage />} />
              <Route path="/growth" element={<GrowthOverviewPage />} />
              <Route path="/growth/add" element={<AddMeasurementPage />} />
              <Route path="/growth/history" element={<HistoryPage />} />
              <Route path="/growth/charts" element={<GrowthChartsPage />} />
              <Route path="/growth/forecast" element={<GrowthForecastPage />} />
              <Route path="/growth/risk" element={<RiskLatestPage />} />
              <Route path="/growth/risk/history" element={<RiskHistoryPage />} />
              <Route path="/growth/explanation" element={<RiskExplanationPage />} />
              
              {/* Catch-all for authenticated */}
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Route>

            {/* Catch-all for unauthenticated */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
