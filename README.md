# MantraCode

**MantraCode** is an agentic AI coding assistant that runs entirely in your terminal. It integrates a rich, interactive, React-based terminal user interface (TUI) with a powerful tool-calling server, sandboxed local execution, PostgreSQL session storage, and Polar-powered billing & credits.

With MantraCode, you can choose to work in **PLAN** mode (read-only context discovery) or **BUILD** mode (full code generation, file modification, and CLI task execution) to let the AI solve complex software development tasks autonomously.

> Built with [Bun](https://bun.sh), [OpenTUI](https://github.com/opentui/opentui), [Hono](https://hono.dev), [Prisma 7](https://prisma.io), [Clerk](https://clerk.com), [Polar](https://polar.sh), and the [Vercel AI SDK](https://sdk.vercel.ai/).

---

## Key Highlights

- **Dual Operational Modes (Agents)**:
  - **PLAN Mode**: Safe, read-only exploration of code. The agent utilizes search and read tools (`grep`, `glob`, `readFile`, `listDirectory`) to design solutions and answer queries without modifying files.
  - **BUILD Mode**: Unlocks write and execution tools (`writeFile`, `editFile`, `bash`) to write code, modify files, and run tasks (tests, builds, commands) dynamically in the workspace.
- **Rich Terminal User Experience (TUI)**:
  - **Custom Markdown Rendering**: Fully styled text, lists, and tables inside the terminal.
  - **Code Syntax Highlighting**: Real-time terminal syntax-highlighting for code blocks (JS, TS, Python, Rust, Go, Java, C, C++, and more).
  - **Visual Code Diffs**: Highlights file edits using red/green comparison boxes (`DiffCodeBox`) directly in the scroll buffer.
  - **Collapsible Reasoning Trees**: Renders live thinking indicators (using Vertex AI's native reasoning tokens) with elapsed duration trackers and collapsible thought blocks.
  - **Letter-by-Letter Reveal Animation**: Smooth streaming output at 4 characters per 16ms tick.
- **Clerk OAuth 2.0 PKCE Loopback Auth**: Kicks off user authentication seamlessly inside the browser (via a local ephemeral callback server in the CLI and a proxy redirect on the API server) and securely stores session tokens in `~/.mantracode/auth.json`.
- **Slash Commands Menu**: Press `/` to interactively trigger commands to manage sessions, change models, switch modes (agents), configure live-preview themes, authenticate, upgrade credits, and more.
- **Vertex AI Integration**: Full support for 6 Google Vertex models with native reasoning/thinking budgets, including Claude models through Vertex AI's Anthropic integration.
- **Polar Billing & Credits System**: Integrated credits metering with INR-based pricing, usage tracking, checkout, and customer portal.
- **Smart Input Bar**: File `@`-mentions with auto-completion, multi-line paste collapse, and keyboard-driven command menu.
- **Auto-Resume on Interrupt**: Interrupted streams are automatically resumed when a session is reloaded.

---

## Architecture

MantraCode is structured as a TypeScript monorepo consisting of four packages:

| Package | Description |
|---------|-------------|
| **`@mantracode/cli`** | The main user-facing application — an interactive React-based TUI built on OpenTUI. |
| **`@mantracode/server`** | Hono HTTP API server powering the backend, managing streams, and invoking agentic tools. |
| **`@mantracode/database`** | Prisma schema, client, and migrations with PostgreSQL. |
| **`@mantracode/shared`** | Shared types, Zod schemas, model definitions (with INR pricing), and custom SSE event protocol definitions. |

```
                     ┌────────────────┐
                     │  MantraCode    │◀─── OAuth Success
                     │  CLI Client    │───┐ (Redirect loopback)
                     └────────────────┘   │
                       ▲            │     │
                   SSE │      HTTP  │     ▼
                Stream │      Auth  │   ┌──────────────┐
                       │      & Chat│   │ Web Browser  │
                       │            ▼   └──────────────┘
                     ┌────────────────┐
                     │  Hono Server   │
                     │ (API, Tools,   │
                     │  Billing)      │
                     └────────────────┘
                       ▲            │
            PostgreSQL │            │ Invoke Tools
                       ▼            ▼
                     ┌────┐     ┌──────────────┐
                     │ DB │     │ User's CWD   │
                     └────┘     │ Workspace    │
                                └──────────────┘
```

### Agentic Tool System

When the assistant is prompted, it dynamically evaluates the user's query and workspace context to decide if tools are needed. Trivial queries (greetings, thanks) skip tool calling entirely. Based on the selected **Agent Mode**, the server registers and grants access to the following workspace tools:

| Mode | Allowed Tools | Description |
|---|---|---|
| **PLAN & BUILD** | `listDirectory` | List file paths and directories in the user's workspace |
| **PLAN & BUILD** | `readFile` | Read the full contents of a workspace file (max 10,000 chars) |
| **PLAN & BUILD** | `glob` | Find files matching a glob pattern (uses `Bun.Glob`, max 200 results) |
| **PLAN & BUILD** | `grep` | Search file contents with a regular expression (max 50 matches) |
| **BUILD Only** | `writeFile` | Create or overwrite a file in the workspace (auto-creates parent dirs) |
| **BUILD Only** | `editFile` | Make targeted, surgical code modifications using exact string replacements |
| **BUILD Only** | `bash` | Execute shell commands (30s default timeout, 20k char output limit) |

All tools enforce path traversal prevention (must stay within project directory) and explicitly block access to `.env` and `.env.*` files for security.

---

## Slash Commands

Interact with the terminal client using the following slash commands inside the input bar:

| Command | Action | Description |
|---|---|---|
| **`/new`** | Start Fresh | Instantly starts a clean conversation session. |
| **`/reload`** | Refresh | Reloads the current session's conversation history. |
| **`/agents`** | Switch Modes | Opens a dialog to switch between **PLAN** and **BUILD** mode. |
| **`/models`** | Change LLM | Opens an interactive searchable list to switch the active generation model. |
| **`/sessions`** | History Browser | View, search, delete, and resume past chat sessions (categorized by date). |
| **`/theme`** | Custom Themes | Preview and select from 35+ built-in themes (Catppuccin, Dracula, Tokyo Night, Nord, etc.) with live preview (reverts on cancel). |
| **`/login`** | Authenticate | Launches browser-based Clerk OAuth authentication. |
| **`/logout`** | Clear Auth | Discards local credentials. |
| **`/upgrade`** | Buy Credits | Opens Polar checkout to purchase more credits. |
| **`/usage`** | Billing Portal | Opens Polar customer portal in your browser. |
| **`/exit`** | Quit | Closes the TUI. |

---

## Supported Models

All models are served through **Google Vertex AI** (with Claude models available via Vertex's Anthropic integration):

| Model ID | Thinking Config | Pricing (INR per 1M tokens) |
|---|---|---|
| `gemini-3.5-flash` | High thinking level | ₹142.5 input / ₹855 output |
| `gemini-3.1-pro-preview` | High thinking level | ₹190 input / ₹1,140 output |
| `gemini-3.1-flash-lite` | Medium thinking level | ₹23.75 input / ₹142.5 output |
| `gemini-2.5-pro` | Budget: 2048 tokens | ₹118.75 input / ₹950 output |
| `gemini-2.5-flash` | Budget: 2048 tokens | ₹28.5 input / ₹237.5 output |
| `gemini-2.5-flash-lite` | Budget: 1024 tokens | ₹9.5 input / ₹38 output |

Default model: `gemini-3.5-flash`. Credits are calculated from token usage at a rate of 1 credit = ₹0.01.

---

## Tech Stack

- **Bun**: Ultra-fast JS/TS runtime, package manager, and development server.
- **React 19 & OpenTUI**: Rich component architecture for the terminal.
- **Hono**: High-performance HTTP server with end-to-end type-safe RPC client integration.
- **Vercel AI SDK**: Multi-model streaming, tool calling, and structured outputs (v6).
- **Clerk**: Secure, cloud-hosted authentication.
- **Polar**: Billing platform for credits checkout, customer portal, and usage metering.
- **Prisma 7 & PostgreSQL**: Persistent storage for session histories, workspace state, and messages.
- **Sentry**: High-fidelity observability, error-logging, and metrics on the server.
- **Zod 4**: Runtime schema validation and type inference.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.x
- A PostgreSQL database instance (local or hosted, e.g. [Neon](https://neon.tech))
- Google Cloud Vertex AI credentials (service account with Vertex AI API enabled)
- Clerk API keys (Frontend API + OAuth client ID + Secret Key + Publishable Key)
- Polar access token and product/credit meter IDs (for billing)

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AspireCalc/MantraCode.git
   cd MantraCode
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```

3. **Install Dependencies**:
   ```bash
   bun install
   ```

4. **Prepare the Database**:
   ```bash
   # Generate Prisma client
   bun --cwd packages/database prisma generate

   # Push or migrate the schema
   bun --cwd packages/database prisma migrate dev
   ```

5. **Run Applications**:
   Start the Hono API server:
   ```bash
   bun run dev:server
   ```
   In a separate terminal tab, run the CLI client:
   ```bash
   bun run dev:cli
   ```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Server endpoint accessible by the CLI | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection URL | — |
| `GOOGLE_PROJECT_ID` | Google Cloud project ID (fallback) | — |
| `GOOGLE_VERTEX_PROJECT` | Vertex AI project name | — |
| `GOOGLE_VERTEX_LOCATION` | Vertex AI regional endpoint | `global` |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID (fallback) | — |
| `CLERK_SECRET_KEY` | Clerk secret backend key | — |
| `CLERK_PUBLISHABLE_KEY` | Clerk public publishable key | — |
| `CLERK_FRONTEND_API` | Clerk Frontend API endpoint | — |
| `CLERK_OAUTH_CLIENT_ID` | Clerk OAuth client ID | — |
| `POLAR_ACCESS_TOKEN` | Polar API access token | — |
| `POLAR_PRODUCT_ID` | Polar product ID for credit purchases | — |
| `POLAR_CREDITS_METER_ID` | Polar credits meter ID for usage tracking | — |
| `POLAR_SERVER` | Polar environment | `sandbox` |

---

## Roadmap

- [x] Session CRUD (create, list, view, delete, search)
- [x] Rich TUI layout, multi-line navigation, and viewport routing
- [x] Theme system with 35+ themes, local persistence, and real-time live preview
- [x] AI model streaming with custom Server-Sent Events (SSE) protocol (6 event types)
- [x] Server-authoritative stream interrupt handling on cancel
- [x] Per-session concurrent stream serialization (409 lockouts)
- [x] Smooth letter-by-letter reveal animation (4 chars/16ms)
- [x] Dual-mode agentic tool calling (PLAN & BUILD) with 50-step hard limit
- [x] Full local workspace filesystem tool implementations (`readFile`, `writeFile`, `editFile`, `bash`, `glob`, `grep`, `listDirectory`)
- [x] `.env` file security restriction across all tools
- [x] Clerk OAuth 2.0 PKCE loopback CLI authentication
- [x] Custom terminal Markdown, live syntax highlighting (10+ languages), code diff renders, and expandable reasoning steps
- [x] Polar billing integration — checkout, customer portal, credits metering, usage ingestion
- [x] INR-based credit calculation from token usage
- [x] Credit balance middleware (402 when out of credits)
- [x] Smart input bar with file `@`-mentions and paste-collapse
- [x] Auto-resume interrupted streams on session reload
- [x] Session auto-naming via Vertex AI
- [x] Trivial query detection (greetings skip tool calling)
- [ ] Multi-user usage metrics dashboard

---

## Stream Protocol (SSE)

The server streams AI responses using a custom SSE protocol with the following event types:

| Event | Payload | Description |
|---|---|---|
| `text-delta` | `{ content: string }` | Text content chunks |
| `reasoning-delta` | `{ content: string }` | Reasoning/thinking chunks |
| `tool-call` | `{ id, name, args }` | Tool invocation |
| `tool-result` | `{ id, name, result }` | Tool execution result |
| `done` | `{ messageId, durationMs }` | Stream complete |
| `error` | `{ error }` | Error message |

---

## License

ISC

## Author

**Nishant Chauhan**

## Organisation

**AspireNX**
