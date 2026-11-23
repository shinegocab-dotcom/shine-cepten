import React from 'react';

export interface BrandLogoProps {
  variant?: 'light' | 'dark' | 'auto';
  iconOnly?: boolean;
  showTagline?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: { icon: 26, title: 'text-xs', badge: 'text-[9px] px-1.5 py-0.5 rounded', sub: 'text-[9px]' },
  sm: { icon: 32, title: 'text-base', badge: 'text-[10px] px-2 py-0.5 rounded-md', sub: 'text-[10px]' },
  md: { icon: 42, title: 'text-lg', badge: 'text-[10px] px-2 py-0.5 rounded-md', sub: 'text-[11px]' },
  lg: { icon: 72, title: 'text-2xl', badge: 'text-[11px] px-2.5 py-0.5 rounded-md', sub: 'text-xs' },
};

export const BrandIcon: React.FC<{ size?: number; inverted?: boolean; className?: string }> = ({
  size = 40,
  inverted = false,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 128 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="SHINE CAPTAIN Logo Emblem"
    className={className}
  >
    <rect width="128" height="128" rx="28" fill="#111111" />
    {inverted && (
      <rect
        x="2"
        y="2"
        width="124"
        height="124"
        rx="26"
        stroke="#FFC928"
        strokeOpacity="0.28"
        strokeWidth="2.5"
      />
    )}
    {/* Bold SHINE Double-Slash Emblem (//) */}
    <path d="M30 96L50 32H65L45 96H30Z" fill="#FFC928" />
    <path d="M63 96L83 32H98L78 96H63Z" fill="#FFC928" />
  </svg>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'auto',
  iconOnly = false,
  showTagline = false,
  size = 'md',
  className = '',
}) => {
  const cfg = SIZE_MAP[size];
  const isDark = variant === 'dark';
  const textClass =
    variant === 'auto'
      ? 'text-[#111111] dark:text-white'
      : isDark
      ? 'text-white'
      : 'text-[#111111]';
  const mutedClass =
    variant === 'auto'
      ? 'text-neutral-500 dark:text-neutral-400'
      : isDark
      ? 'text-neutral-400'
      : 'text-neutral-500';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <BrandIcon size={cfg.icon} inverted={isDark} className="shrink-0 shadow-sm" />
      {!iconOnly && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`font-display font-extrabold tracking-tight ${cfg.title} ${textClass}`}>
              SHINE
            </span>
            <span
              className={`bg-[#FFC928] font-display font-extrabold tracking-wide text-[#111111] ${cfg.badge}`}
            >
              CAPTAIN
            </span>
          </div>
          {showTagline && (
            <span className={`mt-1 font-semibold tracking-[0.12em] ${cfg.sub} ${mutedClass}`}>
              Driver App • Partner
            </span>
          )}
        </div>
      )}
    </div>
  );
};
