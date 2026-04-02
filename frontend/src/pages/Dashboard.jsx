import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnalysisStore } from '../store/analysisStore';
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

const TABS = ['Overview', 'Bias', 'Noise', 'Duplicates', 'Imbalance'];

const TAB_ICONS = {
  Overview: '◈', Bias: '⚖', Noise: '〰', Duplicates: '⧉', Imbalance: '⚡',
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

export const Dashboard = () => {
  const { results, status, datasetName, progress, stage, errorMessage, currentJobId, reset } = useAnalysisStore();
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
                <Card><SectionTitle accent="#9b59f5">Fairness Radar</SectionTitle><BiasRadar /></Card>
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
                  <Card><SectionTitle>Outlier Distribution (IQR)</SectionTitle><OutlierBoxPlot /></Card>
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
                  <ImbalanceBar />
                </Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <AIInsightCard title="Rebalancing Strategy" text={r.imbalance_report.recommended_strategy} />
                  {r.issues.filter(i => i.category === 'imbalance').map(i => (
                    <IssueCard key={i.id} title={`Imbalance — ${i.column || r.imbalance_report.target_column || 'target'}`} severity={i.severity} description={i.description} recommendation={i.recommendation} />
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
