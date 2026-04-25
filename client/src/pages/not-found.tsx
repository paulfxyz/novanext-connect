import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="nova-bg" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', textAlign: 'center', padding: '24px' }}>
      <div style={{ fontSize: '5rem' }}>🌊</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '3rem', color: 'white', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
        404
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '300px' }}>
        This page doesn't exist. Let's get you back to the conference.
      </p>
      <Link href="/">
        <button className="nova-btn-cyan">← Back to NovaNEXT</button>
      </Link>
    </div>
  );
}
