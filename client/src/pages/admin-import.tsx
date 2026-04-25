import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Upload, FileText, ClipboardList, User, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw, X, ArrowRight, Download, Zap
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────
type ImportRow = {
  name: string;
  title?: string;
  bio?: string;
  location?: string;
  companyName?: string;
  companyRole?: string;
  website?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  instagramUrl?: string;
  tags?: string;
  email?: string;           // stored for display; not in DB schema
  _raw?: Record<string, string>; // original CSV row
};

type ImportStatus = { name: string; status: 'added' | 'error' | 'pending'; error?: string };

// ── CSV Field Mapping ─────────────────────────────────────────────────────
const FIELD_LABELS: Record<keyof ImportRow, string> = {
  name: "Full Name *",
  title: "Job Title",
  bio: "Bio / Description",
  location: "Location",
  companyName: "Company Name",
  companyRole: "Role at Company",
  website: "Website URL",
  linkedinUrl: "LinkedIn URL",
  twitterUrl: "Twitter / X URL",
  githubUrl: "GitHub URL",
  instagramUrl: "Instagram URL",
  tags: "Tags (comma-separated)",
  email: "Email (not stored)",
  _raw: "—",
};

// Heuristic auto-mapping from CSV column header → ImportRow key
function guessMapping(header: string): keyof ImportRow | null {
  const h = header.toLowerCase().replace(/[\s_-]/g, '');
  if (['name','fullname','contactname','person','attendee'].some(k => h.includes(k))) return 'name';
  if (['jobtitle','title','role','position','function'].some(k => h.includes(k))) return 'title';
  if (['bio','description','about','summary'].some(k => h.includes(k))) return 'bio';
  if (['location','city','country','place','region'].some(k => h.includes(k))) return 'location';
  if (['company','organisation','organization','employer','firm'].some(k => h.includes(k))) return 'companyName';
  if (['companyrole','roleatcompany','jobrole'].some(k => h.includes(k))) return 'companyRole';
  if (['website','url','web','homepage','personalsite'].some(k => h.includes(k))) return 'website';
  if (['linkedin'].some(k => h.includes(k))) return 'linkedinUrl';
  if (['twitter','x.com','xurl','twitterurl'].some(k => h.includes(k))) return 'twitterUrl';
  if (['github'].some(k => h.includes(k))) return 'githubUrl';
  if (['instagram'].some(k => h.includes(k))) return 'instagramUrl';
  if (['tags','keywords','categories','sector','industry'].some(k => h.includes(k))) return 'tags';
  if (['email','mail','emailaddress'].some(k => h.includes(k))) return 'email';
  return null;
}

// Parse CSV text
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return { headers: [], rows: [] };
  const parse = (line: string) => {
    const result: string[] = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i+1] === '"') { field += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        result.push(field.trim()); field = '';
      } else {
        field += c;
      }
    }
    result.push(field.trim());
    return result;
  };
  const headers = parse(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(parse);
  return { headers, rows };
}

// Parse vCard (.vcf) text
function parseVCards(text: string): ImportRow[] {
  const contacts: ImportRow[] = [];
  const cards = text.split(/BEGIN:VCARD/i).filter(c => c.trim());
  for (const card of cards) {
    const row: ImportRow = { name: '' };
    const lines = card.split(/\r?\n/);
    for (const line of lines) {
      const [rawKey, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      const key = rawKey?.split(';')[0]?.toUpperCase()?.trim();
      if (!key || !value) continue;
      if (key === 'FN') row.name = value;
      else if (key === 'TITLE') row.title = value;
      else if (key === 'ORG') row.companyName = value.split(';')[0];
      else if (key === 'NOTE') row.bio = value;
      else if (key.startsWith('ADR')) row.location = value.replace(/;+/g, ', ').replace(/^,\s*/, '');
      else if (key.startsWith('URL')) {
        const v = value.toLowerCase();
        if (v.includes('linkedin')) row.linkedinUrl = value;
        else if (v.includes('github')) row.githubUrl = value;
        else if (v.includes('twitter') || v.includes('x.com')) row.twitterUrl = value;
        else if (v.includes('instagram')) row.instagramUrl = value;
        else row.website = value;
      }
    }
    if (row.name) contacts.push(row);
  }
  return contacts;
}

// ── Main Import Component ─────────────────────────────────────────────────
export default function AdminImport({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // UI state
  const [mode, setMode] = useState<'idle' | 'csv' | 'paste' | 'vcf'>('idle');
  const [dragOver, setDragOver] = useState(false);

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, keyof ImportRow>>({});
  const [showAllRows, setShowAllRows] = useState(false);

  // Paste state
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState<'names' | 'csv_text'>('names');

  // Preview state (rows ready to import)
  const [preview, setPreview] = useState<ImportRow[]>([]);

  // Result state
  const [results, setResults] = useState<ImportStatus[]>([]);

  // ── Import mutation ──────────────────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: (rows: ImportRow[]) =>
      apiRequest("POST", "/api/admin/import", rows.map(r => ({
        name: r.name,
        title: r.title || null,
        bio: r.bio || null,
        location: r.location || null,
        companyName: r.companyName || null,
        companyRole: r.companyRole || null,
        website: r.website || null,
        linkedinUrl: r.linkedinUrl || null,
        twitterUrl: r.twitterUrl || null,
        githubUrl: r.githubUrl || null,
        instagramUrl: r.instagramUrl || null,
        tags: r.tags ? JSON.stringify(r.tags.split(',').map(t => t.trim()).filter(Boolean)) : '[]',
        socialLinks: '[]',
      }))).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setResults(data.results || []);
      toast({ title: `✓ ${data.added} contact${data.added !== 1 ? 's' : ''} imported` });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  // ── File drop handler ────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (file.name.toLowerCase().endsWith('.vcf') || text.includes('BEGIN:VCARD')) {
        const rows = parseVCards(text);
        setPreview(rows);
        setMode('vcf');
        toast({ title: `${rows.length} vCard contact${rows.length !== 1 ? 's' : ''} parsed` });
      } else {
        // CSV
        const { headers, rows } = parseCSV(text);
        setCsvHeaders(headers);
        setCsvRows(rows);
        const autoMap: Record<string, keyof ImportRow> = {};
        for (const h of headers) {
          const guess = guessMapping(h);
          if (guess) autoMap[h] = guess;
        }
        setMapping(autoMap);
        setMode('csv');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Apply CSV mapping → preview ──────────────────────────────────────────
  const applyMapping = () => {
    const nameCol = Object.entries(mapping).find(([, v]) => v === 'name')?.[0];
    if (!nameCol) {
      toast({ title: "Map the Name column first", variant: "destructive" });
      return;
    }
    const rows: ImportRow[] = csvRows.map(row => {
      const raw: Record<string, string> = {};
      csvHeaders.forEach((h, i) => { raw[h] = row[i] || ''; });
      const out: ImportRow = { name: '', _raw: raw };
      for (const [col, field] of Object.entries(mapping)) {
        const val = raw[col] || '';
        if (field !== '_raw') (out as any)[field] = val;
      }
      return out;
    }).filter(r => r.name?.trim());
    setPreview(rows);
  };

  // ── Parse bulk paste ─────────────────────────────────────────────────────
  const parsePaste = () => {
    if (pasteMode === 'csv_text') {
      const { headers, rows } = parseCSV(pasteText);
      setCsvHeaders(headers);
      setCsvRows(rows);
      const autoMap: Record<string, keyof ImportRow> = {};
      for (const h of headers) {
        const guess = guessMapping(h);
        if (guess) autoMap[h] = guess;
      }
      setMapping(autoMap);
      setMode('csv');
    } else {
      // One name per line
      const rows: ImportRow[] = pasteText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(name => ({ name }));
      setPreview(rows);
    }
  };

  const previewVisible = showAllRows ? preview : preview.slice(0, 8);

  // ── Download sample CSV ──────────────────────────────────────────────────
  const downloadSample = () => {
    const sample = `name,title,company,location,linkedin,twitter,website,tags
"Maria Silva","Founder & CEO","StartupAI","Lisbon, Portugal","https://linkedin.com/in/mariasilva","https://x.com/mariasilva","https://mariasilva.com","AI,Startup"
"João Santos","Partner","Armilar VC","Porto, Portugal","https://linkedin.com/in/joaosantos","","","VC,Investor"
"Ana Rodrigues","CTO","TechLisboa","Aveiro, Portugal","","https://github.com/anarodrigues","https://techlisboa.pt","Tech,Developer"`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'novanext-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const fieldOptions = (Object.keys(FIELD_LABELS) as (keyof ImportRow)[])
    .filter(k => k !== '_raw');

  // ── RESULT VIEW ──────────────────────────────────────────────────────────
  if (results.length > 0) {
    const added = results.filter(r => r.status === 'added').length;
    const errors = results.filter(r => r.status === 'error').length;
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div className="nova-card" style={{ padding: '28px', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
            {errors === 0 ? '🎉' : '⚠️'}
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'white', marginBottom: '6px' }}>
            Import Complete
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--nova-cyan)', fontWeight: 700 }}>{added} added</span>
            {errors > 0 && <span style={{ color: 'var(--nova-pink)', fontWeight: 700 }}> · {errors} failed</span>}
          </p>
        </div>
        <div className="nova-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '20px' }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {r.status === 'added'
                ? <CheckCircle2 size={15} style={{ color: 'var(--nova-cyan)', flexShrink: 0 }}/>
                : <AlertCircle size={15} style={{ color: 'var(--nova-pink)', flexShrink: 0 }}/>}
              <span style={{ fontSize: '0.85rem', color: 'white', flex: 1 }}>{r.name}</span>
              {r.error && <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{r.error}</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="nova-btn-primary" onClick={() => { setResults([]); setPreview([]); setMode('idle'); setPasteText(''); }} style={{ flex: 1, justifyContent: 'center', borderRadius: '10px', fontSize: '0.85rem' }}>
            Import More
          </button>
          {onDone && (
            <button className="nova-btn-cyan" onClick={onDone} style={{ flex: 1, justifyContent: 'center', borderRadius: '10px', fontSize: '0.85rem' }}>
              View Entries →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── PREVIEW & CONFIRM ────────────────────────────────────────────────────
  if (preview.length > 0) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: '1.1rem' }}>
              Preview — {preview.length} contacts
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginTop: '2px' }}>
              Review before importing. Invalid rows (no name) are excluded.
            </p>
          </div>
          <button onClick={() => { setPreview([]); setMode(mode === 'vcf' ? 'idle' : mode); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={13}/> Edit
          </button>
        </div>

        {/* Preview table */}
        <div className="nova-card" style={{ overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Name','Title','Company','Location','LinkedIn','Twitter','Website','Tags'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--nova-cyan)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewVisible.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(32,32,200,0.06)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    {[
                      row.name,
                      row.title || '—',
                      row.companyName || '—',
                      row.location || '—',
                      row.linkedinUrl ? '✓' : '—',
                      row.twitterUrl ? '✓' : '—',
                      row.website ? '✓' : '—',
                      row.tags || '—',
                    ].map((cell, ci) => (
                      <td key={ci} style={{ padding: '9px 12px', color: ci === 0 ? 'white' : 'rgba(255,255,255,0.5)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 8 && (
            <button onClick={() => setShowAllRows(!showAllRows)}
              style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {showAllRows ? <><ChevronUp size={13}/> Show less</> : <><ChevronDown size={13}/> Show all {preview.length} rows</>}
            </button>
          )}
        </div>

        {/* Import button */}
        <button
          className="nova-btn-cyan"
          style={{ width: '100%', justifyContent: 'center', borderRadius: '12px', padding: '14px', fontSize: '0.9rem' }}
          onClick={() => importMutation.mutate(preview)}
          disabled={importMutation.isPending}
          data-testid="btn-confirm-import"
        >
          {importMutation.isPending
            ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }}/> Importing...</>
            : <><Upload size={15}/> Import {preview.length} contact{preview.length !== 1 ? 's' : ''}</>}
        </button>
      </div>
    );
  }

  // ── CSV COLUMN MAPPING ───────────────────────────────────────────────────
  if (mode === 'csv') {
    const nameIsMapped = Object.values(mapping).includes('name');
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => setMode('idle')} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <X size={12}/> Cancel
          </button>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: '1.1rem', flex: 1 }}>
            Map CSV Columns
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>{csvRows.length} rows</span>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', marginBottom: '16px' }}>
          We auto-detected the mapping below. Adjust if needed — <strong style={{ color: 'white' }}>Name is required</strong>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {csvHeaders.map(header => (
            <div key={header} className="nova-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', minWidth: '120px', fontFamily: 'monospace' }}>
                {header}
              </span>
              <ArrowRight size={13} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}/>
              <select
                value={mapping[header] || ''}
                onChange={e => {
                  const val = e.target.value as keyof ImportRow | '';
                  setMapping(prev => {
                    const next = { ...prev };
                    if (val) next[header] = val;
                    else delete next[header];
                    return next;
                  });
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px', color: mapping[header] ? 'var(--nova-cyan)' : 'rgba(255,255,255,0.4)',
                  fontSize: '0.8rem', padding: '6px 10px', cursor: 'pointer', flex: 1, minWidth: '140px',
                  appearance: 'none',
                }}
              >
                <option value="">— skip —</option>
                {fieldOptions.map(f => (
                  <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                ))}
              </select>
              {/* Sample value */}
              {csvRows[0] && (
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  e.g. {csvRows[0][csvHeaders.indexOf(header)] || ''}
                </span>
              )}
            </div>
          ))}
        </div>

        <button
          className={nameIsMapped ? "nova-btn-cyan" : "nova-btn-primary"}
          style={{ width: '100%', justifyContent: 'center', borderRadius: '12px', padding: '14px', fontSize: '0.9rem', opacity: nameIsMapped ? 1 : 0.5 }}
          onClick={applyMapping}
          disabled={!nameIsMapped}
        >
          <ArrowRight size={15}/> Preview {csvRows.filter(r => r[csvHeaders.indexOf(Object.entries(mapping).find(([,v]) => v === 'name')?.[0] || '')])?.length || 0} Contacts
        </button>
      </div>
    );
  }

  // ── PASTE MODE ───────────────────────────────────────────────────────────
  if (mode === 'paste') {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => setMode('idle')} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <X size={12}/> Back
          </button>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: '1.1rem', flex: 1 }}>
            Paste & Import
          </h3>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '3px', marginBottom: '16px' }}>
          {[
            { id: 'names', label: 'Names (one per line)', icon: <User size={12}/> },
            { id: 'csv_text', label: 'CSV text', icon: <FileText size={12}/> },
          ].map(opt => (
            <button key={opt.id}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                background: pasteMode === opt.id ? 'var(--nova-blue)' : 'transparent',
                color: pasteMode === opt.id ? 'white' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.15s ease' }}
              onClick={() => setPasteMode(opt.id as any)}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginBottom: '10px' }}>
          {pasteMode === 'names'
            ? 'One name per line. The AI Research tab can enrich them afterwards.'
            : 'Paste CSV with a header row. We\'ll guide you through column mapping.'}
        </p>

        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder={pasteMode === 'names'
            ? "Pedro Quintas\nMaria Fontes\nJoão Ferreira\n..."
            : "name,title,company\nPedro Quintas,CEO,Armilar VC\n..."}
          style={{
            width: '100%', minHeight: '200px', background: 'var(--nova-card)',
            border: '1px solid var(--nova-border)', borderRadius: '12px',
            color: 'white', padding: '14px 16px', fontSize: '0.85rem',
            fontFamily: pasteMode === 'csv_text' ? 'monospace' : 'var(--font-body)',
            resize: 'vertical', outline: 'none', marginBottom: '14px',
            lineHeight: 1.6,
          }}
          data-testid="textarea-paste"
        />

        <button
          className="nova-btn-cyan"
          style={{ width: '100%', justifyContent: 'center', borderRadius: '12px', padding: '14px', fontSize: '0.9rem', opacity: pasteText.trim() ? 1 : 0.5 }}
          onClick={parsePaste}
          disabled={!pasteText.trim()}
        >
          <ArrowRight size={15}/> Parse & Preview
        </button>
      </div>
    );
  }

  // ── IDLE / ENTRY POINT ───────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.5rem', color: 'white', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '6px' }}>
          Import Contacts
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
          Bulk-add attendees from CSV exports, CRM data, LinkedIn exports, vCard files, or any spreadsheet.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--nova-cyan)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '16px', padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(0,229,208,0.04)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.15s ease', marginBottom: '20px',
        }}
        data-testid="dropzone-import"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.vcf,.txt"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          data-testid="input-file"
        />
        <Upload size={32} style={{ color: dragOver ? 'var(--nova-cyan)' : 'rgba(255,255,255,0.25)', margin: '0 auto 12px' }}/>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'white', fontSize: '1rem', marginBottom: '6px' }}>
          Drop a file here or click to browse
        </p>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem' }}>
          Supports <strong style={{ color: 'rgba(255,255,255,0.6)' }}>CSV</strong>, <strong style={{ color: 'rgba(255,255,255,0.6)' }}>vCard (.vcf)</strong>, and <strong style={{ color: 'rgba(255,255,255,0.6)' }}>plain text</strong> · Max 10MB
        </p>
      </div>

      {/* Other entry modes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        <button
          onClick={() => setMode('paste')}
          className="nova-card"
          style={{ padding: '20px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--nova-border)', background: 'var(--nova-card)', display: 'flex', flexDirection: 'column', gap: '8px' }}
          data-testid="btn-paste-mode"
        >
          <ClipboardList size={22} style={{ color: 'var(--nova-cyan)' }}/>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>Paste names</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
            One name per line, or paste raw CSV text
          </div>
        </button>

        <button
          onClick={downloadSample}
          className="nova-card"
          style={{ padding: '20px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--nova-border)', background: 'var(--nova-card)', display: 'flex', flexDirection: 'column', gap: '8px' }}
          data-testid="btn-download-sample"
        >
          <Download size={22} style={{ color: 'var(--nova-pink)' }}/>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>Sample CSV</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
            Download template with correct column names
          </div>
        </button>
      </div>

      {/* Supported sources */}
      <div style={{ background: 'rgba(32,32,200,0.06)', border: '1px solid rgba(32,32,200,0.2)', borderRadius: '12px', padding: '16px' }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--nova-cyan)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
          Works with exports from
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['LinkedIn CSV', 'HubSpot CRM', 'Salesforce', 'Notion Database', 'Airtable', 'Google Contacts', 'Apple Contacts (.vcf)', 'Any spreadsheet'].map(src => (
            <span key={src} className="nova-badge" style={{ fontSize: '0.72rem' }}>{src}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
