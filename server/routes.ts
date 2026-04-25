import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertCompanySchema } from "@shared/schema";
import { z } from "zod";

const OPENROUTER_API_KEY = "REDACTED_KEY_REMOVED";

// Helper: call OpenRouter with a model — 20 s hard timeout so pplx.app sandbox never hangs
async function callOpenRouter(model: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nova.paulfleury.com",
        "X-Title": "NovaNEXT Networking App"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      })
    });
    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }
    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

// Sanitize a raw AI suggestion into a safe shape before sending to client
function sanitizeSuggestion(raw: any): any | null {
  try {
    const name = (raw?.name ?? '').toString().trim();
    if (!name) return null; // skip nameless entries

    // tags: AI sometimes returns a comma-string or object — normalize to string[]
    let tags: string[] = [];
    if (Array.isArray(raw.tags)) {
      tags = raw.tags.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (typeof raw.tags === 'string') {
      tags = raw.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    // confidence: clamp to 0-1
    const confidence = Math.min(1, Math.max(0, parseFloat(raw.confidence ?? 0.5) || 0.5));

    return {
      name,
      title:       raw.title       ? String(raw.title).trim()       : undefined,
      bio:         raw.bio         ? String(raw.bio).trim()          : undefined,
      avatarUrl:   null, // never trust AI-supplied avatar URLs (they 404)
      location:    raw.location    ? String(raw.location).trim()     : undefined,
      companyName: raw.companyName ? String(raw.companyName).trim()  : undefined,
      companyRole: raw.companyRole ? String(raw.companyRole).trim()  : undefined,
      website:     raw.website     ? String(raw.website).trim()      : undefined,
      linkedinUrl: raw.linkedinUrl ? String(raw.linkedinUrl).trim()  : undefined,
      twitterUrl:  raw.twitterUrl  ? String(raw.twitterUrl).trim()   : undefined,
      githubUrl:   raw.githubUrl   ? String(raw.githubUrl).trim()    : undefined,
      tags,
      confidence,
      source:  raw.source  ? String(raw.source)  : 'knowledge base',
      reason:  raw.reason  ? String(raw.reason)  : '',
    };
  } catch {
    return null;
  }
}

// ── URL detector & page scraper ─────────────────────────────────────────────
// Detects URLs in the query string and fetches readable text from those pages
function extractUrls(text: string): string[] {
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  return (text.match(urlRe) || []).map(u => u.replace(/[.,;!?)]+$/, ''));
}

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NovaNEXT-Research/1.0)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en,pt;q=0.9',
      }
    });
    if (!res.ok) return '';
    const html = await res.text();
    // Strip tags, collapse whitespace — keep first 4000 chars
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 4000);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

// Parse model JSON output into a clean array
function parseModelOutput(raw: string): any[] {
  try {
    let content = raw.trim()
      .replace(/^```(?:json)?[\r\n]*/m, '')
      .replace(/```[\s]*$/m, '')
      .trim();
    let parsed = JSON.parse(content);
    if (!Array.isArray(parsed) && Array.isArray(parsed?.suggestions)) parsed = parsed.suggestions;
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

// ── Main research function ────────────────────────────────────────────────────
// Accepts a free-text query (may contain URLs). Scrapes any linked pages for
// grounding context, then queries 3 AI models in parallel asking for 4 results
// each → deduplicates → returns up to 10 sorted by confidence.
async function searchPersonOrCompany(query: string, extraUrls: string[] = []): Promise<any[]> {
  // 1. Extract URLs embedded in the query itself
  const inlineUrls = extractUrls(query);
  const cleanQuery = query.replace(/https?:\/\/[^\s<>"']+/gi, '').replace(/\s{2,}/g, ' ').trim();
  const allUrls = [...new Set([...inlineUrls, ...extraUrls])];

  // 2. Fetch page text from any detected URLs (in parallel, 10s each)
  let pageContext = '';
  if (allUrls.length > 0) {
    const texts = await Promise.allSettled(allUrls.map(fetchPageText));
    const joined = texts
      .filter(r => r.status === 'fulfilled' && r.value)
      .map((r: any) => r.value as string)
      .join('\n\n---\n\n');
    if (joined) {
      pageContext = `\n\nADDITIONAL CONTEXT scraped from provided URLs (use this to anchor your research — the person/company IS the one described here):\n${joined.slice(0, 6000)}`;
    }
  }

  // 3. Build the prompt — ask for 4 results per model (3 models × 4 = up to 12, dedup to 10)
  const prompt = `You are a precision researcher for NovaNEXT, a major tech & AI investment conference in Aveiro, Portugal on 17 June 2026. The conference focuses on AI, startups, investors, Portuguese/Lusophone tech ecosystems, and European deep-tech.

Search your knowledge for people or companies named or related to: "${cleanQuery || query}"${
  pageContext
}

Return EXACTLY 4 distinct suggestions as a JSON array. Each item must be a real person OR real company. Rules:
- If page context was provided above: the FIRST result MUST be the exact person/company from that page, with high confidence (0.9+). Use the scraped data to fill all fields accurately.
- Subsequent results: other people/companies with the same or similar name, or closely related figures who'd attend NovaNEXT Portugal 2026
- Prioritise: Portuguese/Lusophone tech ecosystem, European AI/startup/VC, international figures active in Portugal
- Homonyms: always prefer the European/Portuguese tech context unless context proves otherwise
- Write a DETAILED bio of 3-5 sentences — be specific about their work, achievements, and connection to Portugal/tech
- ALL URLs must be real and verifiable. If unsure, set to null

For each suggestion return this EXACT JSON structure (no extra fields):
{
  "type": "person" or "company",
  "name": "Full Name",
  "title": "Current job title or role",
  "bio": "Detailed 3-5 sentence bio with specifics",
  "avatarUrl": null,
  "location": "City, Country",
  "companyName": "Employer or company name (if person)",
  "companyRole": "Their role at the company",
  "website": "https://personal-site.com or null",
  "linkedinUrl": "https://linkedin.com/in/handle or null",
  "twitterUrl": "https://x.com/handle or null",
  "githubUrl": "https://github.com/handle or null",
  "tags": ["3-6 relevant tags like AI, Startup, Investor, Portugal, Speaker"],
  "confidence": 0.0 to 1.0,
  "source": "knowledge base" or "scraped profile",
  "reason": "1-2 sentences: why this specific person/company would attend NovaNEXT 2026 in Aveiro, Portugal"
}

Return ONLY a valid JSON array. No markdown, no explanation, no wrapper object.`;

  // 4. Query 3 models in parallel
  const models = [
    "anthropic/claude-3.5-haiku",
    "google/gemini-flash-1.5",
    "openai/gpt-4o-mini",
  ];

  const results = await Promise.allSettled(
    models.map(model => callOpenRouter(model, prompt))
  );

  // 5. Merge, deduplicate, sanitize
  const allSuggestions: any[] = [];
  const seen = new Set<string>();

  // If we have page context, boost the first result from each model
  const hasContext = pageContext.length > 0;

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const items = parseModelOutput(result.value);
    items.forEach((item, idx) => {
      const sanitized = sanitizeSuggestion(item);
      if (!sanitized) return;
      // Boost confidence of first item when we had page context
      if (hasContext && idx === 0) sanitized.confidence = Math.max(sanitized.confidence, 0.9);
      const key = sanitized.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        allSuggestions.push(sanitized);
      }
    });
  }

  // 6. Sort by confidence desc, return up to 10
  return allSuggestions
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 10);
}

export function registerRoutes(httpServer: Server, app: Express): void {
  // ── Public API ────────────────────────────────────────────────────────────

  // Get all contacts (for card wall)
  app.get("/api/contacts", (_req, res) => {
    try {
      const all = storage.getAllContacts();
      res.json(all);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  // Search contacts
  app.get("/api/contacts/search", (req, res) => {
    const q = z.string().min(1).safeParse(req.query.q);
    if (!q.success) return res.json([]);
    try {
      const results = storage.searchContacts(q.data);
      res.json(results);
    } catch (e) {
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Get single contact by slug
  app.get("/api/contacts/:slug", (req, res) => {
    const contact = storage.getContactBySlug(req.params.slug);
    if (!contact) return res.status(404).json({ error: "Not found" });
    res.json(contact);
  });

  // ── Admin API ─────────────────────────────────────────────────────────────

  // AI-powered research: search web/AI for a name/company
  app.post("/api/admin/research", async (req, res) => {
    const schema = z.object({
      query: z.string().min(1),
      url: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Query required" });

    try {
      const extraUrls = body.data.url ? [body.data.url] : [];
      const suggestions = await searchPersonOrCompany(body.data.query, extraUrls);
      res.json({ suggestions });
    } catch (e: any) {
      console.error("Research error:", e);
      res.status(500).json({ error: "Research failed: " + e.message });
    }
  });

  // Create contact (from suggestion or manual)
  app.post("/api/admin/contacts", (req, res) => {
    const body = insertContactSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    try {
      const contact = storage.createContact(body.data);
      res.status(201).json(contact);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update contact
  app.patch("/api/admin/contacts/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    try {
      const updated = storage.updateContact(id, req.body);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete contact
  app.delete("/api/admin/contacts/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const deleted = storage.deleteContact(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  // Get all companies
  app.get("/api/companies", (_req, res) => {
    res.json(storage.getAllCompanies());
  });

  // Create company
  app.post("/api/admin/companies", (req, res) => {
    const body = insertCompanySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    try {
      const company = storage.createCompany(body.data);
      res.status(201).json(company);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Bulk import contacts directly (from CSV / vCard parse)
  app.post("/api/admin/import", (req, res) => {
    const schema = z.array(z.object({
      name: z.string().min(1),
      title: z.string().optional().nullable(),
      bio: z.string().optional().nullable(),
      avatarUrl: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      companyName: z.string().optional().nullable(),
      companyRole: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      linkedinUrl: z.string().optional().nullable(),
      twitterUrl: z.string().optional().nullable(),
      githubUrl: z.string().optional().nullable(),
      instagramUrl: z.string().optional().nullable(),
      tags: z.string().optional().nullable(),
      socialLinks: z.string().optional().nullable(),
    }));
    const body = schema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    const results: { name: string; status: 'added' | 'error'; error?: string }[] = [];
    for (const item of body.data) {
      try {
        storage.createContact({
          name: item.name,
          slug: item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          title: item.title || null,
          bio: item.bio || null,
          avatarUrl: item.avatarUrl || null,
          location: item.location || null,
          companyName: item.companyName || null,
          companyRole: item.companyRole || null,
          website: item.website || null,
          linkedinUrl: item.linkedinUrl || null,
          twitterUrl: item.twitterUrl || null,
          githubUrl: item.githubUrl || null,
          instagramUrl: item.instagramUrl || null,
          tags: item.tags || '[]',
          socialLinks: item.socialLinks || '[]',
          isVerified: false,
        });
        results.push({ name: item.name, status: 'added' });
      } catch (e: any) {
        results.push({ name: item.name, status: 'error', error: e.message });
      }
    }
    res.json({ results, added: results.filter(r => r.status === 'added').length });
  });

  // Delete company
  app.delete("/api/admin/companies/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = storage.deleteCompany(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });
}
