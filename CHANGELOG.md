# Changelog

All notable changes to NovaNEXT Connect are documented here.
Format: [Semantic Versioning](https://semver.org/)

---

## [1.0.0] — 2026-04-25

### 🎉 Initial Release — Built live at NovaNEXT showcase

This version was built in a single live session to demonstrate the power of AI-assisted development. From blank canvas to deployed application in under 30 minutes.

### Added

#### Public Interface
- **Attendee directory** — mobile-first card wall with all registered contacts
- **Live search** — debounced, instant search across name, company, title, bio, tags
- **Contact profiles** — individual pages with full bio, social links, tags
- **Stats bar** — real-time attendee count and search result count
- **Empty states** — clear messaging when no results or no data yet

#### Admin Panel (`/admin`)
- **PIN authentication** — 4-digit PIN gate (`0000`), auto-submit on 4th digit, shake animation on wrong entry
- **AI Research tab** — search by name/company, queries 3 AI models simultaneously
- **Suggestion cards** — stacked card view with confidence meter, "why here" reasoning, social badges, add button
- **Entries tab** — full CRUD view of all directory entries with inline delete confirmation
- **Toast notifications** — feedback on all mutations (add/delete/error)

#### AI Engine
- **Multi-model research** — Claude 3.5 Haiku + Gemini Flash 1.5 + GPT-4o Mini in parallel
- **Deduplication** — results merged by name across all model responses
- **Confidence scoring** — each suggestion scored 0-1 for relevance
- **Portugal context** — AI prompted to prioritise Portuguese/Lusophone tech ecosystem
- **Homonym handling** — models instructed to distinguish between namesakes by context

#### Design System
- **NovaNEXT brand** — electric blue (#2020C8), cyan (#00E5D0), magenta (#E040FB)
- **Cabinet Grotesk** display font + **Satoshi** body font (both Fontshare)
- **Gradient effects** — hero text, avatar gradients, background orbs
- **Skeleton loaders** — shimmer animations while data loads
- **Dark-first** — optimised for conference environment (low-light)
- **Mobile-first** — 390px viewport primary design target

#### Infrastructure
- **Express + SQLite** — lightweight, zero-dependency database
- **Drizzle ORM** — type-safe queries with automatic schema migration
- **Zod validation** — all API inputs validated
- **Hash routing** — works in iframes and subdomain hosting
- **TanStack Query** — cache invalidation, loading states, optimistic UI

### Technical Challenges & Solutions

#### Challenge: AI Homonym Resolution
Multiple people can share the same name globally. For a conference in Portugal, returning a Silicon Valley engineer named "Pedro Santos" when we want the Lisbon-based VC is a quality failure.

**Solution**: The research prompt explicitly sets conference context (NovaNEXT 2026, Aveiro Portugal, Portuguese/Lusophone ecosystem) and instructs models to return a "reason" field explaining why each suggestion belongs there. Users see all 3-5 options and select the correct one from the card stack.

#### Challenge: Multi-Model Response Consistency
Different AI models return JSON in slightly different formats — some wrap in markdown code blocks, some add commentary.

**Solution**: Post-processing strips markdown fences with regex, then JSON.parse in a try/catch. Names are lowercased for deduplication across model outputs.

#### Challenge: Mobile Navigation in Admin
The admin nav with logo + two tabs + two action buttons was too cramped on 390px screens.

**Solution**: Restructured to a two-row layout — top row for logo/identity and compact action links, bottom row for full-width tab switcher.

---

## Unreleased

### Planned for v1.1.0
- Avatar image upload (multipart form + local storage)
- Contact edit modal in admin entries view
- Export directory to CSV

### Planned for v2.0.0
- Public-facing attendee registration flow
- Event schedule integration (sessions + speakers)
- QR code per contact card for quick sharing
- Offline PWA support
