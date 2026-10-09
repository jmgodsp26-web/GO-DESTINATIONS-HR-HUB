import { GoDestinationsLogo } from '../common/GoDestinationsLogo';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  HelpCircle,
  X,
  CheckCircle2,
  Info,
  KeyRound,
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modal State
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'reset' | 'info'>('reset');

  // Load remembered work email / ID on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('godestinations_remembered_email');
      if (saved) {
        setIdentifier(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const openResetModal = () => {
    setError(null);
    setActiveModalTab('reset');
    setShowHelpModal(true);
  };

  const openInfoModal = () => {
    setActiveModalTab('info');
    setShowHelpModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your company email address.');
      return;
    }
    if (!password || !password.trim()) {
      setError('Wrong password. Please try again or reset your password.');
      return;
    }

    setError(null);
    setSuccessBanner(null);
    setIsLoading(true);

    try {
      await login(cleanId, password);
      // Persist remembered identifier if checked
      if (rememberMe) {
        try {
          localStorage.setItem('godestinations_remembered_email', cleanId);
        } catch {}
      } else {
        try {
          localStorage.removeItem('godestinations_remembered_email');
        } catch {}
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Wrong password. Please try again or reset your password.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const isWrongPassword = Boolean(
    error &&
      (error.toLowerCase().includes('wrong password') ||
        error.toLowerCase().includes('password') ||
        error.toLowerCase().includes('credential'))
  );

  return (
    <div className="go-login relative min-h-screen bg-[#fafbfc] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased overflow-hidden select-none">
      {/* Refined Ambient Background Lighting & Subtle Pattern */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_-10%,rgba(58,93,131,0.08),rgba(255,255,255,0))] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.4] bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,#000_60%,transparent_100%)] pointer-events-none"
        aria-hidden="true"
      />

      <aside className="go-login-story" aria-label="GO Destinations workplace">
        <div className="go-story-top"><GoDestinationsLogo variant="icon-only" size="xl" /><span>GO DESTINATIONS</span></div>
        <div className="go-story-copy"><span className="go-eyebrow">PEOPLE MAKE THE JOURNEY</span><h2>A world of possibilities.<br /><em>One connected team.</em></h2><p>Your time, your team, and everything you need to do your best work. Welcome to your GO workplace.</p></div>
        <div className="go-story-footer"><span className="go-story-dot" /> GLOBAL REACH. PERSONAL CONNECTION.</div>
      </aside>
      <div className="go-login-form relative z-10 w-full max-w-[420px] mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#3A5D83]" />
            <span className="text-xs font-semibold tracking-widest text-[#3A5D83] uppercase">
              Workforce Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            GO Destinations
          </h1>
          <p className="mt-1 text-xs sm:text-[13px] text-slate-500 font-normal">
            Employee Directory &amp; Leave Administration
          </p>
        </div>

        {/* Main Authentication Card */}
        <div className="go-surface bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06),0_16px_40px_-8px_rgba(15,23,42,0.04)] p-7 sm:p-9 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Sign in to your account
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Welcome back. Enter your credentials to continue.
            </p>
          </div>

          {/* Success Banner */}
          {successBanner && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-800 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold block">Password Changed</span>
                <span>{successBanner}</span>
              </div>
            </div>
          )}

          {/* Error Message for other account issues (e.g. disabled account) */}
          {error && !isWrongPassword && (
            <div
              id="auth-error-banner"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-700 animate-in fade-in duration-150 shadow-xs"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-bold block text-rose-900 text-sm">
                  Sign-In Issue
                </span>
                <span className="block mt-0.5 text-rose-800">{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="identifier"
                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Company Email
              </label>
              <div className="relative group focus-within:ring-4 focus-within:ring-[#3A5D83]/10 rounded-xl transition-all">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#3A5D83] transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="identifier"
                  name="identifier"
                  type="email"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50/60 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#3A5D83] transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={openResetModal}
                  className="text-[11px] text-[#3A5D83] hover:text-[#182E3F] hover:underline font-semibold cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative group focus-within:ring-4 focus-within:ring-[#3A5D83]/10 rounded-xl transition-all">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#3A5D83] transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm border rounded-xl bg-slate-50/60 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-all font-mono ${
                    isWrongPassword
                      ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/10'
                      : 'border-slate-200 focus:border-[#3A5D83]'
                  }`}
                  placeholder="Enter your account password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Inline Password Error Message */}
              {isWrongPassword && (
                <div
                  id="password-inline-error"
                  className="mt-1.5 flex items-center space-x-1.5 text-xs text-rose-600 font-medium animate-in fade-in duration-150"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span>Wrong password. Please try again or reset your password.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-[#3A5D83] rounded border-slate-300 focus:ring-[#3A5D83]"
                />
                <span className="text-xs text-slate-600 font-medium">Remember on this device</span>
              </label>

              <button
                type="button"
                onClick={openInfoModal}
                className="text-xs text-slate-500 hover:text-[#3A5D83] flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Need help?</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                id="login-submit-btn"
                disabled={isLoading}
                className="group relative w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#3A5D83] hover:bg-[#182E3F] active:bg-[#243E58] shadow-[0_2px_8px_-1px_rgba(58,93,131,0.35)] hover:shadow-[0_4px_12px_-2px_rgba(58,93,131,0.45)] disabled:opacity-50 transition-all min-h-[44px] cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1.5">
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Exterior Clean Footer */}
        <div className="text-center mt-6">
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} GO Destinations Ltd. All rights reserved.
          </p>
        </div>
      </div>

      {/* Forgot Password / Account Assistance Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="go-surface bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header & Navigation Tabs */}
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 pt-5 pb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Account Assistance &amp; Security
                </h3>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('reset')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                    activeModalTab === 'reset'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Reset Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('info')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                    activeModalTab === 'info'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Onboarding Info</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Password Recovery Guidance */}
            {activeModalTab === 'reset' && (
              <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Protected Account Recovery</span>
                  </div>
                  <p className="text-amber-900 leading-normal">
                    To reset your password, contact HR.
                  </p>
                </div>

                <div className="space-y-2 text-slate-700">
                  <p className="font-semibold text-slate-900 text-xs">How to get access:</p>
                  <p>
                    Ask your HR administrator for a temporary password:
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-medium text-slate-800">
                    <div>Contact your company HR administrator through your internal company directory.</div>
                  </div>
                  <p className="text-slate-500 text-[11px] pt-1">
                    Your HR Administrator will issue a temporary credential that requires you to choose a new private password upon signing in.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(false)}
                    className="px-5 py-2 bg-[#3A5D83] hover:bg-[#182E3F] text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Understood
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Onboarding Info */}
            {activeModalTab === 'info' && (
              <div className="p-6 space-y-3.5 text-xs text-slate-600 leading-relaxed">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                  <p className="font-semibold text-slate-900 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Initial Onboarding Password</span>
                  </p>
                  <p className="text-slate-600">
                    When you are added to the company portal, HR will give you a unique temporary password for your account.
                  </p>
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 text-xs inline-block">
                    Provided privately by HR
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-900">Signing in:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                    <li>Enter your company email address.</li>
                    <li>Enter the temporary password provided by HR.</li>
                    <li>You will be prompted to set your personal password right after logging in.</li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-700 text-[11px] leading-relaxed">
                  <strong>Need administrator assistance?</strong> Ask your company HR administrator to reset your password in Employees.
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(false)}
                    className="px-4 py-2 bg-[#3A5D83] hover:bg-[#182E3F] text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
