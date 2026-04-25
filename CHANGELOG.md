# Changelog

All notable changes to NovaNEXT Connect are documented here.
Format: [Semantic Versioning](https://semver.org/)

---

## [1.2.3] — 2026-04-25

### ✨ Bio Quality — Complete Overhaul

#### AI Bio Synthesis from Clean Facts
- **Root cause of bad bios**: raw string concatenation of `site_text` + `bio_hint` + repo names was feeding navigation chrome ("ventures connect EN / lang home → ventures → connect") directly into the bio field
- **New architecture**: `synthesizeBio(facts, name)` — a dedicated Claude 3.5 Haiku call that receives a structured fact sheet and writes a clean 2-3 sentence professional bio. Strictly grounded: if a field isn't in the scraped facts, it cannot appear in the bio.
- **Fact sheet contents**: GitHub bio → company → location → website → open source project list (name + description) → website prose excerpt
- **Paul Fleury verified**: bio now reads "Paul Fleury is an internet entrepreneur focused on building open source productivity and security tools. He develops innovative applications like junk (a floating notepad), clippy (an AI contract analysis tool), and morrigan (an encrypted digital will platform)..."

#### Smart HTML Prose Extraction
- **Old `stripHtml`**: naively stripped all tags — returned nav/header/footer noise along with body text
- **New `extractBodyProse`**:
  1. Removes `<script>`, `<style>`, `<svg>`, `<noscript>` blocks entirely
  2. Strips `<nav>`, `<header>`, `<footer>`, `<aside>`, `<menu>` blocks by tag name
  3. Prioritises `<main>` and `<article>` containers (richest prose)
  4. Extracts only `<p>` paragraphs longer than 30 chars (skips "Click here", nav items)
  5. Falls back to full-tag-stripped text only if fewer than 2 paragraphs found

#### Smarter Tags
- Tags derived from full text scan: Entrepreneur, Founder, Investor, Rust, AI, Open Source, Product, VC
- No more hardcoded ["Tech"] fallback when we know more

### ✎ Admin Bio Quick Edit
- **Pencil icon** on every contact row in the Entries tab — opens an inline bio editor
- **Textarea** with cyan focus ring — pre-filled with current bio (or empty for new)
- **Save / Cancel** buttons — PATCH to `/api/admin/contacts/:id` with immediate cache invalidation
- **Bio preview** (one-line truncated) shown in the row even before editing, so you can see what each person has at a glance
- Works for any contact — add or replace bio, no page navigation needed

---

## [1.2.2] — 2026-04-25

### 🛡️ Anti-Hallucination Fix

#### Anchor Bio Built from Scraped Facts Only
- **Root cause fixed** — AI was freely generating bio text for anchor persons even when verified scraped data was available, producing completely invented content (e.g. "CEO of AI Innovations, Lisbon")
- **`buildAnchorFromFacts()` now wired unconditionally** — whenever enrichment returns a verified profile with a name, the anchor result is always constructed from scraped facts only (GitHub API bio, company, location, top repos, site text); the AI output is never used for the #1 result
- **Previous conditional was wrong** — the old code only used facts when `firstKey !== anchorName`; if the AI happened to guess the name correctly it still used the hallucinated bio. Now: if we have facts, we always use facts.
- **Bio is deterministic** — `bioParts` array assembled strictly from: `bio_hint` (GitHub bio field) → `company` → `location` → `top_repos` summaries → `site_text` excerpt. Nothing invented.
- **Paul Fleury test verified**: LinkedIn URL input now returns `"Internet entrepreneur"` (from GitHub API), with all links intact and `source: "scraped profile"`

### ✨ New Feature — QR Code on Profile Page

- **QR code displayed on every contact profile** — generated client-side via `qrcode` npm package
- **Cyan-on-dark palette** — dark: `#00E5D0`, light: `#080818` — matches NovaNEXT design system
- **Copy URL button** — one-tap copy of the profile's `/#/contact/<slug>` URL alongside the QR
- **Share any profile** — attendees at the conference can scan to pull up a contact card on their phone

---

## [1.2.1] — 2026-04-25

### ✨ New Features

#### Platform-Aware Enrichment Engine (Rebuilt)
- **LinkedIn handle → GitHub crossref** — LinkedIn returns HTTP 999 (login wall). Instead, the handle is extracted from the URL and queried against the GitHub API — works perfectly for users with matching handles (e.g. `paulfxyz`)
- **GitHub API enrichment** — structured JSON: name, bio, company, location, website, twitter_username, top repos with descriptions and versions
- **Twitter/X enrichment** — Twitterbot UA for og: meta tags → GitHub API crossref for linked profiles
- **Generic website** — og:title, og:description extraction with 8s timeout

#### Parallel Architecture
- Enrichment + 3 AI models fire simultaneously (no sequential waiting)
- Verified URLs hard-injected into anchor result post-completion
- ~16s with URL, ~8s without (vs ~30s sequential in v1.2.0)

#### VERIFIED Badge & Rich Suggestion Cards
- **VERIFIED badge** on anchor result when enrichment confirms the profile
- **Colored link buttons** with ExternalLink icon — LinkedIn (blue), GitHub (purple), Twitter (sky), Website (cyan)
- All links are live `<a>` tags — click to verify in context before adding

---

## [1.2.0] — 2026-04-25

### ✨ New Features

#### Research Engine — 10 Results & URL Grounding
- **URL/LinkedIn input field** in Admin Research — paste any profile or website URL alongside the name query; the server fetches and strips HTML from the URL (10s timeout) and feeds it as grounding context to the AI prompt
- **Auto-detect inline URLs** — URLs typed directly into the name query field are also extracted and scraped automatically
- **10 results per search** — 3 AI models queried in parallel (Claude 3.5 Haiku, Gemini Flash 1.5, GPT-4o Mini), each returning 4 suggestions → deduplicated → sorted by confidence → top 10 returned
- **Confidence scoring improved** — first result automatically boosted to ≥ 0.9 when page context was scraped, ensuring the exact person/company from the URL ranks first
- **Research API** — `POST /api/admin/research` now accepts optional `url` field and passes it to `searchPersonOrCompany(query, extraUrls[])`

#### Richer Suggestion Cards (Admin)
- **Full bio display** — no longer clamped to 2 lines; shows complete bio with "Show more / Show less" toggle for bios longer than ~220 characters
- **Clickable social links** — LinkedIn, X/Twitter, GitHub, Website badges are now real `<a href target="_blank">` links (previously non-interactive)
- **Company + role as distinct labelled fields** — company name with building icon, role as secondary label beneath
- **Location** moved into the header section alongside the name/title
- **Confidence colour-coded** — green (≥80%), cyan (≥60%), yellow (≥40%), dim otherwise
- **All tags shown** — up to 5 tags (was 4)

#### Home Page — "Research with AI" Button
- **Empty state CTA** — when a search query returns 0 local results, a prominent blue gradient button appears: "Research \"[query]\" with AI →"
- **Results state CTA** — a subtle secondary button appears below the card grid when results exist but the user may want to find someone not yet in the directory
- Both buttons navigate to `/#/admin?q=<encoded query>` — the Admin page reads the `?q=` hash param on mount, pre-fills the search field, and auto-triggers research
- **No sessionStorage** — all state passed via URL hash param, compatible with iframe sandbox

---

## [1.1.0] — 2026-04-25

### 🐛 Bug Fixes

- **Slug normalization** — `slugify()` now applies NFD Unicode decomposition before stripping diacritics. `António Câmara` correctly becomes `antonio-camara` (was `ant-nio-c-mara`). A startup migration auto-heals any existing broken slugs in the database.
- **Contact page proxy** — Replaced raw `fetch()` with `apiRequest()` in `contact.tsx` so the `__PORT_5000__` rewrite fires correctly on `nova.pplx.app`. Direct links like `/#/contact/paul-fleury` no longer 404.

### ✨ New Features

#### Import Tab (Admin)
- **File drop zone** — drag & drop or click-to-browse for CSV, vCard (`.vcf`), and plain text files
- **Auto-detection** — heuristic column mapper detects name, title, company, LinkedIn, Twitter, GitHub, location, tags from common export formats
- **Column mapping UI** — dropdown selects per column with example value preview; Name is required before proceeding
- **Paste mode** — names one-per-line OR raw CSV text with toggle, routes through same mapping/preview pipeline
- **vCard parser** — extracts `FN`, `TITLE`, `ORG`, `NOTE`, `ADR`, and typed `URL` fields from `.vcf` exports
- **Preview table** — first 8 rows shown before import, expandable; rows without a name are excluded automatically
- **Bulk import endpoint** — `POST /api/admin/import` accepts array of contact objects, returns per-row `added`/`error` status
- **Result view** — success/failure per contact with toast summary; "Import More" and "View Entries" CTAs
- **Sample CSV download** — one-click template with correct column names
- **Supported sources listed:** LinkedIn CSV, HubSpot, Salesforce, Notion Database, Airtable, Google Contacts, Apple Contacts (`.vcf`), any spreadsheet

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

## [1.1.1] — 2026-04-25

### 🐛 Bug Fixes

- **Research crash (blank page)** — The admin research feature was causing a silent React tree crash after ~15 seconds, leaving the page completely blank. Three root causes fixed:
  1. **No error boundary** — any render exception killed the whole UI. A global `ErrorBoundary` now wraps all routes and shows a branded recovery screen instead.
  2. **Unguarded data from AI models** — AI responses occasionally return `tags` as a comma-string, `name` as null, or `confidence` outside 0–1. A new `sanitizeSuggestion()` server-side function normalises every field before it leaves the API.
  3. **`SuggestionCard` not defensive** — the component now coerces all fields to safe types before rendering, guarding against any unexpected shapes.
- **OpenRouter timeout** — API calls had no timeout, causing the pplx.app sandbox to hang indefinitely on slow or unresponsive models. Each call now has a hard 20-second `AbortController` timeout.
- **Missing Lucide imports** — `Globe` and `MapPin` were used in `SuggestionCard` but not imported, causing a module error in some builds.
- **JSON parsing robustness** — model responses wrapped in `{ suggestions: [...] }` and responses with stray markdown fences are now handled correctly.
