import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import { ArrowLeft, Linkedin, Twitter, Github, Globe, MapPin, Building2, ExternalLink, Verified, QrCode, Copy, Check } from "lucide-react";
import type { Contact } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import QRCode from "qrcode";

function NovaNextLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="NovaNEXT">
      <rect width="40" height="40" rx="8" fill="#2020C8"/>
      <path d="M8 28V12h4l10 12V12h4v16h-4L12 16v12z" fill="#00E5D0"/>
    </svg>
  );
}

export default function ContactPage() {
  const { slug } = useParams<{ slug: string }>();
  const [qrSvg, setQrSvg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const { data: contact, isLoading, isError } = useQuery<Contact>({
    queryKey: ["/api/contacts", slug],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  // Profile URL — always canonical nova.pplx.app
  const profileUrl = `https://nova.pplx.app/#/contact/${slug}`;

  // Generate QR code SVG once slug is known
  useEffect(() => {
    if (!slug) return;
    QRCode.toString(profileUrl, {
      type: 'svg',
      margin: 2,
      width: 200,
      color: { dark: '#00E5D0', light: '#080818' },
    }).then(setQrSvg).catch(() => {});
  }, [slug]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select a hidden input
    }
  };

  const tags: string[] = (() => {
    try { return JSON.parse(contact?.tags || "[]"); } catch { return []; }
  })();

  const initials = (contact?.name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <div className="nova-bg" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="nova-skeleton" style={{ width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto 20px' }}/>
          <div className="nova-skeleton" style={{ width: '200px', height: '28px', borderRadius: '8px', margin: '0 auto 12px' }}/>
          <div className="nova-skeleton" style={{ width: '140px', height: '18px', borderRadius: '8px', margin: '0 auto' }}/>
        </div>
      </div>
    );
  }

  if (isError || !contact) {
    return (
      <div className="nova-bg" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ fontSize: '4rem' }}>😶‍🌫️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: '1.5rem' }}>Not Found</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>This person isn't in the directory yet.</p>
        <Link href="/">
          <button className="nova-btn-primary">← Back to Directory</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="nova-bg" style={{ minHeight: '100dvh' }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '800px', height: '400px',
        background: 'radial-gradient(ellipse at center, rgba(32,32,200,0.25) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0
      }}/>

      {/* Header nav */}
      <header style={{ position: 'relative', zIndex: 10, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/">
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', cursor: 'pointer', background: 'none', border: 'none' }}>
            <ArrowLeft size={16}/> All Attendees
          </button>
        </Link>
        <div style={{ flex: 1 }}/>
        <NovaNextLogo size={28}/>
      </header>

      {/* Profile Content */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '680px', margin: '0 auto', padding: '16px 16px 80px' }}>
        {/* Hero card */}
        <div className="nova-card" style={{ padding: '36px 32px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <div className="nova-avatar" style={{ width: '96px', height: '96px', fontSize: '2rem' }}>
                {contact.avatarUrl
                  ? <img src={contact.avatarUrl} alt={contact.name} onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}/>
                  : initials}
              </div>
              {contact.isVerified && (
                <div style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'var(--nova-cyan)', borderRadius: '50%', padding: '2px' }}>
                  <Verified size={14} style={{ color: 'var(--nova-dark)' }}/>
                </div>
              )}
            </div>

            {/* Name & meta */}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: 'white', lineHeight: 1.1, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                {contact.name}
              </h1>
              {contact.title && (
                <p style={{ color: 'var(--nova-cyan)', fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                  {contact.title}
                </p>
              )}
              {contact.companyName && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={14}/> {contact.companyRole ? `${contact.companyRole} @ ` : ''}{contact.companyName}
                </p>
              )}
              {contact.location && (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <MapPin size={12}/> {contact.location}
                </p>
              )}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '24px' }}>
              {tags.map(tag => <span key={tag} className="nova-tag">{tag}</span>)}
            </div>
          )}
        </div>

        {/* Bio */}
        {contact.bio && (
          <div className="nova-card" style={{ padding: '24px 28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--nova-cyan)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>
              About
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.75, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              {contact.bio}
            </p>
          </div>
        )}

        {/* Social Links */}
        {(contact.linkedinUrl || contact.twitterUrl || contact.githubUrl || contact.instagramUrl || contact.website) && (
          <div className="nova-card" style={{ padding: '24px 28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--nova-cyan)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>
              Connect
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {contact.linkedinUrl && (
                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', textDecoration: 'none', padding: '12px 16px', background: 'rgba(0,119,181,0.15)', border: '1px solid rgba(0,119,181,0.3)', borderRadius: '10px', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,119,181,0.25)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,119,181,0.15)'; }}>
                  <Linkedin size={20} style={{ color: '#0A66C2' }}/>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>LinkedIn Profile</span>
                  <ExternalLink size={14} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)' }}/>
                </a>
              )}
              {contact.twitterUrl && (
                <a href={contact.twitterUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', textDecoration: 'none', padding: '12px 16px', background: 'rgba(29,155,240,0.1)', border: '1px solid rgba(29,155,240,0.25)', borderRadius: '10px', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,155,240,0.2)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,155,240,0.1)'; }}>
                  <Twitter size={20} style={{ color: '#1D9BF0' }}/>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>X / Twitter</span>
                  <ExternalLink size={14} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)' }}/>
                </a>
              )}
              {contact.githubUrl && (
                <a href={contact.githubUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', textDecoration: 'none', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}>
                  <Github size={20}/>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>GitHub</span>
                  <ExternalLink size={14} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)' }}/>
                </a>
              )}
              {contact.website && (
                <a href={contact.website} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'white', textDecoration: 'none', padding: '12px 16px', background: 'rgba(0,229,208,0.08)', border: '1px solid rgba(0,229,208,0.2)', borderRadius: '10px', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,208,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,208,0.08)'; }}>
                  <Globe size={20} style={{ color: 'var(--nova-cyan)' }}/>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Website</span>
                  <ExternalLink size={14} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)' }}/>
                </a>
              )}
            </div>
          </div>
        )}

        {/* QR Code — share this profile */}
        <div className="nova-card" style={{ padding: '28px', marginBottom: '20px', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.75rem',
            color: 'var(--nova-cyan)', letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}>
            <QrCode size={13}/> Share Profile
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: '20px' }}>
            Scan to open this profile on any device
          </p>

          {/* QR SVG */}
          {qrSvg ? (
            <div style={{
              display: 'inline-block',
              background: '#080818',
              border: '2px solid rgba(0,229,208,0.25)',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 0 40px rgba(0,229,208,0.08)',
              marginBottom: '20px',
            }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className="nova-skeleton" style={{ width: '180px', height: '180px', borderRadius: '12px', margin: '0 auto 20px' }}/>
          )}

          {/* Profile URL + copy button */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '10px 14px',
            maxWidth: '340px', margin: '0 auto',
          }}>
            <span style={{
              flex: 1, fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}>
              {profileUrl}
            </span>
            <button
              onClick={handleCopy}
              data-testid="btn-copy-url"
              style={{
                flexShrink: 0, background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(0,229,208,0.1)',
                border: `1px solid ${copied ? 'rgba(74,222,128,0.4)' : 'rgba(0,229,208,0.3)'}`,
                borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
                color: copied ? '#4ade80' : 'var(--nova-cyan)', fontSize: '0.72rem', fontWeight: 700,
                transition: 'all 0.2s ease',
              }}
            >
              {copied ? <Check size={12}/> : <Copy size={12}/>}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Back */}
        <div style={{ textAlign: 'center', paddingTop: '16px' }}>
          <Link href="/">
            <button className="nova-btn-primary">
              <ArrowLeft size={14}/> Back to Directory
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
