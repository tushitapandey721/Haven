import React from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  Shield, Lock, Sparkles, BookOpen, Heart, Eye, ArrowRight,
  Check, ArrowLeft, Leaf, Compass, Feather, Award
} from 'lucide-react';
import {
  PaperCard, WashiTape, WaxStampButton, StickyNote, TornDivider,
  IdentityIcon, BoundariesIcon, CommitmentsIcon, PrivacyIcon,
  AgencyIcon, HumilityIcon, CreativeIcon, GuidedIcon, QuillIcon
} from '@/components/tactile-ui';

export default function AboutPage() {
  const fiveFeatures = [
    {
      title: 'Privacy-first',
      description: 'Your reflections are yours alone.',
      icon: PrivacyIcon,
    },
    {
      title: 'Risk-aware',
      description: 'Built to address AI risks in chatbots, with clear boundaries.',
      icon: BoundariesIcon,
    },
    {
      title: 'Creative',
      description: 'Scrapbook customization lets you shape your journal visually.',
      icon: CreativeIcon,
    },
    {
      title: 'Accessible',
      description: 'Minimal, calming design that anyone can use.',
      icon: IdentityIcon,
    },
    {
      title: 'Guided',
      description: 'Prompts and boundaries help you reflect without overwhelm.',
      icon: GuidedIcon,
    },
  ];

  const designCommitments = [
    {
      number: '01',
      title: 'Agency Preservation',
      description: 'Haven never tells you what to choose. It helps you untangle your own thoughts.',
      icon: AgencyIcon,
      accent: 'sage',
    },
    {
      number: '02',
      title: 'Epistemic Humility',
      description: 'When the system is uncertain or lacks information, it explicitly communicates that uncertainty.',
      icon: HumilityIcon,
      accent: 'terracotta',
    },
    {
      number: '03',
      title: 'Deterministic Safety Boundaries',
      description: 'AI safety checks run deterministically before and after model generation.',
      icon: BoundariesIcon,
      accent: 'kraft',
    },
    {
      number: '04',
      title: 'Anti-Dependency Stance',
      description: 'Haven actively discourages unhealthy anthropomorphism or emotional reliance on AI.',
      icon: IdentityIcon,
      accent: 'parchment',
    },
    {
      number: '05',
      title: 'Privacy by Design',
      description: 'Conversations and journal entries belong exclusively to the user.',
      icon: PrivacyIcon,
      accent: 'sage',
    },
  ];

  return (
    <div className="page-transition-enter min-h-[100dvh] bg-[var(--paper-parchment)] px-4 sm:px-6 md:px-12 py-8 sm:py-12 text-[var(--ink-primary)]">
      <div className="mx-auto max-w-3xl">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-sans-clean text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-primary)]"
            data-testid="link-about-back-home"
          >
            <ArrowLeft size={14} />
            <span>Return to Haven</span>
          </Link>

          <div className="flex items-center gap-2">
            <WashiTape variant="terracotta" angle={-1} width="w-20" />
            <span className="font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Archival Manifesto
            </span>
          </div>
        </div>

        {/* Header Title Section */}
        <div className="relative pt-4 pb-10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EADCC6] text-[#7A4B31] shadow-inner">
              <QuillIcon className="w-5 h-5" />
            </span>
            <div>
              <div className="font-mono-custom text-[10px] uppercase tracking-[0.25em] text-[#8B5E43]">
                Mission & Safety Boundaries
              </div>
              <h1 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-[var(--ink-primary)]">
                About Haven
              </h1>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <StickyNote angle={-1.5} className="max-w-md">
              "A space to think, notice, and reflect. Not a therapist. A careful epistemic companion."
            </StickyNote>
          </div>
        </div>

        {/* Section 1: Verbatim Five-Item Feature List */}
        <div className="my-8 rounded-2xl border border-[#DFD6C2] bg-[#FAF7F0] p-6 sm:p-10 shadow-[var(--shadow-paper)]">
          <div className="mb-6 flex items-center justify-between border-b border-[#EAE3D2] pb-4">
            <h2 className="font-editorial text-2xl sm:text-3xl text-[var(--ink-primary)]">
              Haven is designed to be:
            </h2>
            <WashiTape variant="sage" angle={1} width="w-24" />
          </div>

          <ul className="space-y-5">
            {fiveFeatures.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <li
                  key={idx}
                  className="flex items-start gap-4 transition-transform hover:translate-x-1"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFE9DC] text-[#7A4B31] border border-[#DDD3BF]">
                    <IconComp className="w-4 h-4" />
                  </span>
                  <div className="font-sans-clean text-sm sm:text-base leading-relaxed text-[var(--ink-primary)]">
                    <strong className="font-semibold text-[#6B452E]">{item.title}:</strong>{' '}
                    <span>{item.description}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <TornDivider />

        {/* Section 2: Five Fundamental Design Commitments */}
        <div className="my-10">
          <div className="mb-8">
            <div className="font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[#8B5E43]">
              Safety Architecture & Ethics
            </div>
            <h2 className="mt-1 font-editorial text-2xl sm:text-3xl text-[var(--ink-primary)]">
              Five Design Commitments
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)] font-sans-clean max-w-xl">
              These principles govern every model prompt, safety classifier, and interaction boundary across Haven.
            </p>
          </div>

          <div className="space-y-4">
            {designCommitments.map((commitment, index) => {
              const IconComp = commitment.icon;
              return (
                <PaperCard
                  key={commitment.number}
                  surface={
                    commitment.accent === 'sage'
                      ? 'sage'
                      : commitment.accent === 'kraft'
                      ? 'kraft'
                      : 'studio'
                  }
                  className="p-5 sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    <span className="font-mono-custom text-xs font-bold text-[#8B5E43] opacity-80 pt-0.5">
                      {commitment.number}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <IconComp className="w-5 h-5 text-[#6B452E]" />
                        <h3 className="font-editorial text-lg sm:text-xl font-medium text-[var(--ink-primary)]">
                          {commitment.title}
                        </h3>
                      </div>
                      <p className="mt-1.5 font-sans-clean text-xs sm:text-sm leading-relaxed text-[var(--ink-primary)] opacity-90">
                        {commitment.description}
                      </p>
                    </div>
                  </div>
                </PaperCard>
              );
            })}
          </div>
        </div>

        {/* Archival Seal & Call to Action */}
        <div className="mt-12 text-center rounded-2xl border border-dashed border-[#C9BFA8] bg-[#F4EDE0] p-8 sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#9C6749] text-[#FAF6EF] shadow-md">
            <QuillIcon className="w-7 h-7" />
          </div>
          <h3 className="mt-4 font-editorial text-2xl text-[var(--ink-primary)]">
            Ready to begin your reflection?
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[var(--ink-muted)] max-w-md mx-auto font-sans-clean">
            Enter your personal sanctuary. Conversations remain deterministic, bounded, and private.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link href="/space">
              <WaxStampButton>
                Start reflecting
              </WaxStampButton>
            </Link>
            <Link
              href="/journal"
              className="inline-flex items-center gap-2 font-sans-clean text-xs sm:text-sm font-semibold text-[var(--ink-primary)] underline underline-offset-4 hover:text-[#8B5E43]"
            >
              <BookOpen size={15} />
              Open Tactile Journal
            </Link>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          Haven Sanctuary © 2026 — Private • Bounded • Creative
        </div>
      </div>
    </div>
  );
}
