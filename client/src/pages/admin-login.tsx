import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { setAdminAuth } from "@/lib/adminAuth";

const CORRECT_PIN = "0000";

function NovaNextLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="NovaNEXT">
      <rect width="40" height="40" rx="8" fill="#2020C8"/>
      <path d="M8 28V12h4l10 12V12h4v16h-4L12 16v12z" fill="#00E5D0"/>
    </svg>
  );
}

export default function AdminLoginPage() {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [, navigate] = useLocation();
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handlePinChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
    setError(false);

    if (digit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when 4th digit entered
    if (index === 3 && digit) {
      const fullPin = [...newPin].join("");
      if (fullPin === CORRECT_PIN) {
        setAdminAuth(true);
        navigate("/admin");
      } else {
        setError(true);
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setPin(["", "", "", ""]);
          inputRefs[0].current?.focus();
        }, 600);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  return (
    <div className="nova-bg" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '300px',
        background: 'radial-gradient(ellipse at center, rgba(32,32,200,0.3) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0
      }}/>

      {/* Back link */}
      <Link href="/">
        <button style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', cursor: 'pointer', background: 'none', border: 'none', zIndex: 10 }}>
          <ArrowLeft size={16}/> Back
        </button>
      </Link>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px', padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <NovaNextLogo size={56}/>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.8rem', color: 'white', marginTop: '16px', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
            Admin Panel
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '6px' }}>
            Enter your 4-digit PIN to continue
          </p>
        </div>

        {/* PIN card */}
        <div className="nova-card" style={{ padding: '36px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '28px', color: 'var(--nova-cyan)' }}>
            <Shield size={18}/>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Secure Access
            </span>
          </div>

          {/* PIN inputs */}
          <div
            style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}
            className={shaking ? 'animate-[wiggle_0.5s_ease]' : ''}
          >
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={inputRefs[i]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handlePinChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="pin-input"
                style={{ borderColor: error ? 'var(--nova-pink)' : undefined }}
                data-testid={`input-pin-${i}`}
              />
            ))}
          </div>

          {error && (
            <p style={{ color: 'var(--nova-pink)', fontSize: '0.85rem', marginBottom: '8px' }}>
              Incorrect PIN. Please try again.
            </p>
          )}

          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>
            The PIN auto-submits on the 4th digit
          </p>
        </div>

        {/* Conference badge */}
        <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.08)' }}/>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            NovaNEXT · Aveiro 2026
          </span>
          <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.08)' }}/>
        </div>
      </div>

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-wiggle { animation: wiggle 0.5s ease; }
      `}</style>
    </div>
  );
}
