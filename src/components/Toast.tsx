import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners: ((toast: Toast) => void)[] = [];

/** Call this from anywhere to show a toast notification. */
export function showToast(message: string, type: ToastType = 'info') {
  const toast: Toast = { id: ++toastId, message, type };
  listeners.forEach(fn => fn(toast));
}

const iconMap = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
  error: <XCircle className="w-4 h-4 text-red-400 shrink-0" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-[#d4af37] shrink-0" />,
};

const bgMap = {
  success: 'border-emerald-500/40 bg-emerald-950/80',
  error: 'border-red-500/40 bg-red-950/80',
  warning: 'border-amber-500/40 bg-amber-950/80',
  info: 'border-[#d4af37]/40 bg-[#1a1610]/90',
};

/**
 * ToastContainer — Renders stacked toast notifications.
 * Mount this once at the root of your app.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      const idx = listeners.indexOf(addToast);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-sm text-sm text-[#f4e4bc] font-mono animate-slide-in ${bgMap[toast.type]}`}
        >
          {iconMap[toast.type]}
          <span className="leading-snug">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
