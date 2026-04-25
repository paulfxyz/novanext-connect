import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { getAdminAuth, setAdminAuth } from "@/lib/adminAuth";
import AdminImport from "./admin-import";
import {
  Search, Plus, Trash2, X, Users, Building2,
  ArrowLeft, Linkedin, Twitter, Github,
  Zap, ChevronRight, RefreshCw, LogOut, Upload
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contact, ContactSuggestion } from "@shared/schema";

function NovaNextLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="NovaNEXT">
      <rect width="40" height="40" rx="8" fill="#2020C8"/>
      <path d="M7 28V12h4.5l8.5 12 8.5-12H33v16h-4V18L20 28 11 18v10z" fill="#00E5D0"/>
    </svg>
  );
}

// ── Suggestion Card ────────────────────────────────────────────────────────
function SuggestionCard({
  suggestion, onAdd, isAdding
}: { suggestion: ContactSuggestion; onAdd: (s: ContactSuggestion) => void; isAdding: boolean }) {
  const confidence = Math.round((suggestion.confidence || 0.5) * 100);
  const initials = suggestion.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="nova-card suggestion-card" style={{ padding: '20px', position: 'relative' }}>
      {/* Confidence */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div className="confidence-bar" style={{ width: '50px' }}>
          <div className="confidence-fill" style={{ width: `${confidence}%` }}/>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{confidence}%</span>
      </div>

      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div className="nova-avatar" style={{ width: '52px', height: '52px', fontSize: '1.1rem', flexShrink: 0 }}>
          {suggestion.avatarUrl
            ? <img src={suggestion.avatarUrl} alt={suggestion.name} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}/>
            : initials}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: '70px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'white', marginBottom: '2px' }}>
            {suggestion.name}
          </h3>
          {suggestion.title && (
            <p style={{ fontSize: '0.8rem', color: 'var(--nova-cyan)', fontWeight: 600 }}>{suggestion.title}</p>
          )}
          {suggestion.companyName && (
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Building2 size={10}/> {suggestion.companyName}
            </p>
          )}
        </div>
      </div>

      {suggestion.bio && (
        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {suggestion.bio}
        </p>
      )}

      {/* Reason badge */}
      {suggestion.reason && (
        <div style={{ background: 'rgba(0,229,208,0.06)', border: '1px solid rgba(0,229,208,0.15)', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--nova-cyan)', fontWeight: 600 }}>Why here: </span>
            {suggestion.reason}
          </p>
        </div>
      )}

      {/* Social badges */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {suggestion.linkedinUrl && <span className="nova-badge"><Linkedin size={9}/> LinkedIn</span>}
        {suggestion.twitterUrl && <span className="nova-badge"><Twitter size={9}/> X</span>}
        {suggestion.githubUrl && <span className="nova-badge"><Github size={9}/> GitHub</span>}
        {suggestion.website && <span className="nova-badge"><Globe size={9}/> Web</span>}
        {suggestion.location && <span className="nova-badge"><MapPin size={9}/> {suggestion.location}</span>}
      </div>

      {/* Tags */}
      {suggestion.tags && suggestion.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {suggestion.tags.slice(0, 4).map(t => <span key={t} className="nova-tag">{t}</span>)}
        </div>
      )}

      {/* Add button */}
      <button
        className="nova-btn-cyan"
        style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '10px' }}
        onClick={() => onAdd(suggestion)}
        disabled={isAdding}
        data-testid={`btn-add-suggestion-${suggestion.name.replace(/\s/g, '-').toLowerCase()}`}
      >
        {isAdding ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>}
        {isAdding ? 'Adding...' : 'Add to Directory'}
      </button>
    </div>
  );
}

// ── Entry Row ──────────────────────────────────────────────────────────────
function EntryRow({ contact, onDelete }: { contact: Contact; onDelete: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false);
  const initials = contact.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const tags: string[] = (() => { try { return JSON.parse(contact.tags || "[]"); } catch { return []; } })();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(32,32,200,0.06)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      {/* Avatar */}
      <div className="nova-avatar" style={{ width: '40px', height: '40px', fontSize: '0.85rem', flexShrink: 0 }}>
        {contact.avatarUrl
          ? <img src={contact.avatarUrl} alt={contact.name} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}/>
          : initials}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>
            {contact.name}
          </span>
          {tags.slice(0, 2).map(t => <span key={t} className="nova-tag" style={{ fontSize: '0.6rem' }}>{t}</span>)}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>
          {contact.title || '—'}{contact.companyName ? ` · ${contact.companyName}` : ''}
        </p>
      </div>
      {/* Social icons */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {contact.linkedinUrl && <Linkedin size={13} style={{ color: 'rgba(255,255,255,0.3)' }}/>}
        {contact.twitterUrl && <Twitter size={13} style={{ color: 'rgba(255,255,255,0.3)' }}/>}
        {contact.githubUrl && <Github size={13} style={{ color: 'rgba(255,255,255,0.3)' }}/>}
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
        <Link href={`/contact/${contact.slug}`}>
          <button style={{ padding: '6px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
            data-testid={`btn-view-${contact.id}`}>
            <ChevronRight size={16}/>
          </button>
        </Link>
        {confirming ? (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button style={{ padding: '5px 10px', background: 'rgba(224,64,251,0.2)', border: '1px solid rgba(224,64,251,0.3)', borderRadius: '6px', color: 'var(--nova-pink)', fontSize: '0.75rem', cursor: 'pointer' }}
              onClick={() => { onDelete(contact.id); setConfirming(false); }}
              data-testid={`btn-confirm-delete-${contact.id}`}>
              Delete
            </button>
            <button style={{ padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              onClick={() => setConfirming(false)}>
              <X size={12}/>
            </button>
          </div>
        ) : (
          <button style={{ padding: '6px', color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--nova-pink)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'; }}
            onClick={() => setConfirming(true)}
            data-testid={`btn-delete-${contact.id}`}>
            <Trash2 size={15}/>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Page ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"research" | "entries" | "import">("research");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [addingName, setAddingName] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const { toast } = useToast();

  // Auth check
  useEffect(() => {
    if (!getAdminAuth()) navigate("/admin/login");
  }, []);

  const logout = () => {
    setAdminAuth(false);
    navigate("/admin/login");
  };

  // Contacts list
  const { data: contacts = [], isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Research mutation
  const researchMutation = useMutation({
    mutationFn: (query: string) =>
      apiRequest("POST", "/api/admin/research", { query }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        toast({ title: `Found ${data.suggestions.length} suggestions`, description: "Select the right one to add." });
      } else {
        toast({ title: "No suggestions found", description: "Try a different search query.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Research failed", description: "Check your connection and try again.", variant: "destructive" });
    }
  });

  // Add contact mutation
  const addContactMutation = useMutation({
    mutationFn: (suggestion: ContactSuggestion) =>
      apiRequest("POST", "/api/admin/contacts", {
        name: suggestion.name,
        slug: suggestion.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        title: suggestion.title || null,
        bio: suggestion.bio || null,
        avatarUrl: suggestion.avatarUrl || null,
        location: suggestion.location || null,
        companyName: suggestion.companyName || null,
        companyRole: suggestion.companyRole || null,
        website: suggestion.website || null,
        linkedinUrl: suggestion.linkedinUrl || null,
        twitterUrl: suggestion.twitterUrl || null,
        githubUrl: suggestion.githubUrl || null,
        tags: JSON.stringify(suggestion.tags || []),
        socialLinks: "[]",
        isVerified: false,
      }).then(r => r.json()),
    onSuccess: (_, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setAddingName(null);
      setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
      toast({ title: `✓ ${suggestion.name} added`, description: "Now visible in the public directory." });
      if (suggestions.length <= 1) setSuggestions([]);
    },
    onError: () => {
      setAddingName(null);
      toast({ title: "Failed to add contact", variant: "destructive" });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact removed" });
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSuggestions([]);
    researchMutation.mutate(searchQuery.trim());
  };

  const handleAdd = (suggestion: ContactSuggestion) => {
    setAddingName(suggestion.name);
    addContactMutation.mutate(suggestion);
  };

  const filteredContacts = contacts.filter(c =>
    !filterQuery || c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (c.companyName || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="admin-layout">
      {/* Background glow */}
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '500px', height: '400px', background: 'radial-gradient(ellipse at center, rgba(224,64,251,0.08) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }}/>

      {/* Top nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,24,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '12px 16px' }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <NovaNextLogo size={28}/>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.88rem', color: 'white', letterSpacing: '0.02em' }}>NovaNEXT Admin</div>
              <div style={{ fontSize: '0.58rem', color: 'var(--nova-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Aveiro 2026</div>
            </div>
            <div style={{ flex: 1 }}/>
            <Link href="/">
              <button style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                <ArrowLeft size={12}/> View
              </button>
            </Link>
            <button style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', background: 'none', border: 'none', cursor: 'pointer' }} onClick={logout}>
              <LogOut size={12}/> Out
            </button>
          </div>
          {/* Tabs row */}
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '3px' }}>
            {[
              { id: 'research', label: 'Research', icon: <Zap size={12}/> },
              { id: 'import', label: 'Import', icon: <Upload size={12}/> },
              { id: 'entries', label: `Entries (${contacts.length})`, icon: <Users size={12}/> }
            ].map(tab => (
              <button key={tab.id}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '8px 8px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600,
                  background: view === tab.id ? 'var(--nova-blue)' : 'transparent',
                  color: view === tab.id ? 'white' : 'rgba(255,255,255,0.45)',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setView(tab.id as any)}
                data-testid={`btn-tab-${tab.id}`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }}>

        {/* ── RESEARCH TAB ─────────────────────────────────────────────────── */}
        {view === "research" && (
          <div>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem', color: 'white', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '6px' }}>
                Research a Person or Company
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
                Type a name — our AI queries 3 models simultaneously and returns the most likely NovaNEXT attendees.
              </p>
            </div>

            {/* Search form */}
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}/>
                <input
                  type="text"
                  className="nova-search"
                  placeholder="e.g. Pedro Quintas, Startup Lisboa, Hypernova..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '44px', borderRadius: '12px' }}
                  data-testid="input-admin-search"
                />
              </div>
              <button type="submit" className="nova-btn-primary" disabled={researchMutation.isPending} style={{ borderRadius: '12px', whiteSpace: 'nowrap' }} data-testid="btn-research">
                {researchMutation.isPending ? (
                  <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }}/> Researching...</>
                ) : (
                  <><Zap size={15}/> Research</>
                )}
              </button>
            </form>

            {/* Loading state */}
            {researchMutation.isPending && (
              <div style={{ textAlign: 'center', padding: '48px', background: 'rgba(32,32,200,0.05)', borderRadius: '16px', border: '1px dashed rgba(32,32,200,0.3)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚡</div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
                  Querying 3 AI models simultaneously...
                </p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', marginTop: '6px' }}>
                  Claude · Gemini · GPT-4o — finding the best match for NovaNEXT 2026
                </p>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && !researchMutation.isPending && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--nova-cyan)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {suggestions.length} Suggestions Found
                  </h3>
                  <button style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => setSuggestions([])}>
                    <X size={13}/> Clear
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                  {suggestions.map((s, i) => (
                    <SuggestionCard
                      key={`${s.name}-${i}`}
                      suggestion={s}
                      onAdd={handleAdd}
                      isAdding={addingName === s.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!researchMutation.isPending && suggestions.length === 0 && (
              <div style={{ padding: '48px 24px', textAlign: 'center', opacity: 0.6 }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔎</div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                  Search for a name or company to get AI-powered suggestions
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── IMPORT TAB ────────────────────────────────────────────────────── */}
        {view === "import" && (
          <AdminImport onDone={() => setView("entries")}/>
        )}

        {/* ── ENTRIES TAB ───────────────────────────────────────────────────── */}
        {view === "entries" && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem', color: 'white', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '4px' }}>
                  Directory Entries
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                  {contacts.length} {contacts.length === 1 ? 'person' : 'people'} in the directory
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="nova-btn-primary" style={{ fontSize: '0.78rem', borderRadius: '10px', padding: '8px 14px' }}
                  onClick={() => setView("research")}>
                  <Zap size={13}/> Research
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', borderRadius: '10px', padding: '8px 14px', background: 'rgba(0,229,208,0.1)', border: '1px solid rgba(0,229,208,0.25)', color: 'var(--nova-cyan)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.04em' }}
                  onClick={() => setView("import")}>
                  <Upload size={13}/> Import
                </button>
              </div>
            </div>

            {/* Filter */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}/>
              <input
                type="text"
                className="nova-search"
                placeholder="Filter by name or company..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                style={{ paddingLeft: '40px', borderRadius: '10px', padding: '10px 14px 10px 40px', fontSize: '0.88rem' }}
                data-testid="input-filter"
              />
            </div>

            {/* List */}
            <div className="nova-card" style={{ padding: 0, overflow: 'hidden' }}>
              {loadingContacts ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
                  Loading...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👥</div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
                    {filterQuery ? 'No results match your filter' : 'No entries yet — use Research to add people'}
                  </p>
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <EntryRow
                    key={contact.id}
                    contact={contact}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
