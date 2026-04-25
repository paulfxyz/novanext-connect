import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertCompanySchema } from "@shared/schema";
import { z } from "zod";

const OPENROUTER_API_KEY = "REDACTED_KEY_REMOVED";

// Helper: call OpenRouter with a model
async function callOpenRouter(model: string, prompt: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
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
      max_tokens: 2000,
    })
  });
  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.status}`);
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || "";
}

// Search for a person/company using multiple AI models and merge results
async function searchPersonOrCompany(query: string): Promise<any[]> {
  const prompt = `You are a researcher for NovaNEXT, a major tech & AI investment conference in Aveiro, Portugal on 17 June 2026. The conference focuses on AI, startups, investors, and Portuguese/Lusophone tech ecosystems.

Search your knowledge for people or companies named or related to: "${query}"

Return EXACTLY 3 distinct suggestions as a JSON array. Each item must be a person OR a company that could plausibly attend NovaNEXT 2026 in Portugal. Prioritize:
1. People/companies in Portuguese tech/startup/VC ecosystem
2. International AI/tech/VC figures who operate in Europe
3. Be especially careful with homonyms - always prefer the Portuguese/Lusophone or European tech context

For each suggestion, return this exact JSON structure:
{
  "type": "person" or "company",
  "name": "Full Name",
  "title": "Job title or role",
  "bio": "2-3 sentence bio",
  "avatarUrl": null,
  "location": "City, Country",
  "companyName": "Company name (if person)",
  "companyRole": "Role at company (if person)",
  "website": "https://...",
  "linkedinUrl": "https://linkedin.com/in/... (if known)",
  "twitterUrl": "https://twitter.com/... or https://x.com/... (if known)",
  "githubUrl": "https://github.com/... (if known)",
  "tags": ["AI", "startup", "investor", etc],
  "confidence": 0.0 to 1.0,
  "source": "knowledge base",
  "reason": "Why this person/company is likely at NovaNEXT Portugal 2026"
}

Return ONLY valid JSON array, no markdown, no explanation. If unsure about a URL, set it to null.`;

  // Try 3 models in parallel for best coverage
  const models = [
    "anthropic/claude-3.5-haiku",
    "google/gemini-flash-1.5",
    "openai/gpt-4o-mini"
  ];

  const results = await Promise.allSettled(
    models.map(model => callOpenRouter(model, prompt))
  );

  const allSuggestions: any[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      try {
        let content = result.value.trim();
        // Strip markdown code blocks if present
        content = content.replace(/^```(?:json)?\n?/m, '').replace(/```\s*$/m, '').trim();
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const key = item.name?.toLowerCase()?.trim();
            if (key && !seen.has(key)) {
              seen.add(key);
              allSuggestions.push(item);
            }
          }
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    }
  }

  // Return top 3-5 by confidence (deduplicated)
  return allSuggestions
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 5);
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
    const schema = z.object({ query: z.string().min(1) });
    const body = schema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Query required" });

    try {
      const suggestions = await searchPersonOrCompany(body.data.query);
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
