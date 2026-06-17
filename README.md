# MantraCode

**MantraCode** is a terminal-based (TUI) AI coding assistant — an agentic code model that runs entirely in your terminal. It combines a rich React-based terminal UI with a lightweight Hono API server and PostgreSQL persistence.

> Built with [Bun](https://bun.sh), [OpenTUI](https://github.com/opentui/opentui), [Hono](https://hono.dev), [Prisma](https://prisma.io), and [TypeScript](https://www.typescriptlang.org).

---

## Architecture

This is a monorepo with four packages:

| Package | Description |
|---------|-------------|
| **`@mantracode/cli`** | React-based TUI client using OpenTUI — the main user-facing application |
| **`@mantracode/server`** | Hono HTTP API server powering the backend |
| **`@mantracode/database`** | Prisma schema, client, and PostgreSQL integration |
| **`@mantracode/shared`** | Shared types, Zod schemas, AI model definitions, and streaming protocol |

### Streaming Protocol

AI responses are streamed from the server to the CLI via **Server-Sent Events (SSE)** with Zod-validated event types:

- **`text-delta`** — Incremental text tokens as the model generates
- **`done`** — Stream completed with the final message ID and duration
- **`error`** — Stream terminated with an error message

The server tracks per-stream state (`StreamState` — controller, accumulated content, model, mode) in an in-memory map, enabling it to persist the authoritative accumulated text on interrupt rather than relying on client-supplied data.

### Letter-by-Letter Reveal

The CLI reveals incoming text gradually for a smooth reading experience. Tokens are buffered in a `fullTextRef` while an interval ticks to reveal characters into `displayedTextRef`. The reveal continues at an increased rate even after the stream finishes, ensuring the entire response is animated without a final jump.

---

## Features

- **Terminal-First TUI** — A rich, keyboard-driven interface powered by React + OpenTUI
- **Session Management** — Create, list, and view AI chat sessions persisted to PostgreSQL
- **Slash Commands** — `/new`, `/sessions`, `/theme`, `/models`, `/agents`, `/exit`, and more
- **Built-in Themes** — Catppuccin, Dracula, Tokyo Night, Nord, Rose Pine, and many others with live preview
- **Type-Safe RPC** — End-to-end type safety from server routes to the CLI via Hono's typed client
- **Server-Authoritative Interrupt Handling** — Interrupted streams persist the server's accumulated text, not client-supplied data
- **Per-Session Stream Serialization** — Active streams are tracked and concurrent submissions for the same session are rejected with 409
- **Smooth Letter-by-Letter Streaming** — Gradual character reveal with no final instant jump, at 4 chars per 16ms tick
- **Sentry Observability** — Error tracking on the server
- **Keyboard Layer System** — Stack-based keyboard focus management across input, command menu, and dialogs

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.x
- A PostgreSQL database (e.g., [Neon.tech](https://neon.tech))

### Setup

```bash
# Clone the repo
git clone https://github.com/AspireCalc/MantraCode.git
cd MantraCode

# Copy environment variables
cp .env.example .env
# Edit .env with your database URL and other config

# Install dependencies
bun install

# Generate the Prisma client
bun --cwd packages/database prisma generate

# Run database migrations
bun --cwd packages/database prisma migrate dev

# Start the server (in one terminal)
bun run dev:server

# Start the CLI (in another terminal)
bun run dev:cli
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev:server` | Start the Hono API server with hot reload |
| `bun run dev:cli` | Start the TUI client with watch mode |

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/:sessionId` | Submit a new user message and start streaming |
| `POST` | `/:sessionId/resume` | Resume streaming for the last pending user message |
| `POST` | `/:sessionId/interrupt` | Interrupt an active stream and persist server-accumulated text |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Server URL for the CLI client | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `GOOGLE_PROJECT_ID` | Google Project ID | — |
| `GOOGLE_VERTEX_LOCATION` | Google Vertext Location | `global` |
| `GOOGLE_VERTEX_PROJECT` | Google Vertext Project Name | — |
| `CLERK_OAUTH_CLIENT_SECRET` | Clerk OAuth Client Secret | — |
| `CLERK_OAUTH_CLIENT_ID` | Clerk OAuth Client ID | — |
| `CLERK_FRONTEND_API` | Clerk frontend API | — |
| `CLERK_SECRET_KEY` | Clerk Secret Key | — |
| `CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key | — |
| `JWT_SECRET` | JWT Secret | `jwt-secret` |

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Bun** | Runtime, package manager, and bundler |
| **TypeScript** | Strict, ESNext, `verbatimModuleSyntax` |
| **OpenTUI** | React-based terminal UI framework |
| **Hono** | Lightweight HTTP server |
| **Prisma 7** | ORM with PostgreSQL adapter |
| **Zod** | Runtime schema validation |
| **Sentry** | Error tracking and observability |
| **React 19** | Component model for the TUI |
| **AI SDK** | AI model invocation and streaming |

---

## Roadmap

- [x] Session CRUD (create, list, view)
- [x] TUI navigation, input, and routing
- [x] Theme system with persistence
- [x] AI model invocation and streaming
- [x] Server-authoritative interrupt handling
- [x] Per-session stream serialization
- [x] Smooth letter-by-letter reveal animation
- [ ] Agent/tool calling support
- [ ] Usage tracking and billing
- [ ] Authentication
- [ ] Session history browsing

---

## License

ISC

## Author

**Nishant Chauhan**

## Organisation

**AspireNX**