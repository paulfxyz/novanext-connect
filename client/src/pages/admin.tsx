import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { getAdminAuth, setAdminAuth } from "@/lib/adminAuth";
import AdminImport from "./admin-import";
import {
  Search, Plus, Trash2, X, Users, Building2,
  ArrowLeft, Linkedin, Twitter, Github, Globe, MapPin,
  Zap, ChevronRight, RefreshCw, LogOut, Upload, ExternalLink, ShieldCheck,
  Pencil, Check, Sparkles
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contact, ContactSuggestion } from "@shared/schema";

function NovaNextLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="NovaNEXT">
      <rect width="40" height="40" rx="8" fill="#2020C8"/>
      <path d="M8 28V12h4l10 12V12h4v16h-4L12 16v12z" fill="#00E5D0"/>
    </svg>
  );
}

// ── Suggestion Card ────────────────────────────────────────────────────────
function SuggestionCard({
  suggestion, onAdd, isAdding
}: { suggestion: ContactSuggestion; onAdd: (s: ContactSuggestion) => void; isAdding: boolean }) {
  const [bioExpanded, setBioExpanded] = useState(false);

  // Defensive: ensure name is always a string
  const name = suggestion?.name ? String(suggestion.name) : 'Unknown';
  const confidence = Math.round(Math.min(1, Math.max(0, Number(suggestion?.confidence) || 0.5)) * 100);
  const initials = name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || '?';
  // Defensive: tags must be an array of strings
  const tags: string[] = Array.isArray(suggestion?.tags)
    ? suggestion.tags.map(String)
    : typeof suggestion?.tags === 'string'
      ? (suggestion.tags as string).split(',').map(t => t.trim()).filter(Boolean)
      : [];
  const safeName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const bio = suggestion?.bio ? String(suggestion.bio) : '';
  // Show bio collapsed (4 lines) unless expanded
  const bioLines = bio.split('\n').join(' ');
  const isBioLong = bioLines.length > 220;

  // Confidence colour: green > 80%, cyan > 60%, yellow > 40%, else dim
  const confColor = confidence >= 80 ? '#4ade80' : confidence >= 60 ? 'var(--nova-cyan)' : confidence >= 40 ? '#facc15' : 'rgba(255,255,255,0.3)';
  const isScraped = suggestion?.source === 'scraped profile';

  return (
    <div className="nova-card suggestion-card" style={{ padding: '20px', position: 'relative' }}>
      {/* Confidence badge + source */}
      <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
        <div className="confidence-bar" style={{ width: '48px' }}>
          <div className="confidence-fill" style={{ width: `${confidence}%`, background: confColor }}/>
        </div>
        <span style={{ fontSize: '0.65rem', color: confColor, fontWeight: 700 }}>{confidence}%</span>
        {isScraped && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', color: '#4ade80', fontWeight: 700, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '4px', padding: '1px 5px' }}>
            <ShieldCheck size={8}/> VERIFIED
          </span>
        )}
      </div>

      {/* Header: avatar + name + title + company */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div className="nova-avatar" style={{ width: '52px', height: '52px', fontSize: '1.1rem', flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: '64px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'white', marginBottom: '3px', lineHeight: 1.2 }}>
            {name}
          </h3>
          {suggestion?.title && (
            <p style={{ fontSize: '0.8rem', color: 'var(--nova-cyan)', fontWeight: 600, marginBottom: '2px' }}>{String(suggestion.title)}</p>
          )}
          {(suggestion?.companyName || suggestion?.companyRole) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {suggestion?.companyName && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Building2 size={10} style={{ flexShrink: 0 }}/>
                  <span style={{ fontWeight: 600 }}>{String(suggestion.companyName)}</span>
                </p>
              )}
              {suggestion?.companyRole && suggestion?.companyRole !== suggestion?.title && (
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', paddingLeft: '14px' }}>
                  {String(suggestion.companyRole)}
                </p>
              )}
            </div>
          )}
          {suggestion?.location && (
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
              <MapPin size={9}/> {String(suggestion.location)}
            </p>
          )}
        </div>
      </div>

      {/* Bio — full text, collapsible if long */}
      {bio && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.65,
            ...(isBioLong && !bioExpanded ? {
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            } : {})
          }}>
            {bioLines}
          </p>
          {isBioLong && (
            <button
              onClick={() => setBioExpanded(!bioExpanded)}
              style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--nova-cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
            >
              {bioExpanded ? 'Show less ↑' : 'Show more ↓'}
            </button>
          )}
        </div>
      )}

      {/* Reason badge */}
      {suggestion?.reason && (
        <div style={{ background: 'rgba(0,229,208,0.06)', border: '1px solid rgba(0,229,208,0.15)', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--nova-cyan)', fontWeight: 600 }}>Why here: </span>
            {String(suggestion.reason)}
          </p>
        </div>
      )}

      {/* Live social links — always shown, click to verify */}
      {(suggestion?.linkedinUrl || suggestion?.twitterUrl || suggestion?.githubUrl || suggestion?.website) && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Links — click to verify</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {suggestion?.linkedinUrl && (
              <a href={String(suggestion.linkedinUrl)} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px',
                  background: 'rgba(10,102,194,0.15)', border: '1px solid rgba(10,102,194,0.4)',
                  borderRadius: '8px', color: '#60a5fa', textDecoration: 'none',
                  cursor: 'pointer',
                }}
                onClick={e => e.stopPropagation()}
                title={String(suggestion.linkedinUrl)}
              >
                <Linkedin size={10}/> LinkedIn <ExternalLink size={8} style={{ opacity: 0.5 }}/>
              </a>
            )}
            {suggestion?.twitterUrl && (
              <a href={String(suggestion.twitterUrl)} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px',
                  background: 'rgba(29,155,240,0.12)', border: '1px solid rgba(29,155,240,0.35)',
                  borderRadius: '8px', color: '#60c8fa', textDecoration: 'none',
                  cursor: 'pointer',
                }}
                onClick={e => e.stopPropagation()}
                title={String(suggestion.twitterUrl)}
              >
                <Twitter size={10}/> X / Twitter <ExternalLink size={8} style={{ opacity: 0.5 }}/>
              </a>
            )}
            {suggestion?.githubUrl && (
              <a href={String(suggestion.githubUrl)} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
                  cursor: 'pointer',
                }}
                onClick={e => e.stopPropagation()}
                title={String(suggestion.githubUrl)}
              >
                <Github size={10}/> GitHub <ExternalLink size={8} style={{ opacity: 0.5 }}/>
              </a>
            )}
            {suggestion?.website && (
              <a href={String(suggestion.website)} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px',
                  background: 'rgba(0,229,208,0.08)', border: '1px solid rgba(0,229,208,0.25)',
                  borderRadius: '8px', color: 'var(--nova-cyan)', textDecoration: 'none',
                  cursor: 'pointer',
                }}
                onClick={e => e.stopPropagation()}
                title={String(suggestion.website)}
              >
                <Globe size={10}/> Website <ExternalLink size={8} style={{ opacity: 0.5 }}/>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {tags.slice(0, 5).map((t, i) => <span key={`${t}-${i}`} className="nova-tag">{t}</span>)}
        </div>
      )}

      {/* Add button */}
      <button
        className="nova-btn-cyan"
        style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '10px' }}
        onClick={() => onAdd(suggestion)}
        disabled={isAdding}
        data-testid={`btn-add-suggestion-${safeName}`}
      >
        {isAdding ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>}
        {isAdding ? 'Adding...' : 'Add to Directory'}
      </button>
    </div>
  );
}

// ── Entry Row ──────────────────────────────────────────────────────────────
// ── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({ contact, onClose, onSaved }: {
  contact: Contact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Parse existing tags
  const parseTags = (raw: string | null | undefined): string[] => {
    try { return JSON.parse(raw || '[]'); } catch { return []; }
  };

  const [form, setForm] = useState({
    name:        contact.name        || '',
    title:       contact.title       || '',
    companyName: contact.companyName || '',
    companyRole: contact.companyRole || '',
    location:    contact.location    || '',
    bio:         contact.bio         || '',
    linkedinUrl: contact.linkedinUrl || '',
    twitterUrl:  contact.twitterUrl  || '',
    githubUrl:   contact.githubUrl   || '',
    website:     contact.website     || '',
  });
  const [tags, setTags]         = useState<string[]>(parseTags(contact.tags));
  const [tagInput, setTagInput] = useState('');

  function addTag(raw: string) {
    const t = raw.trim().replace(/,+$/, '').trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  }

  function removeTag(t: string) { setTags(prev => prev.filter(x => x !== t)); }

  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
    if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1]);
  }

  async function save() {
    if (!form.name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await apiRequest('PATCH', `/api/admin/contacts/${contact.id}`, {
        name:        form.name.trim()        || null,
        title:       form.title.trim()       || null,
        companyName: form.companyName.trim() || null,
        companyRole: form.companyRole.trim() || null,
        location:    form.location.trim()    || null,
        bio:         form.bio.trim()         || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        twitterUrl:  form.twitterUrl.trim()  || null,
        githubUrl:   form.githubUrl.trim()   || null,
        website:     form.website.trim()     || null,
        tags:        JSON.stringify(tags),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: 'Saved' });
      onSaved();
      onClose();
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const field = (
    label: string,
    key: keyof typeof form,
    placeholder: string,
    type: 'input' | 'url' = 'input',
    icon?: React.ReactNode
  ) => (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>
        {icon} {label}
      </label>
      <input
        type={type === 'url' ? 'url' : 'text'}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        data-testid={`modal-input-${key}-${contact.id}`}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
          padding: '10px 12px', color: 'white', fontSize: '0.85rem',
          fontFamily: 'var(--font-body)', outline: 'none',
          boxSizing: 'border-box' as const, transition: 'border-color 0.15s',
        }}
        onFocus={e  => { e.currentTarget.style.borderColor = 'rgba(0,229,208,0.5)'; }}
        onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      />
    </div>
  );

  const initials = form.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return createPortal(
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(8,8,24,0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Modal panel — stop propagation so clicks inside don't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '620px',
          maxHeight: '92vh',
          background: 'var(--nova-card)',
          border: '1px solid var(--nova-border)',
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,208,0.08)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div className="nova-avatar" style={{ width: '44px', height: '44px', fontSize: '0.9rem', flexShrink: 0 }}>
            {contact.avatarUrl
              ? <img src={contact.avatarUrl} alt={contact.name} onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'white', fontSize: '1rem', margin: 0 }}>
              {contact.name}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--nova-cyan)', margin: '2px 0 0', opacity: 0.8 }}>
              Edit profile
            </p>
          </div>
          <button onClick={onClose} style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}>
            <X size={16}/>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Identity ── */}
          <section>
            <p style={{ fontSize: '0.65rem', color: 'var(--nova-cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px', opacity: 0.7 }}>Identity</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {field('Full name',  'name',        'Full Name')}
              {field('Title / Role', 'title',     'e.g. Entrepreneur, Investor')}
              {field('Company',    'companyName', 'Company name')}
              {field('Role at co.','companyRole', 'e.g. Co-founder & CEO')}
              <div style={{ gridColumn: '1 / -1' }}>
                {field('Location', 'location', 'City, Country', 'input', <MapPin size={11}/>)}
              </div>
            </div>
          </section>

          {/* ── Bio ── */}
          <section>
            <p style={{ fontSize: '0.65rem', color: 'var(--nova-cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px', opacity: 0.7 }}>Bio</p>
            <textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Write a short bio — who they are and what they build..."
              rows={4}
              data-testid={`modal-bio-${contact.id}`}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                padding: '10px 12px', color: 'white', fontSize: '0.85rem',
                lineHeight: 1.7, resize: 'vertical', fontFamily: 'var(--font-body)',
                outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.15s',
              }}
              onFocus={e  => { e.currentTarget.style.borderColor = 'rgba(0,229,208,0.5)'; }}
              onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
          </section>

          {/* ── Tags ── */}
          <section>
            <p style={{ fontSize: '0.65rem', color: 'var(--nova-cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px', opacity: 0.7 }}>Tags</p>
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', gap: '7px', alignItems: 'center',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '8px 10px',
                cursor: 'text', minHeight: '44px',
              }}
              onClick={() => (document.getElementById(`tag-input-${contact.id}`) as HTMLInputElement)?.focus()}
            >
              {tags.map(t => (
                <span key={t} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(32,32,200,0.35)', border: '1px solid rgba(32,32,200,0.6)',
                  borderRadius: '20px', padding: '3px 10px 3px 12px',
                  fontSize: '0.72rem', color: 'var(--nova-cyan)', fontWeight: 600,
                  letterSpacing: '0.04em',
                }}>
                  {t}
                  <button
                    onClick={e => { e.stopPropagation(); removeTag(t); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,229,208,0.6)', padding: '0', lineHeight: 1, fontSize: '0.9rem', display: 'flex' }}
                    data-testid={`btn-remove-tag-${t}-${contact.id}`}
                  >&times;</button>
                </span>
              ))}
              <input
                id={`tag-input-${contact.id}`}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder={tags.length === 0 ? 'Type a tag and press Enter or comma…' : 'Add tag…'}
                data-testid={`modal-tag-input-${contact.id}`}
                style={{
                  flex: '1 1 120px', minWidth: '100px',
                  background: 'none', border: 'none', outline: 'none',
                  color: 'white', fontSize: '0.83rem', fontFamily: 'var(--font-body)',
                  padding: '2px 4px',
                }}
              />
            </div>
            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
              Press <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem' }}>Enter</kbd> or <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem' }}>,</kbd> to add &nbsp;·&nbsp; <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem' }}>⌫</kbd> to remove last
            </p>
          </section>

          {/* ── Social Links ── */}
          <section>
            <p style={{ fontSize: '0.65rem', color: 'var(--nova-cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px', opacity: 0.7 }}>Social &amp; Web</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {field('LinkedIn',    'linkedinUrl', 'https://linkedin.com/in/…', 'url', <Linkedin size={11}/>)}
              {field('Twitter / X', 'twitterUrl',  'https://x.com/…',           'url', <Twitter  size={11}/>)}
              {field('GitHub',      'githubUrl',   'https://github.com/…',       'url', <Github   size={11}/>)}
              {field('Website',     'website',     'https://…',                  'url', <Globe    size={11}/>)}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          background: 'rgba(8,8,24,0.4)',
        }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s' }}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            data-testid={`modal-save-${contact.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 24px',
              background: saving ? 'rgba(32,32,200,0.3)' : 'linear-gradient(135deg, #2020C8, #3535EE)',
              border: '1px solid rgba(53,53,238,0.6)', borderRadius: '10px',
              color: 'white', fontSize: '0.85rem', fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1, transition: 'all 0.15s',
              boxShadow: saving ? 'none' : '0 4px 16px rgba(32,32,200,0.4)',
            }}
          >
            <Check size={15}/> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Entry Row ────────────────────────────────────────────────────────────────
function EntryRow({ contact, onDelete }: { contact: Contact; onDelete: (id: number) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const { toast } = useToast();

  const enrichMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/admin/contacts/${contact.id}/enrich`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      const fields = data?.enriched || [];
      toast({ title: 'Profile refreshed', description: fields.length > 0 ? `Updated: ${fields.join(', ')}` : 'Bio and tags updated.' });
    },
    onError: (e: any) => {
      toast({ title: 'Enrichment failed', description: e?.message || 'Could not reach research engine.', variant: 'destructive' });
    },
  });

  const tags: string[] = (() => { try { return JSON.parse(contact.tags || '[]'); } catch { return []; } })();
  const initials = contact.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      {showEdit && (
        <EditModal
          contact={contact}
          onClose={() => setShowEdit(false)}
          onSaved={() => setShowEdit(false)}
        />
      )}

      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', transition: 'background 0.15s ease' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(32,32,200,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>

          {/* Avatar */}
          <div className="nova-avatar" style={{ width: '40px', height: '40px', fontSize: '0.85rem', flexShrink: 0 }}>
            {contact.avatarUrl
              ? <img src={contact.avatarUrl} alt={contact.name} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
              : initials}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>
                {contact.name}
              </span>
              {tags.slice(0, 3).map(t => (
                <span key={t} className="nova-tag" style={{ fontSize: '0.6rem' }}>{t}</span>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>
              {contact.title || '\u2014'}{contact.companyName ? ` \u00b7 ${contact.companyName}` : ''}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }}>
              {contact.bio
                ? contact.bio
                : <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.16)' }}>No bio yet</span>}
            </p>
          </div>

          {/* Social indicators */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
            {contact.linkedinUrl && <Linkedin size={12} style={{ color: 'rgba(255,255,255,0.3)' }}/>}
            {contact.twitterUrl  && <Twitter  size={12} style={{ color: 'rgba(255,255,255,0.3)' }}/>}
            {contact.githubUrl   && <Github   size={12} style={{ color: 'rgba(255,255,255,0.3)' }}/>}
            {contact.website     && <Globe    size={12} style={{ color: 'rgba(255,255,255,0.3)' }}/>}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            {/* AI Enrich */}
            <button
              title="Re-enrich with AI"
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
              data-testid={`btn-enrich-${contact.id}`}
              style={{ padding: '6px', color: enrichMutation.isPending ? 'var(--nova-cyan)' : 'rgba(255,255,255,0.35)', background: enrichMutation.isPending ? 'rgba(0,229,208,0.1)' : 'none', border: 'none', cursor: enrichMutation.isPending ? 'wait' : 'pointer', borderRadius: '6px', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!enrichMutation.isPending) { (e.currentTarget as HTMLElement).style.color = 'var(--nova-cyan)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,208,0.08)'; } }}
              onMouseLeave={e => { if (!enrichMutation.isPending) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.background = 'none'; } }}>
              <Sparkles size={14} style={{ animation: enrichMutation.isPending ? 'spin 1s linear infinite' : 'none' }}/>
            </button>
            {/* Edit */}
            <button
              title="Edit profile"
              onClick={() => setShowEdit(true)}
              data-testid={`btn-edit-${contact.id}`}
              style={{ padding: '6px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--nova-cyan)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,208,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}>
              <Pencil size={14}/>
            </button>
            {/* View */}
            <Link href={`/contact/${contact.slug}`}>
              <button
                data-testid={`btn-view-${contact.id}`}
                style={{ padding: '6px', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                <ChevronRight size={16}/>
              </button>
            </Link>
            {/* Delete */}
            {confirming ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  style={{ padding: '5px 10px', background: 'rgba(224,64,251,0.15)', border: '1px solid rgba(224,64,251,0.3)', borderRadius: '6px', color: 'var(--nova-pink)', fontSize: '0.75rem', cursor: 'pointer' }}
                  onClick={() => { onDelete(contact.id); setConfirming(false); }}
                  data-testid={`btn-confirm-delete-${contact.id}`}>
                  Delete
                </button>
                <button style={{ padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                  onClick={() => setConfirming(false)}>
                  <X size={12}/>
                </button>
              </div>
            ) : (
              <button
                data-testid={`btn-delete-${contact.id}`}
                style={{ padding: '6px', color: 'rgba(255,255,255,0.22)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--nova-pink)'; (e.currentTarget as HTMLElement).style.background = 'rgba(224,64,251,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.22)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
                onClick={() => setConfirming(true)}>
                <Trash2 size={15}/>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
// ── Main Admin Page ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"research" | "entries" | "import">("research");
  const [searchQuery, setSearchQuery] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [addingName, setAddingName] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const { toast } = useToast();

  // Auth check
  useEffect(() => {
    if (!getAdminAuth()) navigate("/admin/login");
  }, []);

  // Pre-fill query from hash param ?q= (set by home page "Research with AI" button)
  useEffect(() => {
    const hash = window.location.hash; // e.g. "#/admin?q=Paul+Fleury"
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const params = new URLSearchParams(hash.slice(qIndex + 1));
      const q = params.get('q');
      if (q) {
        setSearchQuery(decodeURIComponent(q));
        // Optionally auto-trigger research after a short delay
        setTimeout(() => {
          setSuggestions([]);
          researchMutation.mutate({ query: decodeURIComponent(q) });
        }, 400);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    mutationFn: ({ query, url }: { query: string; url?: string }) =>
      apiRequest("POST", "/api/admin/research", { query, url: url || undefined }).then(r => r.json()),
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
    researchMutation.mutate({ query: searchQuery.trim(), url: profileUrl.trim() || undefined });
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
            <form onSubmit={handleSearch} style={{ marginBottom: '32px' }}>
              {/* Name / query row */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
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
              </div>
              {/* URL / profile link row */}
              <div style={{ position: 'relative' }}>
                <Globe size={14} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}/>
                <input
                  type="url"
                  className="nova-search"
                  placeholder="Profile URL or LinkedIn link (optional) — e.g. https://linkedin.com/in/..."
                  value={profileUrl}
                  onChange={e => setProfileUrl(e.target.value)}
                  style={{ paddingLeft: '40px', borderRadius: '10px', fontSize: '0.82rem', height: '42px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  data-testid="input-admin-url"
                />
              </div>
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
