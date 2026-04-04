import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnalysisStore } from '../store/analysisStore';
import { useCleaningStore } from '../store/cleaningStore';
import { ScoreRing } from '../components/ui/ScoreRing';
import { AIInsightCard } from '../components/ui/AIInsightCard';
import { ForgeLoader } from '../components/ui/ForgeLoader';
import { IssueCard } from '../components/ui/IssueCard';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { BiasRadar } from '../components/charts/BiasRadar';
import { NoiseDonut } from '../components/charts/NoiseDonut';
import { ImbalanceBar } from '../components/charts/ImbalanceBar';
import { DuplicateGraph } from '../components/charts/DuplicateGraph';
import { CorrelationHeatmap } from '../components/charts/CorrelationHeatmap';
import { OutlierBoxPlot } from '../components/charts/OutlierBoxPlot';

const TABS = ['Overview', 'Bias', 'Noise', 'Duplicates', 'Imbalance', 'Clean'];

const TAB_ICONS = {
  Overview: '◈', Bias: '⚖', Noise: '〰', Duplicates: '⧉', Imbalance: '⚡', Clean: '🧹',
};

// ── Stat card ──────────────────────────────────────────────────────────────────
const Stat = ({ label, value, sub, color = '#f0f0f8' }) => (
  <div style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 20px' }}>
    <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.12em', marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 11, color: '#5a5a7a', marginTop: 5 }}>{sub}</div>}
  </div>
);

// ── Section header ─────────────────────────────────────────────────────────────
const SectionTitle = ({ children, accent = '#ff6b2b' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
    <div style={{ width: 3, height: 18, borderRadius: 2, background: accent }} />
    <h3 style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: 16, color: '#f0f0f8' }}>{children}</h3>
  </div>
);

// ── Card wrapper ───────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: '#080810', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24, ...style }}>
    {children}
  </div>
);

// ── Inline Clean Tab ───────────────────────────────────────────────────────────
const C = {
  border: 'rgba(255,255,255,0.06)', muted: '#5a5a7a', text: '#f0f0f8',
  orange: '#ff6b2b', purple: '#9b59f5', green: '#00d97e', red: '#ff3b5c',
  yellow: '#f5a623', cyan: '#00c8ff', dim: '#3a3a5a', card: '#0b0b18',
};
const mono = "'Space Mono', monospace";
const sans = "'Syne', sans-serif";
const body = "'Inter', sans-serif";

const CLabel = ({ children }) => (
  <div style={{ fontFamily: mono, fontSize: 9, color: C.muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
    {children}
  </div>
);

const CToggle = ({ value, onChange, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '7px 0' }}>
    <span style={{ fontFamily: body, fontSize: 13, color: C.text }}>{label}</span>
    <div onClick={() => onChange(!value)} style={{ width: 36, height: 19, borderRadius: 99, background: value ? `linear-gradient(90deg,${C.orange},${C.purple})` : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.25s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2.5, left: value ? 18 : 2.5, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.25s' }} />
    </div>
  </label>
);

const CSelect = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 11px', color: C.text, fontFamily: mono, fontSize: 11, outline: 'none', cursor: 'pointer', width: '100%' }}>
    {options.map(o => <option key={o.value} value={o.value} style={{ background: '#0b0b18' }}>{o.label}</option>)}
  </select>
);

const CSlider = ({ value, min, max, step = 0.01, onChange, label, format = v => v }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <CLabel>{label}</CLabel>
      <span style={{ fontFamily: mono, fontSize: 10, color: C.orange }}>{format(value)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: C.orange }} />
  </div>
);

const CPill = ({ label, value, color = C.text }) => (
  <div style={{ background: '#0d0d1a', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px' }}>
    <CLabel>{label}</CLabel>
    <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 18, color, lineHeight: 1 }}>{value}</div>
  </div>
);

const CProgressBar = ({ value, color = C.orange }) => (
  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
    <motion.div initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ duration: 0.7 }}
      style={{ height: '100%', background: color, borderRadius: 99, boxShadow: `0 0 8px ${color}66` }} />
  </div>
);

const CleanConfigGrid = ({ config, setConfig }) => {
  const impOptions = [
    { value: 'mean', label: 'Mean' }, { value: 'median', label: 'Median' },
    { value: 'mode', label: 'Mode' }, { value: 'forward_fill', label: 'Forward Fill' },
    { value: 'backward_fill', label: 'Backward Fill' }, { value: 'drop', label: 'Drop rows' },
  ];
  const outlierOptions = [
    { value: 'iqr', label: 'IQR — Interquartile Range' },
    { value: 'zscore', label: 'Z-Score — std deviations' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
      {/* Duplicates */}
      <div style={{ background: C.card, border: `1px solid ${C.orange}22`, borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: C.orange }} />
          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: C.text }}>⧉ Duplicate Removal</span>
        </div>
        <CToggle value={config.remove_exact_duplicates} onChange={v => setConfig({ remove_exact_duplicates: v })} label="Exact duplicates" />
        <CToggle value={config.remove_fuzzy_duplicates} onChange={v => setConfig({ remove_fuzzy_duplicates: v })} label="Fuzzy duplicates" />
        {config.remove_fuzzy_duplicates && (
          <div style={{ marginTop: 10 }}>
            <CSlider value={config.fuzzy_threshold} min={0.70} max={1.0} step={0.01} onChange={v => setConfig({ fuzzy_threshold: v })} label="Similarity threshold" format={v => `${Math.round(v * 100)}%`} />
          </div>
        )}
      </div>
      {/* Missing values */}
      <div style={{ background: C.card, border: `1px solid ${C.purple}22`, borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: C.purple }} />
          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: C.text }}>◌ Missing Values</span>
        </div>
        <CToggle value={config.impute_missing} onChange={v => setConfig({ impute_missing: v })} label="Impute missing cells" />
        {config.impute_missing && (
          <div style={{ marginTop: 10 }}>
            <CLabel>Strategy</CLabel>
            <CSelect value={config.imputation_strategy} onChange={v => setConfig({ imputation_strategy: v })} options={impOptions} />
          </div>
        )}
      </div>
      {/* Outliers */}
      <div style={{ background: C.card, border: `1px solid ${C.yellow}22`, borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: C.yellow }} />
          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: C.text }}>◉ Outlier Detection</span>
        </div>
        <CToggle value={config.handle_outliers} onChange={v => setConfig({ handle_outliers: v })} label="Detect & handle outliers" />
        {config.handle_outliers && (
          <>
            <div style={{ marginTop: 10 }}>
              <CLabel>Algorithm</CLabel>
              <CSelect value={config.outlier_method} onChange={v => setConfig({ outlier_method: v })} options={outlierOptions} />
            </div>
            <CToggle value={config.cap_outliers} onChange={v => setConfig({ cap_outliers: v })} label="Cap at bounds (winsorize)" />
          </>
        )}
      </div>
      {/* Type inference */}
      <div style={{ background: C.card, border: `1px solid ${C.cyan}22`, borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: C.cyan }} />
          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: C.text }}>◫ Type Inference</span>
        </div>
        <CToggle value={config.infer_types} onChange={v => setConfig({ infer_types: v })} label="Auto-infer column types" />
        <CToggle value={config.apply_type_conversions} onChange={v => setConfig({ apply_type_conversions: v })} label="Apply conversions" />
        <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['int64','float64','bool','datetime','category'].map(t => (
            <span key={t} style={{ fontFamily: mono, fontSize: 8, color: C.cyan, background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)', borderRadius: 4, padding: '2px 6px' }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const CleanResults = ({ report, downloadUrl, fileName }) => {
  const [sec, setSec] = useState('overview');
  const sections = [
    { id: 'overview', label: 'Overview' }, { id: 'duplicates', label: 'Duplicates' },
    { id: 'missing', label: 'Missing' }, { id: 'outliers', label: 'Outliers' },
    { id: 'types', label: 'Types' },
  ];
  const dup = report.duplicate_summary;
  const mv = report.missing_value_summary;
  const out = report.outlier_summary;
  const ti = report.type_inference_summary;
  const origRows = report.original_shape?.[0] ?? 0;
  const finalRows = report.final_shape?.[0] ?? 0;
  const finalCols = report.final_shape?.[1] ?? 0;

  return (
    <div>
      {/* Download banner */}
      {downloadUrl && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'rgba(0,217,126,0.07)', border: '1px solid rgba(0,217,126,0.22)', borderRadius: 10, padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 9, color: C.green, letterSpacing: '0.12em' }}>CLEANED DATASET READY</div>
            <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 13, color: C.text, marginTop: 2 }}>
              {finalRows.toLocaleString()} rows · {finalCols} cols · {(report.rows_removed ?? 0)} rows removed
            </div>
          </div>
          <a href={downloadUrl} download={`cleaned_${fileName || 'dataset'}`}
            style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: C.green, border: '1px solid rgba(0,217,126,0.35)', borderRadius: 7, padding: '8px 16px', background: 'rgba(0,217,126,0.09)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            DOWNLOAD CSV
          </a>
        </motion.div>
      )}

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSec(s.id)} style={{
            fontFamily: mono, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: sec === s.id ? C.text : C.muted, background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 14px', borderBottom: sec === s.id ? `2px solid ${C.orange}` : '2px solid transparent', transition: 'color 0.15s',
          }}>{s.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={sec} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

          {sec === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                <CPill label="Rows Removed" value={(report.rows_removed ?? 0).toLocaleString()} color={C.yellow} />
                <CPill label="Cells Cleaned" value={(report.cells_cleaned ?? 0).toLocaleString()} color={C.cyan} />
                <CPill label="Final Rows" value={finalRows.toLocaleString()} />
                <CPill label="Retention" value={`${((finalRows / Math.max(origRows, 1)) * 100).toFixed(1)}%`} color={C.green} />
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <CLabel>Operations applied</CLabel>
                {report.operations_applied?.length > 0
                  ? report.operations_applied.map((op, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#0d0d1a', borderRadius: 7, border: `1px solid ${C.border}`, marginBottom: 6 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, flexShrink: 0 }} />
                      <span style={{ fontFamily: mono, fontSize: 10, color: C.text }}>{op}</span>
                    </div>
                  ))
                  : <p style={{ fontFamily: body, fontSize: 12, color: C.muted }}>No operations applied.</p>
                }
              </div>
            </div>
          )}

          {sec === 'duplicates' && dup && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: C.card, border: `1px solid ${C.orange}22`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>Exact Duplicates</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <CPill label="Removed" value={dup.exact_removed} color={dup.exact_removed > 0 ? C.yellow : C.green} />
                  <CPill label="Of original" value={`${((dup.exact_removed / Math.max(dup.original_rows, 1)) * 100).toFixed(1)}%`} color={C.muted} />
                </div>
                <CProgressBar value={dup.exact_removed / Math.max(dup.original_rows, 1)} color={C.orange} />
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.purple}22`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>Fuzzy Duplicates</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <CPill label="Removed" value={dup.fuzzy_removed} color={dup.fuzzy_removed > 0 ? C.purple : C.green} />
                  <CPill label="Threshold" value={`${Math.round(dup.fuzzy_threshold_used * 100)}%`} color={C.purple} />
                </div>
                {dup.sample_fuzzy_pairs?.length > 0 && (
                  <div>
                    <CLabel>Sample pairs</CLabel>
                    {dup.sample_fuzzy_pairs.slice(0, 4).map(([a, b], i) => (
                      <span key={i} style={{ fontFamily: mono, fontSize: 9, color: C.purple, marginRight: 12 }}>#{a} ≈ #{b}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {sec === 'duplicates' && !dup && <p style={{ fontFamily: body, fontSize: 13, color: C.muted }}>Not run.</p>}

          {sec === 'missing' && mv && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                <CPill label="Cells Filled" value={mv.total_cells_filled.toLocaleString()} color={C.purple} />
                <CPill label="Cols Imputed" value={Object.keys(mv.strategy_used).length} />
                <CPill label="Strategy" value={mv.strategy_used[Object.keys(mv.strategy_used)[0]] || '—'} color={C.cyan} />
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <CLabel>Per-column detail</CLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 8 }}>
                  {Object.entries(mv.strategy_used).map(([col, strategy]) => (
                    <div key={col} style={{ background: '#0d0d1a', border: `1px solid ${C.border}`, borderRadius: 7, padding: '10px 12px' }}>
                      <div style={{ fontFamily: mono, fontSize: 10, color: C.text, marginBottom: 5 }}>{col}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: C.purple, background: 'rgba(155,89,245,0.1)', border: '1px solid rgba(155,89,245,0.2)', borderRadius: 3, padding: '2px 6px' }}>{strategy}</span>
                        <span style={{ fontFamily: mono, fontSize: 9, color: C.muted }}>{mv.cells_filled[col] ?? 0} cells</span>
                      </div>
                      {mv.fill_values[col] && <div style={{ marginTop: 4, fontFamily: mono, fontSize: 8, color: C.dim }}>val: <span style={{ color: C.cyan }}>{String(mv.fill_values[col]).slice(0, 20)}</span></div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {sec === 'missing' && !mv && <p style={{ fontFamily: body, fontSize: 13, color: C.muted }}>Not run.</p>}

          {sec === 'outliers' && out && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                <CPill label="Method" value={out.method.toUpperCase()} color={C.yellow} />
                <CPill label="Cols" value={out.columns_processed.length} />
                <CPill label="Found" value={out.total_outliers.toLocaleString()} color={out.total_outliers > 0 ? C.red : C.green} />
                <CPill label="Capped" value={out.total_capped.toLocaleString()} color={C.yellow} />
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <CLabel>Per-column</CLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(out.outliers_detected).filter(([,v]) => v > 0).sort(([,a],[,b]) => b-a).map(([col, count]) => {
                    const bounds = out.bounds[col] || {};
                    const maxCount = Math.max(...Object.values(out.outliers_detected));
                    return (
                      <div key={col} style={{ background: '#0d0d1a', border: `1px solid ${C.border}`, borderRadius: 7, padding: '11px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontFamily: mono, fontSize: 10, color: C.text }}>{col}</span>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <span style={{ fontFamily: mono, fontSize: 9, color: C.red }}>{count} outliers</span>
                            {out.outliers_capped[col] > 0 && <span style={{ fontFamily: mono, fontSize: 9, color: C.yellow }}>{out.outliers_capped[col]} capped</span>}
                          </div>
                        </div>
                        <CProgressBar value={count / Math.max(maxCount, 1)} color={C.yellow} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: mono, fontSize: 8, color: C.muted }}>
                          <span>lower: <span style={{ color: C.cyan }}>{bounds.lower?.toFixed(2) ?? '—'}</span></span>
                          <span>upper: <span style={{ color: C.cyan }}>{bounds.upper?.toFixed(2) ?? '—'}</span></span>
                        </div>
                      </div>
                    );
                  })}
                  {Object.values(out.outliers_detected).every(v => v === 0) && <p style={{ fontFamily: body, fontSize: 12, color: C.green }}>✓ No outliers detected.</p>}
                </div>
              </div>
            </div>
          )}
          {sec === 'outliers' && !out && <p style={{ fontFamily: body, fontSize: 13, color: C.muted }}>Not run.</p>}

          {sec === 'types' && ti && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: C.card, border: `1px solid ${C.cyan}22`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>Conversions Applied ({Object.keys(ti.conversions_applied).length})</div>
                {Object.keys(ti.conversions_applied).length > 0
                  ? Object.entries(ti.conversions_applied).map(([col, conv]) => {
                    const [from, to] = conv.split(' → ');
                    return (
                      <div key={col} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#0d0d1a', borderRadius: 6, marginBottom: 5 }}>
                        <span style={{ fontFamily: mono, fontSize: 10, color: C.text }}>{col}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontFamily: mono, fontSize: 8, color: C.muted, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 3 }}>{from}</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                          <span style={{ fontFamily: mono, fontSize: 8, color: C.cyan, background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)', padding: '2px 6px', borderRadius: 3 }}>{to}</span>
                        </div>
                      </div>
                    );
                  })
                  : <p style={{ fontFamily: body, fontSize: 12, color: C.muted }}>No conversions needed.</p>
                }
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, maxHeight: 340, overflowY: 'auto' }}>
                <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 10 }}>Inferred Type Map</div>
                {Object.entries(ti.inferred_types).map(([col, type]) => (
                  <div key={col} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 5, background: '#0d0d1a', marginBottom: 4 }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: C.text }}>{col}</span>
                    <span style={{ fontFamily: mono, fontSize: 8, color: type === 'integer' ? C.cyan : type === 'float' ? C.purple : type === 'boolean' ? C.green : type === 'datetime' ? C.orange : type === 'categorical' ? C.yellow : C.muted }}>{type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sec === 'types' && !ti && <p style={{ fontFamily: body, fontSize: 13, color: C.muted }}>Not run.</p>}

        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const CleanTab = ({ uploadedFile, datasetName, cleaning }) => {
  const { status, progress, stage, report, downloadUrl, errorMessage, config, setConfig, cleanFromFile, reset } = cleaning;
  const isDemo = !uploadedFile;

  const handleRun = () => {
    if (!uploadedFile) return;
    cleanFromFile(uploadedFile);
  };

  // ── idle / config ──────────────────────────────────────────────────────────
  if (status === 'idle' || status === 'error') return (
    <div>
      {isDemo && (
        <div style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontFamily: body, fontSize: 13, color: C.yellow }}>
          ⚠ Demo mode — cleaning requires a real uploaded file. Upload a dataset from the landing page to enable cleaning.
        </div>
      )}
      {status === 'error' && (
        <div style={{ background: 'rgba(255,59,92,0.07)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontFamily: body, fontSize: 13, color: C.red }}>
          ✗ {errorMessage}
        </div>
      )}
      <CleanConfigGrid config={config} setConfig={setConfig} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={handleRun}
          disabled={isDemo}
          style={{
            fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: isDemo ? C.muted : '#fff',
            background: isDemo ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${C.orange}, ${C.purple})`,
            border: 'none', borderRadius: 9, padding: '12px 28px',
            cursor: isDemo ? 'not-allowed' : 'pointer',
            boxShadow: isDemo ? 'none' : `0 4px 20px ${C.orange}44`,
            transition: 'all 0.2s',
          }}
        >
          🧹 RUN CLEANING ON {datasetName ? `"${datasetName}"` : 'DATASET'}
        </button>
        {status === 'error' && (
          <button onClick={reset} style={{ fontFamily: mono, fontSize: 10, color: C.muted, border: `1px solid ${C.border}`, background: 'none', borderRadius: 7, padding: '8px 14px', cursor: 'pointer' }}>
            RESET
          </button>
        )}
      </div>
    </div>
  );

  // ── processing ─────────────────────────────────────────────────────────────
  if (status === 'processing') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 24 }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{ width: 64, height: 64, borderRadius: '50%', border: `2px solid rgba(255,255,255,0.05)`, borderTop: `2px solid ${C.orange}` }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 4 }}>Cleaning {datasetName}…</div>
        <div style={{ fontFamily: mono, fontSize: 9, color: C.muted, letterSpacing: '0.1em' }}>{stage}</div>
      </div>
      <div style={{ width: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 9, color: C.muted, marginBottom: 6 }}>
          <span>{stage}</span><span>{Math.round((progress || 0) * 100)}%</span>
        </div>
        <CProgressBar value={progress || 0} color={C.orange} />
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {[['TYPE INFERENCE', 0.15, C.cyan], ['DEDUPLICATION', 0.35, C.orange], ['IMPUTATION', 0.55, C.purple], ['OUTLIER CAP', 0.75, C.yellow]].map(([label, threshold, color]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: progress >= threshold ? color : C.dim, boxShadow: progress >= threshold ? `0 0 6px ${color}` : 'none', transition: 'all 0.5s' }} />
            <span style={{ fontFamily: mono, fontSize: 7, color: progress >= threshold ? color : C.dim, letterSpacing: '0.08em' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── complete ───────────────────────────────────────────────────────────────
  if (status === 'complete' && report) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 16, color: C.text }}>Cleaning Complete</span>
        </div>
        <button onClick={reset} style={{ fontFamily: mono, fontSize: 9, color: C.muted, border: `1px solid ${C.border}`, background: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', letterSpacing: '0.08em' }}>
          RE-RUN WITH NEW CONFIG
        </button>
      </div>
      <CleanResults report={report} downloadUrl={downloadUrl} fileName={datasetName} />
    </div>
  );

  return null;
};

// ── Dashboard ──────────────────────────────────────────────────────────────────
export const Dashboard = () => {
  const { results, status, datasetName, progress, stage, errorMessage, currentJobId, reset, uploadedFile } = useAnalysisStore();
  const cleaning = useCleaningStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => { if (status === 'idle') navigate('/'); }, [status, navigate]);

  // ── Error state ──────────────────────────────────────────────────────────────
  if (status === 'error') return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff3b5c" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      </div>
      <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: 18, color: '#f0f0f8' }}>Analysis Failed</div>
      <div style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 13, color: '#7a7a9a', maxWidth: 400, textAlign: 'center' }}>{errorMessage}</div>
      <button onClick={() => { reset(); navigate('/'); }}
        style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#ff6b2b', border: '1px solid rgba(255,107,43,0.3)', background: 'rgba(255,107,43,0.08)', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', letterSpacing: '0.08em' }}>
        ← TRY AGAIN
      </button>
    </div>
  );

  // ── Loading state ────────────────────────────────────────────────────────────
  if (status !== 'complete' || !results) return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <ForgeLoader />
      <div style={{ width: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', marginBottom: 8, letterSpacing: '0.08em' }}>
          <span>{stage || 'Initialising…'}</span>
          <span>{Math.round((progress || 0) * 100)}%</span>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
          <motion.div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #ff6b2b, #9b59f5)' }}
            animate={{ width: `${(progress || 0) * 100}%` }} transition={{ duration: 0.5 }} />
        </div>
        <div style={{ marginTop: 16, fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#3a3a5a', textAlign: 'center' }}>
          {datasetName && `Analysing: ${datasetName}`}
        </div>
      </div>
    </div>
  );

  // ── Report ───────────────────────────────────────────────────────────────────
  const r = results;
  const critCount = r.issues.filter(i => i.severity === 'CRITICAL').length;
  const warnCount = r.issues.filter(i => i.severity === 'WARNING').length;
  const infoCount = r.issues.filter(i => i.severity === 'INFO').length;
  const totalCount = Math.max(r.issues.length, 1);

  const noiseData = {
    outliers: r.noise_report.outlier_details.reduce((s, o) => s + o.outlier_count, 0),
    typeMismatch: Object.values(r.noise_report.formatting_errors).reduce((s, v) => s + v, 0),
    valueNoise: r.noise_report.total_missing_cells,
    structural: r.noise_report.constant_columns.length,
  };

  const imbalanceRatio = r.imbalance_report.imbalance_ratio;
  const imbalanceSev = imbalanceRatio >= 10 ? 'EXTREME' : imbalanceRatio >= 3 ? 'MODERATE' : imbalanceRatio >= 1.5 ? 'MILD' : 'BALANCED';

  const gradeColor = { A: '#00d97e', B: '#7dd87d', C: '#f5a623', D: '#ff6b2b', F: '#ff3b5c' };

  return (
    <div style={{ minHeight: '100vh', background: '#04040a' }}>

      {/* ── Topbar ── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ paddingTop: 28, paddingBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a', letterSpacing: '0.12em', marginBottom: 6 }}>
                JOB / {(currentJobId || '').slice(0, 12).toUpperCase()}
              </div>
              <h1 style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 800, fontSize: 26, color: '#f0f0f8', letterSpacing: '-0.02em' }}>
                {datasetName || 'Dataset'} <span style={{ color: '#5a5a7a', fontWeight: 400, fontSize: 20 }}>— Quality Report</span>
              </h1>
              <div style={{ marginTop: 6, display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a' }}>{r.dataset_info.rows.toLocaleString()} rows</span>
                <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a' }}>{r.dataset_info.columns} columns</span>
                <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#5a5a7a' }}>{r.dataset_info.size_mb.toFixed(2)} MB</span>
                <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#00d97e' }}>● COMPLETE</span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/report/${currentJobId || 'report'}`)}
              style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#ff6b2b', border: '1px solid rgba(255,107,43,0.3)', background: 'rgba(255,107,43,0.08)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              EXPORT PDF
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, marginTop: 24 }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: activeTab === tab ? '#f0f0f8' : '#5a5a7a',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 18px', position: 'relative',
                borderBottom: activeTab === tab ? '2px solid #ff6b2b' : '2px solid transparent',
                transition: 'color 0.2s',
              }}>
                <span style={{ marginRight: 6, opacity: 0.7 }}>{TAB_ICONS[tab]}</span>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px 80px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>

            {/* ── OVERVIEW ── */}
            {activeTab === 'Overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>

                {/* Left: Score + stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 28 }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.15em', marginBottom: 20 }}>DATASET QUALITY SCORE</div>
                    <ScoreRing value={r.overall_quality_score} size={160} stroke={10} label="" />
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 800, fontSize: 48, color: gradeColor[r.grade] || '#f5a623', lineHeight: 1 }}>{r.grade}</span>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#5a5a7a' }}>GRADE</span>
                    </div>
                  </Card>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Stat label="Rows" value={r.dataset_info.rows.toLocaleString()} />
                    <Stat label="Columns" value={r.dataset_info.columns} />
                    <Stat label="Issues" value={r.issues.length} color={r.issues.length > 5 ? '#ff3b5c' : '#f5a623'} />
                    <Stat label="Size" value={`${r.dataset_info.size_mb.toFixed(1)}MB`} />
                  </div>

                  {/* Issue severity bar */}
                  <Card style={{ padding: 20 }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.12em', marginBottom: 12 }}>SEVERITY BREAKDOWN</div>
                    <div style={{ height: 6, borderRadius: 99, overflow: 'hidden', display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)' }}>
                      <div style={{ width: `${critCount / totalCount * 100}%`, background: '#ff3b5c', transition: 'width 0.8s ease', borderRadius: '99px 0 0 99px' }} />
                      <div style={{ width: `${warnCount / totalCount * 100}%`, background: '#f5a623', transition: 'width 0.8s ease' }} />
                      <div style={{ width: `${infoCount / totalCount * 100}%`, background: '#9b59f5', transition: 'width 0.8s ease', borderRadius: '0 99px 99px 0' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                      {[['#ff3b5c', 'CRITICAL', critCount], ['#f5a623', 'WARN', warnCount], ['#9b59f5', 'INFO', infoCount]].map(([c, l, v]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a' }}>{l} ({v})</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Right: AI + dimensions + issues */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <AIInsightCard text={r.executive_summary} title="AI Executive Summary" />

                  {/* Dimension bars */}
                  <Card>
                    <SectionTitle>Quality Dimensions</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {Object.entries(r.dimension_scores).map(([k, v]) => {
                        const col = v >= 80 ? '#00d97e' : v >= 60 ? '#f5a623' : '#ff3b5c';
                        return (
                          <div key={k}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#7a7a9a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: col, fontWeight: 700 }}>{v.toFixed(0)}</span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                              <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                                style={{ height: '100%', borderRadius: 99, background: col, boxShadow: `0 0 8px ${col}66` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Top issues */}
                  <Card>
                    <SectionTitle accent="#ff3b5c">Top Issues</SectionTitle>
                    {r.issues.slice(0, 5).map(i => (
                      <IssueCard key={i.id} title={`${i.category.toUpperCase()} — ${i.column || 'dataset'}`} severity={i.severity} description={i.description} recommendation={i.recommendation} />
                    ))}
                    {r.issues.length === 0 && <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#5a5a7a' }}>No issues detected. 🎉</p>}
                  </Card>
                </div>
              </div>
            )}

            {/* ── BIAS ── */}
            {activeTab === 'Bias' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <Card>
                  <SectionTitle accent="#9b59f5">Fairness Radar</SectionTitle>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.1em', marginBottom: 12 }}>
                    CLICK ANY AXIS LABEL TO LEARN WHAT IT MEASURES
                  </div>
                  <BiasRadar
                    biasDetails={r.bias_report.details}
                    fairnessMetrics={r.bias_report.fairness_metrics}
                  />
                </Card>
                <Card><SectionTitle accent="#f5a623">Column Correlations</SectionTitle><CorrelationHeatmap /></Card>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Card>
                    <SectionTitle accent="#9b59f5">Bias Flags</SectionTitle>
                    {r.issues.filter(i => i.category === 'bias').length === 0
                      ? <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#5a5a7a' }}>No bias issues detected.</p>
                      : r.issues.filter(i => i.category === 'bias').map(i => (
                        <IssueCard key={i.id} title={`Bias — ${i.column || 'dataset'}`} severity={i.severity} description={i.description} recommendation={i.recommendation} />
                      ))
                    }
                  </Card>
                </div>
              </div>
            )}

            {/* ── NOISE ── */}
            {activeTab === 'Noise' && (
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Card><SectionTitle accent="#ff6b2b">Noise Breakdown</SectionTitle><NoiseDonut data={noiseData} />
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[['#ff6b2b', 'Outliers', noiseData.outliers], ['#f5a623', 'Formatting', noiseData.typeMismatch], ['#9b59f5', 'Missing Cells', noiseData.valueNoise], ['#5a5a7a', 'Constant Cols', noiseData.structural]].map(([c, l, v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: c }}>{l}</span>
                          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#f0f0f8' }}>{v.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Card>
                    <SectionTitle>Outlier Distribution</SectionTitle>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.1em', marginBottom: 4 }}>
                      IQR METHOD — VALUES OUTSIDE 1.5× INTERQUARTILE RANGE
                    </div>
                    <OutlierBoxPlot outlierDetails={r.noise_report.outlier_details} />
                  </Card>
                  <Card>
                    <SectionTitle accent="#ff3b5c">Noise Issues</SectionTitle>
                    {r.issues.filter(i => i.category === 'noise').map(i => (
                      <IssueCard key={i.id} title={`Noise — ${i.column || 'dataset'}`} severity={i.severity} description={i.description} recommendation={i.recommendation} />
                    ))}
                  </Card>
                </div>
              </div>
            )}

            {/* ── DUPLICATES ── */}
            {activeTab === 'Duplicates' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <SectionTitle accent="#00d97e">Duplicate Clusters</SectionTitle>
                  <DuplicateGraph />
                  <div style={{ marginTop: 12, fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.1em' }}>D3 FORCE-DIRECTED GRAPH</div>
                </Card>
                <Card>
                  <SectionTitle>Duplicate Report</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Exact Duplicate Rows', value: r.duplicate_report.exact_duplicate_rows, pct: `${(r.duplicate_report.exact_duplicate_fraction * 100).toFixed(1)}% of data`, color: r.duplicate_report.exact_duplicate_rows > 0 ? '#f5a623' : '#00d97e' },
                      { label: 'Near-Duplicate Pairs', value: r.duplicate_report.near_duplicate_pairs, pct: 'fuzzy matched', color: '#9b59f5' },
                      { label: 'Redundant Columns', value: r.duplicate_report.duplicate_columns.length, pct: r.duplicate_report.duplicate_columns.join(', ') || 'none', color: '#5a5a7a' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '14px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#7a7a9a', letterSpacing: '0.08em' }}>{s.label}</span>
                          <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 20, color: s.color }}>{s.value}</span>
                        </div>
                        <div style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 11, color: '#5a5a7a', marginTop: 4 }}>{s.pct}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20 }}>
                    {r.issues.filter(i => i.category === 'duplicate').map(i => (
                      <IssueCard key={i.id} title={`Duplicate — ${i.column || 'dataset'}`} severity={i.severity} description={i.description} recommendation={i.recommendation} />
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── IMBALANCE ── */}
            {activeTab === 'Imbalance' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 3, height: 18, borderRadius: 2, background: '#ff6b2b' }} />
                      <h3 style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: 16, color: '#f0f0f8' }}>Class Distribution</h3>
                    </div>
                    <SeverityBadge level={imbalanceSev} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    {[
                      { label: 'Target', value: r.imbalance_report.target_column || 'N/A' },
                      { label: 'Ratio', value: `${r.imbalance_report.imbalance_ratio.toFixed(1)}:1`, color: '#f5a623' },
                      { label: 'Balanced', value: r.imbalance_report.is_imbalanced ? 'No' : 'Yes', color: r.imbalance_report.is_imbalanced ? '#ff3b5c' : '#00d97e' },
                    ].map(s => <Stat key={s.label} label={s.label} value={s.value} color={s.color} />)}
                  </div>
                  <ImbalanceBar
                      classDistribution={r.imbalance_report.class_distribution}
                      imbalanceRatio={r.imbalance_report.imbalance_ratio}
                      targetColumn={r.imbalance_report.target_column}
                    />
                </Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <AIInsightCard title="Rebalancing Strategy" text={r.imbalance_report.recommended_strategy} />
                  {r.issues.filter(i => i.category === 'imbalance').map(i => (
                    <IssueCard key={i.id} title={`Imbalance — ${i.column || r.imbalance_report.target_column || 'target'}`} severity={i.severity} description={i.description} recommendation={i.recommendation} />
                  ))}
                </div>
              </div>
            )}

            {/* ── CLEAN ── */}
            {activeTab === 'Clean' && (
              <CleanTab
                uploadedFile={uploadedFile}
                datasetName={datasetName}
                cleaning={cleaning}
              />
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};