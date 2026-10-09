import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Baby } from 'lucide-react';

export default function RegisterPage() {
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
            <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              Register as a mother to start monitoring your baby's growth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" type="text" placeholder="Jane Doe" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="mother@example.com" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" disabled />
            </div>
            <div className="pt-2">
              <Button className="w-full" disabled>Create Account</Button>
            </div>
            <p className="text-sm text-center text-muted-foreground mt-4">
              Registration functionality will be implemented in Stage 16B.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col border-t p-6 mt-4">
            <p className="text-sm text-center text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
