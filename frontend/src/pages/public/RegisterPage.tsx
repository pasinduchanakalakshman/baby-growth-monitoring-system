import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { CircleAlert, Loader2, Mail, UserRound } from 'lucide-react';
import { authApi } from '@/api/auth';
import { ApiClientError } from '@/api/client';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  const registerMutation = useMutation({
    mutationFn: authApi.registerMother,
    onSuccess: async () => {
      // Preserve the existing email-prefill and success-message handoff to Login.
      navigate('/login', { state: { registered: true, email: formData.email } });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.data?.detail) {
        setError(typeof err.data.detail === 'string' ? err.data.detail : 'Validation error occurred');
      } else {
        setError('Network error or server unavailable');
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) return setError('Name is required');
    if (!formData.email.trim()) return setError('Email is required');
    if (!formData.password) return setError('Password is required');
    if (formData.password.length < 6) return setError('Password must be at least 6 characters');
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    registerMutation.mutate({
      name: formData.name,
      email: formData.email,
      password: formData.password
    });
  };

  const nameInvalid = error === 'Name is required';
  const emailInvalid = error === 'Email is required';
  const passwordInvalid = error === 'Password is required' || error === 'Password must be at least 6 characters';
  const confirmationInvalid = error === 'Passwords do not match';

  return (
    <AuthLayout mode="register">
      <Card className="auth-surface rounded-2xl border-card bg-card/95">
        <CardHeader className="space-y-0 pb-7">
          <div className="mb-8 hidden grid-cols-2 rounded-lg bg-muted/70 p-1 text-center text-sm sm:grid">
            <Link to="/login" className="flex min-h-11 items-center justify-center rounded-md text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">Sign In</Link>
            <span aria-current="page" className="relative rounded-md bg-card px-3 py-2.5 font-medium text-primary shadow-control after:absolute after:inset-x-1/3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-primary">Create Account</span>
          </div>
          <CardTitle>
            <h2 id="register-heading" className="text-2xl leading-tight font-bold tracking-tight">Create Your Account</h2>
          </CardTitle>
          <CardDescription id="register-description" className="mt-2 leading-relaxed">
            Join to start tracking your baby's growth.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} aria-labelledby="register-heading" aria-describedby={error ? 'register-error' : 'register-description'} aria-busy={registerMutation.isPending}>
          <CardContent className="auth-form max-w-none gap-5 pb-0">
            {error && (
              <Alert variant="destructive" id="register-error">
                <CircleAlert aria-hidden="true" className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <UserRound aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your full name"
                  className="h-12 rounded-lg bg-background/60 pl-11"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  disabled={registerMutation.isPending}
                  aria-invalid={nameInvalid || undefined}
                  aria-describedby={nameInvalid ? 'register-error' : undefined}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="youremail@example.com"
                  className="h-12 rounded-lg bg-background/60 pl-11"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  disabled={registerMutation.isPending}
                  aria-invalid={emailInvalid || undefined}
                  aria-describedby={emailInvalid ? 'register-error' : undefined}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                placeholder="Create a password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                disabled={registerMutation.isPending}
                aria-invalid={passwordInvalid || undefined}
                aria-describedby={passwordInvalid ? 'register-error password-hint' : 'password-hint'}
                required
              />
              <p id="password-hint" className="text-xs leading-relaxed text-muted-foreground">Use at least 6 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                visibilityLabel="confirmation password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                disabled={registerMutation.isPending}
                aria-invalid={confirmationInvalid || undefined}
                aria-describedby={confirmationInvalid ? 'register-error' : undefined}
                required
              />
            </div>
            <Button className="mt-2 h-12 w-full rounded-lg" type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                  Creating account...
                </>
              ) : 'Create Account'}
            </Button>
            <span role="status" className="sr-only">{registerMutation.isPending ? 'Creating your account. Please wait.' : ''}</span>
          </CardContent>
          <CardFooter className="justify-center pt-5">
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Sign In</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
