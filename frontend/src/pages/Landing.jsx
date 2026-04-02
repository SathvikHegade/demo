import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../store/analysisStore';

const FEATURES = [
  { icon: '⚖', label: 'Bias Detection',    desc: 'Demographic + proxy fairness metrics' },
  { icon: '〰', label: 'Noise Analysis',    desc: 'Outliers, type errors, missing values' },
  { icon: '⧉', label: 'Duplicate Scan',    desc: 'Exact & near-duplicate row clustering' },
  { icon: '⚡', label: 'AI Narratives',     desc: 'Gemini-powered issue recommendations' },
];

export const Landing = () => {
  const [dragging, setDragging] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [targetColumn, setTargetColumn] = useState('');
  const [biasTolerance, setBiasTolerance] = useState(30);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const { uploadFile, loadMockData } = useAnalysisStore();

  const handleFile = useCallback(async (file) => {
    const config = { target_column: targetColumn.trim() || null, bias_threshold: 1 - biasTolerance / 100 };
    uploadFile(file, config);
    navigate('/dashboard/live');
  }, [targetColumn, biasTolerance, uploadFile, navigate]);

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
  };

  const onDemo = () => { loadMockData(); navigate('/dashboard/demo'); };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative' }}>

      {/* Ambient orbs */}
      <div style={{ position: 'fixed', top: -200, left: -200, width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,43,0.06) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,89,245,0.06) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 760 }}>

        {/* Badge */}
        <div className="animate-fade-up" style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.15em',
            color: '#ff6b2b', background: 'rgba(255,107,43,0.08)',
            border: '1px solid rgba(255,107,43,0.2)', borderRadius: 99,
            padding: '5px 14px', textTransform: 'uppercase',
          }}>
            ◈ AI-Powered Dataset Quality Analysis
          </span>
        </div>

        {/* Headline */}
        <div className="animate-fade-up stagger-1" style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'Roboto Mono', fontWeight: 800, fontSize: 'clamp(42px, 7vw, 80px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: '#f0f0f8' }}>
            Forge{' '}
            <span style={{ background: 'linear-gradient(135deg,#ff6b2b 0%,#9b59f5 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Production-Ready
            </span>
            <br />Datasets.
          </h1>
        </div>

        {/* Sub */}
        <div className="animate-fade-up stagger-2" style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontFamily: 'Inter, Cascadia Code', fontWeight: 300, fontSize: 17, color: '#7a7a9a', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            Drop your CSV. Get a full AI-generated audit: bias, noise, imbalance, duplicates — all in under 2 minutes.
          </p>
        </div>

        {/* Drop Zone */}
        <div className="animate-fade-up stagger-3">
          <input ref={fileRef} type="file" accept=".csv,.json,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          <div
            onClick={() => fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            style={{
              border: `1px solid ${dragging ? 'rgba(255,107,43,0.6)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 16,
              padding: '52px 40px',
              cursor: 'pointer',
              textAlign: 'center',
              background: dragging ? 'rgba(255,107,43,0.04)' : 'rgba(8,8,16,0.6)',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(10px)',
              boxShadow: dragging ? '0 0 40px rgba(255,107,43,0.1), inset 0 0 40px rgba(255,107,43,0.04)' : 'none',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Corner accents */}
            {[['0','0','right','bottom'],['0','auto','left','bottom'],['auto','0','right','top'],['auto','auto','left','top']].map(([t,b,r,l], i) => (
              <div key={i} style={{ position: 'absolute', top: t === 'auto' ? undefined : 12, bottom: b === 'auto' ? undefined : 12, right: r === 'auto' ? undefined : 12, left: l === 'auto' ? undefined : 12, width: 16, height: 16, borderTop: (t !== 'auto') ? '1.5px solid rgba(255,107,43,0.4)' : 'none', borderBottom: (b !== 'auto') ? '1.5px solid rgba(255,107,43,0.4)' : 'none', borderRight: (r !== 'auto') ? '1.5px solid rgba(255,107,43,0.4)' : 'none', borderLeft: (l !== 'auto') ? '1.5px solid rgba(255,107,43,0.4)' : 'none' }} />
            ))}

            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b2b" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>

            <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: 18, color: '#f0f0f8', marginBottom: 8 }}>
              Drop your dataset here
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#5a5a7a', letterSpacing: '0.08em', marginBottom: 28 }}>
              CSV · JSON · XLSX · up to 50MB
            </div>

            <button
              onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
              style={{
                fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#ff6b2b',
                border: '1px solid rgba(255,107,43,0.35)', borderRadius: 8,
                padding: '10px 28px', background: 'rgba(255,107,43,0.08)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(255,107,43,0.16)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(255,107,43,0.08)'; }}
            >
              Browse File
            </button>
          </div>
        </div>

        {/* Config toggle */}
        <div className="animate-fade-up stagger-4" style={{ marginTop: 16 }}>
          <button onClick={() => setConfigOpen(v => !v)}
            style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: configOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
            ADVANCED CONFIG
          </button>

          {configOpen && (
            <div style={{ marginTop: 12, padding: 20, background: 'rgba(8,8,16,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>TARGET COLUMN</label>
                <input type="text" placeholder="e.g. churn" value={targetColumn} onChange={e => setTargetColumn(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 12px', color: '#f0f0f8', fontFamily: 'Space Mono, monospace', fontSize: 12, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>BIAS TOLERANCE — {biasTolerance}%</label>
                <input type="range" min={0} max={100} value={biasTolerance} onChange={e => setBiasTolerance(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#ff6b2b', marginTop: 8 }} />
              </div>
            </div>
          )}
        </div>

        {/* Demo + divider */}
        <div className="animate-fade-up stagger-5" style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', letterSpacing: '0.1em' }}>OR TRY A DEMO</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
        </div>

        <div className="animate-fade-up stagger-6" style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          {[
            { label: 'E-commerce Churn', tag: 'BIAS + IMBALANCE', color: '#ff6b2b' },
            { label: 'Credit Fraud Dataset', tag: 'DUPLICATES + NOISE', color: '#9b59f5' },
          ].map((d, i) => (
            <button key={i} onClick={onDemo}
              style={{
                flex: 1, padding: '14px 20px', background: 'rgba(8,8,16,0.6)',
                border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 10,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${d.color}44`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
            >
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: d.color, letterSpacing: '0.12em', marginBottom: 6 }}>{d.tag}</div>
              <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 600, fontSize: 14, color: '#f0f0f8' }}>{d.label}</div>
            </button>
          ))}
        </div>

        {/* Feature strip */}
        <div className="animate-fade-up stagger-6" style={{ marginTop: 56, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ padding: '16px', background: 'rgba(8,8,16,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 600, fontSize: 13, color: '#f0f0f8', marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 11, color: '#5a5a7a', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
