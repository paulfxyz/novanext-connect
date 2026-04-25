import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, ArrowUpRight, Linkedin, Twitter, Github, Globe, MapPin, Building2, Zap } from "lucide-react";
import type { Contact } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// NovaNEXT Logo SVG
function NovaNextLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="NovaNEXT Connect">
      <rect width="40" height="40" rx="8" fill="#2020C8"/>
      <path d="M7 28V12h4.5l8.5 12 8.5-12H33v16h-4V18L20 28 11 18v10z" fill="#00E5D0"/>
    </svg>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  const tags: string[] = (() => {
    try { return JSON.parse(contact.tags || "[]"); } catch { return []; }
  })();

  const initials = contact.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Link href={`/contact/${contact.slug}`}>
      <div className="nova-card p-4 cursor-pointer" data-testid={`card-contact-${contact.id}`}>
        <div className="flex items-start gap-3 mb-3">
          <div className="nova-avatar" style={{ width: '52px', height: '52px', fontSize: '1.1rem', flexShrink: 0 }}>
            {contact.avatarUrl
              ? <img src={contact.avatarUrl} alt={contact.name} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}/>
              : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4px' }}>
              <h3 className="font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', wordBreak: 'break-word' }}>
                {contact.name}
              </h3>
              <ArrowUpRight size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: '2px' }}/>
            </div>
            {contact.title && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--nova-cyan)', wordBreak: 'break-word' }}>
                {contact.title}
              </p>
            )}
            {contact.companyName && (
              <p className="text-xs text-white/50 mt-0.5 flex items-start gap-1">
                <Building2 size={11} style={{ flexShrink: 0, marginTop: '2px' }}/>
                <span style={{ wordBreak: 'break-word' }}>{contact.companyName}</span>
              </p>
            )}
          </div>
        </div>

        {contact.bio && (
          <p className="text-sm text-white/60 line-clamp-2 mb-4 leading-relaxed">
            {contact.bio}
          </p>
        )}

        {contact.location && (
          <p className="text-xs text-white/40 flex items-center gap-1 mb-3">
            <MapPin size={11}/> {contact.location}
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className="nova-tag">{tag}</span>
            ))}
          </div>
        )}

        {/* Social Links */}
        <div className="flex gap-2 flex-wrap">
          {contact.linkedinUrl && (
            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="nova-badge" onClick={e => e.stopPropagation()}>
              <Linkedin size={11}/> LinkedIn
            </a>
          )}
          {contact.twitterUrl && (
            <a href={contact.twitterUrl} target="_blank" rel="noopener noreferrer"
              className="nova-badge" onClick={e => e.stopPropagation()}>
              <Twitter size={11}/> X
            </a>
          )}
          {contact.githubUrl && (
            <a href={contact.githubUrl} target="_blank" rel="noopener noreferrer"
              className="nova-badge" onClick={e => e.stopPropagation()}>
              <Github size={11}/> GitHub
            </a>
          )}
          {contact.website && (
            <a href={contact.website} target="_blank" rel="noopener noreferrer"
              className="nova-badge" onClick={e => e.stopPropagation()}>
              <Globe size={11}/> Web
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="nova-card p-5 h-48">
      <div className="flex items-start gap-4 mb-4">
        <div className="nova-skeleton rounded-full w-16 h-16"/>
        <div className="flex-1 space-y-2">
          <div className="nova-skeleton h-5 w-3/4 rounded"/>
          <div className="nova-skeleton h-3.5 w-1/2 rounded"/>
          <div className="nova-skeleton h-3 w-1/3 rounded"/>
        </div>
      </div>
      <div className="space-y-2">
        <div className="nova-skeleton h-3 w-full rounded"/>
        <div className="nova-skeleton h-3 w-4/5 rounded"/>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: allContacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/search", debouncedQuery],
    queryFn: () => apiRequest("GET", `/api/contacts/search?q=${encodeURIComponent(debouncedQuery)}`).then(r => r.json()),
    enabled: debouncedQuery.length >= 1,
  });

  const contacts = debouncedQuery ? (searchResults || []) : allContacts;
  const loading = isLoading || (debouncedQuery && isSearching);

  return (
    <div className="nova-bg" style={{ minHeight: '100dvh' }}>
      {/* Noise texture overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        backgroundSize: '200px'
      }}/>

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NovaNextLogo size={36}/>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'white', lineHeight: 1 }}>
                NovaNEXT
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--nova-cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                Connect · Aveiro 2026
              </div>
            </div>
          </div>
          <Link href="/admin/login">
            <button className="nova-btn-primary" style={{ fontSize: '0.75rem', padding: '8px 18px' }}>
              Admin ↗
            </button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '48px 24px 40px' }}>
        {/* Electric orb ring */}
        <div style={{
          position: 'absolute', left: '50%', top: '0', transform: 'translateX(-50%)',
          width: '600px', height: '300px',
          background: 'radial-gradient(ellipse at center, rgba(32,32,200,0.3) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none'
        }}/>

        <div style={{ position: 'relative' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--nova-cyan)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>
            17 June 2026 · Aveiro, Portugal
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'white', lineHeight: 1.05, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
            Who's at{' '}
            <span className="nova-gradient-text">NovaNEXT?</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto 40px', lineHeight: 1.6 }}>
            Search attendees, speakers, founders and investors attending the #1 Future Tech Conference in Portugal.
          </p>

          {/* Search */}
          <div style={{ maxWidth: '520px', margin: '0 auto', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}/>
            <input
              type="text"
              className="nova-search"
              placeholder="Search by name, company or role..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ paddingLeft: '50px' }}
              data-testid="input-search"
            />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', gap: '32px', padding: '0 24px 32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', color: 'var(--nova-cyan)' }}>
              {allContacts.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Attendees
            </div>
          </div>
          {debouncedQuery && (
            <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}/>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.8rem', color: 'var(--nova-pink)' }}>
                  {contacts.length}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Results
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Grid */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', padding: '0 16px 80px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i}/>)}
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', color: 'white', marginBottom: '8px' }}>
              {debouncedQuery ? `No results for "${debouncedQuery}"` : "No attendees yet"}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginBottom: debouncedQuery ? '28px' : '0' }}>
              {debouncedQuery ? "Try a different search term, or research this person with AI." : "Check back soon — the roster is being assembled."}
            </p>
            {debouncedQuery && (
              <a
                href={`#/admin?q=${encodeURIComponent(debouncedQuery)}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'linear-gradient(135deg, var(--nova-blue) 0%, rgba(32,32,200,0.8) 100%)',
                  border: '1px solid rgba(32,32,200,0.5)',
                  borderRadius: '12px', padding: '12px 24px',
                  color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: '0.9rem', letterSpacing: '0.02em', textDecoration: 'none',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  boxShadow: '0 0 24px rgba(32,32,200,0.3)'
                }}
                data-testid="btn-research-ai-empty"
              >
                <Zap size={15}/>
                Research "{debouncedQuery}" with AI →
              </a>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {contacts.map(contact => (
                <ContactCard key={contact.id} contact={contact}/>
              ))}
            </div>
            {/* Floating AI research CTA when search has results */}
            {debouncedQuery && contacts.length > 0 && (
              <div style={{ textAlign: 'center', paddingTop: '36px' }}>
                <a
                  href={`#/admin?q=${encodeURIComponent(debouncedQuery)}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(32,32,200,0.12)',
                    border: '1px solid rgba(32,32,200,0.35)',
                    borderRadius: '12px', padding: '10px 22px',
                    color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-display)', fontWeight: 700,
                    fontSize: '0.82rem', letterSpacing: '0.02em', textDecoration: 'none',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                  }}
                  data-testid="btn-research-ai-results"
                >
                  <Zap size={13}/>
                  Research "{debouncedQuery}" with AI →
                </a>
                <p style={{ marginTop: '8px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                  Not finding the right person? Add them via Admin.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
          NovaNEXT Connect · Aveiro 2026 · Built with ❤️ for the ecosystem
        </p>
      </footer>
    </div>
  );
}
