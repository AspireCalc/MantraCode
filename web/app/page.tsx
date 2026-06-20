"use client";

import { useEffect, useState } from "react";

const UNIX_CMD = "curl -fsSL https://mantracode.vercel.app/install.sh | sh";
const WINDOWS_CMD = "irm https://mantracode.vercel.app/install.ps1 | iex";
const GITHUB_URL = "https://github.com/AspireCalc/MantraCode";
const THEME_STORAGE_KEY = "mantracode-theme";

if (typeof document !== "undefined") {
  const id = "mantracode-page-style";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .hero-grid {
        background-color: var(--bg);
        background-image:
          linear-gradient(rgba(120,120,120,0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(120,120,120,0.08) 1px, transparent 1px);
        background-size: 42px 42px;
      }
      [data-theme="dark"] .hero-grid {
        background-image:
          linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
      }

      .section-shell {
        position: relative;
      }

      .soft-panel {
        background: color-mix(in srgb, var(--bg-secondary) 92%, transparent);
        backdrop-filter: blur(10px);
      }

      .hairline {
        border-color: color-mix(in srgb, var(--border) 82%, transparent);
      }

      .terminal-glow {
        box-shadow:
          0 20px 60px rgba(0, 0, 0, 0.16),
          0 0 0 1px color-mix(in srgb, var(--border) 90%, transparent);
      }

      .mantra-divider {
        height: 1px;
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--border) 85%, transparent),
          transparent
        );
      }

      .hero-orb {
        background:
          radial-gradient(circle at center, rgba(0, 184, 148, 0.16), transparent 65%);
        filter: blur(50px);
      }
    `;
    document.head.appendChild(style);
  }
}

type Theme = "light" | "dark";

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  } catch {}

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

function Code({ children }: { children: string }) {
  return (
    <code className="bg-(--bg-tertiary) text-mantra px-2 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.22em] text-mantra font-semibold">
      {children}
    </p>
  );
}

function SectionTitle({
  children,
  center = false,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <h2
      className={`text-3xl sm:text-4xl font-bold tracking-tight text-(--text-bold) ${
        center ? "text-center" : ""
      }`}
    >
      {children}
    </h2>
  );
}

function SectionSubtitle({
  children,
  center = false,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <p
      className={`text-(--text-muted) mt-4 text-lg max-w-2xl ${
        center ? "text-center mx-auto" : ""
      }`}
    >
      {children}
    </p>
  );
}

function CopyButton({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 rounded-lg border border-(--border-subtle) px-3 py-2 text-xs font-medium text-(--text-muted) hover:text-(--text-bold) hover:border-mantra/30 transition-colors ${className}`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function InstallCommandRow({
  label,
  command,
}: {
  label: string;
  command: string;
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--bg) overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-(--border-subtle) bg-(--bg-secondary)">
        <span className="text-xs font-mono text-(--text-muted)">{label}</span>
        <CopyButton value={command} />
      </div>
      <div className="px-4 py-4 font-mono text-sm overflow-x-auto">
        <span className="text-mantra mr-2">{label === "PowerShell" ? "PS>" : "$"}</span>
        <span className="text-(--text-bold) whitespace-nowrap">{command}</span>
      </div>
    </div>
  );
}

function HeroCommandPill() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(UNIX_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy install command"
      className="group mt-8 flex items-center gap-3 rounded-xl border border-(--border) bg-(--bg-secondary) px-4 py-3 text-sm font-mono hover:border-mantra/35 transition-all duration-200 w-full max-w-2xl text-left"
    >
      <span className="text-mantra select-none shrink-0">$</span>
      <span className="flex-1 text-(--text-bold) truncate">{UNIX_CMD}</span>
      <span className="shrink-0 flex items-center gap-1 text-xs text-(--text-muted) group-hover:text-mantra transition-colors">
        {copied ? "Copied!" : "Copy"}
      </span>
    </button>
  );
}

function TerminalPreview() {
  return (
    <div className="rounded-2xl border border-(--border) bg-(--bg) overflow-hidden terminal-glow">
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border-subtle) bg-(--bg-secondary)">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs font-mono text-(--text-muted)">workspace · mantracode</span>
      </div>

      <div className="p-5 sm:p-6 font-mono text-sm leading-relaxed">
        <p>
          <span className="text-green-400">user</span>
          <span className="text-(--text-muted)">@</span>
          <span className="text-mantra">workspace</span>
          <span className="text-(--text-muted)"> $ </span>
          <span className="text-(--text-bold)">mantracode</span>
        </p>

        <div className="mt-4 space-y-1 text-(--text-muted)">
          <p>
            <span className="text-mantra">●</span> MantraCode v1.0.0
          </p>
          <p>
            <span className="text-purple-400">●</span> Mode: BUILD
          </p>
          <p>
            <span className="text-sky-400">●</span> Model: Gemini 2.5 Pro
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-(--border-subtle) bg-(--bg-secondary) p-4">
          <p className="text-(--text-bold)">
            Refactor the auth flow, improve loading states, and generate the updated API handlers.
          </p>
        </div>

        <div className="mt-5 space-y-2 text-(--text-muted)">
          <p>
            <span className="text-mantra">›</span> Inspecting routes, middleware, and session helpers…
          </p>
          <p>
            <span className="text-mantra">›</span> Updating files with new auth guard logic…
          </p>
          <p>
            <span className="text-mantra">›</span> Preparing patch and follow-up steps…
          </p>
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--bg-secondary) px-4 py-4">
      <p className="text-lg font-semibold text-(--text-bold)">{value}</p>
      <p className="mt-1 text-sm text-(--text-muted)">{label}</p>
    </div>
  );
}

function FeatureTile({
  title,
  description,
  badge,
  className = "",
}: {
  title: string;
  description: string;
  badge: string;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 sm:p-6 ${className}`}
    >
      <span className="inline-flex rounded-full border border-mantra/20 bg-mantra/10 px-2.5 py-1 text-[11px] font-mono text-mantra">
        {badge}
      </span>
      <h3 className="mt-4 text-lg sm:text-xl font-semibold tracking-tight text-(--text-bold)">
        {title}
      </h3>
      <p className="mt-3 text-sm sm:text-base text-(--text-muted) leading-relaxed">
        {description}
      </p>
    </article>
  );
}

function FlowCard({
  step,
  title,
  desc,
}: {
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-(--border) bg-(--bg-secondary) p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl border border-mantra/20 bg-mantra/10 text-sm font-mono font-bold text-mantra">
          {step}
        </span>
        <div className="h-px flex-1 mantra-divider" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-(--text-bold)">
        {title}
      </h3>
      <p className="mt-2 text-sm text-(--text-muted) leading-relaxed">{desc}</p>
    </div>
  );
}

function CommandCard({
  cmd,
  desc,
}: {
  cmd: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--bg-secondary) p-4">
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex rounded-lg border border-mantra/20 bg-mantra/10 px-3 py-1.5 text-sm font-mono text-mantra">
          {cmd}
        </span>
      </div>
      <p className="mt-3 text-sm text-(--text-muted) leading-relaxed">{desc}</p>
    </div>
  );
}

function ModelCard({
  name,
  type,
  price,
}: {
  name: string;
  type: string;
  price: string;
}) {
  const chipClass =
    type === "Pro"
      ? "border-purple-500/20 bg-purple-500/10 text-purple-400"
      : type.includes("Lite")
      ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
      : "border-mantra/20 bg-mantra/10 text-mantra";

  return (
    <div className="rounded-2xl border border-(--border) bg-(--bg-secondary) p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-(--text-bold)">
            {name}
          </h3>
          <p className="mt-1 text-sm text-(--text-muted)">Native reasoning support on Vertex AI.</p>
        </div>
        <span className={`inline-flex text-nowrap rounded-full border px-2.5 py-1 text-xs ${chipClass}`}>
          {type}
        </span>
      </div>
      <div className="mt-5 pt-4 border-t border-(--border-subtle)">
        <p className="text-[11px] uppercase tracking-[0.2em] text-(--text-muted)">
          Pricing / 1M tokens
        </p>
        <p className="mt-1 text-sm font-mono text-(--text-bold)">{price}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = getPreferredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    applyTheme(theme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme, mounted]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      try {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === "light" || storedTheme === "dark") return;
      } catch {}

      const nextTheme: Theme = event.matches ? "dark" : "light";
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-nav/90 backdrop-blur-md border-b border-(--border-subtle)">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">
            <span className="text-mantra">Mantra</span> Code
          </span>

          <div className="hidden md:flex items-center gap-6 text-sm text-(--text-muted)">
            <a href="#features" className="hover:text-(--text-bold) transition-colors">
              Features
            </a>
            <a href="#install" className="hover:text-(--text-bold) transition-colors">
              Install
            </a>
            <a href="#commands" className="hover:text-(--text-bold) transition-colors">
              Commands
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-(--text-bold) transition-colors"
            >
              GitHub
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#install"
              className="hidden sm:inline-flex items-center rounded-lg bg-mantra px-4 py-2 text-sm font-semibold text-white hover:bg-mantra-light transition-colors"
            >
              Install
            </a>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-(--overlay) transition-colors text-(--text-muted) hover:text-(--text-bold)"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      <section className="hero-grid relative overflow-hidden px-6 pt-28 pb-20 sm:pt-32 sm:pb-24 min-h-screen flex items-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="hero-orb absolute top-[-8rem] left-1/2 -translate-x-1/2 w-[36rem] h-[36rem]" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 90% 70% at 50% 12%, transparent 35%, var(--bg, #ffffff) 78%)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-(--border) bg-(--overlay) text-sm text-(--text-muted)">
              <span className="w-2 h-2 rounded-full bg-mantra animate-pulse" />
              v1.0.0 · Agentic AI in your terminal
            </div>

            <h1 className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-(--text-bold)">
              Code faster
              <br />
              without leaving
              <br />
              <span className="text-mantra">your terminal.</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-(--text-muted) max-w-xl leading-relaxed">
              MantraCode is an AI coding assistant built for terminal-native development:
              inspect context, edit files, switch models, and ship changes without
              breaking your flow.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href="#install"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-mantra text-white font-semibold hover:bg-mantra-light transition-colors text-sm"
              >
                Install MantraCode
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>

              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-(--border) text-(--text-bold) font-semibold hover:bg-(--overlay) transition-colors text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                View on GitHub
              </a>
            </div>

            <HeroCommandPill />

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
              <HeroStat value="6 models" label="Switch across Gemini tiers." />
              <HeroStat value="7 tools" label="Read, edit, grep, shell, and more." />
              <HeroStat value="2 modes" label="PLAN for context, BUILD for execution." />
            </div>
          </div>

          <div className="relative">
            <TerminalPreview />
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-24 max-w-6xl mx-auto scroll-mt-20 section-shell">
        <div className="max-w-3xl">
          <SectionEyebrow>Features</SectionEyebrow>
          <div className="mt-4">
            <SectionTitle>
              Everything you need to work inside one{" "}
              <span className="text-mantra">terminal workflow</span>
            </SectionTitle>
          </div>
          <SectionSubtitle>
            Model access, workspace tooling, session continuity, and terminal-native controls
            designed to stay out of your way while you build.
          </SectionSubtitle>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <FeatureTile
            badge="Modes"
            title="PLAN before BUILD."
            description="Separate discovery from execution so you can inspect context first and only modify files when you actually mean to."
            className="xl:col-span-2"
          />
          <FeatureTile
            badge="Models"
            title="Switch model tiers."
            description="Move between faster flash models and deeper pro models depending on latency, cost, and reasoning needs."
          />
          <FeatureTile
            badge="Tools"
            title="Operate on real files."
            description="Read, write, edit, grep, list directories, and run shell commands without jumping into separate utilities."
          />
          <FeatureTile
            badge="Interface"
            title="Readable terminal output."
            description="Streaming responses, markdown rendering, syntax highlighting, diffs, and structured output keep long sessions usable."
          />
          <FeatureTile
            badge="Sessions"
            title="Resume where you left off."
            description="Keep session history, revisit past threads, and continue interrupted work instead of restarting from zero."
          />
          <FeatureTile
            badge="Customization"
            title="Themes that fit your setup."
            description="Choose from multiple terminal themes with persistent preferences and a UI that still prioritizes clarity over decoration."
          />
          <FeatureTile
            badge="Account"
            title="Auth, usage, billing."
            description="Handle login, usage, and credits from the same product surface without fragmenting the workflow."
          />
        </div>
      </section>

      <section className="px-6 py-24 max-w-6xl mx-auto section-shell">
        <div className="max-w-3xl">
          <SectionEyebrow>Workflow</SectionEyebrow>
          <div className="mt-4">
            <SectionTitle>
              From install to productive in a few{" "}
              <span className="text-mantra">terminal steps</span>
            </SectionTitle>
          </div>
          <SectionSubtitle>
            Start in the shell, connect your workspace, and move straight into actual coding work.
          </SectionSubtitle>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <FlowCard
            step="01"
            title="Install"
            desc="Run one command and let the installer handle setup, including Bun when required."
          />
          <FlowCard
            step="02"
            title="Open project"
            desc="Launch MantraCode from any repository or working directory with a single terminal command."
          />
          <FlowCard
            step="03"
            title="Authenticate"
            desc="Sign in through the browser for full cloud access, or continue with limited local usage."
          />
          <FlowCard
            step="04"
            title="Build"
            desc="Inspect files, generate code, refactor logic, and debug issues without leaving the terminal."
          />
        </div>
      </section>

      <section id="install" className="px-6 py-24 max-w-6xl mx-auto scroll-mt-20 section-shell">
        <div className="rounded-3xl border border-(--border) bg-(--bg-secondary) overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="p-8 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-(--border-subtle)">
              <SectionEyebrow>Install</SectionEyebrow>
              <div className="mt-4">
                <SectionTitle>
                  Get started in <span className="text-mantra">one command</span>
                </SectionTitle>
              </div>
              <SectionSubtitle>
                Install MantraCode on macOS, Linux, or Windows, then run it inside any project directory.
              </SectionSubtitle>

              <div className="mt-8 space-y-3 text-sm text-(--text-muted)">
                <div className="flex items-start gap-3">
                  <span className="text-mantra mt-0.5">▸</span>
                  <span>macOS 12+, Linux, or Windows (x86_64 / arm64).</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-mantra mt-0.5">▸</span>
                  <span>Git for repository-based workflows.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-mantra mt-0.5">▸</span>
                  <span>Google Vertex AI project for cloud-hosted models.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-mantra mt-0.5">▸</span>
                  <span>About 50MB of free disk space.</span>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-(--border-subtle) bg-(--bg) p-4">
                <p className="text-sm text-(--text-muted)">
                  After install, run <Code>mantracode</Code> in any project folder.
                </p>
              </div>
            </div>

            <div className="p-8 sm:p-10 lg:p-12">
              <div className="space-y-4">
                <InstallCommandRow label="macOS / Linux" command={UNIX_CMD} />
                <InstallCommandRow label="PowerShell" command={WINDOWS_CMD} />
              </div>

              <div className="mt-6 rounded-2xl border border-(--border) bg-(--bg) overflow-hidden">
                <div className="px-4 py-3 border-b border-(--border-subtle) bg-(--bg-secondary)">
                  <span className="text-xs font-mono text-(--text-muted)">Next step</span>
                </div>
                <div className="p-4 font-mono text-sm">
                  <span className="text-mantra">$</span>
                  <span className="ml-2 text-(--text-bold)">mantracode</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="commands" className="px-6 py-24 max-w-6xl mx-auto scroll-mt-20 section-shell">
        <div className="max-w-3xl">
          <SectionEyebrow>Commands</SectionEyebrow>
          <div className="mt-4">
            <SectionTitle>
              <span className="text-mantra">Slash</span> commands for fast control
            </SectionTitle>
          </div>
          <SectionSubtitle>
            Open the command menu with <Code>/</Code> and switch sessions, models, themes,
            and account actions without breaking flow.
          </SectionSubtitle>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <CommandCard cmd="/new" desc="Start a fresh conversation." />
          <CommandCard cmd="/reload" desc="Reload the current session." />
          <CommandCard cmd="/agents" desc="Switch between PLAN and BUILD modes." />
          <CommandCard cmd="/models" desc="Change the active AI model." />
          <CommandCard cmd="/sessions" desc="Browse, search, and resume past sessions." />
          <CommandCard cmd="/theme" desc="Switch themes with live preview." />
          <CommandCard cmd="/login" desc="Authenticate via browser." />
          <CommandCard cmd="/logout" desc="Clear credentials." />
          <CommandCard cmd="/upgrade" desc="Open checkout for more credits." />
          <CommandCard cmd="/usage" desc="Open the customer portal." />
          <CommandCard cmd="/profile" desc="View account info and credit balance." />
          <CommandCard cmd="/exit" desc="Quit MantraCode." />
        </div>
      </section>

      <section className="px-6 py-24 max-w-6xl mx-auto section-shell">
        <div className="max-w-3xl">
          <SectionEyebrow>Models</SectionEyebrow>
          <div className="mt-4">
            <SectionTitle>
              Supported <span className="text-mantra">models</span>
            </SectionTitle>
          </div>
          <SectionSubtitle>
            Choose faster flash tiers for responsiveness or pro tiers for deeper reasoning and more complex coding work.
          </SectionSubtitle>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <ModelCard name="Gemini 2.5 Flash" type="Flash" price="₹5 / ₹20" />
          <ModelCard name="Gemini 2.5 Flash Lite" type="Flash Lite" price="₹3 / ₹12" />
          <ModelCard name="Gemini 2.5 Pro" type="Pro" price="₹15 / ₹60" />
          <ModelCard name="Gemini 3.1 Flash Lite" type="Flash Lite" price="₹3 / ₹12" />
          <ModelCard name="Gemini 3.1 Pro" type="Pro" price="₹15 / ₹60" />
          <ModelCard name="Gemini 3.5 Flash" type="Flash" price="₹5 / ₹20" />
        </div>
      </section>

      <footer className="border-t border-(--border-subtle) px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-(--text-muted)">
            <span className="font-bold text-(--text-bold)">
              <span className="text-mantra">Mantra</span> Code
            </span>
            <span>·</span>
            <span>Built by Nishant Chauhan</span>
            <span>·</span>
            <span>© {new Date().getFullYear()} AspireNX</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-(--text-muted)">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-(--text-bold) transition-colors"
            >
              GitHub
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-(--text-bold) transition-colors"
            >
              Issues
            </a>
            <a
              href={`${GITHUB_URL}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-(--text-bold) transition-colors"
            >
              Releases
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}