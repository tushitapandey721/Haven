import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Leaf, Download, Check, Sparkles, MessageCircle, BookOpen,
  ArrowRight, Search, CircleHelp, RefreshCcw, FileText,
  SlidersHorizontal, Palette, Type, Sticker, Plus
} from 'lucide-react';
import {
  useGetReflections, useGetEnvironment
} from '@workspace/api-client-react';
import {
  PaperCard, WashiTape, WaxStampButton, StickyNote, TornDivider,
  QuillIcon, GuidedIcon, CreativeIcon, AgencyIcon, BoundariesIcon
} from '@/components/tactile-ui';

export default function ReflectionsPage() {
  const [, setLocation] = useLocation();
  const reflections = useGetReflections();
  const environment = useGetEnvironment();
  const data = reflections.data;
  const env = environment.data;
  const [copied, setCopied] = useState(false);

  // Guided Prompts specified in mandate
  const guidedPrompts = [
    {
      id: 'prompt-1',
      title: 'Surprise & Learning',
      prompt: 'What did you learn today that surprised you?',
      tape: 'kraft' as const,
      angle: -1.5,
      surface: 'parchment' as const,
      tag: 'Curiosity',
    },
    {
      id: 'prompt-2',
      title: 'Weekly Overcoming',
      prompt: 'Which challenge did you overcome this week?',
      tape: 'sage' as const,
      angle: 1.8,
      surface: 'sage' as const,
      tag: 'Resilience',
    },
    {
      id: 'prompt-3',
      title: 'Struggle & Growth',
      prompt: 'Where did you struggle, and how can you improve?',
      tape: 'terracotta' as const,
      angle: -1,
      surface: 'kraft' as const,
      tag: 'Humility',
    },
    {
      id: 'prompt-4',
      title: 'Quiet Pride',
      prompt: 'What are you proud of right now?',
      tape: 'kraft' as const,
      angle: 2,
      surface: 'studio' as const,
      tag: 'Affirmation',
    },
  ];

  // Scrapbook Preview State for interactive tactile demo
  const [previewPaper, setPreviewPaper] = useState<'parchment' | 'sage' | 'kraft' | 'studio'>('parchment');
  const [previewFont, setPreviewFont] = useState<'serif' | 'script' | 'sans'>('serif');
  const [previewSticker, setPreviewSticker] = useState('🌿');

  const handleStartReflecting = (promptText: string) => {
    sessionStorage.setItem('haven_pending_prompt', promptText);
    setLocation('/space');
  };

  const handleCreateScrapbookEntry = (promptText: string, tag: string) => {
    const newEntry = {
      id: `entry-${Date.now()}`,
      title: promptText,
      content: `Prompt: ${promptText}\n\n`,
      vibe: 'reflective',
      paperStyle: previewPaper,
      fontStyle: previewFont,
      stickers: [
        { id: `stk-${Date.now()}`, stickerId: 'bot-fern', label: 'Reflection Stamp', icon: previewSticker, color: '#3d6648', bg: '#e8f0e9', x: 80, y: 10, rotate: 4, scale: 1.1 },
      ],
      photos: [],
      tags: [tag, 'Guided Prompt'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingStr = localStorage.getItem('haven_journal_entries');
    let entries = [];
    if (existingStr) {
      try { entries = JSON.parse(existingStr); } catch {}
    }
    entries = [newEntry, ...entries];
    localStorage.setItem('haven_journal_entries', JSON.stringify(entries));

    const token = localStorage.getItem('haven_token');
    if (token) {
      fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newEntry),
      }).catch(() => {});
    }

    setLocation('/journal');
  };

  const handleExportArchive = () => {
    if (!data) return;
    let md = `# Haven Reflections Archive\n`;
    md += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    md += `## Recurring Topics\n${(data.topics || []).map((t) => `- ${t}`).join('\n')}\n\n`;
    md += `## Considered Perspectives\n${(data.perspectives || []).map((p) => `- ${p}`).join('\n')}\n\n`;
    md += `## Open Questions\n${(data.questions || []).map((q) => `- ${q}`).join('\n')}\n\n`;
    md += `## Timeline Milestones\n${(data.timeline || []).map((tm: any) => `### ${tm.label}\n${tm.detail}`).join('\n\n')}\n`;

    navigator.clipboard?.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haven-reflections-archive.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-transition-enter haven-noise min-h-[100dvh] bg-[var(--paper-parchment)] px-4 sm:px-6 md:px-12 py-8 sm:py-12 text-[var(--ink-primary)]">
      <div className="mx-auto max-w-5xl">
        
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DFD6C2] pb-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E6DEC9] text-[#7A4B31] border border-[#D5CAB4] shadow-xs">
              <GuidedIcon className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Haven / Desk Sanctuary
              </div>
              <h1 className="font-editorial text-2xl sm:text-3xl md:text-4xl text-[var(--ink-primary)]">
                Reflections
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportArchive}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D5CAB4] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)] shadow-xs transition-colors hover:border-[#8B5E43]"
              data-testid="button-export-reflections-archive"
            >
              {copied ? <Check size={13} className="text-[#8B5E43]" /> : <Download size={13} />}
              <span>{copied ? 'Copied' : 'Export Archive (.md)'}</span>
            </button>
          </div>
        </div>

        {/* Section 1: Guided Reflection Prompts on Torn-Paper Index Cards */}
        <div className="mt-8">
          <div className="max-w-2xl">
            {/* Verbatim Intro Copy */}
            <p className="font-editorial text-xl sm:text-2xl text-[var(--ink-primary)] leading-snug">
              Haven offers guided prompts to help you reflect:
            </p>
          </div>

          {/* Draggable/Torn-Paper Index Cards Layout */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {guidedPrompts.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ y: -4, rotate: 0 }}
                transition={{ duration: 0.25 }}
                className="relative"
              >
                <PaperCard
                  surface={item.surface}
                  tapeVariant={item.tape}
                  tapeAngle={item.angle}
                  withPin={true}
                  className="h-full flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 pt-1">
                      <span className="font-mono-custom text-[10px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                        {item.title}
                      </span>
                      <span className="rounded-full bg-[rgba(0,0,0,0.06)] px-2 py-0.5 font-sans-clean text-[10px] font-semibold text-[var(--ink-primary)]">
                        {item.tag}
                      </span>
                    </div>

                    <p className="font-editorial text-lg sm:text-xl leading-relaxed text-[var(--ink-primary)]">
                      "{item.prompt}"
                    </p>
                  </div>

                  {/* Actions to reflect in space or scrap in journal */}
                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[rgba(0,0,0,0.08)] pt-4">
                    <button
                      onClick={() => handleStartReflecting(item.prompt)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5E43] px-3.5 py-1.5 text-xs font-semibold text-[#FAF6EF] shadow-xs hover:bg-[#73462E] transition-colors"
                      data-testid={`button-reflect-${item.id}`}
                    >
                      <MessageCircle size={13} />
                      <span>Reflect in Space</span>
                    </button>
                    <button
                      onClick={() => handleCreateScrapbookEntry(item.prompt, item.tag)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,0,0,0.15)] bg-[rgba(255,255,255,0.6)] px-3 py-1.5 text-xs font-medium text-[var(--ink-primary)] hover:bg-white transition-colors"
                      data-testid={`button-scrap-${item.id}`}
                    >
                      <BookOpen size={13} />
                      <span>Scrapbook This</span>
                    </button>
                  </div>
                </PaperCard>
              </motion.div>
            ))}
          </div>

          {/* Verbatim Follow-Up Copy & Direct Picker Integration */}
          <div className="mt-10 rounded-2xl border border-[#DFD6C2] bg-[#FAF7F0] p-6 sm:p-8 shadow-[var(--shadow-paper)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-2">
                  <WashiTape variant="sage" angle={-1} width="w-20" />
                  <span className="font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[#5E7153] font-semibold">
                    Tactile Journal Customizer
                  </span>
                </div>
                {/* Verbatim Prompts Scrapbook Copy */}
                <p className="font-editorial text-lg sm:text-xl leading-relaxed text-[var(--ink-primary)]">
                  You can save, tag, and arrange these reflections like a tactile
                  scrapbook, making your journal both personal and creative.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <Link href="/journal">
                  <WaxStampButton icon={<BookOpen className="w-4 h-4" />}>
                    Open Journal Desk
                  </WaxStampButton>
                </Link>
              </div>
            </div>

            {/* Live tactile customizer bar previewing paper & typography */}
            <div className="mt-6 grid gap-4 border-t border-[#EAE3D2] pt-6 sm:grid-cols-3">
              {/* 1. Paper Texture Picker */}
              <div>
                <label className="flex items-center gap-1.5 font-mono-custom text-[10px] uppercase tracking-[0.15em] text-[var(--ink-muted)] mb-2">
                  <Palette size={12} /> Paper Surface
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'parchment', label: 'Parchment', bg: '#F4EEE1' },
                    { id: 'sage', label: 'Sage', bg: '#DCE3D5' },
                    { id: 'kraft', label: 'Kraft', bg: '#C9A97E' },
                    { id: 'studio', label: 'Studio', bg: '#FAFAF7' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPreviewPaper(p.id as any)}
                      style={{ backgroundColor: p.bg }}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium text-[#2B2A26] transition-transform ${
                        previewPaper === p.id ? 'border-[#8B5E43] ring-2 ring-[#8B5E43]/30 scale-105' : 'border-[#D5CAB4]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Typography Vibe Picker */}
              <div>
                <label className="flex items-center gap-1.5 font-mono-custom text-[10px] uppercase tracking-[0.15em] text-[var(--ink-muted)] mb-2">
                  <Type size={12} /> Typography Vibe
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'serif', label: 'Editorial Serif', fontClass: 'font-editorial' },
                    { id: 'script', label: 'Handwritten Script', fontClass: 'font-script' },
                    { id: 'sans', label: 'Clean Sans', fontClass: 'font-sans-clean' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setPreviewFont(f.id as any)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] ${f.fontClass} transition-transform ${
                        previewFont === f.id ? 'bg-[#8B5E43] text-white border-[#8B5E43] scale-105' : 'bg-white border-[#D5CAB4] text-[var(--ink-primary)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Mindful Sticker Emblems */}
              <div>
                <label className="flex items-center gap-1.5 font-mono-custom text-[10px] uppercase tracking-[0.15em] text-[var(--ink-muted)] mb-2">
                  <Sticker size={12} /> Mindful Stamp
                </label>
                <div className="flex items-center gap-2">
                  {['🌿', '✨', '💭', '🛡️', '👁️', '🌊'].map((stk) => (
                    <button
                      key={stk}
                      onClick={() => setPreviewSticker(stk)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition-transform ${
                        previewSticker === stk ? 'border-[#8B5E43] bg-[#EAE3D2] scale-110 shadow-xs' : 'border-[#D5CAB4] bg-white'
                      }`}
                    >
                      {stk}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <TornDivider className="my-12" />

        {/* Section 2: Active Reflections & Timeline Archive */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-mono-custom text-[10px] uppercase tracking-[0.2em] text-[#8B5E43]">
                Longitudinal Overview
              </div>
              <h2 className="font-editorial text-2xl sm:text-3xl text-[var(--ink-primary)]">
                Recurring Topics & Open Questions
              </h2>
            </div>
          </div>

          {reflections.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3 py-6">
              <div className="h-44 rounded-xl bg-[#EBE4D5] animate-pulse" />
              <div className="h-44 rounded-xl bg-[#EBE4D5] animate-pulse" />
              <div className="h-44 rounded-xl bg-[#EBE4D5] animate-pulse" />
            </div>
          ) : reflections.isError ? (
            <div className="my-6 flex items-center justify-between rounded-xl border border-dashed border-[#D5CAB4] bg-[#FAF7F0] p-5">
              <span className="text-xs text-[var(--ink-muted)]">Reflections archive is resting right now.</span>
              <button onClick={() => reflections.refetch()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B5E43]">
                <RefreshCcw size={13} /> Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-3">
                <PaperCard surface="parchment" className="p-5">
                  <div className="flex items-center justify-between text-[#8B5E43] mb-3">
                    <Leaf size={16} />
                    <span className="font-mono-custom text-[9px] uppercase tracking-[0.15em] text-[var(--ink-muted)]">
                      Not conclusions
                    </span>
                  </div>
                  <h3 className="font-editorial text-lg font-medium text-[var(--ink-primary)]">
                    Recurring topics
                  </h3>
                  <ul className="mt-3 space-y-1.5 font-sans-clean text-xs text-[var(--ink-primary)]">
                    {(data?.topics || []).length > 0 ? (
                      data!.topics.map((t, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="mt-1 h-1 w-1 rounded-full bg-[#8B5E43]" />
                          <span>{t}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[var(--ink-muted)] italic">No recurring topics yet. Keep reflecting.</li>
                    )}
                  </ul>
                </PaperCard>

                <PaperCard surface="sage" className="p-5">
                  <div className="flex items-center justify-between text-[#5E7153] mb-3">
                    <Search size={16} />
                    <span className="font-mono-custom text-[9px] uppercase tracking-[0.15em] text-[#4A5D44]">
                      Held lightly
                    </span>
                  </div>
                  <h3 className="font-editorial text-lg font-medium text-[#1E2B1A]">
                    Considered perspectives
                  </h3>
                  <ul className="mt-3 space-y-1.5 font-sans-clean text-xs text-[#23311E]">
                    {(data?.perspectives || []).length > 0 ? (
                      data!.perspectives.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="mt-1 h-1 w-1 rounded-full bg-[#5E7153]" />
                          <span>{p}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[var(--ink-muted)] italic">Perspectives will gather as you return.</li>
                    )}
                  </ul>
                </PaperCard>

                <PaperCard surface="studio" className="p-5">
                  <div className="flex items-center justify-between text-[#8B5E43] mb-3">
                    <CircleHelp size={16} />
                    <span className="font-mono-custom text-[9px] uppercase tracking-[0.15em] text-[var(--ink-muted)]">
                      Still open
                    </span>
                  </div>
                  <h3 className="font-editorial text-lg font-medium text-[var(--ink-primary)]">
                    Returned questions
                  </h3>
                  <ul className="mt-3 space-y-1.5 font-sans-clean text-xs text-[var(--ink-primary)]">
                    {(data?.questions || []).length > 0 ? (
                      data!.questions.map((q, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="mt-1 h-1 w-1 rounded-full bg-[#8B5E43]" />
                          <span>{q}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[var(--ink-muted)] italic">Open questions will appear here.</li>
                    )}
                  </ul>
                </PaperCard>
              </div>

              {/* Conversation Trail */}
              <div className="mt-8 rounded-2xl border border-[#DFD6C2] bg-[#FAF7F0] p-6 sm:p-8">
                <div className="flex items-center justify-between mb-4 border-b border-[#EAE3D2] pb-3">
                  <div>
                    <div className="font-mono-custom text-[10px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                      Conversation Trail
                    </div>
                    <h3 className="font-editorial text-xl sm:text-2xl text-[var(--ink-primary)]">
                      The shape of returning
                    </h3>
                  </div>
                  <FileText size={18} className="text-[#8B5E43]" />
                </div>

                <div className="mt-4">
                  {data?.timeline?.length ? (
                    <div className="space-y-4">
                      {data.timeline.map((point: any, index: number) => (
                        <div key={index} className="flex gap-4">
                          <div className="flex w-4 flex-col items-center">
                            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#8B5E43]" />
                            {index < data.timeline.length - 1 && (
                              <span className="w-px flex-1 bg-[#D5CAB4] my-1" />
                            )}
                          </div>
                          <div className="pb-4">
                            <div className="font-mono-custom text-[10px] uppercase tracking-[0.1em] text-[#8B5E43] font-semibold">
                              {point.label}
                            </div>
                            <p className="mt-1 text-xs sm:text-sm text-[var(--ink-muted)]">
                              {point.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--ink-muted)] italic">
                      Your timeline will take shape through repeated attention.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
