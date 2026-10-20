import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { UserRound, Loader2, CheckCircle2, CircleAlert } from 'lucide-react';
import { authApi } from '@/api/auth';
import { ApiClientError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const registeredEmail = location.state?.email;
  const justRegistered = location.state?.registered;

  useEffect(() => {
    if (justRegistered && registeredEmail) {
      setEmail(registeredEmail);
      setSuccessMsg('Account created successfully. Please sign in.');
    }
  }, [justRegistered, registeredEmail]);

  const loginMutation = useMutation({
    mutationFn: authApi.loginMother,
    onSuccess: async () => {
      await refreshUser();
      // On success, redirect to the page they came from, or to the app
      const from = location.state?.from?.pathname || '/app';
      navigate(from, { replace: true });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.status === 401) {
        setError('Incorrect email or password');
      } else if (err instanceof ApiClientError && err.data?.detail) {
        setError(typeof err.data.detail === 'string' ? err.data.detail : 'Invalid credentials');
      } else {
        setError('Network error or server unavailable');
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim()) return setError('Email is required');
    if (!password) return setError('Password is required');

    loginMutation.mutate({ email, password });
  };

  return (
    <AuthLayout>
      <Card className="auth-surface rounded-2xl border-card bg-card/95">
        <CardHeader className="space-y-0 pb-7">
          <div className="mb-8 hidden grid-cols-2 rounded-lg bg-muted/70 p-1 text-center text-sm sm:grid">
            <span aria-current="page" className="relative rounded-md bg-card px-3 py-2.5 font-medium text-primary shadow-control after:absolute after:inset-x-1/3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-primary">Sign In</span>
            <Link to="/register" className="flex min-h-11 items-center justify-center rounded-md text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">Create Account</Link>
          </div>
          <CardTitle>
            <h2 id="login-heading" className="text-3xl leading-tight font-bold tracking-tight sm:text-2xl">Welcome Back!</h2>
          </CardTitle>
          <CardDescription id="login-description" className="mt-2 leading-relaxed">
            <span className="lg:hidden">Sign in to continue.</span>
            <span className="hidden lg:inline">Sign in to continue tracking your baby's growth.</span>
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} aria-labelledby="login-heading" aria-describedby={error ? 'login-error' : 'login-description'} aria-busy={loginMutation.isPending}>
          <CardContent className="auth-form max-w-none gap-5 pb-0">
            {successMsg && (
              <Alert role="status" className="border-primary/20 bg-secondary/60">
                <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
                <AlertDescription>{successMsg}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" id="login-error">
                <CircleAlert aria-hidden="true" className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <UserRound aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="youremail@example.com"
                  className="h-12 rounded-lg bg-background/60 pl-11"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loginMutation.isPending}
                  aria-invalid={error === 'Email is required' || undefined}
                  aria-describedby={error === 'Email is required' ? 'login-error' : undefined}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loginMutation.isPending}
                aria-invalid={error === 'Password is required' || undefined}
                aria-describedby={error === 'Password is required' ? 'login-error' : undefined}
                required
              />
            </div>
            <Button className="mt-2 h-12 w-full rounded-lg" type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                  Signing in...
                </>
              ) : 'Sign In'}
            </Button>
            <span role="status" className="sr-only">{loginMutation.isPending ? 'Signing in. Please wait.' : ''}</span>
          </CardContent>
          <CardFooter className="justify-center pt-5">
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Create Account</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
