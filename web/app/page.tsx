"use client";

const INSTALL_CMD = "curl -fsSL https://mantracode.vercel.app/install.sh | sh";
const GITHUB_URL = "https://github.com/AspireCalc/MantraCode";

function Code({ children }: { children: string }) {
  return (
    <code className="bg-[#22222E] text-[#FF651D] px-2 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl sm:text-4xl font-bold text-center tracking-tight">
      {children}
    </h2>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[#A1A1AA] text-center mt-4 text-lg max-w-2xl mx-auto">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <>
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0E0E12]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">
            <span className="text-[#FF651D]">Mantra</span>Code
          </span>
          <div className="flex items-center gap-6 text-sm text-[#A1A1AA]">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#install" className="hover:text-white transition-colors">
              Install
            </a>
            <a href="#commands" className="hover:text-white transition-colors">
              Commands
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#FF651D10_0%,_transparent_60%)] pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#FF651D]/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-[#A1A1AA] mb-8">
            <span className="w-2 h-2 rounded-full bg-[#FF651D] animate-pulse" />
            v1.0.0 — Agentic AI in Your Terminal
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            <span className="text-[#FF651D]">Mantra</span>Code
          </h1>
          <p className="text-xl sm:text-2xl text-[#A1A1AA] mt-4 max-w-xl">
            An agentic AI coding assistant that runs entirely inside your
            terminal.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
            <button
              onClick={() => {
                navigator.clipboard.writeText(INSTALL_CMD);
                const el = document.getElementById("copy-feedback");
                if (el) {
                  el.textContent = "Copied!";
                  setTimeout(() => (el.textContent = "Copy"), 1500);
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF651D] text-white font-semibold hover:bg-[#FF8A4D] transition-colors text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span id="copy-feedback">Copy Install Command</span>
            </button>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-white font-semibold hover:bg-white/5 transition-colors text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>

        {/* TERMINAL MOCKUP */}
        <div className="relative z-10 mt-20 w-full max-w-3xl">
          <div className="rounded-xl border border-white/10 bg-[#0E0E12] overflow-hidden shadow-2xl">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-[#181820]">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-[#A1A1AA] font-mono">
                mantracode
              </span>
            </div>
            <div className="p-5 font-mono text-sm leading-relaxed">
              <p>
                <span className="text-green-400">user</span>
                <span className="text-[#A1A1AA]">@</span>
                <span className="text-[#FF651D]">workspace</span>
                <span className="text-[#A1A1AA]"> $ </span>
                <span className="text-white">mantracode</span>
              </p>
              <p className="mt-2 text-[#A1A1AA]">
                <span className="text-[#FF651D]">●</span> MantraCode v1.0.0
              </p>
              <p className="text-[#A1A1AA]">
                <span className="text-purple-400">●</span> Mode: BUILD
              </p>
              <p className="mt-3">
                <span className="text-white">Ask anything...</span>
                <span className="animate-pulse text-[#FF651D]">▊</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="px-6 py-24 max-w-6xl mx-auto scroll-mt-20"
      >
        <SectionTitle>
          Everything a developer needs, in one{" "}
          <span className="text-[#FF651D]">terminal</span>
        </SectionTitle>
        <SectionSubtitle>
          Dual agent modes, multiple AI models, file tooling, session history,
          and more — no context switching.
        </SectionSubtitle>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
                />
              </svg>
            }
            title="Dual Agent Modes"
            description={
              <>
                <Code>PLAN</Code> mode for read-only context discovery (search,
                read, grep). <Code>BUILD</Code> mode for full code generation
                and file modification.
              </>
            }
          />
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
            }
            title="Rich Terminal UI"
            description="Custom Markdown rendering, real-time code syntax highlighting (10+ languages), visual code diffs, collapsible reasoning trees, and letter-by-letter streaming reveal."
          />
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            }
            title="6 AI Models"
            description="Powered by Google Vertex AI — Gemini 2.5 Pro/Flash, Gemini 3.1 Pro/Flash, and more. Each with native thinking and reasoning support."
          />
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.036 1.007-1.875 2.25-1.875s2.25.84 2.25 1.875c0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z"
                />
              </svg>
            }
            title="7 Workspace Tools"
            description="Read, write, edit, glob, grep, bash, and list directory — all with path traversal protection and .env file restrictions."
          />
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            }
            title="Session Management"
            description="Persistent PostgreSQL storage, auto-naming via AI, history browser with search, and auto-resume of interrupted streams."
          />
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
            title="35+ Themes"
            description="Catppuccin, Dracula, Tokyo Night, Nord, and many more — with live preview and local persistence."
          />
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            }
            title="Auth & Billing"
            description="OAuth 2.0 PKCE via Clerk. INR-based credit system with Polar checkout, customer portal, and usage metering."
          />
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
                />
              </svg>
            }
            title="Smart Input"
            description="File @-mentions with auto-completion, multi-line paste collapse, keyboard-driven command menu — all inside a beautiful TUI."
          />
          <FeatureCard
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            }
            title="WebSocket Tunnel"
            description="Secure tunnel between the server and CLI for tool execution on your local filesystem — AI runs in the cloud, tools run on your machine."
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <SectionTitle>
          How it <span className="text-[#FF651D]">works</span>
        </SectionTitle>
        <SectionSubtitle>
          From install to productivity in under a minute.
        </SectionSubtitle>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            {
              step: "01",
              title: "Install",
              desc: "Run the one-liner curl command. It installs Bun (if needed) and sets up MantraCode globally.",
            },
            {
              step: "02",
              title: "Run",
              desc: "Type mantracode in any project directory. The terminal UI opens instantly.",
            },
            {
              step: "03",
              title: "Authenticate",
              desc: "Log in via browser (Clerk OAuth 2.0 PKCE) or skip for limited local use.",
            },
            {
              step: "04",
              title: "Code",
              desc: "Ask questions, generate code, debug issues, refactor files — all from your terminal.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[#FF651D]/10 border border-[#FF651D]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-[#FF651D] font-bold text-sm">
                  {item.step}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-[#A1A1AA] text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* INSTALL */}
      <section
        id="install"
        className="px-6 py-24 max-w-3xl mx-auto scroll-mt-20"
      >
        <SectionTitle>
          Get started in{" "}
          <span className="text-[#FF651D]">one command</span>
        </SectionTitle>
        <SectionSubtitle>
          Works on macOS and Linux. Requires Bun — the install script handles
          everything.
        </SectionSubtitle>

        <div className="mt-12 rounded-xl border border-white/10 bg-[#181820] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <span className="text-xs text-[#A1A1AA] font-mono">Terminal</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(INSTALL_CMD);
                const el = document.getElementById("copy-cmd-feedback");
                if (el) {
                  el.textContent = "Copied!";
                  setTimeout(() => (el.textContent = "Copy"), 1500);
                }
              }}
              className="text-xs text-[#A1A1AA] hover:text-white transition-colors"
            >
              <span id="copy-cmd-feedback">Copy</span>
            </button>
          </div>
          <div className="p-5 font-mono text-sm">
            <p>
              <span className="text-[#A1A1AA]">$ </span>
              <span className="text-white">{INSTALL_CMD}</span>
            </p>
            <p className="mt-2 text-[#A1A1AA]">
              <span className="text-green-400">#</span> Then run:
            </p>
            <p className="text-white">
              <span className="text-[#A1A1AA]">$ </span>mantracode
            </p>
            <p className="mt-3 text-xs text-[#A1A1AA] border-t border-white/5 pt-3">
              <span className="text-purple-400">Windows:</span>{" "}
              irm https://mantracode.vercel.app/install.ps1 | iex
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-[#181820] p-5">
          <h3 className="font-semibold text-sm mb-2">Prerequisites</h3>
          <ul className="text-sm text-[#A1A1AA] space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-[#FF651D] mt-0.5">▸</span>
              macOS 12+, Linux, or Windows (x86_64 / arm64)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF651D] mt-0.5">▸</span>
              Git (for repository-based workflows)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF651D] mt-0.5">▸</span>
              A Google Vertex AI project (for cloud-hosted models)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF651D] mt-0.5">▸</span>
              50MB free disk space
            </li>
          </ul>
        </div>
      </section>

      {/* CLI COMMANDS */}
      <section
        id="commands"
        className="px-6 py-24 max-w-4xl mx-auto scroll-mt-20"
      >
        <SectionTitle>
          <span className="text-[#FF651D]">Slash</span> Commands
        </SectionTitle>
        <SectionSubtitle>
          Everything you need at your fingertips. Press{" "}
          <Code>/</Code> in the input bar to open the command menu.
        </SectionSubtitle>

        <div className="mt-12 rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-[#181820]">
                <th className="text-left px-5 py-3 font-semibold text-[#A1A1AA]">
                  Command
                </th>
                <th className="text-left px-5 py-3 font-semibold text-[#A1A1AA]">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["/new", "Start a fresh conversation"],
                ["/reload", "Reload the current session"],
                ["/agents", "Switch between PLAN and BUILD modes"],
                ["/models", "Change the AI model"],
                ["/sessions", "Browse, search, and resume past sessions"],
                ["/theme", "Choose from 35+ themes with live preview"],
                ["/login", "Authenticate via browser (Clerk OAuth)"],
                ["/logout", "Clear credentials"],
                ["/upgrade", "Open Polar checkout for credits"],
                ["/usage", "Open Polar customer portal"],
                ["/profile", "View account info and credit balance"],
                ["/exit", "Quit MantraCode"],
              ].map(([cmd, desc]) => (
                <tr
                  key={cmd}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-[#FF651D]">
                    {cmd}
                  </td>
                  <td className="px-5 py-3 text-[#A1A1AA]">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODELS */}
      <section className="px-6 py-24 max-w-4xl mx-auto">
        <SectionTitle>
          Supported <span className="text-[#FF651D]">Models</span>
        </SectionTitle>
        <SectionSubtitle>
          Powered by Google Vertex AI — each model with native thinking and
          reasoning support.
        </SectionSubtitle>

        <div className="mt-12 rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-[#181820]">
                <th className="text-left px-5 py-3 font-semibold text-[#A1A1AA]">
                  Model
                </th>
                <th className="text-left px-5 py-3 font-semibold text-[#A1A1AA]">
                  Type
                </th>
                <th className="text-left px-5 py-3 font-semibold text-[#A1A1AA]">
                  Pricing (per 1M tokens)
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Gemini 2.5 Flash", "Flash", "₹5 / ₹20"],
                ["Gemini 2.5 Flash Lite", "Flash (Lite)", "₹3 / ₹12"],
                ["Gemini 2.5 Pro", "Pro", "₹15 / ₹60"],
                ["Gemini 3.1 Flash Lite", "Flash (Lite)", "₹3 / ₹12"],
                ["Gemini 3.1 Pro", "Pro", "₹15 / ₹60"],
                ["Gemini 3.5 Flash", "Flash", "₹5 / ₹20"],
              ].map(([model, type, price]) => (
                <tr
                  key={model}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-white">{model}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        type === "Pro"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : "bg-[#FF651D]/10 text-[#FF651D] border border-[#FF651D]/20"
                      }`}
                    >
                      {type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#A1A1AA] font-mono">
                    {price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <span className="font-bold text-white">
              <span className="text-[#FF651D]">Mantra</span>Code
            </span>
            <span>·</span>
            <span>Built by Nishant Chauhan</span>
            <span>·</span>
            <span>© {new Date().getFullYear()} AspireNX</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#A1A1AA]">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Issues
            </a>
            <a
              href={`${GITHUB_URL}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Releases
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="group rounded-xl border border-white/5 bg-[#181820] p-5 hover:border-[#FF651D]/20 hover:bg-[#1C1C28] transition-all duration-300">
      <div className="w-9 h-9 rounded-lg bg-[#FF651D]/10 border border-[#FF651D]/20 flex items-center justify-center text-[#FF651D] mb-3 group-hover:bg-[#FF651D]/15 transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-sm mb-2 text-white">{title}</h3>
      <p className="text-[#A1A1AA] text-sm leading-relaxed">{description}</p>
    </div>
  );
}
