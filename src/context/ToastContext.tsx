import { AnimatePresence, motion } from 'motion/react';
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastInput {
  type?: ToastType;
  title?: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toastOrTitle: ToastInput | string, typeOrMessage?: ToastType | string, message?: string) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toastOrTitle: ToastInput | string, typeOrMessage?: ToastType | string, messageText?: string) => {
      let finalType: ToastType = 'info';
      let finalTitle = '';
      let finalMessage: string | undefined = undefined;
      let finalDuration = 4000;

      if (typeof toastOrTitle === 'object' && toastOrTitle !== null) {
        finalType = toastOrTitle.type || 'info';
        finalTitle = toastOrTitle.title || (finalType === 'error' ? 'Notice' : 'Success');
        finalMessage = toastOrTitle.message;
        finalDuration = toastOrTitle.duration ?? 4000;
      } else if (typeof toastOrTitle === 'string') {
        if (typeOrMessage === 'success' || typeOrMessage === 'error' || typeOrMessage === 'info') {
          finalType = typeOrMessage;
          finalTitle = typeOrMessage === 'error' ? 'Notice' : 'Update';
          finalMessage = toastOrTitle;
        } else if (typeof typeOrMessage === 'string') {
          finalTitle = toastOrTitle;
          finalMessage = typeOrMessage;
        } else {
          finalTitle = toastOrTitle;
        }
        if (messageText) {
          finalMessage = messageText;
        }
      }

      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        id,
        type: finalType,
        title: finalTitle,
        message: finalMessage,
        duration: finalDuration,
      };

      setToasts((prev) => [...prev, newToast]);

      if (finalDuration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, finalDuration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message }),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, info }}>
      {children}
      {/* Floating Toast Container */}
      <div
        aria-live="polite" aria-relevant="additions"
        className="go-toast-stack fixed z-[60] flex flex-col pointer-events-none"
      >
        <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <motion.div layout="position" initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 48 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              key={toast.id}
              className={`go-toast pointer-events-auto is-${toast.type}`}
              style={{ '--toast-duration': `${toast.duration ?? 4000}ms` } as React.CSSProperties}
            >
              <span className="go-toast-icon" aria-hidden="true">
                {isSuccess && <CheckCircle2 className="w-4 h-4" />}
                {isError && <AlertCircle className="w-4 h-4" />}
                {!isSuccess && !isError && <Info className="w-4 h-4" />}
              </span>
              <div className="go-toast-copy">
                <p className="go-toast-title">{toast.title}</p>
                {toast.message && <p className="go-toast-message">{toast.message}</p>}
              </div>
              <button type="button" onClick={() => removeToast(toast.id)} className="go-toast-close" aria-label="Close notification">
                <X className="w-3.5 h-3.5" />
              </button>
              {(toast.duration ?? 4000) > 0 && <span className="go-toast-timer" aria-hidden="true" />}
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
