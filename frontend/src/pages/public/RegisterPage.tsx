import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Baby, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authApi } from '@/api/auth';
import { ApiClientError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
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
      // Upon successful registration, typically the backend doesn't log the user in natively via cookie,
      // wait, the auth router /register returns the User, but does NOT set the cookie!
      // Looking at the auth routes, /login sets the cookie. So we must navigate to /login on success.
      navigate('/login', { state: { registered: true, email: formData.email } });
    },
    onError: (err: any) => {
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

  return (
    <div className="min-h-dvh flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#F8F9FB]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center items-center gap-2">
          <Baby className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Baby Growth</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create Account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardDescription className="text-center">
              Register as a mother to start monitoring your baby's growth.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 text-center font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  type="text" 
                  placeholder="Jane Doe" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  disabled={registerMutation.isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="mother@example.com" 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  disabled={registerMutation.isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    disabled={registerMutation.isPending}
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
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input 
                  id="confirmPassword" 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={registerMutation.isPending}
                  required
                />
              </div>
              <div className="pt-2">
                <Button className="w-full" type="submit" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col border-t p-6">
              <p className="text-sm text-center text-slate-600">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign In
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
