import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export const FirstTimePasswordModal: React.FC = () => {
  const { user, mustChangePassword, completeFirstTimePasswordChange } = useAuth();
  const { showToast } = useToast();

  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNew, setShowNew] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!mustChangePassword || !user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanNew || cleanNew.length < 8) {
      setError('Your new password must be at least 8 characters long.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setError('The passwords you entered do not match. Please verify both fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeFirstTimePasswordChange(cleanNew);
      showToast({
        type: 'success',
        title: 'Password Secured!',
        message: 'Your password has been saved. Please sign in again.',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasMinLength = newPassword.length >= 8;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#3A5D83] to-[#263E58] p-6 text-white text-center relative">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            Create Your Personal Password
          </h2>
          <p className="text-xs text-white/80 mt-1 max-w-xs mx-auto">
            Welcome to GO Destinations, <span className="font-semibold text-white">{user.full_name}</span>!
          </p>
        </div>

        {/* Content & Form */}
        <div className="p-6 sm:p-7 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Since this is your first time signing in with your initial onboarding credentials, please choose a private password to secure your portal account.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Personal Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#3A5D83]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="block w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3A5D83]/20 focus:border-[#3A5D83] transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#3A5D83]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  className="block w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3A5D83]/20 focus:border-[#3A5D83] transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password checklist indicators */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-[11px]">
              <div className="flex items-center space-x-2">
                <span className={hasMinLength ? 'text-emerald-600' : 'text-slate-400'}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                <span className={hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  Minimum 8 characters
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={isMatching ? 'text-emerald-600' : 'text-slate-400'}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                <span className={isMatching ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  Passwords match
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting || !hasMinLength || !isMatching}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#3A5D83] hover:bg-[#2F4D6D] active:bg-[#263E58] shadow-xs disabled:opacity-50 transition-all min-h-[42px] cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center space-x-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Password...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1.5">
                    <span>Set Password &amp; Sign In Again</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>


            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
