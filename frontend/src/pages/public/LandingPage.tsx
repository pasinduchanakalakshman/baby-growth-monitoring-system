import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Activity, Baby, Info, LineChart, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F8F9FB]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Baby className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Baby Growth Monitoring</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="#" className="text-sm font-medium text-muted-foreground hover:text-foreground">About</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium hover:underline">
              Sign In
            </Link>
            <Button asChild>
              <Link to="/register">Create Account</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="py-20 md:py-32 px-4 text-center">
          <div className="container mx-auto max-w-4xl">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
              Understand your child's growth with continuous monitoring.
            </h1>
            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
              Monitor growth measurements, view WHO-based growth status, and access forecasting and early-risk assessments.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="px-8" asChild>
                <Link to="/register">Create Account</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-8" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-white px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Growth Monitoring</h3>
                <p className="text-sm text-slate-600">Track weight and length against WHO standards over time.</p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <LineChart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Short-Term Growth Forecast</h3>
                <p className="text-sm text-slate-600">See expected 30-day growth trajectories based on our model.</p>
              </div>

              <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Early Growth Risk</h3>
                <p className="text-sm text-slate-600">Identify potential 180-day growth-faltering probabilities early.</p>
              </div>

              <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Info className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Explainable AI</h3>
                <p className="text-sm text-slate-600">Understand the 'why' behind risk scores with transparent factors.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-12 px-4 border-t border-slate-200">
          <div className="container mx-auto max-w-3xl text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 flex flex-col sm:flex-row items-center gap-4 text-left">
              <Info className="h-8 w-8 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-900 font-medium leading-relaxed">
                This system provides growth estimates and risk assessments and is not a medical diagnosis. Always consult with a healthcare professional for medical advice.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Baby Growth Monitoring Project.
          </p>
          <div className="flex items-center gap-6">
            <Link to="#" className="text-sm text-slate-500 hover:text-slate-900">Privacy</Link>
            <Link to="#" className="text-sm text-slate-500 hover:text-slate-900">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
