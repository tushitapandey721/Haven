import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

// --- Sketch-Style Line Icons (Hand-drawn, human-made feel) ---
export function IdentityIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Hand-drawn identity profile & seal */}
      <path d="M12 3C7.5 3 4 6.5 4 11c0 3.2 1.8 6 4.5 7.3.5.2.8.8.8 1.4v.8c0 .8.7 1.5 1.5 1.5h2.4c.8 0 1.5-.7 1.5-1.5v-.8c0-.6.3-1.2.8-1.4 2.7-1.3 4.5-4.1 4.5-7.3 0-4.5-3.5-8-8-8z" />
      <path d="M9 10.5c.5-.8 1.6-1.5 3-1.5s2.5.7 3 1.5" />
      <circle cx="10" cy="12" r="0.75" fill="currentColor" />
      <circle cx="14" cy="12" r="0.75" fill="currentColor" />
      <path d="M10.5 15.2c.9.6 2.1.6 3 0" />
      <path d="M9.5 21.5h5" strokeDasharray="1 2" />
    </svg>
  );
}

export function BoundariesIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Hand-drawn protective boundary fence & stone shield */}
      <path d="M12 2.8l7 3.2v6.2c0 5-3.2 9.2-7 10.6-3.8-1.4-7-5.6-7-10.6V6l7-3.2z" />
      <path d="M12 7.5v9" />
      <path d="M7.8 12h8.4" />
      <circle cx="12" cy="12" r="2.8" strokeDasharray="2 2" />
    </svg>
  );
}

export function CommitmentsIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Hand-drawn pact knot & open covenant */}
      <path d="M7.5 14.5l-3.2-3.2a2.8 2.8 0 010-4l1.2-1.2a2.8 2.8 0 014 0l3 3 3-3a2.8 2.8 0 014 0l1.2 1.2a2.8 2.8 0 010 4l-3.2 3.2" />
      <path d="M12 11.5v8.5" />
      <path d="M9.5 17.5l2.5 2.5 2.5-2.5" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

export function PrivacyIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Hand-drawn bound journal with latch & wax seal */}
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M4.5 7.5h15" />
      <path d="M8.5 3.5v17" />
      <circle cx="14" cy="12.5" r="2" />
      <path d="M14 14.5v2" />
    </svg>
  );
}

export function AgencyIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Hand-drawn compass & path of self-guidance */}
      <circle cx="12" cy="12" r="9" />
      <polygon points="12 6.5 14.8 11.2 17.5 12 12.8 14.8 12 17.5 9.2 12.8 6.5 12 11.2 9.2 12 6.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function HumilityIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Hand-drawn balanced horizon & leaf */}
      <path d="M3.5 17.5h17" strokeDasharray="3 2" />
      <path d="M12 4.5c4 2 5.5 6.5 4.5 10-2.5-.5-6.5-2.5-8-7 1.5-.5 2.5-2 3.5-3z" />
      <path d="M8.5 7.5c2 2 4.5 4 7 5" />
    </svg>
  );
}

export function CreativeIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Hand-drawn scrapbook scissors & stamp */}
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <line x1="8.2" y1="7.8" x2="19.5" y2="17.5" />
      <line x1="8.2" y1="16.2" x2="19.5" y2="6.5" />
    </svg>
  );
}

export function GuidedIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Hand-drawn lantern flame */}
      <path d="M8 8.5h8l1 9H7l1-9z" />
      <path d="M10 4.5h4v4h-4z" />
      <path d="M12 2.5v2" />
      <path d="M12 11.5v3" strokeDasharray="1 1" />
      <circle cx="12" cy="13" r="1.2" fill="currentColor" />
      <path d="M6.5 21.5h11" />
    </svg>
  );
}

export function QuillIcon({ className = "w-6 h-6", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20.5 3.5c-4.5.5-9 3-12 7l-2 8 8-2c4-3 6.5-7.5 7-12-.3-.5-.6-.8-1-1z" />
      <path d="M14.5 9.5l-6 6" />
      <circle cx="4.5" cy="19.5" r="1" fill="currentColor" />
    </svg>
  );
}

// --- Washi Tape Component ---
export function WashiTape({
  variant = 'kraft',
  angle = -2,
  className = '',
  width = 'w-24',
}: {
  variant?: 'kraft' | 'sage' | 'terracotta' | 'parchment';
  angle?: number;
  className?: string;
  width?: string;
}) {
  const variantClass = {
    kraft: 'washi-tape-kraft',
    sage: 'washi-tape-sage',
    terracotta: 'washi-tape-terracotta',
    parchment: 'washi-tape',
  }[variant];

  return (
    <div
      className={`h-4 ${width} ${variantClass} select-none ${className}`}
      style={{ transform: `rotate(${angle}deg)` }}
      aria-hidden="true"
    />
  );
}

// --- Wax Stamp Button Component ---
export function WaxStampButton({
  children,
  onClick,
  className = '',
  icon,
  ariaLabel,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  icon?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`btn-wax-stamp ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.18)] text-amber-100 shadow-inner">
        {icon || <QuillIcon className="w-3.5 h-3.5" />}
      </span>
      <span>{children}</span>
    </button>
  );
}

// --- Tactile Paper Card Container ---
export function PaperCard({
  surface = 'studio',
  tapeVariant,
  tapeAngle = -1.5,
  withPin = false,
  className = '',
  children,
}: {
  surface?: 'parchment' | 'sage' | 'kraft' | 'studio' | 'slate';
  tapeVariant?: 'kraft' | 'sage' | 'terracotta' | 'parchment';
  tapeAngle?: number;
  withPin?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const surfaceClass = {
    parchment: 'surface-parchment border-[#E2D8C3]',
    sage: 'surface-sage border-[#CBD5C4]',
    kraft: 'surface-kraft border-[#BCA075]',
    studio: 'surface-studio border-[#E8E4D9]',
    slate: 'surface-slate border-[#343D3A]',
  }[surface];

  return (
    <div className={`tactile-card relative rounded-xl border p-6 sm:p-8 ${surfaceClass} ${className}`}>
      {tapeVariant && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
          <WashiTape variant={tapeVariant} angle={tapeAngle} width="w-20 sm:w-28" />
        </div>
      )}
      {withPin && (
        <div
          className="absolute -top-2 left-6 z-10 h-4 w-4 rounded-full bg-[#8B5E43] shadow-md border border-[#F4EEE1] flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="h-1.5 w-1.5 rounded-full bg-[#FAF6EF]" />
        </div>
      )}
      {children}
    </div>
  );
}

// --- Handwritten Sticky Note Accent ---
export function StickyNote({
  children,
  angle = 2,
  className = '',
}: {
  children: ReactNode;
  angle?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative inline-block bg-[#FBF2C0] text-[#332A15] p-3.5 sm:p-4 rounded shadow-sm border border-[#E9DC98] font-script text-base sm:text-lg leading-snug select-none ${className}`}
      style={{ transform: `rotate(${angle}deg)` }}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
        <WashiTape variant="kraft" angle={-1} width="w-14" />
      </div>
      {children}
    </div>
  );
}

// --- Torn Paper Edge Divider ---
export function TornDivider({ className = '' }: { className?: string }) {
  return (
    <div
      className={`my-8 h-2 w-full bg-[#E0D8C7] opacity-60 torn-edge-top torn-edge-bottom ${className}`}
      aria-hidden="true"
    />
  );
}
