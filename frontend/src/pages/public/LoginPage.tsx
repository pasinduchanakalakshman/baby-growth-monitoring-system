import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Baby } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F8F9FB] p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <Baby className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Baby Growth Monitoring</span>
          </Link>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Welcome back. Sign in to continue monitoring your baby's growth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="mother@example.com" disabled />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="#" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input id="password" type="password" placeholder="••••••••" disabled />
            </div>
            <div className="pt-2">
              <Button className="w-full" disabled>Sign In</Button>
            </div>
            <p className="text-sm text-center text-muted-foreground mt-4">
              Login functionality will be implemented in Stage 16B.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col border-t p-6 mt-4">
            <p className="text-sm text-center text-slate-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Create Account
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
