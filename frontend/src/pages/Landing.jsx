import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../store/analysisStore';
import { importFromKaggle, importFromSheets, importFromHuggingFace } from '../services/api';

const FEATURES = [
  { icon: '⚖', label: 'Bias Detection', desc: 'Demographic + proxy fairness metrics' },
  { icon: '〰', label: 'Noise Analysis', desc: 'Outliers, type errors, missing values' },
  { icon: '⧉', label: 'Duplicate Scan', desc: 'Exact & near-duplicate row clustering' },
  { icon: '⚡', label: 'AI Narratives', desc: 'Gemini-powered issue recommendations' },
];

const Spinner = () => (
  <span style={{
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid rgba(255,107,43,0.2)',
    borderTop: '2px solid #ff6b2b',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    verticalAlign: 'middle',
    marginRight: 6,
  }} />
);

export const Landing = () => {
  const [dragging, setDragging] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [targetColumn, setTargetColumn] = useState('');
  const [biasTolerance, setBiasTolerance] = useState(30);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const { uploadFile, loadMockData } = useAnalysisStore();

  // Import panel state
  const [importTab, setImportTab] = useState('kaggle');
  const [importInput, setImportInput] = useState('');
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [hfSplit, setHfSplit] = useState('train');
  const [hfMaxRows, setHfMaxRows] = useState(10000);

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

  const handleTabChange = (tab) => {
    setImportTab(tab);
    setImportInput('');
    setImportStatus(null);
    setImportMessage('');
  };

  const handleImport = async () => {
    if (!importInput.trim()) return;
    setImportStatus('loading');
    setImportMessage('');
    try {
      let result;
      if (importTab === 'kaggle') {
        result = await importFromKaggle(importInput.trim());
      } else if (importTab === 'sheets') {
        result = await importFromSheets(importInput.trim());
      } else {
        result = await importFromHuggingFace(importInput.trim(), hfSplit, hfMaxRows);
      }

      // If backend returned a job_id, pipe straight into the analysis dashboard
      if (result.job_id) {
        const label = importTab === 'kaggle'
          ? importInput.trim()
          : importTab === 'sheets'
          ? 'Sheets Import'
          : importInput.trim();
        useAnalysisStore.getState().startImportJob(result.job_id, label);
        navigate('/dashboard/live');
        return;
      }

      // Fallback: no pipeline yet — just show counts
      setImportStatus('success');
      setImportMessage(
        `Connected! Found ${result.rows?.toLocaleString() ?? '?'} rows, ` +
        `${result.columns?.length ?? '?'} columns. ` +
        `Note: Full analysis pipeline coming soon — use file upload for complete analysis.`
      );
    } catch (err) {
      setImportStatus('error');
      setImportMessage(err.message);
    }
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6, padding: '8px 12px',
    color: '#f0f0f8', fontFamily: 'Space Mono, monospace',
    fontSize: 12, outline: 'none',
  };

  const importBtnStyle = {
    fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ff6b2b',
    border: '1px solid rgba(255,107,43,0.35)', borderRadius: 8,
    padding: '9px 22px', background: 'rgba(255,107,43,0.08)',
    cursor: 'pointer', transition: 'all 0.2s', marginTop: 10,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

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
          <h1 style={{ fontWeight: 800, fontSize: 'clamp(42px, 7vw, 80px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: '#f0f0f8' }}>
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
            {[['0', '0', 'right', 'bottom'], ['0', 'auto', 'left', 'bottom'], ['auto', '0', 'right', 'top'], ['auto', 'auto', 'left', 'top']].map(([t, b, r, l], i) => (
              <div key={i} style={{ position: 'absolute', top: t === 'auto' ? undefined : 12, bottom: b === 'auto' ? undefined : 12, right: r === 'auto' ? undefined : 12, left: l === 'auto' ? undefined : 12, width: 16, height: 16, borderTop: (t !== 'auto') ? '1.5px solid rgba(255,107,43,0.4)' : 'none', borderBottom: (b !== 'auto') ? '1.5px solid rgba(255,107,43,0.4)' : 'none', borderRight: (r !== 'auto') ? '1.5px solid rgba(255,107,43,0.4)' : 'none', borderLeft: (l !== 'auto') ? '1.5px solid rgba(255,107,43,0.4)' : 'none' }} />
            ))}

            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b2b" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
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

        {/* Import from external source */}
        <div className="animate-fade-up stagger-6" style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>IMPORT FROM EXTERNAL SOURCE</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
        </div>

        <div className="animate-fade-up stagger-6" style={{ marginTop: 16 }}>
          <div style={{
            background: 'rgba(8,8,16,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: 20,
          }}>
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
              {['kaggle', 'sheets', 'huggingface'].map(tab => (
                <button key={tab} onClick={() => handleTabChange(tab)} style={{
                  fontFamily: 'Space Mono, monospace', fontSize: 10, textTransform: 'uppercase',
                  letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 14px',
                  color: importTab === tab ? '#f0f0f8' : '#5a5a7a',
                  borderBottom: importTab === tab ? '1.5px solid #ff6b2b' : '1.5px solid transparent',
                  marginBottom: -1,
                  transition: 'color 0.15s',
                }}>
                  {tab === 'kaggle' ? 'Kaggle' : tab === 'sheets' ? 'Google Sheets' : 'HuggingFace'}
                </button>
              ))}
            </div>

            {/* Kaggle tab */}
            {importTab === 'kaggle' && (
              <div>
                <label style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>KAGGLE DATASET ID</label>
                <input
                  type="text"
                  placeholder="e.g. titanic/titanic  or  datasnaek/youtube-new"
                  value={importInput}
                  onChange={e => setImportInput(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', marginTop: 5 }}>
                  Format: username/dataset-name — find on kaggle.com/datasets
                </div>
              </div>
            )}

            {/* Sheets tab */}
            {importTab === 'sheets' && (
              <div>
                <label style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>GOOGLE SHEETS URL</label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={importInput}
                  onChange={e => setImportInput(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', marginTop: 5 }}>
                  Sheet must be publicly accessible (File → Share → Anyone with link)
                </div>
              </div>
            )}

            {/* HuggingFace tab */}
            {importTab === 'huggingface' && (
              <div>
                <label style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>HUGGINGFACE DATASET NAME</label>
                <input
                  type="text"
                  placeholder="e.g. imdb  or  csv  or  wikitext"
                  value={importInput}
                  onChange={e => setImportInput(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', marginTop: 5 }}>
                  Dataset name from huggingface.co/datasets
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.08em' }}>SPLIT:</span>
                    {['train', 'test', 'validation'].map(s => (
                      <button key={s} onClick={() => setHfSplit(s)} style={{
                        fontFamily: 'Space Mono, monospace', fontSize: 9, padding: '3px 10px',
                        borderRadius: 99, cursor: 'pointer', transition: 'all 0.15s',
                        background: hfSplit === s ? 'rgba(255,107,43,0.15)' : 'rgba(255,255,255,0.04)',
                        border: hfSplit === s ? '1px solid rgba(255,107,43,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: hfSplit === s ? '#ff6b2b' : '#5a5a7a',
                      }}>{s}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.08em' }}>MAX ROWS:</span>
                    <input
                      type="number"
                      value={hfMaxRows}
                      onChange={e => setHfMaxRows(Number(e.target.value))}
                      style={{ ...inputStyle, width: 90, padding: '4px 8px', fontSize: 11 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={importStatus === 'loading'}
              style={{ ...importBtnStyle, opacity: importStatus === 'loading' ? 0.7 : 1 }}
              onMouseEnter={e => { if (importStatus !== 'loading') e.currentTarget.style.background = 'rgba(255,107,43,0.16)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,107,43,0.08)'; }}
            >
              {importStatus === 'loading' ? <><Spinner />Connecting...</> : 'Import Dataset'}
            </button>

            {/* Status display */}
            {importStatus === 'success' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d97e', marginTop: 3, flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 12, color: '#00d97e', lineHeight: 1.6 }}>{importMessage}</span>
              </div>
            )}
            {importStatus === 'error' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff3b5c', marginTop: 3, flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 12, color: '#ff3b5c', lineHeight: 1.6 }}>{importMessage}</span>
              </div>
            )}
          </div>
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