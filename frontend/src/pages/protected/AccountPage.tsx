import React from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, LogOut, ShieldCheck } from 'lucide-react';

export default function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-slate-500">Manage your profile and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your personal information and account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-2xl font-bold">
              {user?.name?.charAt(0) || <User className="h-8 w-8" />}
            </div>
            <div>
              <h3 className="font-medium text-lg">{user?.name}</h3>
              <p className="text-slate-500">{user?.email}</p>
              <div className="flex items-center gap-1 mt-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full w-fit">
                <ShieldCheck className="h-3 w-3" />
                Active Account
              </div>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <User className="h-4 w-4" /> Full Name
              </p>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email Address
              </p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6 bg-slate-50 flex justify-between rounded-b-lg">
          <Button variant="outline" disabled>Edit Profile (Stage 16B)</Button>
          <Button variant="destructive" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
