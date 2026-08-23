import React, { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowRight, BookOpen, LogIn, Lock, Sparkles, Feather,
  Check, Compass, Heart, HelpCircle, Shield
} from 'lucide-react';
import {
  PaperCard, WashiTape, WaxStampButton, StickyNote, TornDivider,
  IdentityIcon, BoundariesIcon, CommitmentsIcon, PrivacyIcon,
  QuillIcon, AgencyIcon, HumilityIcon
} from '@/components/tactile-ui';

export default function HomePage({
  onOpenHowItWorks,
  onOpenAuth,
}: {
  onOpenHowItWorks?: () => void;
  onOpenAuth?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'identity' | 'boundaries' | 'commitments'>('all');

  return (
    <div className="page-transition-enter haven-noise relative min-h-[100dvh] overflow-hidden bg-[var(--paper-parchment)] text-[var(--ink-primary)]">
      
      {/* Subtle desk paper background accents */}
      <div
        className="pointer-events-none absolute right-[-6%] top-[-8%] h-[480px] w-[480px] rounded-full bg-[#EADDC9] opacity-40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[-10%] left-[-4%] h-[420px] w-[420px] rounded-full bg-[#DCE3D5] opacity-50 blur-3xl"
        aria-hidden="true"
      />

      {/* Top Header Bar */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-8 py-5 sm:py-7">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8B5E43] text-[#FAF6EF] shadow-sm">
            <QuillIcon className="w-5 h-5" />
          </span>
          <div>
            <span className="font-editorial text-2xl font-normal tracking-tight text-[var(--ink-primary)]">
              haven
            </span>
            <span className="hidden xs:inline-block ml-2 font-mono-custom text-[9px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              / private inquiry
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D5CAB4] bg-[#FAF7F0] px-3.5 py-1.5 font-mono-custom text-[10px] uppercase tracking-[0.15em] text-[var(--ink-muted)] shadow-xs transition-colors hover:text-[var(--ink-primary)] hover:border-[#8B5E43]"
            data-testid="link-home-about"
          >
            <BookOpen size={12} />
            <span>About</span>
          </Link>
          
          <Link
            href="/journal"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#D5CAB4] bg-[#FAF7F0] px-3.5 py-1.5 font-mono-custom text-[10px] uppercase tracking-[0.15em] text-[var(--ink-muted)] shadow-xs transition-colors hover:text-[var(--ink-primary)]"
            data-testid="link-home-journal"
          >
            <span>Journal</span>
          </Link>

          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#8B5E43] bg-[#8B5E43] px-4 py-1.5 text-xs font-semibold text-[#FAF6EF] shadow-xs transition-opacity hover:opacity-90"
              data-testid="button-home-signin"
            >
              <LogIn size={12} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 sm:px-8 pt-10 sm:pt-16 pb-16">
        <div className="text-center max-w-3xl mx-auto">
          
          {/* Top Washi Tape & Sanctuary Badge */}
          <div className="inline-flex flex-col items-center justify-center mb-6">
            <WashiTape variant="kraft" angle={-1.5} width="w-28" />
            <div className="mt-2 font-mono-custom text-[11px] uppercase tracking-[0.25em] text-[#8B5E43] font-medium">
              Sanctuary of Clarity & Reflection
            </div>
          </div>

          {/* Verbatim Headline */}
          <h1 className="font-editorial text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-[1.08] tracking-tight text-[var(--ink-primary)]">
            Welcome to Haven
          </h1>

          {/* Verbatim Subhead */}
          <p className="mt-6 font-sans-clean text-base sm:text-lg md:text-xl font-normal leading-relaxed text-[var(--ink-primary)] opacity-90 max-w-2xl mx-auto">
            A calm, privacy-first AI reflection engine and creative journal sanctuary.
            Haven helps you pause, notice, and grow — guided by AI that is
            transparent, safe, and respectful of your boundaries.
          </p>

          {/* Primary CTA (Wax-stamped button) */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link href="/space" data-testid="link-start-reflecting">
              <WaxStampButton
                icon={<QuillIcon className="w-4 h-4" />}
                className="text-base px-8 py-4"
              >
                Start reflecting
              </WaxStampButton>
            </Link>

            <Link
              href="/reflections"
              className="inline-flex items-center gap-2 font-sans-clean text-sm font-semibold text-[var(--ink-primary)] underline underline-offset-4 hover:text-[#8B5E43] transition-colors"
              data-testid="link-explore-reflections"
            >
              <Sparkles size={16} className="text-[#8B5E43]" />
              Guided reflection prompts
            </Link>
          </div>

          {/* Tactile sticky annotation */}
          <div className="mt-8 flex justify-center">
            <StickyNote angle={1.2} className="text-sm">
              "No persuasive traps. No hidden personas. Just grounded epistemic space."
            </StickyNote>
          </div>
        </div>

        <TornDivider className="my-16" />

        {/* Below the Fold: Three Stacked Paper-Textured Cards */}
        <div className="mt-12 space-y-8">
          <div className="text-center mb-8">
            <div className="font-mono-custom text-[10px] uppercase tracking-[0.25em] text-[#8B5E43]">
              Ethical Foundations
            </div>
            <h2 className="mt-1 font-editorial text-2xl sm:text-3xl md:text-4xl text-[var(--ink-primary)]">
              How Haven is Built
            </h2>
          </div>

          {/* 1. Identity Card (Parchment Texture) */}
          <PaperCard
            surface="parchment"
            tapeVariant="kraft"
            tapeAngle={-2}
            className="shadow-[var(--shadow-paper)]"
          >
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              <div className="flex items-center gap-3 md:flex-col md:items-center">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E6DCB8] text-[#7A4B31] border border-[#D5CAB4] shadow-xs">
                  <IdentityIcon className="w-7 h-7" />
                </span>
                <span className="font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                  Parchment
                </span>
              </div>

              <div className="flex-1">
                <h3 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--ink-primary)]">
                  Identity
                </h3>
                
                {/* Verbatim Bullets */}
                <ul className="mt-4 space-y-3 font-sans-clean text-sm sm:text-base leading-relaxed text-[var(--ink-primary)]">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B5E43]" />
                    <span>Haven is an AI companion built for reflection, not persuasion.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B5E43]" />
                    <span>Its identity is always visible — no hidden personas, no confusion.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B5E43]" />
                    <span>It exists to support your thinking, not to replace human connection.</span>
                  </li>
                </ul>
              </div>
            </div>
          </PaperCard>

          {/* 2. Boundaries Card (Kraft Texture) */}
          <PaperCard
            surface="kraft"
            tapeVariant="terracotta"
            tapeAngle={1.8}
            className="shadow-[var(--shadow-paper)]"
          >
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              <div className="flex items-center gap-3 md:flex-col md:items-center">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#B89668] text-[#332215] border border-[#A88658] shadow-xs">
                  <BoundariesIcon className="w-7 h-7" />
                </span>
                <span className="font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[#4A3828]">
                  Kraft Earth
                </span>
              </div>

              <div className="flex-1">
                <h3 className="font-editorial text-2xl sm:text-3xl font-medium text-[#261E14]">
                  Boundaries
                </h3>
                
                {/* Verbatim Bullets */}
                <ul className="mt-4 space-y-3 font-sans-clean text-sm sm:text-base leading-relaxed text-[#2B2217]">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5C4029]" />
                    <span>Haven is not therapy. It's a structured tool for clarity, not a substitute for professional care.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5C4029]" />
                    <span>It operates with deterministic safety boundaries — clear limits on what it can and cannot do.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5C4029]" />
                    <span>It won't simply agree with you; it encourages deeper reasoning.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5C4029]" />
                    <span>Your reflections remain private. Nothing is shared without your consent.</span>
                  </li>
                </ul>
              </div>
            </div>
          </PaperCard>

          {/* 3. Commitments Card (Sage Texture) */}
          <PaperCard
            surface="sage"
            tapeVariant="sage"
            tapeAngle={-1.2}
            className="shadow-[var(--shadow-paper)]"
          >
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              <div className="flex items-center gap-3 md:flex-col md:items-center">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#CAD4C2] text-[#3B4D36] border border-[#B6C2AE] shadow-xs">
                  <CommitmentsIcon className="w-7 h-7" />
                </span>
                <span className="font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[#4A5D44]">
                  Sage Linen
                </span>
              </div>

              <div className="flex-1">
                <h3 className="font-editorial text-2xl sm:text-3xl font-medium text-[#1E2B1A]">
                  Commitments
                </h3>
                
                {/* Verbatim Bullets */}
                <ul className="mt-4 space-y-3 font-sans-clean text-sm sm:text-base leading-relaxed text-[#23311E]">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#465E40]" />
                    <span><strong>Transparency:</strong> Haven shows its reasoning and admits uncertainty.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#465E40]" />
                    <span><strong>Control:</strong> You can pause, reset, or reshape your experience anytime.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#465E40]" />
                    <span><strong>Honesty:</strong> No overconfidence, no hidden agendas — just clear epistemic reasoning.</span>
                  </li>
                </ul>
              </div>
            </div>
          </PaperCard>
        </div>

        {/* Bottom Callout & Scrapbook Link */}
        <div className="mt-16 text-center border-t border-[#DFD6C2] pt-10">
          <div className="inline-flex items-center gap-2 text-xs font-mono-custom uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-3">
            <QuillIcon className="w-4 h-4 text-[#8B5E43]" />
            Personal Archive & Sanctuary
          </div>
          <p className="font-editorial text-xl sm:text-2xl text-[var(--ink-primary)] max-w-lg mx-auto">
            Step onto your desk. Notice what moves inside.
          </p>
          <div className="mt-6">
            <Link href="/space">
              <WaxStampButton>
                Enter your space
              </WaxStampButton>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DFD6C2] py-8 text-center font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        Haven — Transparent • Bounded • Creative • 2026
      </footer>
    </div>
  );
}
