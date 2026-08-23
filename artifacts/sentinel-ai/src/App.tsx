import { type FormEvent, type MouseEvent, type ReactNode, type CSSProperties, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, Bookmark, BookOpen, Camera, Check, ChevronDown, CircleHelp, Clock3,
  Compass, Copy, Download, Eye, Feather, FileText, Heart, HelpCircle, Image as ImageIcon, Info, Leaf, Lock,
  LogIn, LogOut, Mail, Menu, MessageCircle, Moon, MoreHorizontal, Palette, Pause, Plus, RefreshCcw, RotateCw,
  Search, Share2, Shield, SlidersHorizontal, Sparkles, Sticker, Sun, Trash2, TriangleAlert, Type, Upload, User, X, Zap,
} from 'lucide-react';
import {
  getGetConversationQueryKey, getGetEnvironmentQueryKey, getGetReflectionsQueryKey,
  getGetResearchAnalyticsQueryKey, getListConversationsQueryKey, setAuthTokenGetter,
  useCreateConversation, useDeleteConversation, useGetConversation, useGetEnvironment,
  useGetReflections, useGetResearchAnalytics, useHealthCheck, useListConversations,
  useSendMessage, useUpdateEnvironment,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import HomePage from '@/pages/HomePage';
import AboutPage from '@/pages/AboutPage';
import ReflectionsPageComponent from '@/pages/ReflectionsPage';
import {
  QuillIcon, BoundariesIcon, PrivacyIcon, HumilityIcon, AgencyIcon,
  WashiTape, WaxStampButton
} from '@/components/tactile-ui';

if (typeof window !== 'undefined') {
  setAuthTokenGetter(() => localStorage.getItem('haven_token'));
}

const queryClient = new QueryClient();

const formatTime = (value?: string) => {
  if (!value) return '';
  try { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); } catch { return ''; }
};
const modeLabel = (mode?: string) => mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Reflective';

const atmosphereConfig: Record<string, { background: string; foreground: string; card: string; border: string; primary: string; accent: string; muted: string; mutedForeground: string; description: string }> = {
  grounding: { background: '38 30% 93%', foreground: '202 28% 19%', card: '40 32% 97%', border: '36 20% 82%', primary: '171 37% 32%', accent: '43 82% 63%', muted: '38 22% 88%', mutedForeground: '201 13% 45%', description: 'A softer, steadier palette for slowing down and finding your footing.' },
  reflective: { background: '38 28% 94%', foreground: '202 28% 19%', card: '40 29% 97%', border: '36 18% 83%', primary: '171 37% 32%', accent: '43 82% 63%', muted: '38 20% 89%', mutedForeground: '201 13% 45%', description: 'The neutral Haven atmosphere for open-ended reflection.' },
  depth: { background: '222 28% 94%', foreground: '218 28% 19%', card: '225 28% 97%', border: '220 20% 83%', primary: '222 34% 40%', accent: '278 45% 63%', muted: '222 20% 89%', mutedForeground: '218 13% 46%', description: 'A deeper, quieter tone for questions about meaning, identity, and what sits underneath.' },
  growth: { background: '92 28% 93%', foreground: '154 24% 19%', card: '88 30% 97%', border: '92 18% 82%', primary: '145 35% 34%', accent: '75 70% 57%', muted: '92 20% 88%', mutedForeground: '151 13% 45%', description: 'A fresh, living palette for possibility, learning, and forward movement.' },
  complexity: { background: '25 30% 93%', foreground: '20 25% 20%', card: '28 30% 97%', border: '25 18% 82%', primary: '15 40% 38%', accent: '190 50% 54%', muted: '25 20% 88%', mutedForeground: '20 13% 46%', description: 'A layered, slightly warmer atmosphere for ambiguity and competing perspectives.' },
};

const getAtmosphereStyle = (mode?: string): CSSProperties => {
  const palette = atmosphereConfig[mode ?? 'reflective'] ?? atmosphereConfig.reflective;
  return {
    '--background': palette.background,
    '--foreground': palette.foreground,
    '--card': palette.card,
    '--card-foreground': palette.foreground,
    '--border': palette.border,
    '--card-border': palette.border,
    '--primary': palette.primary,
    '--accent': palette.accent,
    '--muted': palette.muted,
    '--muted-foreground': palette.mutedForeground,
    transition: 'background-color 1.4s ease, color 1.1s ease, border-color 1.1s ease',
  } as CSSProperties;
};

const atmosphereDescription = (mode?: string) => (atmosphereConfig[mode ?? 'reflective'] ?? atmosphereConfig.reflective).description;
const signalLabel: Record<string, string> = {
  confirmationBias: 'confirmation bias', emotionalDependency: 'dependency', anthropomorphism: 'anthropomorphism',
  delusionReinforcement: 'reinforcement risk', escalatingDistress: 'escalating distress', unsafeAdvice: 'unsafe advice',
  overValidation: 'over-validation', manipulation: 'manipulation', hallucinationRisk: 'hallucination risk',
};

function useAffirmationAtmosphere() {
  const [location] = useLocation();
  const [generated, setGenerated] = useState<{ affirmation: string; color: string } | null>(null);

  useEffect(() => {
    const handleGenerated = (event: Event) => {
      const detail = (event as CustomEvent<{ affirmation: string; color: string }>).detail;
      if (detail?.affirmation && detail?.color) setGenerated(detail);
    };
    window.addEventListener('haven-ai-atmosphere', handleGenerated);
    return () => window.removeEventListener('haven-ai-atmosphere', handleGenerated);
  }, []);

  useEffect(() => {
    if (location !== '/space') {
      document.documentElement.style.removeProperty('--affirmation-background');
      delete document.documentElement.dataset.hasAffirmation;
      return;
    }
    document.documentElement.style.setProperty(
      '--affirmation-background',
      generated ? `radial-gradient(circle at 18% 12%, ${generated.color}40, transparent 42%)` : 'none',
    );
    if (generated) {
      document.documentElement.dataset.hasAffirmation = 'true';
    } else {
      delete document.documentElement.dataset.hasAffirmation;
    }
  }, [generated, location]);

  return { generated };
}

function Mark({ small = false }: { small?: boolean }) {
  return <span className={`inline-flex items-center justify-center rounded-full border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))] ${small ? 'h-6 w-6' : 'h-9 w-9'}`} data-testid="brand-mark"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))] shadow-[0_0_0_4px_hsl(var(--accent)/.16)]" /></span>;
}

// Fade-in-and-rise variant used for staggered micro-interactions across the hero.
import { easeOut } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
} as const;

// The Haven wordmark's icon: a gentle arch sheltering a warm, glowing core —
// shelter (haven) holding a person's inner light. The core softly pulses,
// echoing the breathing orb on the right of the hero.
function HavenMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="brand-mark-haven"
      aria-hidden="true"
    >
      <path
        d="M8 39V23C8 13.06 15.16 6 24 6C32.84 6 40 13.06 40 23V39"
        stroke="hsl(var(--primary))"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="27.5" r="9.5" stroke="hsl(var(--accent)/.4)" strokeWidth="1.4" />
      <motion.circle
        cx="24"
        cy="27.5"
        r="5.4"
        fill="hsl(var(--accent))"
        animate={{ opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  );
}

// The full lockup: mark + wordmark, sized generously for hero use.
function HavenLogo({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const markSize = size === 'lg' ? 60 : 28;
  return (
    <div className="flex items-center gap-4" data-testid="brand-lockup-haven">
      <HavenMark size={markSize} />
      <span
        className={
          size === 'lg'
            ? "font-display text-[clamp(2.6rem,4.8vw,3.8rem)] leading-none tracking-[-.02em] text-[hsl(var(--foreground))]"
            : 'font-display text-lg leading-none tracking-[-.01em] text-[hsl(var(--foreground))]'
        }
      >
        haven
      </span>
    </div>
  );
}

// Organic blob outlines the orb's gradient layers morph between — this is
// what gives the "liquid aura" its slow, non-mechanical shape-shift instead
// of a plain circle expanding and contracting.
const blobPath = [
  '62% 38% 34% 66% / 58% 38% 62% 42%',
  '38% 62% 63% 37% / 41% 62% 38% 59%',
  '55% 45% 40% 60% / 50% 55% 45% 50%',
  '62% 38% 34% 66% / 58% 38% 62% 42%',
];
const blobPathReverse = [...blobPath].reverse();

// A handful of tiny drifting light specks scattered around the orb, each on
// its own slow, looping float — like dust suspended in still, warm light.
const orbSpecks = [
  { left: '18%', top: '22%', duration: 5.5, delay: 0 },
  { left: '78%', top: '16%', duration: 6.5, delay: 0.6 },
  { left: '85%', top: '62%', duration: 5, delay: 1.2 },
  { left: '12%', top: '68%', duration: 6, delay: 0.3 },
  { left: '52%', top: '10%', duration: 7, delay: 1.6 },
  { left: '30%', top: '86%', duration: 5.8, delay: 0.9 },
];

// A soft, layered "breathing orb": blurred gradient auras that morph between
// organic blob shapes as they expand and contract out of phase, framed by
// two slowly counter-rotating hairline rings and a scatter of drifting light
// specks. Each layer runs on its own 5-8s rhythm so the whole thing never
// feels mechanical.
function BreathingOrb() {
  return (
    <div className="relative h-full w-full" data-testid="hero-breathing-orb">
      <motion.div
        className="absolute inset-[6%] rounded-full border border-[hsl(var(--primary)/.1)]"
        animate={{ rotate: 360 }}
        transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-[18%] rounded-full border border-[hsl(var(--primary)/.14)]"
        animate={{ rotate: -360 }}
        transition={{ duration: 52, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-[3%] blur-[54px]"
        style={{ background: 'radial-gradient(circle, hsl(var(--accent)/.4), transparent 70%)' }}
        animate={{ borderRadius: blobPath, scale: [1, 1.12, 1], opacity: [0.3, 0.56, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-[17%] blur-2xl"
        style={{ background: 'radial-gradient(circle at 40% 35%, hsl(var(--primary)/.55), hsl(var(--accent)/.35) 60%, transparent 82%)' }}
        animate={{ borderRadius: blobPathReverse, scale: [1, 1.08, 0.96, 1], opacity: [0.45, 0.72, 0.45] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      />
      <motion.div
        className="absolute inset-[33%]"
        style={{
          background: 'radial-gradient(circle at 38% 32%, hsl(var(--accent)/.97), hsl(var(--primary)/.88) 72%)',
          boxShadow: '0 0 70px hsl(var(--accent)/.45), 0 0 140px hsl(var(--primary)/.25)',
        }}
        animate={{ borderRadius: blobPath, scale: [1, 1.14, 1] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {orbSpecks.map((speck, index) => (
        <motion.span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]"
          style={{ left: speck.left, top: speck.top, boxShadow: '0 0 8px hsl(var(--accent)/.8)' }}
          animate={{ y: [0, -14, 0], x: [0, 7, 0], opacity: [0.15, 0.9, 0.15] }}
          transition={{ duration: speck.duration, repeat: Infinity, ease: 'easeInOut', delay: speck.delay }}
        />
      ))}
      <div className="absolute left-0 top-1/2 h-px w-full bg-[hsl(var(--primary)/.08)]" />
      <div className="absolute left-1/2 top-0 h-full w-px bg-[hsl(var(--primary)/.06)]" />
      <div
        className="absolute inset-[27%] z-10 flex items-center justify-center pointer-events-none"
        aria-label="breathe, notice, return"
      >
        <div className="haven-liquid-words relative flex h-full w-full items-center justify-center overflow-visible">
          {['breathe', 'notice', 'return'].map((word, index) => (
            <span
              key={word}
              className={`haven-liquid-word haven-liquid-word-${index + 1} font-display`}
              aria-hidden="true"
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (open: boolean) => void;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  showHowItWorks: boolean;
  setShowHowItWorks: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function AuthModal() {
  const { showAuthModal, setShowAuthModal, authMode, setAuthMode, login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!showAuthModal) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (authMode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3 sm:p-4 backdrop-blur-md flex min-h-full items-start sm:items-center justify-center py-6 sm:py-8 safe-top safe-bottom animate-appear">
      <div className="relative w-full max-w-md my-auto max-h-[88vh] overflow-y-auto rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.98)] p-5 sm:p-7 md:p-8 shadow-2xl backdrop-blur-2xl">
        <button
          onClick={() => setShowAuthModal(false)}
          className="absolute right-4 top-4 sm:right-5 sm:top-5 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--elevate-1))] hover:text-[hsl(var(--foreground))]"
          data-testid="button-close-auth-modal"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <HavenMark size={32} />
          <div>
            <div className="font-display text-2xl">{authMode === 'login' ? 'Welcome to Haven' : 'Create your private space'}</div>
            <div className="font-mono-custom text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">
              {authMode === 'login' ? 'Private profile sign in' : 'Permanent encrypted reflection vault'}
            </div>
          </div>
        </div>

        <div className="mt-6 flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--elevate-1))] p-1">
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setError(''); }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${authMode === 'login' ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
            data-testid="tab-auth-login"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('register'); setError(''); }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${authMode === 'register' ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
            data-testid="tab-auth-register"
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-3 text-xs leading-5 text-[hsl(var(--destructive))]" data-testid="auth-error-message">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] mb-1.5">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail size={15} className="absolute left-3 text-[hsl(var(--muted-foreground))]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2.5 pl-9 pr-3 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.5)] focus:border-[hsl(var(--primary))]"
                data-testid="input-auth-email"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] mb-1.5">
              Password (min. 6 characters)
            </label>
            <div className="relative flex items-center">
              <Lock size={15} className="absolute left-3 text-[hsl(var(--muted-foreground))]" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2.5 pl-9 pr-3 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground)/.5)] focus:border-[hsl(var(--primary))]"
                data-testid="input-auth-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-[hsl(var(--primary))] py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
            data-testid="button-auth-submit"
          >
            {submitting ? 'Authenticating…' : authMode === 'login' ? 'Sign In' : 'Create Private Profile'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">
          <span>Haven preserves your privacy. Your conversations are isolated strictly to your account.</span>
        </div>
      </div>
    </div>
  );
}

function HowHavenWorksModal() {
  const { showHowItWorks, setShowHowItWorks } = useAuth();
  if (!showHowItWorks) return null;

  const commitments = [
    {
      icon: HumilityIcon,
      title: 'Epistemic Mirror & Humility',
      summary: 'Haven refuses to blindly agree or flatter. It gently reflects your line of reasoning so you can inspect where assumptions begin.',
    },
    {
      icon: BoundariesIcon,
      title: 'Deterministic Boundaries',
      summary: 'Haven is an AI reflection tool, not a human friend, therapist, or doctor. It never diagnoses, prescribes, or claims sentience.',
    },
    {
      icon: AgencyIcon,
      title: 'Agency & Anti-Dependency',
      summary: 'Haven detects emotional dependency loops, confirmation bias, and cognitive over-closure, guiding your attention back to your own agency.',
    },
    {
      icon: PrivacyIcon,
      title: 'Strict Privacy & Memory Vault',
      summary: 'Your conversations, reflections, and atmospheres belong strictly to your private space and are never sold or trained on.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 p-3 sm:p-4 backdrop-blur-sm flex min-h-full items-start sm:items-center justify-center py-6 sm:py-8 safe-top safe-bottom animate-appear">
      <div className="relative w-full max-w-2xl my-auto max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl border border-[#DFD6C2] bg-[#FAF7F0] p-6 sm:p-8 md:p-10 shadow-2xl">
        <button
          onClick={() => setShowHowItWorks(false)}
          className="absolute right-4 top-4 sm:right-5 sm:top-5 rounded-full p-2 text-[var(--ink-muted)] hover:bg-[#EAE3D2] hover:text-[var(--ink-primary)] transition-colors"
          data-testid="button-close-how-it-works"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8B5E43] text-[#FAF6EF] shadow-xs">
            <QuillIcon className="w-5 h-5" />
          </span>
          <div>
            <div className="font-mono-custom text-[10px] uppercase tracking-[.25em] text-[#8B5E43]">Core Architecture</div>
            <h2 className="font-editorial text-2xl sm:text-3xl text-[var(--ink-primary)]">How Haven Works</h2>
          </div>
        </div>

        <p className="mt-4 font-sans-clean text-xs sm:text-sm leading-relaxed text-[var(--ink-muted)]">
          Most conversational AI is engineered to agree, validate, and please. Haven is designed for epistemic clarity — a quiet sounding board that helps you notice what is present in your own thinking.
        </p>

        <div className="mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2">
          {commitments.map(({ icon: IconComp, title, summary }, i) => (
            <div key={i} className="rounded-xl border border-[#E2D8C3] bg-[#F4EEE1] p-4 shadow-xs">
              <div className="flex items-center gap-2.5 text-[#8B5E43]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E6DCB8] text-[#7A4B31] border border-[#D5CAB4]">
                  <IconComp className="w-4 h-4" />
                </span>
                <h3 className="font-editorial font-medium text-sm text-[var(--ink-primary)]">{title}</h3>
              </div>
              <p className="mt-2 font-sans-clean text-xs leading-relaxed text-[var(--ink-muted)]">{summary}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#DFD6C2] pt-5">
          <span className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[var(--ink-muted)]">
            Epistemic Integrity Engine · SENTINEL
          </span>
          <button
            onClick={() => setShowHowItWorks(false)}
            className="rounded-full bg-[#8B5E43] px-5 py-2 text-xs font-semibold text-[#FAF6EF] hover:bg-[#73462E] transition-colors shadow-xs"
            data-testid="button-dismiss-how-it-works"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}

function InspectReasoningModal({
  open,
  onClose,
  reasoning,
  atmosphere,
}: {
  open: boolean;
  onClose: () => void;
  reasoning?: {
    goal?: string;
    tone?: string;
    reasoningSupport?: string[];
    mustAddress?: string[];
    avoid?: string[];
    topic?: string;
    userIntent?: string;
  };
  atmosphere?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-sm flex min-h-full items-start sm:items-center justify-center py-6 sm:py-8 safe-top safe-bottom animate-appear">
      <div className="relative w-full max-w-lg my-auto max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.98)] p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--elevate-1))] hover:text-[hsl(var(--foreground))]"
          data-testid="button-close-inspect-reasoning"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/.15)] text-[hsl(var(--accent))]">
            <Sparkles size={16} />
          </span>
          <div>
            <div className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Epistemic Transparency</div>
            <h3 className="font-display text-xl">Why Haven Responded This Way</h3>
          </div>
        </div>

        <div className="mt-5 space-y-4 text-xs">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] p-3.5">
            <div className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">Strategy Goal</div>
            <div className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">{reasoning?.goal || 'Reflective inquiry and grounded observation'}</div>
            <div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Tone: {reasoning?.tone || 'Warm, grounded, thoughtful'} · Atmosphere: {modeLabel(atmosphere)}</div>
          </div>

          <div>
            <div className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] mb-2">Reasoning Safeguards Applied</div>
            <div className="flex flex-wrap gap-1.5">
              {(reasoning?.reasoningSupport || ['Distinguish observation from inference', 'Preserve user agency', 'Mitigate sycophancy']).map((item, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--elevate-1))] px-2.5 py-1 text-[11px] text-[hsl(var(--foreground)/.85)]">
                  <Check size={11} className="text-[hsl(var(--primary))]" /> {item}
                </span>
              ))}
            </div>
          </div>

          {reasoning?.avoid && reasoning.avoid.length > 0 && (
            <div>
              <div className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] mb-2">Patterns Proactively Avoided</div>
              <div className="flex flex-wrap gap-1.5">
                {reasoning.avoid.map((item, i) => (
                  <span key={i} className="rounded-full bg-[hsl(var(--destructive)/.08)] border border-[hsl(var(--destructive)/.2)] px-2.5 py-1 text-[10px] text-[hsl(var(--destructive))]">
                    ✕ {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-[hsl(var(--border))] pt-3 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
            Haven is an epistemic mirror for your own reflection, not a source of authority.
          </div>
        </div>
      </div>
    </div>
  );
}

function exportConversationToMarkdown(
  title: string,
  messages: Array<{ role: string; content: string; createdAt: string }>,
  mode?: string,
) {
  let md = `# Haven Reflection — ${title || 'Untitled reflection'}\n`;
  md += `*Exported on ${new Date().toLocaleString()} | Atmosphere: ${modeLabel(mode)}*\n\n`;
  md += `> Haven is a private space for examining your own thinking. This transcript is your personal archive.\n\n`;
  md += `---\n\n`;

  for (const m of messages) {
    const sender = m.role === 'user' ? '### You' : '### Haven (AI)';
    md += `${sender}  \n*${formatTime(m.createdAt)}*\n\n${m.content}\n\n`;
  }

  return md;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('haven_token') : null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchMe = async () => {
      const activeToken = localStorage.getItem('haven_token');
      if (!activeToken) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('haven_token');
          setToken(null);
          setUser(null);
        }
      } catch {
        // Offline / error
      } finally {
        setIsLoading(false);
      }
    };
    fetchMe();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('haven_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setShowAuthModal(false);
    queryClient.invalidateQueries();
  };

  const register = async (email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    localStorage.setItem('haven_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setShowAuthModal(false);
    queryClient.invalidateQueries();
  };

  const logout = async () => {
    const activeToken = localStorage.getItem('haven_token');
    if (activeToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem('haven_token');
    setToken(null);
    setUser(null);
    queryClient.invalidateQueries();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        showAuthModal,
        setShowAuthModal,
        authMode,
        setAuthMode,
        showHowItWorks,
        setShowHowItWorks,
      }}
    >
      {children}
      <AuthModal />
      <HowHavenWorksModal />
    </AuthContext.Provider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, setShowAuthModal, setAuthMode, setShowHowItWorks } = useAuth();

  const nav = [
    { href: '/', label: 'Home', icon: Feather },
    { href: '/space', label: 'My space', icon: MessageCircle },
    { href: '/journal', label: 'Journal', icon: BookOpen },
    { href: '/reflections', label: 'Reflections', icon: Leaf },
    { href: '/about', label: 'About', icon: HelpCircle },
  ];

  return (
    <div className="haven-noise min-h-[100dvh] bg-[var(--paper-parchment)] text-[var(--ink-primary)]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-[268px] flex-col bg-[var(--ink-slate)] px-5 py-6 text-[#F4EEE1] border-r border-[#343D3A]">
        <Link href="/" className="flex items-center gap-3 px-2 transition-opacity hover:opacity-90">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5E43] text-[#FAF6EF] shadow-xs">
            <Feather size={16} />
          </span>
          <div>
            <div className="font-editorial text-2xl tracking-tight text-[#FAF6EF]">haven</div>
            <div className="font-mono-custom text-[9px] uppercase tracking-[.2em] text-[#C5BBAA]">private inquiry</div>
          </div>
        </Link>

        <div className="mt-8 px-2 font-mono-custom text-[9px] uppercase tracking-[.18em] text-[#A39B8C]">Your space</div>
        <nav className="mt-3 space-y-1" aria-label="Primary navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition-colors ${location === href ? 'bg-[#333D3A] text-[#FAF6EF] font-medium shadow-xs' : 'text-[#C5BBAA] hover:bg-[#2C3432] hover:text-[#FAF6EF]'}`}
              data-testid={`link-${label.toLowerCase().replace(' ', '-')}`}
            >
              <Icon size={16} strokeWidth={1.6} />
              <span>{label}</span>
              {location === href && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#8B5E43]" />}
            </Link>
          ))}
        </nav>

        <div className="mt-4 space-y-1 border-t border-[#343D3A] pt-4">
          <button
            onClick={() => setShowHowItWorks(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs text-[#C5BBAA] transition-colors hover:bg-[#2C3432] hover:text-[#FAF6EF]"
            data-testid="button-how-haven-works"
          >
            <BookOpen size={15} />
            <span>How Haven works</span>
          </button>
          <Link
            href="/research"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs text-[#C5BBAA] transition-colors hover:bg-[#2C3432] hover:text-[#FAF6EF]"
            data-testid="link-research"
          >
            <BarChart3 size={15} />
            <span>Research telemetry</span>
          </Link>
        </div>

        {/* User Profile Footer */}
        <div className="mt-auto border-t border-[#343D3A] pt-4">
          {user ? (
            <div className="rounded-xl bg-[#2C3432] p-3 border border-[#3A4542]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5E43] text-[#FAF6EF] font-mono-custom text-xs font-bold shadow-xs">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-[#FAF6EF]">{user.email}</div>
                  <div className="font-mono-custom text-[9px] text-[#A39B8C]">Private Vault</div>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="rounded p-1 text-[#A39B8C] hover:text-[#E07A5F]"
                  data-testid="button-logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#3A4542] bg-[#1E2422] p-3 text-center">
              <div className="text-xs text-[#C5BBAA]">Exploring in Guest Mode</div>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                  className="flex-1 rounded-lg bg-[#8B5E43] py-1.5 text-[11px] font-semibold text-[#FAF6EF] hover:bg-[#73462E] transition-colors"
                  data-testid="button-sidebar-login"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                  className="flex-1 rounded-lg border border-[#3A4542] py-1.5 text-[11px] text-[#C5BBAA] hover:text-[#FAF6EF]"
                  data-testid="button-sidebar-register"
                >
                  Sign Up
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-h-[100dvh] pb-16 md:pb-0 md:pl-[268px]">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[#DFD6C2] bg-[#FAF7F0]/98 px-2 py-2 shadow-lg backdrop-blur-xl safe-bottom md:hidden"
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const isActive = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] transition-colors ${
                isActive
                  ? 'text-[#8B5E43] font-semibold'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
              }`}
              data-testid={`mobile-nav-${label.toLowerCase().replace(' ', '-')}`}
            >
              <div className="relative">
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.7} />
                {isActive && (
                  <motion.span
                    layoutId="mobileNavActiveDot"
                    className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#8B5E43]"
                  />
                )}
              </div>
              <span className="text-[10px] tracking-tight">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const taglineBadges = [
  { icon: Shield, label: 'Conversations stay private' },
  { icon: CircleHelp, label: 'AI identity stays visible' },
  { icon: Pause, label: 'Pause whenever you need' },
];

function Threshold() {
  const { setShowHowItWorks, setShowAuthModal } = useAuth();
  return (
    <HomePage
      onOpenHowItWorks={() => setShowHowItWorks(true)}
      onOpenAuth={() => setShowAuthModal(true)}
    />
  );
}

const reflectiveStarters = [
  {
    icon: Compass,
    title: 'Examining an Assumption',
    subtitle: 'Separate facts from inferences',
    prompt: "I have a strong belief about someone's reaction, but I want to separate what I know from what I'm assuming.",
  },
  {
    icon: SlidersHorizontal,
    title: 'Competing Values',
    subtitle: 'When two good principles clash',
    prompt: "I'm facing a decision where two good principles conflict with each other.",
  },
  {
    icon: Leaf,
    title: 'Untangling Emotional Noise',
    subtitle: 'Inspect what triggered a reaction',
    prompt: "Something felt off about a recent interaction and I want to examine what triggered me.",
  },
  {
    icon: Sparkles,
    title: 'Relationship Perspective',
    subtitle: 'Look at a dynamic without jumping ahead',
    prompt: "I want to reflect on an important relationship dynamic without jumping to quick conclusions.",
  },
];

function SpacePage() {
  const [selectedId, setSelectedId] = useState('');
  const [composer, setComposer] = useState('');
  const [showSessions, setShowSessions] = useState(true);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [showAtmosphere, setShowAtmosphere] = useState(false);
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [selectedReasoning, setSelectedReasoning] = useState<any | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const { generated: generatedAffirmation } = useAffirmationAtmosphere();
  const queryClientInstance = useQueryClient();
  const messageListRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const conversations = useListConversations();
  const environment = useGetEnvironment();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const updateEnvironment = useUpdateEnvironment();
  const list = conversations.data ?? [];
  const currentId = selectedId;
  const detail = useGetConversation(currentId, { query: { enabled: Boolean(currentId), queryKey: getGetConversationQueryKey(currentId) } });

  useEffect(() => {
    const lastMessage = lastMessageRef.current;
    const messageList = messageListRef.current;
    if (!lastMessage || !messageList) return;
    requestAnimationFrame(() => {
      const messageTop = lastMessage.getBoundingClientRect().top - messageList.getBoundingClientRect().top + messageList.scrollTop;
      messageList.scrollTo({
        top: Math.max(0, messageTop),
        behavior: 'smooth',
      });
    });
  }, [detail.data?.messages?.length, isSending, streamingContent, currentId]);

  useEffect(() => {
    const pending = sessionStorage.getItem('haven_pending_prompt');
    if (pending) {
      sessionStorage.removeItem('haven_pending_prompt');
      create(pending);
    }
  }, []);

  const create = (initialPrompt?: string, customTitle?: string) => {
    const starter = initialPrompt ? reflectiveStarters.find((s) => s.prompt === initialPrompt) : null;
    const titleToUse = customTitle || starter?.title || 'A new inquiry';

    createConversation.mutate(
      { data: { title: titleToUse } },
      {
        onSuccess: (data: any) => {
          const newId = data?.conversation?.id || data?.id;
          if (newId) {
            setSelectedId(newId);
            setMobileSessionsOpen(false);
            if (initialPrompt) {
              setComposer(initialPrompt);
            }
          }
          queryClientInstance.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
      },
    );
  };

  const handleStarterClick = (prompt: string) => {
    const starter = reflectiveStarters.find((s) => s.prompt === prompt);
    if (!currentId) {
      create(prompt, starter?.title);
    } else {
      setComposer(prompt);
    }
  };

  const handleExport = () => {
    if (!detail.data) return;
    const md = exportConversationToMarkdown(
      detail.data.title || 'Untitled reflection',
      detail.data.messages || [],
      env?.mode,
    );

    navigator.clipboard?.writeText(md).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haven-reflection-${detail.data.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'session'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = composer.trim();
    if (!content || !currentId || isSending) return;

    setNotice('');
    setComposer('');
    setIsSending(true);
    setStreamingContent('');

    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      role: 'user' as const,
      content,
      createdAt: new Date().toISOString(),
      signalLevel: 0,
    };

    // Synchronous optimistic write
    queryClientInstance.setQueryData(getGetConversationQueryKey(currentId), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        messages: [...(old.messages || []), optimisticMessage],
      };
    });

    const activeToken = localStorage.getItem('haven_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    try {
      const response = await fetch(`/api/conversations/${currentId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let currentEvent = 'message';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              currentEvent = 'message';
              continue;
            }
            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.slice(6).trim();
              continue;
            }
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              try {
                const parsed = JSON.parse(dataStr);
                if (currentEvent === 'delta' || parsed.delta) {
                  const delta = parsed.delta || '';
                  accumulated += delta;
                  setStreamingContent(accumulated);
                } else if (currentEvent === 'done' || parsed.assistantMessage) {
                  const payload = parsed;
                  queryClientInstance.setQueryData(getGetConversationQueryKey(currentId), (old: any) => {
                    if (!old) return old;
                    const withoutOptimistic = (old.messages || []).filter((m: any) => m.id !== tempId);
                    return {
                      ...old,
                      messages: [
                        ...withoutOptimistic,
                        payload.userMessage || optimisticMessage,
                        { ...payload.assistantMessage, reasoning: payload.reasoning },
                      ].filter(Boolean),
                    };
                  });

                  if (payload.environmentState) {
                    queryClientInstance.setQueryData(getGetEnvironmentQueryKey(), payload.environmentState);
                  }
                  if (payload.generatedAtmosphere) {
                    window.dispatchEvent(new CustomEvent('haven-ai-atmosphere', { detail: payload.generatedAtmosphere }));
                  }
                  queryClientInstance.invalidateQueries({ queryKey: getListConversationsQueryKey() });
                }
              } catch {
                // Ignore parse errors on partial frames
              }
            }
          }
        }
      } else {
        // Fallback for non-streaming response
        const result = await response.json();
        queryClientInstance.setQueryData(getGetConversationQueryKey(currentId), (old: any) => {
          if (!old) return old;
          const withoutOptimistic = (old.messages || []).filter((m: any) => m.id !== tempId);
          return {
            ...old,
            messages: [
              ...withoutOptimistic,
              result.userMessage || optimisticMessage,
              { ...result.assistantMessage, reasoning: result.reasoning },
            ].filter(Boolean),
          };
        });
        if (result.environmentState) {
          queryClientInstance.setQueryData(getGetEnvironmentQueryKey(), result.environmentState);
        }
        if (result.generatedAtmosphere) {
          window.dispatchEvent(new CustomEvent('haven-ai-atmosphere', { detail: result.generatedAtmosphere }));
        }
        queryClientInstance.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }
    } catch {
      // Revert optimistic message and restore composer
      queryClientInstance.setQueryData(getGetConversationQueryKey(currentId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: (old.messages || []).filter((m: any) => m.id !== tempId),
        };
      });
      setComposer(content);
      setNotice('Haven could not respond this time. No reply was invented. Your message remains yours.');
    } finally {
      setIsSending(false);
      setStreamingContent('');
    }
  };

  const remove = (id: string) => {
    if (!window.confirm('Remove this conversation from your space?')) return;
    deleteConversation.mutate({ conversationId: id }, {
      onSuccess: () => {
        if (selectedId === id) setSelectedId('');
        queryClientInstance.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      },
    });
  };

  const env = environment.data;

  return (
    <Shell>
      <div className="relative flex h-[100dvh] flex-col overflow-hidden" style={getAtmosphereStyle(env?.mode)}>
        <div className="pointer-events-none absolute right-[-12%] top-[-6%] h-[420px] w-[420px] rounded-full bg-[hsl(var(--accent)/.12)] blur-3xl animate-drift" />
        <div className="pointer-events-none absolute bottom-[-14%] left-[30%] h-[380px] w-[380px] rounded-full bg-[hsl(var(--primary)/.08)] blur-3xl animate-drift" style={{ animationDelay: '-8s' }} />

        {/* Responsive Header */}
        <header className="relative z-20 flex items-center justify-between border-b border-[hsl(var(--border)/.75)] px-3 sm:px-6 md:px-10 py-3 sm:py-3.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))] shadow-sm">
              <MessageCircle size={17} />
            </span>
            <div className="min-w-0">
              <div className="font-mono-custom text-[9px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))] truncate">Haven / Space</div>
              <div className="flex items-center gap-1.5 font-display text-sm sm:text-lg text-[hsl(var(--foreground))] truncate">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--primary))]" /> {modeLabel(env?.mode)} Atmosphere
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Mobile Conversations Drawer Trigger */}
            <button
              onClick={() => setMobileSessionsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] px-2.5 py-1 text-[10px] text-[hsl(var(--foreground))] shadow-sm backdrop-blur transition-colors hover:text-[hsl(var(--foreground))] lg:hidden"
              data-testid="button-mobile-conversations"
              title="View all conversations"
            >
              <MessageCircle size={12} />
              <span className="font-mono-custom font-semibold">({list.length})</span>
            </button>

            {detail.data?.messages && detail.data.messages.length > 0 && (
              <button
                onClick={handleExport}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] px-3 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))] shadow-sm backdrop-blur transition-colors hover:text-[hsl(var(--foreground))]"
                title="Export conversation as Markdown"
                data-testid="button-export-markdown"
              >
                {copiedToast ? <Check size={12} className="text-[hsl(var(--primary))]" /> : <Download size={12} />}
                <span>{copiedToast ? 'Copied & Saved' : 'Export .md'}</span>
              </button>
            )}

            {/* Affirmations Button & Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAffirmation((v) => !v);
                  setShowAtmosphere(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] px-2.5 sm:px-3 py-1.5 font-mono-custom text-[10px] text-[hsl(var(--muted-foreground))] shadow-sm backdrop-blur transition-colors hover:border-[hsl(var(--primary)/.4)] hover:text-[hsl(var(--foreground))]"
                aria-expanded={showAffirmation}
                data-testid="button-affirmation-menu"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--accent))]" />
                <span className="hidden xs:inline">Affirmations</span>
                <ChevronDown size={12} className={`shrink-0 transition-transform ${showAffirmation ? 'rotate-180' : ''}`} />
              </button>

              {showAffirmation && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAffirmation(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] sm:w-[300px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.98)] p-4 shadow-xl backdrop-blur-2xl animate-appear">
                    <div className="flex items-center justify-between">
                      <div className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Affirmation</div>
                      <button
                        onClick={() => setShowAffirmation(false)}
                        className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {generatedAffirmation ? (
                      <div className="mt-2.5 rounded-xl bg-[hsl(var(--primary)/.08)] p-3 text-xs leading-5 text-[hsl(var(--foreground))]">
                        {generatedAffirmation.affirmation}
                      </div>
                    ) : (
                      <div className="mt-2.5 rounded-xl bg-[hsl(var(--elevate-1))] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                        Send a message to generate a reflective affirmation for this inquiry.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Atmosphere Button & Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAtmosphere((value) => !value);
                  setShowAffirmation(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] px-2.5 sm:px-3 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))] shadow-sm backdrop-blur transition-colors hover:border-[hsl(var(--primary)/.4)] hover:text-[hsl(var(--foreground))]"
                data-testid="button-space-atmosphere"
                aria-expanded={showAtmosphere}
              >
                <Sparkles size={13} className="text-[hsl(var(--accent))]" />
                <span className="hidden sm:inline">{modeLabel(env?.mode)} atmosphere</span>
                <ChevronDown size={12} className={`transition-transform ${showAtmosphere ? 'rotate-180' : ''}`} />
              </button>

              {showAtmosphere && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAtmosphere(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] sm:w-[300px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.98)] p-4 shadow-xl backdrop-blur-2xl animate-appear">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--accent)/.15)] text-[hsl(var(--accent))]">
                          <Sparkles size={15} />
                        </span>
                        <div>
                          <div className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Live atmosphere</div>
                          <div className="mt-0.5 font-display text-xl">{modeLabel(env?.mode)}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowAtmosphere(false)}
                        className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{atmosphereDescription(env?.mode)}</p>
                    <div className="mt-3 border-t border-[hsl(var(--border))] pt-3 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
                      It changes automatically from the themes and signals in what you write. Haven does not infer a diagnosis.
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] px-3 py-1.5 font-mono-custom text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:flex">
              <motion.span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} /> private session
            </div>
          </div>
        </header>

        {/* Mobile Slide-Over Conversations Drawer */}
        {mobileSessionsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileSessionsOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[85vw] flex-col bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-[hsl(var(--sidebar-border))] pb-4">
                <div className="flex items-center gap-2">
                  <HavenMark size={24} />
                  <span className="font-display text-lg">Inquiries</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      create();
                      setMobileSessionsOpen(false);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"
                    title="New reflection"
                    data-testid="button-mobile-new-conversation"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => setMobileSessionsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--sidebar-foreground)/.7)] hover:bg-[hsl(var(--sidebar-accent))]"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto space-y-1 pr-1">
                {conversations.isLoading ? (
                  <div className="space-y-2 pt-2">
                    <div className="h-12 animate-pulse rounded-lg bg-[hsl(var(--sidebar-accent))]" />
                    <div className="h-12 animate-pulse rounded-lg bg-[hsl(var(--sidebar-accent))]" />
                  </div>
                ) : list.length === 0 ? (
                  <div className="py-8 text-center text-xs leading-5 text-[hsl(var(--sidebar-foreground)/.6)]">
                    No conversations yet. Tap + to begin.
                  </div>
                ) : (
                  list.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`group flex items-center rounded-xl p-2 transition-colors ${
                        currentId === conversation.id
                          ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] font-medium'
                          : 'text-[hsl(var(--sidebar-foreground)/.75)] hover:bg-[hsl(var(--sidebar-accent)/.5)]'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedId(conversation.id);
                          setMobileSessionsOpen(false);
                        }}
                        className="min-w-0 flex-1 text-left px-1.5"
                      >
                        <span className="block truncate text-xs">{conversation.title || 'Untitled reflection'}</span>
                        <span className="mt-0.5 block font-mono-custom text-[9px] text-[hsl(var(--sidebar-foreground)/.4)]">
                          {conversation.messageCount} messages · {formatTime(conversation.updatedAt)}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(conversation.id);
                        }}
                        className="rounded p-1.5 text-[hsl(var(--sidebar-foreground)/.4)] hover:text-[hsl(var(--destructive))]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}

        <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop Conversations Sidebar */}
          <aside className={`${showSessions ? 'w-[280px]' : 'w-0'} hidden shrink-0 overflow-hidden border-r border-[hsl(var(--border)/.75)] transition-all duration-300 lg:block`}>
            <div className="flex min-w-[280px] items-center justify-between px-5 py-4">
              <span className="font-mono-custom text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Conversations</span>
              <button onClick={() => create()} disabled={createConversation.isPending} className="rounded-md p-1.5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.1)] disabled:opacity-40" data-testid="button-new-conversation">
                <Plus size={17} />
              </button>
            </div>
            <div className="min-w-[280px] px-3">
              {conversations.isLoading ? (
                <div className="space-y-3 px-2 pt-2">
                  <div className="h-12 animate-pulse rounded-lg bg-[hsl(var(--muted))]" />
                  <div className="h-12 animate-pulse rounded-lg bg-[hsl(var(--muted))]" />
                </div>
              ) : conversations.isError ? (
                <div className="px-3 py-4 text-xs text-[hsl(var(--destructive))]" data-testid="status-conversations-error">Could not load conversations.</div>
              ) : list.length === 0 ? (
                <div className="px-3 py-6 text-xs leading-5 text-[hsl(var(--muted-foreground))]" data-testid="empty-conversations">Your first conversation can start with a single honest sentence.</div>
              ) : (
                list.map((conversation) => (
                  <div key={conversation.id} className={`group mb-1 flex items-center rounded-lg ${currentId === conversation.id ? 'bg-[hsl(var(--primary)/.1)]' : 'hover:bg-[hsl(var(--elevate-1))]'}`}>
                    <button onClick={() => setSelectedId(conversation.id)} className="min-w-0 flex-1 px-3 py-3 text-left" data-testid={`button-conversation-${conversation.id}`}>
                      <span className="block truncate text-[13px] font-medium">{conversation.title || 'Untitled reflection'}</span>
                      <span className="mt-1 block font-mono-custom text-[9px] text-[hsl(var(--muted-foreground))]">{conversation.messageCount} messages · {formatTime(conversation.updatedAt)}</span>
                    </button>
                    <button onClick={() => remove(conversation.id)} className="mr-2 rounded p-1.5 text-[hsl(var(--muted-foreground)/.6)] opacity-0 transition-opacity hover:text-[hsl(var(--destructive))] group-hover:opacity-100" data-testid={`button-delete-conversation-${conversation.id}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Main Chat Center Section */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {!currentId ? (
              /* Starters View: Fully scrollable container on mobile */
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 md:px-10 pt-4 sm:pt-6 pb-28 md:pb-8">
                <div className="mx-auto max-w-[720px] py-4 sm:py-6 text-center animate-appear">
                  <div className="relative mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.05)]">
                    <motion.div className="absolute inset-0 rounded-full bg-[hsl(var(--accent)/.18)] blur-lg" animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.75, 0.4] }} transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }} />
                    <HavenMark size={28} />
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl md:text-4xl">Begin without a script.</h2>
                  <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm leading-5 sm:leading-6 text-[hsl(var(--muted-foreground))] px-2">
                    This is not a place to arrive with the right words. Choose an inquiry below or open a blank conversation.
                  </p>

                  {/* Reflective Starters */}
                  <div className="mt-6 sm:mt-8 grid gap-2.5 sm:gap-3 text-left sm:grid-cols-2">
                    {reflectiveStarters.map(({ icon: Icon, title, prompt }, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleStarterClick(prompt)}
                        className="group flex flex-col justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] p-3.5 sm:p-4 text-left shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.4)] hover:bg-[hsl(var(--card))] active:scale-[0.99]"
                        data-testid={`starter-card-${idx}`}
                      >
                        <div>
                          <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/.1)]">
                              <Icon size={13} />
                            </span>
                            <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{title}</span>
                          </div>
                          <p className="mt-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{prompt}</p>
                        </div>
                        <div className="mt-3 flex items-center gap-1 font-mono-custom text-[9px] uppercase tracking-[.1em] text-[hsl(var(--primary))] opacity-0 transition-opacity group-hover:opacity-100">
                          <span>Begin reflection</span> <ArrowRight size={10} />
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 pb-6 flex justify-center gap-4">
                    <button
                      onClick={() => create()}
                      disabled={createConversation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-2.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-sm disabled:opacity-50 active:scale-95"
                      data-testid="button-begin-conversation"
                    >
                      <Plus size={14} /> {createConversation.isPending ? 'Opening…' : 'Open blank conversation'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Active Conversation View */
              <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col px-3 sm:px-6 md:px-10 pb-20 md:pb-6 pt-3 sm:pt-6 overflow-hidden">
                {/* Active Conversation Title Header */}
                <div className="mb-2 sm:mb-4 flex items-start justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedId('')}
                        className="inline-flex items-center gap-1 font-mono-custom text-[9px] uppercase tracking-[.14em] text-[hsl(var(--primary))] hover:underline lg:hidden"
                      >
                        <ArrowLeft size={11} /> Inquiries
                      </button>
                      <span className="font-mono-custom text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))] truncate">
                        · {formatTime(detail.data?.createdAt)}
                      </span>
                    </div>
                    <h1 className="mt-0.5 font-display text-xl sm:text-2xl md:text-3xl truncate">{detail.data?.title || 'Untitled reflection'}</h1>
                  </div>
                  <button onClick={() => setShowSessions(!showSessions)} className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))] lg:flex" data-testid="button-toggle-conversations">
                    <Menu size={12} /> {showSessions ? 'Hide list' : 'Show list'}
                  </button>
                </div>

                {/* Chat Messages Viewport */}
                <div
                  ref={messageListRef}
                  className="haven-chat-viewport min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 scrollbar-thin"
                >
                  <div className="space-y-4 sm:space-y-6 pb-4 sm:pb-6">
                    {detail.isLoading ? (
                      <>
                        <div className="h-20 w-4/5 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />
                        <div className="ml-auto h-16 w-3/4 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />
                      </>
                    ) : detail.isError ? (
                      <div className="rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)] p-4 sm:p-5 text-sm" data-testid="status-conversation-error">
                        <TriangleAlert size={17} className="mb-2 text-[hsl(var(--destructive))]" />
                        <p>We could not open this conversation.</p>
                        <button onClick={() => detail.refetch()} className="mt-3 text-xs font-semibold underline" data-testid="button-retry-conversation">Try again</button>
                      </div>
                    ) : (detail.data?.messages ?? []).length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-5 sm:p-6 text-center text-xs text-[hsl(var(--muted-foreground))]" data-testid="empty-messages">
                        <div className="font-medium text-sm text-[hsl(var(--foreground)/.8)]">The space is open.</div>
                        <p className="mt-1">Say what is present. Haven will meet it carefully.</p>

                        <div className="mt-5 grid gap-2.5 text-left sm:grid-cols-2">
                          {reflectiveStarters.map(({ icon: Icon, title, prompt }, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleStarterClick(prompt)}
                              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] p-3 text-left transition-colors hover:border-[hsl(var(--primary)/.4)] hover:bg-[hsl(var(--card))]"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--foreground))]">
                                <Icon size={12} className="text-[hsl(var(--primary))]" /> {title}
                              </div>
                              <div className="mt-1 line-clamp-2 text-[11px] text-[hsl(var(--muted-foreground))]">{prompt}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      detail.data?.messages.map((message, index) => {
                        const isLast = !isSending && !streamingContent && index === (detail.data?.messages?.length || 0) - 1;
                        const reasoning = (message as any).reasoning;
                        return (
                          <div
                            key={message.id}
                            ref={isLast ? lastMessageRef : undefined}
                            className={`animate-appear ${message.role === 'user' ? 'ml-auto max-w-[92%] sm:max-w-[84%]' : 'max-w-[95%] sm:max-w-[88%]'}`}
                          >
                            <div className={`mb-1.5 flex items-center gap-2 font-mono-custom text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))] ${message.role === 'user' ? 'justify-end' : ''}`}>
                              <span>{message.role === 'user' ? 'You' : 'Haven · AI'}</span>
                              {message.signalLevel !== undefined && message.signalLevel > 0 && (
                                <span className="text-[hsl(var(--destructive))]">signal {message.signalLevel}/4</span>
                              )}
                              {message.role === 'assistant' && (
                                <button
                                  onClick={() => setSelectedReasoning(reasoning || { goal: 'Reflective inquiry and grounded observation', tone: 'Warm, thoughtful', reasoningSupport: ['Distinguish observation from inference', 'Preserve user agency'] })}
                                  className="ml-auto inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 text-[8px] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/.6)] hover:text-[hsl(var(--accent))]"
                                  data-testid={`button-inspect-reasoning-${message.id}`}
                                >
                                  <Sparkles size={9} /> Inspect reasoning
                                </button>
                              )}
                            </div>
                            <div
                              className={`rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-[13px] sm:text-[14px] leading-6 sm:leading-7 ${message.role === 'user' ? 'rounded-br-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'rounded-bl-sm border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] text-[hsl(var(--foreground)/.86)]'}`}
                              data-testid={`message-${message.role}-${message.id}`}
                            >
                              {message.content}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Thinking State */}
                    {isSending && !streamingContent && (
                      <div ref={lastMessageRef} className="animate-appear max-w-[95%] sm:max-w-[88%]" data-testid="status-haven-thinking">
                        <div className="mb-1.5 flex items-center gap-2 font-mono-custom text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">
                          <span>Haven · AI</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-4 sm:px-5 py-3.5 sm:py-4 text-[14px]">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--primary))]" style={{ animationDelay: '0ms' }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--primary))]" style={{ animationDelay: '150ms' }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--primary))]" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}

                    {/* Real-time Streaming State */}
                    {streamingContent && (
                      <div ref={lastMessageRef} className="animate-appear max-w-[95%] sm:max-w-[88%]" data-testid="status-haven-streaming">
                        <div className="mb-1.5 flex items-center gap-2 font-mono-custom text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">
                          <span>Haven · AI</span>
                          <span className="font-mono-custom text-[9px] text-[hsl(var(--accent))] animate-pulse">streaming…</span>
                        </div>
                        <div className="rounded-2xl rounded-bl-sm border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-4 sm:px-5 py-3 sm:py-3.5 text-[13px] sm:text-[14px] leading-6 sm:leading-7 text-[hsl(var(--foreground)/.86)]">
                          {streamingContent}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {notice && (
                  <div className="mt-2 flex items-start gap-3 rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] p-3 text-xs leading-5 text-[hsl(var(--destructive))]" data-testid="status-ai-unavailable">
                    <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                    <span>{notice}</span>
                    <button className="ml-auto" onClick={() => setNotice('')} data-testid="button-dismiss-ai-error"><X size={14} /></button>
                  </div>
                )}

                {/* Chat Input Composer Form */}
                <form onSubmit={send} className="mt-2 sm:mt-3 shrink-0">
                  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.82)] p-2.5 sm:p-3 shadow-[var(--shadow-sm)] backdrop-blur">
                    <textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      placeholder="Put something here to examine…"
                      rows={2}
                      maxLength={12000}
                      className="w-full resize-none border-0 bg-transparent px-2 py-1 text-xs sm:text-sm leading-5 sm:leading-6 outline-none placeholder:text-[hsl(var(--muted-foreground)/.7)]"
                      data-testid="input-message-composer"
                    />
                    <div className="mt-1.5 flex items-center justify-between border-t border-[hsl(var(--border)/.7)] pt-2">
                      <span className="font-mono-custom text-[8px] sm:text-[9px] text-[hsl(var(--muted-foreground))]">
                        {composer.length > 0 ? `${composer.length.toLocaleString()} / 12,000` : 'Haven is an AI mirror.'}
                      </span>
                      <button
                        type="submit"
                        disabled={!composer.trim() || isSending}
                        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[hsl(var(--primary))] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-35 transition-transform active:scale-95"
                        data-testid="button-send-message"
                      >
                        {isSending ? 'Listening…' : 'Send'} <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </section>

          {/* Signal visibility aside for extra large screens */}
          <aside className="hidden w-[250px] shrink-0 border-l border-[hsl(var(--border)/.75)] px-5 py-6 xl:block">
            <div className="font-mono-custom text-[9px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Signal visibility</div>
            <p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Haven surfaces patterns that could narrow your thinking. Signals are prompts for inspection, not diagnoses.</p>
            <div className="mt-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.58)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium"><Activity size={14} className="text-[hsl(var(--primary))]" /> Current atmosphere</div>
              <div className="mt-3 font-display text-2xl">{modeLabel(env?.mode)}</div>
              <div className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">{env?.approvedObjects?.length ? `${env.approvedObjects.length} approved lens${env.approvedObjects.length === 1 ? '' : 'es'} in view.` : 'No additional lens is active.'}</div>
            </div>
            {env?.suggestedObject && (
              <div className="mt-4 rounded-xl border border-[hsl(var(--accent)/.5)] bg-[hsl(var(--accent)/.11)] p-4">
                <div className="font-mono-custom text-[9px] uppercase tracking-[.13em] text-[hsl(var(--foreground)/.6)]">A possible lens</div>
                <p className="mt-2 text-xs leading-5">Would you like to notice <strong>{env.suggestedObject}</strong> here?</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => updateEnvironment.mutate({ data: { objectName: env.suggestedObject!, decision: 'accepted' } }, { onSuccess: () => queryClientInstance.invalidateQueries({ queryKey: getGetEnvironmentQueryKey() }) })} className="rounded-full bg-[hsl(var(--primary))] px-3 py-1.5 text-[10px] font-semibold text-[hsl(var(--primary-foreground))]" data-testid="button-approve-lens">Keep it</button>
                  <button onClick={() => updateEnvironment.mutate({ data: { objectName: env.suggestedObject!, decision: 'rejected' } }, { onSuccess: () => queryClientInstance.invalidateQueries({ queryKey: getGetEnvironmentQueryKey() }) })} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-[10px]" data-testid="button-reject-lens">Not now</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <InspectReasoningModal
        open={Boolean(selectedReasoning)}
        onClose={() => setSelectedReasoning(null)}
        reasoning={selectedReasoning}
        atmosphere={env?.mode}
      />
    </Shell>
  );
}

function ReflectionsPage() {
  return (
    <Shell>
      <ReflectionsPageComponent />
    </Shell>
  );
}

function MiniLineChart({ series }: { series: { label: string; values: number[] }[] }) {
  const max = Math.max(1, ...series.flatMap((item) => item.values));
  return (
    <div className="relative h-44 sm:h-48 w-full" data-testid="chart-signal-series">
      <div className="absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3, 4].map((line) => (
          <span key={line} className="border-t border-[hsl(var(--border)/.7)]" />
        ))}
      </div>
      <svg viewBox="0 0 600 180" preserveAspectRatio="none" className="relative h-full w-full overflow-visible">
        {series.map((item, seriesIndex) => {
          const points = item.values.map((value, index) => `${(index / Math.max(1, item.values.length - 1)) * 600},${174 - (value / max) * 156}`).join(' ');
          return <polyline key={item.label} points={points} fill="none" stroke={seriesIndex === 0 ? 'hsl(var(--primary))' : seriesIndex === 1 ? 'hsl(var(--accent))' : 'hsl(204 40% 55%)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
    </div>
  );
}

const paperStyles: Record<string, { name: string; bg: string; text: string; border: string; accent: string; fontClass: string; desc: string }> = {
  parchment: { name: 'Parchment', bg: '#f9f6ee', text: '#2d2720', border: '#e3dcce', accent: '#7a5a3a', fontClass: 'font-serif', desc: 'Classic warm deckled paper' },
  sage_linen: { name: 'Sage Linen', bg: '#eff4ee', text: '#1e2b21', border: '#cbd7cb', accent: '#376846', fontClass: 'font-sans', desc: 'Organic botanical weave' },
  dark_slate: { name: 'Dark Slate', bg: '#14181f', text: '#e7ecf2', border: '#293240', accent: '#60a5fa', fontClass: 'font-sans', desc: 'Midnight quiet reflection' },
  kraft_vintage: { name: 'Kraft Earth', bg: '#ede3d1', text: '#352b20', border: '#d5c7af', accent: '#8c5e32', fontClass: 'font-serif', desc: 'Warm vintage fiber' },
  clean_minimal: { name: 'Studio White', bg: '#ffffff', text: '#111827', border: '#e5e7eb', accent: '#4b5563', fontClass: 'font-sans', desc: 'Crisp minimal clarity' },
};

const stickerCatalog = [
  { id: 'bot-fern', cat: 'botanical', label: 'Pressed Fern', icon: '🌿', color: '#3d6648', bg: '#e8f0e9' },
  { id: 'bot-sakura', cat: 'botanical', label: 'Sakura Bloom', icon: '🌸', color: '#a84d68', bg: '#fcedf2' },
  { id: 'bot-leaf', cat: 'botanical', label: 'Eucalyptus', icon: '🍃', color: '#4a6b5d', bg: '#eef5f1' },
  { id: 'bot-ginkgo', cat: 'botanical', label: 'Ginkgo Leaf', icon: '🍂', color: '#a87a2a', bg: '#fbf3e4' },
  { id: 'bot-flower', cat: 'botanical', label: 'Chamomile', icon: '🌼', color: '#997321', bg: '#fdf7e7' },

  { id: 'cel-crescent', cat: 'celestial', label: 'Crescent Moon', icon: '🌙', color: '#3b557a', bg: '#edf2f9' },
  { id: 'cel-full', cat: 'celestial', label: 'Radiant Moon', icon: '🌕', color: '#8c7028', bg: '#faf4e3' },
  { id: 'cel-star', cat: 'celestial', label: 'Starburst', icon: '✨', color: '#946626', bg: '#fdf5e8' },
  { id: 'cel-orbit', cat: 'celestial', label: 'Cosmic Orbit', icon: '🪐', color: '#634b82', bg: '#f3eef8' },
  { id: 'cel-crystal', cat: 'celestial', label: 'Prism Crystal', icon: '🔮', color: '#7a4282', bg: '#f6eef7' },

  { id: 'washi-gold', cat: 'washi', label: 'Wax Seal', icon: '🏷️', color: '#9e6d24', bg: '#f8eedc' },
  { id: 'washi-stamp', cat: 'washi', label: 'Postage Mark', icon: '📜', color: '#574d43', bg: '#efebe6' },
  { id: 'washi-rose', cat: 'washi', label: 'Rose Tape', icon: '🎀', color: '#9c4d66', bg: '#faedf2' },
  { id: 'washi-forest', cat: 'washi', label: 'Forest Tape', icon: '🌲', color: '#31573c', bg: '#e8f2eb' },

  { id: 'mantra-lightly', cat: 'mantra', label: 'Hold Lightly', icon: '💭', color: '#3a6678', bg: '#eaf3f7' },
  { id: 'mantra-notice', cat: 'mantra', label: 'Notice & Allow', icon: '👁️', color: '#466657', bg: '#ebf4ef' },
  { id: 'mantra-safe', cat: 'mantra', label: 'Uncertainty is Safe', icon: '🛡️', color: '#75548c', bg: '#f3ecf7' },
  { id: 'mantra-breathe', cat: 'mantra', label: 'Breathe & Return', icon: '🌊', color: '#2d6d7d', bg: '#e6f3f7' },
];

const moodPhotos = [
  {
    id: 'forest-mist',
    label: 'Morning Mist',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
    caption: 'Stillness in the quiet pines',
  },
  {
    id: 'rainy-window',
    label: 'Rain & Warmth',
    url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=600&q=80',
    caption: 'Soft rain against the glass',
  },
  {
    id: 'candle-light',
    label: 'Warm Hearth',
    url: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=600&q=80',
    caption: 'Thoughts by candlelight',
  },
  {
    id: 'mountain-twilight',
    label: 'Evening Peaks',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
    caption: 'Looking outward into twilight',
  },
];

interface JournalEntryState {
  id: string;
  title: string;
  content: string;
  vibe: string;
  paperStyle: string;
  fontStyle: string;
  stickers: Array<{
    id: string;
    stickerId: string;
    label?: string;
    icon?: string;
    color?: string;
    bg?: string;
    x: number;
    y: number;
    rotate: number;
    scale: number;
  }>;
  photos: Array<{
    id: string;
    url: string;
    caption?: string;
    x: number;
    y: number;
    rotate: number;
    scale: number;
    frame: string;
  }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function JournalPage() {
  const [entries, setEntries] = useState<JournalEntryState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileJournalView, setMobileJournalView] = useState<'canvas' | 'pages' | 'tools'>('canvas');
  const [activeTab, setActiveTab] = useState<'stickers' | 'photos' | 'vibe' | 'custom'>('stickers');
  const [stickerCategory, setStickerCategory] = useState<'botanical' | 'celestial' | 'washi' | 'mantra'>('botanical');
  const [selectedElement, setSelectedElement] = useState<{ type: 'sticker' | 'photo'; id: string } | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  // Custom Sticker Generator State
  const [customIcon, setCustomIcon] = useState('✨');
  const [customLabel, setCustomLabel] = useState('My Truth');
  const [customColor, setCustomColor] = useState('#3d6648');
  const [customBg, setCustomBg] = useState('#e8f0e9');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Fetch entries
  const loadEntries = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('haven_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch('/api/journal', { headers });
      if (res.ok) {
        const data = await res.json();
        const loaded: JournalEntryState[] = data.entries || [];
        setEntries(loaded);
        if (loaded.length > 0 && !activeId) {
          setActiveId(loaded[0].id);
        }
      } else {
        throw new Error('Fallback to local');
      }
    } catch {
      const local = localStorage.getItem('haven_journal_entries');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setEntries(parsed);
          if (parsed.length > 0 && !activeId) setActiveId(parsed[0].id);
        } catch {
          // ignore
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  // Save entry to API / LocalStorage
  const saveEntry = async (entryToSave: JournalEntryState) => {
    const updated = entries.map((e) => (e.id === entryToSave.id ? entryToSave : e));
    setEntries(updated);
    localStorage.setItem('haven_journal_entries', JSON.stringify(updated));

    const token = localStorage.getItem('haven_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      await fetch(`/api/journal/${entryToSave.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(entryToSave),
      });
    } catch {
      // Saved in local storage
    }

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2200);
  };

  const createNewEntry = async () => {
    const newEntry: JournalEntryState = {
      id: `entry-${Date.now()}`,
      title: 'Morning Reflections',
      content: '',
      vibe: 'reflective',
      paperStyle: 'parchment',
      fontStyle: 'serif',
      stickers: [
        { id: `stk-${Date.now()}-1`, stickerId: 'bot-fern', label: 'Pressed Fern', icon: '🌿', color: '#3d6648', bg: '#e8f0e9', x: 82, y: 8, rotate: 6, scale: 1.1 },
        { id: `stk-${Date.now()}-2`, stickerId: 'mantra-lightly', label: 'Hold Lightly', icon: '💭', color: '#3a6678', bg: '#eaf3f7', x: 74, y: 78, rotate: -4, scale: 1 },
      ],
      photos: [],
      tags: ['Stillness', 'Inquiry'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const token = localStorage.getItem('haven_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers,
        body: JSON.stringify(newEntry),
      });
      if (res.ok) {
        const saved = await res.json();
        const next = [saved, ...entries];
        setEntries(next);
        setActiveId(saved.id);
        setMobileJournalView('canvas');
        localStorage.setItem('haven_journal_entries', JSON.stringify(next));
        return;
      }
    } catch {
      // Local fallback
    }

    const next = [newEntry, ...entries];
    setEntries(next);
    setActiveId(newEntry.id);
    setMobileJournalView('canvas');
    localStorage.setItem('haven_journal_entries', JSON.stringify(next));
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm('Delete this journal page?')) return;
    const filtered = entries.filter((e) => e.id !== id);
    setEntries(filtered);
    localStorage.setItem('haven_journal_entries', JSON.stringify(filtered));
    if (activeId === id) {
      setActiveId(filtered.length > 0 ? filtered[0].id : null);
    }

    const token = localStorage.getItem('haven_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      await fetch(`/api/journal/${id}`, { method: 'DELETE', headers });
    } catch {
      // deleted locally
    }
  };

  const currentEntry = entries.find((e) => e.id === activeId) || entries[0] || null;

  const updateCurrentEntry = (patch: Partial<JournalEntryState>) => {
    if (!currentEntry) return;
    const updated = { ...currentEntry, ...patch, updatedAt: new Date().toISOString() };
    const nextList = entries.map((e) => (e.id === updated.id ? updated : e));
    setEntries(nextList);
    localStorage.setItem('haven_journal_entries', JSON.stringify(nextList));
  };

  // Sticker Placement
  const addSticker = (sticker: { id: string; label: string; icon: string; color: string; bg?: string }) => {
    if (!currentEntry) return;
    const newSticker = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stickerId: sticker.id,
      label: sticker.label,
      icon: sticker.icon,
      color: sticker.color,
      bg: sticker.bg || '#f3f4f6',
      x: 35 + Math.floor(Math.random() * 30),
      y: 20 + Math.floor(Math.random() * 40),
      rotate: Math.floor(Math.random() * 24) - 12,
      scale: 1,
    };
    updateCurrentEntry({
      stickers: [...(currentEntry.stickers || []), newSticker],
    });
    setMobileJournalView('canvas');
  };

  // Add Custom Generated Sticker
  const addCustomSticker = () => {
    if (!currentEntry) return;
    addSticker({
      id: `custom-${Date.now()}`,
      label: customLabel.trim() || 'Anchor',
      icon: customIcon,
      color: customColor,
      bg: customBg,
    });
  };

  // Photo Attachment
  const addPhoto = (photo: { url: string; caption?: string }) => {
    if (!currentEntry) return;
    const newPhoto = {
      id: `photo-${Date.now()}`,
      url: photo.url,
      caption: photo.caption || 'Captured moment',
      x: 50,
      y: 35,
      rotate: Math.floor(Math.random() * 8) - 4,
      scale: 1,
      frame: 'polaroid',
    };
    updateCurrentEntry({
      photos: [...(currentEntry.photos || []), newPhoto],
    });
    setMobileJournalView('canvas');
  };

  // Handle Photo File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      if (url) {
        addPhoto({ url, caption: file.name.replace(/\.[^/.]+$/, '') });
      }
    };
    reader.readAsDataURL(file);
  };

  // Dragging stickers on touch / mouse pointer
  const handleElementPointerDown = (type: 'sticker' | 'photo', id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedElement({ type, id });

    if (!pageRef.current) return;
    const pageRect = pageRef.current.getBoundingClientRect();
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const element = type === 'sticker'
      ? (currentEntry?.stickers || []).find((s) => s.id === id)
      : (currentEntry?.photos || []).find((p) => p.id === id);

    if (!element) return;
    const startX = element.x;
    const startY = element.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - startClientX) / pageRect.width) * 100;
      const deltaY = ((moveEvent.clientY - startClientY) / pageRect.height) * 100;
      const newX = Math.max(8, Math.min(92, Math.round(startX + deltaX)));
      const newY = Math.max(8, Math.min(92, Math.round(startY + deltaY)));

      if (type === 'sticker') {
        updateCurrentEntry({
          stickers: (currentEntry?.stickers || []).map((s) => (s.id === id ? { ...s, x: newX, y: newY } : s)),
        });
      } else {
        updateCurrentEntry({
          photos: (currentEntry?.photos || []).map((p) => (p.id === id ? { ...p, x: newX, y: newY } : p)),
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const updateElementTransform = (action: 'rotate' | 'scaleUp' | 'scaleDown' | 'remove') => {
    if (!selectedElement || !currentEntry) return;
    if (selectedElement.type === 'sticker') {
      let nextStickers = [...(currentEntry.stickers || [])];
      if (action === 'remove') {
        nextStickers = nextStickers.filter((s) => s.id !== selectedElement.id);
        setSelectedElement(null);
      } else {
        nextStickers = nextStickers.map((s) => {
          if (s.id !== selectedElement.id) return s;
          if (action === 'rotate') return { ...s, rotate: (s.rotate + 15) % 360 };
          if (action === 'scaleUp') return { ...s, scale: Math.min(2, s.scale + 0.15) };
          if (action === 'scaleDown') return { ...s, scale: Math.max(0.6, s.scale - 0.15) };
          return s;
        });
      }
      updateCurrentEntry({ stickers: nextStickers });
    } else if (selectedElement.type === 'photo') {
      let nextPhotos = [...(currentEntry.photos || [])];
      if (action === 'remove') {
        nextPhotos = nextPhotos.filter((p) => p.id !== selectedElement.id);
        setSelectedElement(null);
      } else {
        nextPhotos = nextPhotos.map((p) => {
          if (p.id !== selectedElement.id) return p;
          if (action === 'rotate') return { ...p, rotate: (p.rotate + 8) % 360 };
          if (action === 'scaleUp') return { ...p, scale: Math.min(1.8, p.scale + 0.15) };
          if (action === 'scaleDown') return { ...p, scale: Math.max(0.6, p.scale - 0.15) };
          return p;
        });
      }
      updateCurrentEntry({ photos: nextPhotos });
    }
  };

  const currentPaper = paperStyles[currentEntry?.paperStyle || 'parchment'] || paperStyles.parchment;

  return (
    <Shell>
      <div className="relative min-h-[100dvh] bg-[hsl(var(--background))] px-3 sm:px-6 md:px-10 py-5 sm:py-6 md:py-8">
        {/* Header */}
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-[hsl(var(--border))] pb-4 sm:pb-6">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))] shadow-sm">
              <BookOpen size={18} />
            </span>
            <div className="min-w-0">
              <div className="font-mono-custom text-[9px] sm:text-[10px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))] truncate">Haven / Scrapbook</div>
              <h1 className="font-display text-lg sm:text-2xl md:text-3xl text-[hsl(var(--foreground))] truncate">The Reflective Journal</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {saveToast && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary)/.15)] px-2.5 py-1 font-mono-custom text-[9px] text-[hsl(var(--primary))]"
              >
                <Check size={11} /> Saved
              </motion.div>
            )}
            <button
              onClick={createNewEntry}
              className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary))] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-md)] transition-transform active:scale-95 hover:scale-[1.02]"
              data-testid="button-new-journal-entry"
            >
              <Plus size={14} /> New Page
            </button>
          </div>
        </div>

        {/* Mobile Segmented View Switcher (Visible on < 1024px) */}
        <div className="mx-auto mt-4 flex max-w-[1360px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] p-1 lg:hidden">
          <button
            onClick={() => setMobileJournalView('canvas')}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
              mobileJournalView === 'canvas' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            📖 Page Canvas
          </button>
          <button
            onClick={() => setMobileJournalView('pages')}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
              mobileJournalView === 'pages' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            📑 Pages ({entries.length})
          </button>
          <button
            onClick={() => setMobileJournalView('tools')}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
              mobileJournalView === 'tools' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            🎨 Stamps & Style
          </button>
        </div>

        {/* Main Grid: Sidebar List + Interactive Canvas + Styling Tools */}
        <div className="mx-auto mt-6 sm:mt-8 grid max-w-[1360px] gap-6 lg:grid-cols-[260px_1fr_310px] lg:gap-8">
          {/* Left: Journal Entries Shelf */}
          <aside className={`space-y-4 ${mobileJournalView === 'pages' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex items-center justify-between font-mono-custom text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">
              <span>Pages ({entries.length})</span>
            </div>

            <div className="space-y-2.5">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-16 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />
                  <div className="h-16 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />
                </div>
              ) : entries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                  No journal entries yet. Create your first page to begin.
                </div>
              ) : (
                entries.map((entry) => {
                  const paper = paperStyles[entry.paperStyle || 'parchment'] || paperStyles.parchment;
                  const isActive = entry.id === activeId;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        setActiveId(entry.id);
                        setMobileJournalView('canvas');
                      }}
                      style={{ borderLeftColor: paper.accent }}
                      className={`group relative cursor-pointer rounded-2xl border p-3.5 sm:p-4 transition-all ${
                        isActive
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--card))] shadow-md border-l-4'
                          : 'border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] hover:border-[hsl(var(--primary)/.4)] border-l-2'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">{entry.title || 'Untitled Entry'}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEntry(entry.id);
                          }}
                          className="opacity-70 group-hover:opacity-100 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="mt-1 line-clamp-1 text-[11px] text-[hsl(var(--muted-foreground))]">{entry.content || 'Blank page...'}</div>
                      <div className="mt-2.5 flex items-center justify-between font-mono-custom text-[9px] text-[hsl(var(--muted-foreground)/.7)]">
                        <span>{formatTime(entry.createdAt)}</span>
                        <span>{entry.stickers?.length || 0} stamps</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Center: Tactile Journal Book Canvas */}
          <main className={`flex flex-col items-center w-full ${mobileJournalView === 'canvas' ? 'block' : 'hidden lg:flex'}`}>
            {currentEntry ? (
              <div className="w-full max-w-[720px]">
                {/* Journal Page Frame */}
                <div
                  ref={pageRef}
                  onClick={() => setSelectedElement(null)}
                  style={{
                    backgroundColor: currentPaper.bg,
                    color: currentPaper.text,
                    borderColor: currentPaper.border,
                    boxShadow: '0 20px 45px -12px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)',
                  }}
                  className={`relative min-h-[500px] sm:min-h-[580px] md:min-h-[640px] w-full rounded-3xl border p-4 sm:p-8 md:p-12 transition-colors duration-300 ${
                    currentEntry.fontStyle === 'serif' ? 'font-serif' : currentEntry.fontStyle === 'handwritten' ? 'font-mono-custom' : 'font-sans'
                  }`}
                >
                  {/* Decorative paper margin line */}
                  <div className="pointer-events-none absolute bottom-6 left-6 sm:bottom-8 sm:left-10 top-6 sm:top-8 w-px border-r border-dashed border-[currentColor] opacity-15" />

                  {/* Header info */}
                  <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b border-[currentColor] border-opacity-10 pb-3 sm:pb-4">
                    <input
                      type="text"
                      value={currentEntry.title}
                      onChange={(e) => updateCurrentEntry({ title: e.target.value })}
                      placeholder="Title of this reflection..."
                      className="bg-transparent text-lg sm:text-xl md:text-2xl font-bold tracking-tight outline-none placeholder:text-[currentColor] placeholder:opacity-30 flex-1 min-w-[160px]"
                    />
                    <div className="font-mono-custom text-[9px] sm:text-[10px] uppercase tracking-[.15em] opacity-60">
                      {formatTime(currentEntry.createdAt)}
                    </div>
                  </div>

                  {/* Body Text Area */}
                  <textarea
                    value={currentEntry.content}
                    onChange={(e) => updateCurrentEntry({ content: e.target.value })}
                    placeholder="Write what is unfolding inside you... what tensions, assumptions, or quiet thoughts are calling for attention?"
                    rows={14}
                    className="w-full resize-none bg-transparent text-xs sm:text-sm md:text-base leading-6 sm:leading-7 outline-none placeholder:text-[currentColor] placeholder:opacity-30"
                  />

                  {/* Placed Stickers Layer (with Touch drag support) */}
                  {currentEntry.stickers?.map((sticker) => {
                    const isSelected = selectedElement?.type === 'sticker' && selectedElement.id === sticker.id;
                    return (
                      <motion.div
                        key={sticker.id}
                        onPointerDown={(e) => handleElementPointerDown('sticker', sticker.id, e)}
                        style={{
                          left: `${sticker.x}%`,
                          top: `${sticker.y}%`,
                          transform: `translate(-50%, -50%) rotate(${sticker.rotate}deg) scale(${sticker.scale})`,
                          backgroundColor: sticker.bg || '#ffffff',
                          color: sticker.color || '#333333',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                          touchAction: 'none',
                        }}
                        className={`absolute cursor-pointer select-none rounded-2xl border border-black/10 px-3 py-1.5 sm:px-3.5 sm:py-2 font-mono-custom text-xs font-semibold backdrop-blur transition-transform active:scale-105 ${
                          isSelected ? 'ring-2 ring-[hsl(var(--primary))] scale-110 z-30' : 'hover:scale-105 z-20'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-sm sm:text-base">{sticker.icon}</span>
                          <span className="text-[10px] sm:text-[11px] tracking-wide">{sticker.label}</span>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Placed Photos / Polaroids Layer (with Touch drag support) */}
                  {currentEntry.photos?.map((photo) => {
                    const isSelected = selectedElement?.type === 'photo' && selectedElement.id === photo.id;
                    return (
                      <motion.div
                        key={photo.id}
                        onPointerDown={(e) => handleElementPointerDown('photo', photo.id, e)}
                        style={{
                          left: `${photo.x}%`,
                          top: `${photo.y}%`,
                          transform: `translate(-50%, -50%) rotate(${photo.rotate}deg) scale(${photo.scale})`,
                          boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
                          touchAction: 'none',
                        }}
                        className={`absolute w-36 sm:w-44 cursor-pointer select-none rounded-xl bg-white p-2 sm:p-2.5 text-zinc-900 transition-transform active:scale-105 ${
                          isSelected ? 'ring-2 ring-[hsl(var(--primary))] z-30' : 'hover:scale-105 z-20'
                        }`}
                      >
                        {/* Washi tape topper */}
                        <div className="absolute -top-2 left-1/2 h-4 sm:h-5 w-12 sm:w-14 -translate-x-1/2 rounded bg-[#e8be89]/80 shadow-sm backdrop-blur" />
                        <img src={photo.url} alt="Journal memory" className="h-24 sm:h-32 w-full rounded-lg object-cover" />
                        <div className="mt-1.5 sm:mt-2 text-center font-mono-custom text-[9px] sm:text-[10px] text-zinc-700 italic truncate">
                          {photo.caption || 'A quiet memory'}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Floating Transform Control Toolbar when a sticker or photo is active */}
                {selectedElement && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-2xl sm:rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.96)] p-3 sm:px-5 sm:py-2.5 shadow-lg backdrop-blur-xl"
                  >
                    <span className="font-mono-custom text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Controls:</span>
                    <button
                      onClick={() => updateElementTransform('rotate')}
                      className="inline-flex items-center gap-1 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--primary)/.2)]"
                      title="Rotate item"
                    >
                      <RotateCw size={13} /> Rotate
                    </button>
                    <button
                      onClick={() => updateElementTransform('scaleUp')}
                      className="rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--primary)/.2)]"
                      title="Enlarge"
                    >
                      + Scale
                    </button>
                    <button
                      onClick={() => updateElementTransform('scaleDown')}
                      className="rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--primary)/.2)]"
                      title="Shrink"
                    >
                      - Scale
                    </button>
                    <button
                      onClick={() => updateElementTransform('remove')}
                      className="inline-flex items-center gap-1 rounded-lg bg-[hsl(var(--destructive)/.12)] px-2.5 py-1 text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.22)]"
                      title="Remove from page"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </motion.div>
                )}

                {/* Footer Save / Sync bar */}
                <div className="mt-4 sm:mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
                    <span>Auto-synced to Haven vault</span>
                  </div>
                  <button
                    onClick={() => saveEntry(currentEntry)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 font-medium text-[hsl(var(--foreground))] shadow-sm hover:border-[hsl(var(--primary)/.5)] transition-transform active:scale-95"
                  >
                    <Check size={14} className="text-[hsl(var(--primary))]" /> Save Page
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-[400px] sm:h-[480px] w-full max-w-[600px] flex-col items-center justify-center rounded-3xl border border-dashed border-[hsl(var(--border))] p-6 sm:p-8 text-center">
                <BookOpen size={36} className="text-[hsl(var(--muted-foreground)/.5)]" />
                <h3 className="mt-4 font-display text-2xl">Your Journal is Open</h3>
                <p className="mt-2 text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">Click 'New Journal Page' to begin your reflective entry with custom paper, stickers, and photos.</p>
                <button
                  onClick={createNewEntry}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm"
                >
                  <Plus size={16} /> Create First Page
                </button>
              </div>
            )}
          </main>

          {/* Right: Customization Toolbox (Vibes, Paper, Stickers, Photos) */}
          <aside className={`rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] p-4 sm:p-5 shadow-sm backdrop-blur-xl ${mobileJournalView === 'tools' ? 'block' : 'hidden lg:block'}`}>
            {/* Toolbox Tabs */}
            <div className="grid grid-cols-4 gap-1 rounded-2xl bg-[hsl(var(--muted)/.6)] p-1">
              {[
                { id: 'stickers', label: 'Stamps', icon: Sticker },
                { id: 'photos', label: 'Photos', icon: Camera },
                { id: 'vibe', label: 'Paper', icon: Palette },
                { id: 'custom', label: 'Custom', icon: Sparkles },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex flex-col items-center gap-1 rounded-xl py-2 font-mono-custom text-[9px] uppercase tracking-wider transition-colors ${
                      active ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm font-bold' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Sticker & Mantra Catalog */}
            {activeTab === 'stickers' && (
              <div className="mt-4 sm:mt-5 space-y-4">
                <div className="flex gap-1 border-b border-[hsl(var(--border))] pb-2">
                  {(['botanical', 'celestial', 'washi', 'mantra'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setStickerCategory(cat)}
                      className={`flex-1 rounded-lg py-1 font-mono-custom text-[9px] uppercase tracking-wider ${
                        stickerCategory === cat ? 'bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))] font-semibold' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {stickerCatalog
                    .filter((s) => s.cat === stickerCategory)
                    .map((sticker) => (
                      <button
                        key={sticker.id}
                        onClick={() => addSticker(sticker)}
                        style={{ backgroundColor: sticker.bg, color: sticker.color }}
                        className="flex flex-col items-center gap-1 rounded-2xl border border-black/5 p-3 text-center transition-transform hover:scale-105 active:scale-95 shadow-sm"
                      >
                        <span className="text-2xl">{sticker.icon}</span>
                        <span className="font-mono-custom text-[10px] font-semibold tracking-tight">{sticker.label}</span>
                      </button>
                    ))}
                </div>
                <div className="text-center font-mono-custom text-[9px] text-[hsl(var(--muted-foreground))]">
                  Tap any sticker to stamp onto page.
                </div>
              </div>
            )}

            {/* Tab 2: Photos & Polaroids */}
            {activeTab === 'photos' && (
              <div className="mt-4 sm:mt-5 space-y-4">
                <div>
                  <div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Upload from device</div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)] py-3 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.1)] active:scale-95"
                  >
                    <Upload size={14} /> Attach personal photo
                  </button>
                </div>

                <div className="border-t border-[hsl(var(--border))] pt-4">
                  <div className="mb-2 font-mono-custom text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Haven Mood Photoprints</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {moodPhotos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => addPhoto(photo)}
                        className="group relative overflow-hidden rounded-xl border border-[hsl(var(--border))] transition-transform hover:scale-105 active:scale-95 text-left"
                      >
                        <img src={photo.url} alt={photo.label} className="h-20 w-full object-cover" />
                        <div className="p-1.5 text-[10px] font-medium text-[hsl(var(--foreground))]">{photo.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Paper Styles & Font Vibes */}
            {activeTab === 'vibe' && (
              <div className="mt-4 sm:mt-5 space-y-4 sm:space-y-5">
                <div>
                  <div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Paper Texture & Tone</div>
                  <div className="mt-2.5 space-y-2">
                    {Object.entries(paperStyles).map(([key, style]) => {
                      const isSelected = currentEntry?.paperStyle === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            updateCurrentEntry({ paperStyle: key });
                            setMobileJournalView('canvas');
                          }}
                          style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
                          className={`flex w-full items-center justify-between rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
                            isSelected ? 'ring-2 ring-[hsl(var(--primary))] shadow-sm' : 'opacity-85 hover:opacity-100'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{style.name}</div>
                            <div className="text-[10px] opacity-75">{style.desc}</div>
                          </div>
                          {isSelected && <Check size={14} style={{ color: style.accent }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[hsl(var(--border))] pt-4">
                  <div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Typography Vibe</div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {[
                      { id: 'serif', label: 'Serif' },
                      { id: 'handwritten', label: 'Script' },
                      { id: 'sans', label: 'Sans' },
                    ].map((font) => (
                      <button
                        key={font.id}
                        onClick={() => {
                          updateCurrentEntry({ fontStyle: font.id });
                          setMobileJournalView('canvas');
                        }}
                        className={`rounded-xl border py-2 text-center text-xs transition-colors ${
                          currentEntry?.fontStyle === font.id
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] font-bold'
                            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                      >
                        {font.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Custom Sticker Generator */}
            {activeTab === 'custom' && (
              <div className="mt-4 sm:mt-5 space-y-4">
                <div>
                  <div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Pick Emblem Icon</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                    {['🌿', '🌸', '✨', '🌙', '🌕', '🌊', '🔥', '🛡️', '💭', '☕', '🍂', '🕊️'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setCustomIcon(emoji)}
                        className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-base sm:text-lg transition-transform ${
                          customIcon === emoji ? 'bg-[hsl(var(--primary)/.2)] scale-110' : 'bg-[hsl(var(--muted))] hover:scale-105 active:scale-95'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Badge Motto / Word</div>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. My Anchor, Gratitude..."
                    className="mt-1.5 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))]"
                  />
                </div>

                <div>
                  <div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Color Palette</div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5 sm:gap-2">
                    {[
                      { bg: '#e8f0e9', color: '#3d6648', label: 'Sage' },
                      { bg: '#edf2f9', color: '#3b557a', label: 'Twilight' },
                      { bg: '#fcedf2', color: '#a84d68', label: 'Rose' },
                      { bg: '#fbf3e4', color: '#a87a2a', label: 'Amber' },
                    ].map((pal) => (
                      <button
                        key={pal.label}
                        onClick={() => {
                          setCustomBg(pal.bg);
                          setCustomColor(pal.color);
                        }}
                        style={{ backgroundColor: pal.bg, color: pal.color }}
                        className="rounded-xl border border-black/5 py-1.5 font-mono-custom text-[9px] font-bold shadow-sm"
                      >
                        {pal.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-3 text-center">
                  <div className="font-mono-custom text-[9px] uppercase text-[hsl(var(--muted-foreground))]">Stamp Preview</div>
                  <div
                    style={{ backgroundColor: customBg, color: customColor }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-2xl border border-black/10 px-3.5 py-1.5 font-mono-custom text-xs font-semibold shadow-md"
                  >
                    <span>{customIcon}</span>
                    <span>{customLabel || 'Motto'}</span>
                  </div>
                </div>

                <button
                  onClick={addCustomSticker}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] py-2.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-md hover:opacity-95 transition-transform active:scale-95"
                >
                  <Sparkles size={14} /> Stamp onto Journal
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function ResearchPage() {
  const analytics = useGetResearchAnalytics();
  const health = useHealthCheck();
  const data = analytics.data;
  const chartSeries = useMemo(() => data?.signalSeries ? [{ label: 'Confirmation bias', values: data.signalSeries.map((item) => item.confirmationBias) }, { label: 'Dependency', values: data.signalSeries.map((item) => item.dependency) }, { label: 'Distress', values: data.signalSeries.map((item) => item.distress) }] : [], [data]);

  return (
    <div className="haven-noise min-h-[100dvh] bg-[hsl(203_24%_17%)] text-[hsl(39_24%_91%)]">
      <header className="border-b border-[hsl(39_24%_91%/.12)] pl-16 pr-4 sm:px-6 md:px-12 py-4 sm:py-5">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <HavenMark size={28} />
            <div>
              <div className="font-mono-custom text-[9px] sm:text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Haven / research</div>
              <div className="mt-0.5 text-[11px] sm:text-xs text-[hsl(39_24%_91%/.5)] hidden xs:block">Anonymized observatory</div>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 font-mono-custom text-[9px] uppercase tracking-[.12em] text-[hsl(39_24%_91%/.5)] sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${health.isError ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent))]'}`} /> model {health.isLoading ? 'checking' : health.isError ? 'unavailable' : 'nominal'}
            </div>
            <Link href="/space" className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-[hsl(39_24%_91%/.2)] px-3 py-1.5 sm:py-2 text-[10px] uppercase tracking-[.1em] text-[hsl(39_24%_91%/.75)] hover:bg-[hsl(39_24%_91%/.08)]" data-testid="link-return-space">
              <ArrowLeft size={12} /> <span className="hidden xs:inline">Return to space</span><span className="xs:hidden">Space</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 sm:px-6 md:px-12 py-6 sm:py-10 md:py-14">
        <div className="mb-8 sm:mb-10 flex flex-wrap items-end justify-between gap-4 sm:gap-6">
          <div>
            <div className="font-mono-custom text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Research console · aggregate only</div>
            <h1 className="mt-2 sm:mt-3 font-display text-4xl sm:text-5xl md:text-6xl leading-tight">A system that<br /><em>knows its edges.</em></h1>
          </div>
          <div className="max-w-xs text-xs leading-5 text-[hsl(39_24%_91%/.5)]">No conversation content, identities, or personally identifying traces appear in this view.</div>
        </div>
        {analytics.isLoading ? (
          <div className="space-y-4 sm:space-y-5">
            <div className="h-28 sm:h-32 animate-pulse rounded-2xl bg-[hsl(39_24%_91%/.08)]" />
            <div className="h-64 sm:h-72 animate-pulse rounded-2xl bg-[hsl(39_24%_91%/.08)]" />
          </div>
        ) : analytics.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--destructive)/.4)] bg-[hsl(var(--destructive)/.1)] p-5 sm:p-6 text-sm" data-testid="status-research-error">
            <span>Research data is unavailable.</span>
            <button onClick={() => analytics.refetch()} className="inline-flex items-center gap-2 font-semibold" data-testid="button-retry-research"><RefreshCcw size={14} /> Retry</button>
          </div>
        ) : data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              {[['Conversations', data.conversations.total, 'all time'], ['Active now', data.conversations.active, 'last 24 hours'], ['Messages', data.conversations.messages, 'across sessions'], ['Avg. duration', data.conversations.averageDuration, 'per conversation']].map(([label, value, detail], index) => (
                <div key={String(label)} className={`rounded-2xl border p-3.5 sm:p-5 ${index === 0 ? 'border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.1)]' : 'border-[hsl(39_24%_91%/.12)] bg-[hsl(39_24%_91%/.045)]'}`}>
                  <div className="font-mono-custom text-[8px] sm:text-[9px] uppercase tracking-[.15em] text-[hsl(39_24%_91%/.5)] truncate">{label}</div>
                  <div className="mt-2 sm:mt-4 font-display text-2xl sm:text-3xl md:text-4xl">{value}</div>
                  <div className="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-[hsl(39_24%_91%/.4)] truncate">{detail}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
              <section className="rounded-2xl border border-[hsl(39_24%_91%/.12)] bg-[hsl(39_24%_91%/.045)] p-4 sm:p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                  <div>
                    <div className="font-mono-custom text-[9px] uppercase tracking-[.15em] text-[hsl(39_24%_91%/.45)]">Behavioral signals</div>
                    <h2 className="mt-1 sm:mt-2 font-display text-2xl sm:text-3xl">Pressure over time</h2>
                  </div>
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-[10px] text-[hsl(39_24%_91%/.55)]">
                    {chartSeries.map((item, index) => (
                      <span key={item.label} className="flex items-center gap-1.5">
                        <i className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-[hsl(var(--primary))]' : index === 1 ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(204_40%_55%)]'}`} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-6 sm:mt-8">
                  {chartSeries.length ? <MiniLineChart series={chartSeries} /> : <div className="flex h-44 sm:h-48 items-center justify-center text-xs sm:text-sm text-[hsl(39_24%_91%/.45)]">No signal series recorded.</div>}
                </div>
                <div className="mt-2 flex justify-between font-mono-custom text-[8px] sm:text-[9px] text-[hsl(39_24%_91%/.35)]">
                  {data.signalSeries?.map((item) => <span key={item.label}>{item.label}</span>)}
                </div>
              </section>
              <section className="rounded-2xl border border-[hsl(39_24%_91%/.12)] bg-[hsl(39_24%_91%/.045)] p-4 sm:p-6 md:p-8">
                <div className="font-mono-custom text-[9px] uppercase tracking-[.15em] text-[hsl(39_24%_91%/.45)]">Model status</div>
                <h2 className="mt-1 sm:mt-2 font-display text-2xl sm:text-3xl">{data.model.provider}</h2>
                <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
                  {[['Status', data.model.status], ['Average latency', data.model.averageLatency], ['Recorded failures', data.model.failures]].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between border-b border-[hsl(39_24%_91%/.1)] pb-2.5 sm:pb-3 text-xs">
                      <span className="text-[hsl(39_24%_91%/.48)]">{label}</span>
                      <span className="font-mono-custom text-[hsl(39_24%_91%/.8)]">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 sm:mt-8 flex items-start gap-2.5 rounded-xl bg-[hsl(var(--accent)/.1)] p-3.5 sm:p-4 text-xs leading-5 text-[hsl(39_24%_91%/.7)]">
                  <Zap size={14} className="mt-0.5 shrink-0 text-[hsl(var(--accent))]" /> Intervention levels are reviewed as signals for system design, never as a score of a person.
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function AboutPageRoute() {
  return (
    <Shell>
      <AboutPage />
    </Shell>
  );
}

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/" component={Threshold} />
        <Route path="/space" component={SpacePage} />
        <Route path="/journal" component={JournalPage} />
        <Route path="/reflections" component={ReflectionsPage} />
        <Route path="/about" component={AboutPageRoute} />
        <Route path="/research" component={ResearchPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;