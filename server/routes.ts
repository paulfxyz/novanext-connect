import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertCompanySchema } from "@shared/schema";
import { z } from "zod";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
if (!OPENROUTER_API_KEY) console.warn('[NovaNEXT] WARNING: OPENROUTER_API_KEY env var not set — research will fail');

// Helper: call OpenRouter with a model — 30 s hard timeout (enrichment + AI)
async function callOpenRouter(model: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
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
        temperature: 0.25,
        max_tokens: 2000,
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

// ── URL detector ─────────────────────────────────────────────────────────────
function extractUrls(text: string): string[] {
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  return (text.match(urlRe) || []).map(u => u.replace(/[.,;!?)]+$/, ''));
}

// ── Platform-aware enrichment ────────────────────────────────────────────────
// Instead of blindly fetching HTML (which LinkedIn/Twitter block), we use
// platform-specific APIs + open sources to build a structured fact object.

interface EnrichedProfile {
  platform: string;       // e.g. 'linkedin', 'github', 'twitter', 'website'
  handle?: string;        // the @handle or slug extracted from the URL
  url: string;            // the original URL passed in
  facts: Record<string, string>; // structured key→value facts found
  rawText?: string;       // any free text extracted (truncated)
}

async function enrichUrl(url: string): Promise<EnrichedProfile> {
  const result: EnrichedProfile = { platform: 'unknown', url, facts: {} };

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname;

    // ── LinkedIn ──────────────────────────────────────────────────────────────
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
      result.platform = 'linkedin';
      // Extract handle from /in/<handle> or /company/<handle>
      const m = path.match(/\/(in|company|school)\/([^/]+)/);
      if (m) {
        result.handle = m[2];
        result.facts['linkedin_handle'] = m[2];
        result.facts['linkedin_url'] = `https://www.linkedin.com/${m[1]}/${m[2]}/`;
        result.facts['profile_type'] = m[1] === 'company' ? 'company' : 'person';
      }
      // LinkedIn is login-walled (returns HTTP 999). Use multiple strategies
      // to resolve the person's identity from open sources.
      if (result.handle) {
        // Strategy 1: GitHub API with exact same handle (works when handles match)
        const ghData = await fetchJson(`https://api.github.com/users/${result.handle}`);
        if (ghData?.name) {
          result.facts['name'] = ghData.name;
          result.facts['github_handle'] = result.handle;
          result.facts['github_url'] = `https://github.com/${result.handle}`;
          if (ghData.bio) result.facts['bio_hint'] = ghData.bio;
          if (ghData.company) result.facts['company'] = ghData.company;
          if (ghData.location) result.facts['location'] = ghData.location;
          if (ghData.blog) result.facts['website'] = ghData.blog;
          if (ghData.twitter_username) {
            result.facts['twitter_handle'] = ghData.twitter_username;
            result.facts['twitter_url'] = `https://x.com/${ghData.twitter_username}`;
          }
        }

        // Strategy 2: If GitHub crossref failed, humanize the handle to get a name.
        // LinkedIn slugs like "joana-martins-70b86320b" → strip numeric suffix → "Joana Martins"
        if (!result.facts['name']) {
          const humanized = result.handle
            .replace(/-[a-f0-9]{7,}$/, '')          // strip hex suffix (LinkedIn UIDs)
            .replace(/-\d+$/, '')                   // strip trailing numeric suffix
            .replace(/-/g, ' ')                     // dashes → spaces
            .replace(/\b\w/g, c => c.toUpperCase()) // title case
            .trim();
          if (humanized.length > 1) result.facts['name'] = humanized;
        }

        // Strategy 3: Web search for the person's name + LinkedIn to find other profiles
        if (result.facts['name']) {
          try {
            const searchQuery = encodeURIComponent(`"${result.facts['name']}" site:linkedin.com OR site:twitter.com OR site:github.com`);
            const searchRes = await fetchJson(
              `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`
            );
            const topics: any[] = [
              ...(searchRes?.RelatedTopics || []),
              ...(searchRes?.Results || [])
            ];
            for (const t of topics.slice(0, 8)) {
              const link: string = t?.FirstURL || t?.url || '';
              if (!link) continue;
              if (!result.facts['twitter_url'] && (link.includes('twitter.com') || link.includes('x.com'))) {
                const tHandle = link.match(/(?:twitter|x)\.com\/([^/?#]+)/)?.[1];
                if (tHandle && !['intent','search','hashtag'].includes(tHandle)) {
                  result.facts['twitter_handle'] = tHandle;
                  result.facts['twitter_url'] = `https://x.com/${tHandle}`;
                }
              }
              if (!result.facts['github_url'] && link.includes('github.com')) {
                const ghHandle = link.match(/github\.com\/([^/?#]+)/)?.[1];
                if (ghHandle && ghHandle !== 'features' && ghHandle !== 'topics') {
                  const ghCheck = await fetchJson(`https://api.github.com/users/${ghHandle}`);
                  if (ghCheck?.name) {
                    result.facts['github_handle'] = ghHandle;
                    result.facts['github_url'] = `https://github.com/${ghHandle}`;
                    if (ghCheck.bio && !result.facts['bio_hint']) result.facts['bio_hint'] = ghCheck.bio;
                    if (ghCheck.company && !result.facts['company']) result.facts['company'] = ghCheck.company;
                    if (ghCheck.location && !result.facts['location']) result.facts['location'] = ghCheck.location;
                    if (ghCheck.blog && !result.facts['website']) result.facts['website'] = ghCheck.blog;
                  }
                }
              }
            }
          } catch { /* web search is best-effort */ }
        }

        // Fetch personal website if found
        if (result.facts['website'] && result.facts['website'].startsWith('http')) {
          const siteText = await fetchHtmlText(result.facts['website']);
          if (siteText) result.facts['site_text'] = siteText.slice(0, 1500);
        }
      }
      return result;
    }

    // ── GitHub ────────────────────────────────────────────────────────────────
    if (host === 'github.com') {
      result.platform = 'github';
      const m = path.match(/^\/([^/]+)/);
      if (m) {
        result.handle = m[1];
        const ghData = await fetchJson(`https://api.github.com/users/${m[1]}`);
        if (ghData && !ghData.message) {
          result.facts['name'] = ghData.name || m[1];
          result.facts['github_handle'] = m[1];
          result.facts['github_url'] = `https://github.com/${m[1]}`;
          if (ghData.bio) result.facts['bio_hint'] = ghData.bio;
          if (ghData.company) result.facts['company'] = ghData.company;
          if (ghData.location) result.facts['location'] = ghData.location;
          if (ghData.blog) result.facts['website'] = ghData.blog;
          if (ghData.twitter_username) {
            result.facts['twitter_handle'] = ghData.twitter_username;
            result.facts['twitter_url'] = `https://x.com/${ghData.twitter_username}`;
          }
          // Get top repos for context
          const repos = await fetchJson(`https://api.github.com/users/${m[1]}/repos?sort=stars&per_page=5`);
          if (Array.isArray(repos)) {
            result.facts['top_repos'] = repos.map((r: any) => `${r.name}: ${r.description || ''}`).join('; ');
          }
        }
      }
      return result;
    }

    // ── Twitter / X ───────────────────────────────────────────────────────────
    if (host === 'twitter.com' || host === 'x.com') {
      result.platform = 'twitter';
      const m = path.match(/^\/([^/]+)/);
      if (m && m[1] !== 'i') {
        result.handle = m[1];
        result.facts['twitter_handle'] = m[1];
        result.facts['twitter_url'] = `https://x.com/${m[1]}`;
        // Fetch og: tags using Twitterbot UA (still public)
        const html = await fetchHtmlRaw(url, 'Twitterbot/1.0');
        if (html) {
          const ogName = html.match(/<meta\s+(?:property=["']og:title["']|name=["']twitter:title["'])\s+content=["']([^"']{2,200})["']/i)?.[1];
          const ogDesc = html.match(/<meta\s+(?:property=["']og:description["']|name=["']twitter:description["'])\s+content=["']([^"']{2,500})["']/i)?.[1];
          if (ogName) result.facts['name'] = ogName.replace(/ \(@.*\)/, '').trim();
          if (ogDesc) result.facts['bio_hint'] = ogDesc;
        }
        // Try GitHub with same handle
        const ghData = await fetchJson(`https://api.github.com/users/${m[1]}`);
        if (ghData?.name) {
          if (!result.facts['name']) result.facts['name'] = ghData.name;
          result.facts['github_handle'] = m[1];
          result.facts['github_url'] = `https://github.com/${m[1]}`;
          if (ghData.blog) result.facts['website'] = ghData.blog;
        }
      }
      return result;
    }

    // ── Generic website ───────────────────────────────────────────────────────
    result.platform = 'website';
    result.facts['website'] = url;
    const html = await fetchHtmlRaw(url, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36');
    if (html) {
      // Extract og: / twitter: meta tags
      const ogTitle = html.match(/<meta[^>]+(?:property=["']og:title["'])[^>]+content=["']([^"']{2,200})["']/i)?.[1]
                   || html.match(/<meta[^>]+content=["']([^"']{2,200})["'][^>]+property=["']og:title["']/i)?.[1];
      const ogDesc  = html.match(/<meta[^>]+(?:property=["']og:description["'])[^>]+content=["']([^"']{5,500})["']/i)?.[1]
                   || html.match(/<meta[^>]+content=["']([^"']{5,500})["'][^>]+property=["']og:description["']/i)?.[1];
      const pageTitle = html.match(/<title[^>]*>([^<]{2,200})<\/title>/i)?.[1];
      if (ogTitle) result.facts['name'] = ogTitle;
      else if (pageTitle) result.facts['site_title'] = pageTitle;
      if (ogDesc) result.facts['bio_hint'] = ogDesc;
      result.rawText = stripHtml(html).slice(0, 2000);
    }
    return result;
  } catch {
    return result;
  }
}

// Low-level helpers ─────────────────────────────────────────────────────────
async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'NovaNEXT-Research/1.2' }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

async function fetchHtmlRaw(url: string, ua: string, timeoutMs = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,*/*;q=0.8',
        'Accept-Language': 'en,pt;q=0.9',
      }
    });
    if (!r.ok) return '';
    return await r.text();
  } catch { return ''; } finally { clearTimeout(t); }
}

async function fetchHtmlText(url: string, timeoutMs = 8000): Promise<string> {
  const html = await fetchHtmlRaw(url, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0 Safari/537.36', timeoutMs);
  return extractBodyProse(html).slice(0, 2000);
}

// Smarter HTML text extraction — skips nav/header/footer/aside noise,
// targets meaningful prose from <main>, <article>, <section>, <p> tags.
function extractBodyProse(html: string): string {
  if (!html) return '';
  // 1. Strip scripts, styles, SVG, noscript entirely
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // 2. Remove entire nav / header / footer / aside / menu blocks
  cleaned = cleaned
    .replace(/<(nav|header|footer|aside|menu)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, '')
    .replace(/<(ul|ol)(\s[^>]*)?\sclass=["'][^"']*(?:nav|menu|header|footer|breadcrumb)[^"']*["'][\s\S]*?<\/\1>/gi, '');

  // 3. Try to extract <main> or <article> first — richest prose containers
  const mainMatch = cleaned.match(/<(?:main|article)(\s[^>]*)?>([\s\S]*?)<\/(?:main|article)>/i);
  const workingHtml = mainMatch ? mainMatch[2] : cleaned;

  // 4. Extract text from <p> tags (core prose)
  const paragraphs: string[] = [];
  const pRe = /<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRe.exec(workingHtml)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/\s{2,}/g, ' ').trim();
    if (text.length > 30) paragraphs.push(text); // skip micro-snippets ("Click here", etc)
  }

  if (paragraphs.length >= 2) {
    // Return up to 4 meaningful paragraphs
    return paragraphs.slice(0, 4).join(' ');
  }

  // 5. Fallback: strip all tags from working area
  return workingHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripHtml(html: string): string {
  return extractBodyProse(html);
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

// Build prompt string — called once we know whether we have anchor context or not
function buildPrompt(query: string, anchorContext: string, hasAnchor: boolean): string {
  return `You are a research assistant for NovaNEXT — a major AI, startup & investment conference in Aveiro, Portugal on 17 June 2026.

Find 4 DISTINCT real people or companies matching: "${query}"${anchorContext}

⚠️ CRITICAL ANTI-HALLUCINATION RULES — READ CAREFULLY:
${hasAnchor
  ? `- Result #1 MUST be the exact person from the ANCHOR above. Their bio, title, and company MUST come from the anchor facts only. DO NOT invent anything not present in the anchor data. If a field is not in the anchor, set it to null or omit it.
- Copy anchor URLs verbatim: github_url → githubUrl, twitter_url → twitterUrl, linkedin_url → linkedinUrl, website → website.
`
  : ''}- For results you GENUINELY KNOW (famous people, well-documented public figures): write a factual bio of 2-3 sentences using only verified facts.
- For results you are NOT CERTAIN ABOUT: set bio to null and confidence to 0.4 or below. DO NOT fabricate job titles, company names, or achievements.
- NEVER invent: company names, funding amounts, university affiliations, conference appearances, or titles.
- Only include a linkedinUrl/twitterUrl/githubUrl if you are 100% certain the exact handle is correct. If in doubt — null.
- It is FAR BETTER to return a result with null bio and null links than to hallucinate plausible-sounding fiction.

Return EXACTLY 4 items as a raw JSON array (no markdown, no wrapper):
{"name":"Full Name","title":"Role or null","bio":"Factual bio or null","avatarUrl":null,"location":"City, Country or null","companyName":"Company or null","companyRole":"Role or null","website":"verified URL or null","linkedinUrl":"verified URL or null","twitterUrl":"verified URL or null","githubUrl":"verified URL or null","tags":["tag1","tag2"],"confidence":0.0,"source":"knowledge base","reason":"1 sentence: why they might attend NovaNEXT 2026"}`;
}

// ── Bio synthesis via AI ────────────────────────────────────────────────────
// Takes a structured fact object and writes a clean, professional 2-3 sentence bio.
// This is the ONLY place where AI writes bio text — strictly grounded in the provided facts.
function buildFactLines(facts: Record<string, string>): string[] {
  const factLines: string[] = [];
  if (facts['bio_hint'])   factLines.push(`GitHub/profile bio: "${facts['bio_hint']}"`);
  if (facts['company'])    factLines.push(`Company/org: ${facts['company']}`);
  if (facts['location'])   factLines.push(`Location: ${facts['location']}`);
  if (facts['website'])    factLines.push(`Website: ${facts['website']}`);
  if (facts['top_repos']) {
    const repos = facts['top_repos'].split('; ').slice(0, 4).map(r => {
      const colon = r.indexOf(':');
      if (colon === -1) return r.trim();
      const repoName = r.slice(0, colon).trim();
      const desc = r.slice(colon + 1).trim();
      return desc ? `${repoName} — ${desc}` : repoName;
    }).filter(Boolean);
    if (repos.length) factLines.push(`Open source projects: ${repos.join(' | ')}`);
  }
  if (facts['site_text']) {
    const prose = facts['site_text'].replace(/[|>\u2192\u2713\u2715\u00d7\u2022]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (prose.length > 60) factLines.push(`Website content excerpt: ${prose.slice(0, 400)}`);
  }
  return factLines;
}

async function synthesizeBioAndTags(facts: Record<string, string>, name: string): Promise<{ bio: string | null; tags: string[] }> {
  const factLines = buildFactLines(facts);
  if (factLines.length === 0) return { bio: null, tags: [] };

  const prompt = `You are writing a professional profile for a networking app directory at NovaNEXT 2026, a major AI and startup conference in Aveiro, Portugal.

Person: ${name}

VERIFIED FACTS (scraped from their actual profiles — use only these):
${factLines.join('\n')}

Return a JSON object with two fields:
1. "bio": a crisp, professional 2-3 sentence bio.
   - Use ONLY the facts above. Do NOT add anything not present in the facts.
   - Do NOT mention NovaNEXT or the conference.
   - Do NOT invent a job title, company, funding, or achievement unless explicitly in the facts.
   - Write in third person ("He builds...", "She leads...", "They create...").
   - Keep it under 80 words. No em-dashes. No marketing fluff.
2. "tags": an array of 2-5 short professional tags (e.g. "Founder", "AI", "VC", "Developer", "Design", "Investor", "Product", "Open Source", "SaaS", "Hardware", "Web3", "Climate", "Healthcare", "B2B", "Angel", etc.).
   - Derive ONLY from the facts. Do not guess.
   - Tags should be title-cased single words or short 2-word phrases.

Return ONLY valid JSON like: {"bio": "...", "tags": ["Founder", "AI"]}`;

  try {
    const result = await callOpenRouter('anthropic/claude-3.5-haiku', prompt);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);
    const bio = typeof parsed.bio === 'string' && parsed.bio.length > 20 ? parsed.bio.trim() : null;
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 6) : [];
    return { bio, tags };
  } catch {
    return { bio: null, tags: [] };
  }
}

// Backwards-compat wrapper
async function synthesizeBio(facts: Record<string, string>, name: string): Promise<string | null> {
  const { bio } = await synthesizeBioAndTags(facts, name);
  return bio;
}

// Build a suggestion object directly from enriched facts.
// Bio is synthesized by AI from clean facts (no raw concatenation, no navigation junk).
async function buildAnchorFromFacts(profile: EnrichedProfile, query: string): Promise<any> {
  const f = profile.facts;
  // Name resolution priority: scraped name → query text (strip URLs) → humanized LinkedIn handle
  const nameFromQuery = query.replace(/https?:\/\/\S+/g, '').trim();
  const nameFromHandle = f['linkedin_handle']
    ? f['linkedin_handle']
        .replace(/-[a-f0-9]{7,}$/, '')
        .replace(/-\d+$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
        .trim()
    : '';
  const name = f['name'] || nameFromQuery || nameFromHandle || 'Unknown';

  // Get enriched repo data if GitHub profile
  if ((profile.platform === 'github' || f['github_handle']) && f['github_handle'] && !f['top_repos']) {
    const repos = await fetchJson(`https://api.github.com/users/${f['github_handle']}/repos?sort=stars&per_page=6`);
    if (Array.isArray(repos)) {
      f['top_repos'] = repos
        .filter((r: any) => r.description)
        .slice(0, 5)
        .map((r: any) => `${r.name}: ${r.description}`)
        .join('; ');
    }
  }

  // Synthesize bio + tags via AI — grounded in facts only
  const { bio, tags: aiTags } = await synthesizeBioAndTags(f, name);
  const tags = aiTags.length > 0 ? aiTags : ['Tech'];

  // Title: use the short GitHub bio as a title-line — it's typically a role/identity
  // NOT as the bio body (previously that doubled-up ugly)
  const title = f['bio_hint'] || null;

  return {
    name,
    title,
    bio,
    avatarUrl:   null,
    location:    f['location'] || null,
    companyName: f['company']?.replace(/^@/, '') || null,
    companyRole: null,
    website:     f['website'] || null,
    linkedinUrl: f['linkedin_url'] || null,
    githubUrl:   f['github_url'] || null,
    twitterUrl:  f['twitter_url'] || null,
    tags:        [...new Set(tags)],
    confidence:  0.97,
    source:      'scraped profile',
    reason:      `Profile verified from ${profile.platform} (${profile.url}).`,
  };
}

// ── Main research function ────────────────────────────────────────────────────
async function searchPersonOrCompany(query: string, extraUrls: string[] = []): Promise<any[]> {
  // 1. Extract inline URLs from query
  const inlineUrls = extractUrls(query);
  const cleanQuery = query.replace(/https?:\/\/[^\s<>"']+/gi, '').replace(/\s{2,}/g, ' ').trim();
  const allUrls = [...new Set([...inlineUrls, ...extraUrls])];

  const models = [
    "anthropic/claude-3.5-haiku",
    "google/gemini-flash-1.5",
    "openai/gpt-4o-mini",
  ];

  if (allUrls.length === 0) {
    // ── No URLs: build prompt immediately, fire all models at once
    const prompt = buildPrompt(cleanQuery || query, '', false);
    const results = await Promise.allSettled(models.map(m => callOpenRouter(m, prompt)));
    return mergeResults(results, [], false).slice(0, 10);
  }

  // ── Has URLs: run enrichment AND all AI models simultaneously
  // Both happen in parallel. Once enrichment completes we know the anchor person.
  // We inject their verified URLs directly into the first AI result (no second round-trip).
  const promptWithoutAnchor = buildPrompt(
    `${cleanQuery || query} (Note: a specific profile URL was provided — the FIRST result must match the person/company at that URL)`,
    '', false
  );

  const [enrichResults, aiResults] = await Promise.all([
    Promise.allSettled(allUrls.map(enrichUrl)),
    Promise.allSettled(models.map(m => callOpenRouter(m, promptWithoutAnchor))),
  ]);

  // Process enrichment
  const enrichedProfiles: EnrichedProfile[] = enrichResults
    .filter(r => r.status === 'fulfilled')
    .map((r: any) => r.value as EnrichedProfile)
    .filter(p => Object.keys(p.facts).length > 0 || p.rawText);

  const hasAnchor = enrichedProfiles.length > 0;

  // Merge AI results, injecting verified URLs into the first slot if enrichment found data
  const suggestions = mergeResults(aiResults, enrichedProfiles, hasAnchor);

  // ANTI-HALLUCINATION: when we have a verified enriched profile, ALWAYS build the anchor
  // from scraped facts only — never trust the AI bio for anchor persons.
  // Also fires when we only have a linkedin_url (handle-humanized name) — better than nothing.
  const anchorHasUsableName = enrichedProfiles[0]?.facts['name'] ||
    enrichedProfiles[0]?.facts['linkedin_handle'] ||
    (cleanQuery && cleanQuery.length > 1);
  if (hasAnchor && anchorHasUsableName) {
    const anchorEntry = sanitizeSuggestion(await buildAnchorFromFacts(enrichedProfiles[0], cleanQuery || query));
    if (anchorEntry) {
      const anchorKey = anchorEntry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const filtered = suggestions.filter(s => s.name.toLowerCase().replace(/[^a-z0-9]/g, '') !== anchorKey);
      return [anchorEntry, ...filtered.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))].slice(0, 10);
    }
  }

  const [first, ...rest] = suggestions;
  if (!first) return [];
  return [first, ...rest.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))].slice(0, 10);
}

// Helper: merge model results, inject verified URLs from enrichment
function mergeResults(
  results: PromiseSettledResult<string>[],
  enrichedProfiles: EnrichedProfile[],
  hasAnchor: boolean
): any[] {
  const allSuggestions: any[] = [];
  const seen = new Set<string>();
  let anchorPlaced = false;

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const items = parseModelOutput(result.value);
    items.forEach((item, idx) => {
      const sanitized = sanitizeSuggestion(item);
      if (!sanitized) return;

      if (hasAnchor && idx === 0) {
        sanitized.confidence = Math.max(sanitized.confidence, 0.93);
        sanitized.source = 'scraped profile';
        // Override with verified URLs — never trust AI-hallucinated handles
        for (const profile of enrichedProfiles) {
          if (profile.facts['linkedin_url']) sanitized.linkedinUrl = profile.facts['linkedin_url'];
          if (profile.facts['github_url'])   sanitized.githubUrl   = profile.facts['github_url'];
          if (profile.facts['twitter_url'])  sanitized.twitterUrl  = profile.facts['twitter_url'];
          if (profile.facts['website'])      sanitized.website     = profile.facts['website'];
          if (profile.facts['name'])         sanitized.name        = profile.facts['name'];
        }
      }

      const key = sanitized.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        if (hasAnchor && idx === 0 && !anchorPlaced) {
          allSuggestions.unshift(sanitized);
          anchorPlaced = true;
        } else {
          allSuggestions.push(sanitized);
        }
      }
    });
  }

  return allSuggestions;
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

  // AI re-enrich an existing contact: re-runs the full research pipeline and merges results
  app.post("/api/admin/contacts/:id/enrich", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const contact = storage.getContact(id);
    if (!contact) return res.status(404).json({ error: 'Not found' });

    try {
      // Build a query from what we know: prefer profile URLs, fall back to name
      const urls: string[] = [
        contact.linkedinUrl,
        contact.githubUrl,
        contact.twitterUrl,
        contact.website,
      ].filter((u): u is string => !!u && u.startsWith('http'));

      const query = contact.name;
      const suggestions = await searchPersonOrCompany(query, urls);
      if (!suggestions || suggestions.length === 0) {
        return res.status(422).json({ error: 'No research results found' });
      }

      // Take the top suggestion (highest confidence / verified anchor)
      const top = suggestions[0];

      // Smart merge: always overwrite bio + tags; fill blanks for everything else
      const patch: Record<string, any> = {};

      // Always refresh bio and tags
      if (top.bio)  patch.bio  = top.bio;
      if (top.tags && top.tags.length > 0) patch.tags = JSON.stringify(top.tags);

      // Fill blanks (never overwrite user-edited values)
      if (!contact.title        && top.title)       patch.title       = top.title;
      if (!contact.location     && top.location)    patch.location    = top.location;
      if (!contact.companyName  && top.companyName) patch.companyName = top.companyName;
      if (!contact.companyRole  && top.companyRole) patch.companyRole = top.companyRole;
      if (!contact.linkedinUrl  && top.linkedinUrl) patch.linkedinUrl = top.linkedinUrl;
      if (!contact.githubUrl    && top.githubUrl)   patch.githubUrl   = top.githubUrl;
      if (!contact.twitterUrl   && top.twitterUrl)  patch.twitterUrl  = top.twitterUrl;
      if (!contact.website      && top.website)     patch.website     = top.website;

      const updated = storage.updateContact(id, patch);
      res.json({ contact: updated, enriched: Object.keys(patch) });
    } catch (e: any) {
      console.error('Enrich error:', e);
      res.status(500).json({ error: 'Enrichment failed: ' + e.message });
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
