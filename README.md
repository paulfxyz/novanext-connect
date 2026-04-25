# NovaNEXT Connect

[![Version](https://img.shields.io/badge/version-1.0.0-2020C8?style=flat-square&logo=github)](https://github.com/paulfxyz/novanext-connect)
[![License](https://img.shields.io/badge/license-MIT-00E5D0?style=flat-square)](LICENSE)
[![Stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20SQLite-E040FB?style=flat-square)](https://github.com/paulfxyz/novanext-connect)
[![AI](https://img.shields.io/badge/AI-OpenRouter%20Multi--Model-2020C8?style=flat-square)](https://openrouter.ai)
[![Conference](https://img.shields.io/badge/NovaNEXT-Aveiro%2C%2017%20June%202026-00E5D0?style=flat-square)](https://www.novanext.global)

> **AI-powered networking intelligence for NovaNEXT 2026 — Aveiro, Portugal.**

NovaNEXT Connect is a mobile-first web application that turns conference networking into a searchable, beautiful directory. Add attendees, speakers, founders and investors — the AI researches them automatically using 3 models simultaneously (Claude · Gemini · GPT-4o), deduplicates, and returns rich profile suggestions.

---

## ✨ Features

| Feature | Description |
|---|---|
| **🔍 Attendee Directory** | Searchable public card wall with instant filtering |
| **⚡ AI Research** | Type a name → 3 models research in parallel → curated suggestions |
| **🃏 Suggestion Cards** | Confidence score, "why here" reasoning, social links preview |
| **🔐 Admin Panel** | PIN-protected (`/admin`, PIN: `0000`) with full CRUD |
| **📱 Mobile-first** | Designed for conference networking on phone |
| **🌊 NovaNEXT Design** | Electric blue + cyan + magenta palette matching NovaNEXT brand |
| **🇵🇹 Context-aware** | AI prioritises Portuguese/Lusophone tech ecosystem matches |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/paulfxyz/novanext-connect
cd novanext-connect
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5000`.

### Production Build

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

---

## 🏗️ Architecture

```
novanext-connect/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── home.tsx      # Public attendee directory
│       │   ├── contact.tsx   # Individual profile page
│       │   ├── admin.tsx     # Admin dashboard (research + entries)
│       │   └── admin-login.tsx # PIN authentication
│       └── index.css         # NovaNEXT design system tokens
├── server/
│   ├── routes.ts             # Express API + OpenRouter integration
│   └── storage.ts            # Drizzle ORM + SQLite (better-sqlite3)
├── shared/
│   └── schema.ts             # Data models (contacts, companies)
└── data.db                   # SQLite database (persists across restarts)
```

### API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/contacts` | All contacts (public) |
| `GET` | `/api/contacts/search?q=` | Search contacts |
| `GET` | `/api/contacts/:slug` | Single contact profile |
| `POST` | `/api/admin/research` | AI-powered person/company lookup |
| `POST` | `/api/admin/contacts` | Add contact |
| `PATCH` | `/api/admin/contacts/:id` | Update contact |
| `DELETE` | `/api/admin/contacts/:id` | Remove contact |

### AI Research Engine

The `/api/admin/research` endpoint queries **3 AI models in parallel** via OpenRouter:

1. `anthropic/claude-3.5-haiku` — strong reasoning about Portuguese tech ecosystem
2. `google/gemini-flash-1.5` — fast, broad knowledge
3. `openai/gpt-4o-mini` — reliable world knowledge

Results are deduplicated by name, merged, sorted by confidence, and returned as structured JSON with:
- Name, title, bio, location
- Social links (LinkedIn, Twitter, GitHub, website)
- Tags, company affiliation
- **Confidence score** (0–1)
- **"Why here" reasoning** — why this person is likely at NovaNEXT Portugal 2026

### Homonym Resolution

The AI prompt explicitly instructs models to prioritise **Portuguese/Lusophone tech context** when multiple people share the same name. Each suggestion includes a "reason" field explaining the contextual match. Users select the correct profile from the card stack.

---

## 🎨 Design System

NovaNEXT Connect mirrors the NovaNEXT brand:

| Token | Value | Usage |
|---|---|---|
| `--nova-blue` | `#2020C8` | Primary surfaces, CTAs |
| `--nova-blue-bright` | `#3535EE` | Hover states |
| `--nova-cyan` | `#00E5D0` | Accent, highlights |
| `--nova-pink` | `#E040FB` | Secondary accent |
| `--nova-dark` | `#080818` | Background |
| `--font-display` | Cabinet Grotesk | Headings (Fontshare) |
| `--font-body` | Satoshi | Body text (Fontshare) |

---

## 🔐 Security

- Admin access protected by 4-digit PIN (default: `0000`)
- Session stored in `sessionStorage` (cleared on tab close)
- All admin routes require POST body validation (Zod)
- OpenRouter API key is server-side only

---

## 📝 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v3 + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: SQLite via `better-sqlite3` + Drizzle ORM
- **AI**: OpenRouter (Claude 3.5 Haiku + Gemini Flash 1.5 + GPT-4o Mini)
- **Routing**: Wouter (hash-based for iframe compatibility)
- **State**: TanStack Query v5

---

## 📋 Roadmap

- [ ] Avatar image upload support
- [ ] Export to CSV/PDF
- [ ] QR code per contact for quick sharing
- [ ] Event schedule integration
- [ ] Real-time attendee count
- [ ] Offline-capable PWA

---

## 🤝 Contributing

Built for NovaNEXT 2026 by [Paul Fleury](https://www.linkedin.com/in/paulfxyz/) with AI assistance.

---

*NovaNEXT Connect — Built for the future, at the future.*
