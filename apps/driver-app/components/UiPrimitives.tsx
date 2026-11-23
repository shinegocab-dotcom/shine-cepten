import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Settings2, X } from 'lucide-react';
import { useDriverApp } from '../state/DriverAppContext';

export const StateNotice: React.FC<{
  variant: 'unconfigured' | 'empty' | 'locked' | 'error' | 'success';
  title: string;
  description: string;
  missingEnvVars?: string[];
  actionLabel?: string;
  onAction?: () => void;
}> = ({ variant, title, description, missingEnvVars, actionLabel, onAction }) => {
  const styles = {
    unconfigured:
      'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900/60 text-neutral-900 dark:text-neutral-100',
    empty:
      'bg-white dark:bg-[#1E1E1E] border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100',
    locked:
      'bg-neutral-100 dark:bg-[#1E1E1E] border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100',
    error:
      'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-950 dark:text-red-100',
    success:
      'bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-100',
  }[variant];

  const Icon =
    variant === 'unconfigured'
      ? Settings2
      : variant === 'error' || variant === 'locked'
      ? AlertTriangle
      : variant === 'success'
      ? CheckCircle2
      : Info;

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {description}
          </p>
          {missingEnvVars && missingEnvVars.length > 0 && (
            <p className="font-mono-num text-xs text-neutral-600 dark:text-neutral-400">
              Required configuration: {missingEnvVars.join(' · ')}
            </p>
          )}
          {actionLabel && onAction && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onAction}
                className="min-h-[44px] rounded-xl bg-[#1E1E1E] px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-[#F5C518] dark:text-[#1E1E1E]"
              >
                {actionLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const FeedbackToast: React.FC = () => {
  const { feedback, clearFeedback } = useDriverApp();
  if (!feedback) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(max(env(safe-area-inset-bottom),16px)+74px)] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-[#1E1E1E]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#1E1E1E] dark:text-white">{feedback.title}</p>
          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            {feedback.message}
          </p>
          {feedback.missingEnvVars && feedback.missingEnvVars.length > 0 && (
            <p className="font-mono-num text-[11px] text-amber-700 dark:text-amber-300">
              Missing: {feedback.missingEnvVars.join(' · ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={clearFeedback}
          aria-label="Dismiss notification"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const PrimaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'brand' | 'dark' | 'outline' | 'danger';
  }
> = ({ variant = 'brand', className = '', children, ...rest }) => {
  const variantStyles = {
    brand:
      'bg-[#F5C518] text-[#1E1E1E] hover:bg-[#E0B20F] disabled:bg-neutral-200 disabled:text-neutral-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500',
    dark: 'bg-[#1E1E1E] text-white hover:bg-neutral-800 dark:bg-white dark:text-[#1E1E1E] dark:hover:bg-neutral-200 disabled:opacity-50',
    outline:
      'border border-neutral-300 bg-white text-[#1E1E1E] hover:bg-neutral-50 dark:border-neutral-700 dark:bg-[#1E1E1E] dark:text-white dark:hover:bg-neutral-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
  }[variant];

  return (
    <button
      {...rest}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518] ${variantStyles} ${className}`}
    >
      {children}
    </button>
  );
};

export const ScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3.5 dark:border-neutral-800">
    <div className="min-w-0 space-y-0.5">
      <h1 className="font-display text-xl font-bold tracking-tight text-[#1E1E1E] dark:text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{subtitle}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  className?: string;
}> = ({ size = 'md', label, sublabel, className = '' }) => {
  const ringSizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-[2.5px]',
    lg: 'h-9 w-9 border-[3px]',
  }[size];

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 animate-spin rounded-full border-[#F5C518]/30 border-t-[#F5C518] border-r-[#1E1E1E] dark:border-[#F5C518]/25 dark:border-t-[#F5C518] dark:border-r-[#F5C518] ${ringSizes}`}
      />
      {(label || sublabel) && (
        <span className="min-w-0 text-left">
          {label && (
            <span className="block text-xs font-bold text-[#1E1E1E] dark:text-white">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="block text-[11px] leading-snug text-neutral-600 dark:text-neutral-400">
              {sublabel}
            </span>
          )}
        </span>
      )}
    </span>
  );
};
