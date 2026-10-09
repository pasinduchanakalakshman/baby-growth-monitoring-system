import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Baby, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/api/auth';
import { ApiClientError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
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
    onError: (err: any) => {
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
    <div className="min-h-dvh flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#F8F9FB]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center items-center gap-2">
          <Baby className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Baby Growth</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign In
        </h2>
      </div>
      
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardDescription className="text-center">
              Welcome back. Sign in to continue monitoring your baby's growth.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {successMsg && (
                <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md border border-green-200 flex items-center justify-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {successMsg}
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 text-center font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="mother@example.com" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loginMutation.isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loginMutation.isPending}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="pt-2">
                <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col border-t p-6">
              <p className="text-sm text-center text-slate-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Create Account
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
