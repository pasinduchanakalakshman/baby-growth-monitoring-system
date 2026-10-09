import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { GuestRoute } from '@/auth/GuestRoute'
import AppShell from '@/components/layout/AppShell'
import LandingPage from '@/pages/public/LandingPage'
import LoginPage from '@/pages/public/LoginPage'
import RegisterPage from '@/pages/public/RegisterPage'
import Dashboard from '@/pages/protected/Dashboard'
import AccountPage from '@/pages/protected/AccountPage'
import ErrorState from '@/components/ui/ErrorState'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public/Guest Routes */}
            <Route path="/" element={
              <GuestRoute>
                <LandingPage />
              </GuestRoute>
            } />
            <Route path="/login" element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            } />
            <Route path="/register" element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            } />

            {/* Protected Routes inside AppShell */}
            <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="app" element={<Dashboard />} />
              <Route path="account" element={<AccountPage />} />
              {/* Placeholders for future baby/growth routes */}
              <Route path="baby" element={<div>Baby Profile Placeholder</div>} />
              <Route path="growth" element={<div>Growth Monitoring Placeholder</div>} />
              <Route path="growth/add" element={<div>Add Measurement Placeholder</div>} />
              <Route path="growth/charts" element={<div>Growth Charts Placeholder</div>} />
              <Route path="growth/forecast" element={<div>Forecast Placeholder</div>} />
              <Route path="growth/risk" element={<div>Risk Placeholder</div>} />
              <Route path="growth/explanation" element={<div>Risk Explanation Placeholder</div>} />
              <Route path="growth/history" element={<div>History Placeholder</div>} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
