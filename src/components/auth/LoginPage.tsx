import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Shield,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { GoDestinationsLogo } from '../common/GoDestinationsLogo';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleQuickLogin = async (loginId: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await login(loginId);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your full name or work email address.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await login(identifier.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your name or email.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickAccounts = [
    {
      name: 'Isiah Dane',
      email: 'igeguera@gmail.com',
      role: 'admin' as const,
      roleLabel: 'HR Administrator',
      badge: 'Your Account',
      isPrimary: true,
    },
    {
      name: 'Ann Loraine',
      email: 'ann.loraine@godestinations.com',
      role: 'admin' as const,
      roleLabel: 'HR Director',
      badge: 'Admin',
      isPrimary: false,
    },
    {
      name: 'Trixie Garganera',
      email: 'trixie.garganera@godestinations.com',
      role: 'employee' as const,
      roleLabel: 'Program Management',
      badge: 'Employee',
      isPrimary: false,
    },
    {
      name: 'Denisse Joseph',
      email: 'denisse.joseph@godestinations.com',
      role: 'employee' as const,
      roleLabel: 'Relationship Management',
      badge: 'Employee',
      isPrimary: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-3">
          <GoDestinationsLogo variant="stacked" size="lg" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          GO Destinations HR Hub
        </h2>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Enterprise workforce portal • Leave portfolio, team rosters & administration
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-7 px-5 sm:px-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] rounded-2xl border border-slate-200/90 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Quick Access for igeguera@gmail.com */}
          <div className="rounded-xl p-4 bg-gradient-to-br from-[#3A5D83]/10 via-white to-[#3A5D83]/5 border border-[#3A5D83]/30 shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-[#3A5D83] uppercase tracking-wide">
                  Instant Admin Access
                </span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3A5D83]/10 text-[#3A5D83] border border-[#3A5D83]/20">
                Administrator
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">Isiah Dane</p>
                <p className="text-xs text-slate-500 truncate font-mono">igeguera@gmail.com</p>
              </div>
              <button
                type="button"
                id="quick-login-isiah-btn"
                disabled={isLoading}
                onClick={() => handleQuickLogin('igeguera@gmail.com')}
                className="shrink-0 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#3A5D83] hover:bg-[#2F4D6D] active:bg-[#263E58] shadow-xs transition-all disabled:opacity-50"
              >
                <span>Sign In Directly</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Select Workspace Account */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Or Select Authorized Account
              </span>
              <span className="text-[10px] text-slate-400">1-Click Sign In</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickLogin(acc.email)}
                  className={`flex items-start p-2.5 rounded-xl border text-left transition-all group ${
                    acc.isPrimary
                      ? 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600">
                        {acc.name}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                          acc.role === 'admin'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-200/70 text-slate-700'
                        }`}
                      >
                        {acc.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{acc.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2.5 text-slate-400 font-semibold tracking-wider">
                Or Enter Identifier Manually
              </span>
            </div>
          </div>

          {/* Manual Login Form */}
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name or Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="e.g. igeguera@gmail.com, Isiah Dane, or Ann Loraine"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[10px] text-slate-400">Optional for initialized accounts</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Enter password if set"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                id="login-submit-btn"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-xs text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 transition-all min-h-[40px]"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <span className="flex items-center space-x-1.5">
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            </div>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 flex items-center justify-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Enterprise HR Management • Secure Session</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
