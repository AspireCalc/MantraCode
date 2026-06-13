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
| **`@mantracode/database`** | Prisma schema, client, and PostgreSQL integration (Neon.tech) |
| **`@mantracode/shared`** | Shared types, Zod schemas, AI model definitions, and streaming protocol |

---

## Features

- **Terminal-First TUI** — A rich, keyboard-driven interface powered by React + OpenTUI
- **Session Management** — Create, list, and view AI chat sessions persisted to PostgreSQL
- **Slash Commands** — `/new`, `/sessions`, `/theme`, `/models`, `/agents`, `/exit`, and more
- **30 Built-in Themes** — Catppuccin, Dracula, Tokyo Night, Nord, Rose Pine, and many others with live preview
- **Type-Safe RPC** — End-to-end type safety from server routes to the CLI via Hono's typed client
- **AI Streaming Protocol** — Zod-validated streaming events (text deltas, reasoning, tool calls, errors)
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

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `APP_URL` | Server URL for the CLI client | `http://localhost:3000` |
| `SENTRY_DSN` | Sentry DSN for error tracking | — |
| `SENTRY_ENVIRONMENT` | Sentry environment tag | — |

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
| **Neon.tech** | Cloud PostgreSQL |

---

## Roadmap

- [x] Session CRUD (create, list, view)
- [x] TUI navigation, input, and routing
- [x] Theme system with persistence
- [ ] AI model invocation and streaming
- [ ] Agent/tool calling support
- [ ] Usage tracking and billing
- [ ] Authentication
- [ ] Session history browsing

---

## License

ISC

## Author

**Nishant Chauhan**
