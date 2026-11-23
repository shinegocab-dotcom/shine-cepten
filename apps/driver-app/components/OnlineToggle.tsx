import React from 'react';
import { Lock, Power } from 'lucide-react';
import { useDriverApp } from '../state/DriverAppContext';

export const OnlineToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { backendConfigured, driverProfile, onlineEligibility, togglingDuty, toggleOnlineStatus } =
    useDriverApp();

  const isOnline = Boolean(driverProfile?.is_online);
  const canGoOnline = backendConfigured && onlineEligibility.allowed;

  return (
    <button
      type="button"
      disabled={togglingDuty}
      onClick={() => void toggleOnlineStatus()}
      aria-pressed={isOnline}
      className={`group flex min-h-[52px] items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${
        isOnline
          ? 'border-[#1E1E1E] bg-[#1E1E1E] text-white dark:border-[#F5C518] dark:bg-[#F5C518] dark:text-[#1E1E1E]'
          : canGoOnline
          ? 'border-neutral-300 bg-white text-[#1E1E1E] hover:border-[#1E1E1E] dark:border-neutral-700 dark:bg-[#1E1E1E] dark:text-white'
          : 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-[#1E1E1E] dark:text-neutral-300'
      } ${compact ? '' : 'w-full'}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isOnline
              ? 'bg-[#F5C518] text-[#1E1E1E] dark:bg-[#1E1E1E] dark:text-[#F5C518]'
              : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          {canGoOnline || isOnline ? <Power className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold whitespace-nowrap">
              {isOnline ? 'Online · Accepting Rides' : 'Offline Duty'}
            </span>
          </div>
          {!compact && (
            <p
              className={`truncate text-xs ${
                isOnline
                  ? 'text-neutral-300 dark:text-neutral-800'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {!backendConfigured
                ? 'Requires Firebase connection & admin approval'
                : !driverProfile
                ? 'Sign in with Google or OTP to check duty approval'
                : !onlineEligibility.allowed
                ? 'Locked until profile, KYC, and vehicle are approved'
                : isOnline
                ? 'Streaming live GPS · Tap to pause ride offers'
                : 'Tap to go online and receive live ride requests'}
            </p>
          )}
        </div>
      </div>

      <span
        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
          isOnline
            ? 'bg-[#F5C518] text-[#1E1E1E] dark:bg-[#1E1E1E] dark:text-[#F5C518]'
            : 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200'
        }`}
      >
        {isOnline ? 'GO OFFLINE' : canGoOnline ? 'GO ONLINE' : 'LOCKED'}
      </span>
    </button>
  );
};
